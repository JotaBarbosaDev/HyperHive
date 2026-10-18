import React from "react";
import { getCelldMetrics, getCelldObservations } from "@/services/celld";
import type {
  CelldMetrics,
  CelldObservationPage,
  CelldObservationQuery,
} from "@/types/celld";
import { mergeObservations } from "@/components/celld/observability";
import { streamCelldObservations, CelldStreamUnsupported, CelldStreamGap } from "@/services/celld-stream";
import { ApiError } from "@/services/api-client";
import { MAX_WINDOW_MS } from "@/components/celld/operations-query";

// A session owns its fixed query and cursor. Cleanup invalidates pending results.
export function useCelldObservations(
  token: string,
  fleetId: string,
  kind: "logs" | "events" | "trace" | "metrics",
  query: CelldObservationQuery,
  follow: boolean,
  traceId?: string,
) {
  const [page, setPage] = React.useState<CelldObservationPage | null>(null);
  const [requests, setRequests] = React.useState<
    CelldMetrics["requests"] | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const moreRef = React.useRef<() => void>(() => {});
  const reloadRef = React.useRef<() => void>(() => {});
  const followRef = React.useRef(follow);
  followRef.current = follow;
  const key = JSON.stringify(query);
  const sinceRef = React.useRef(Math.min(query.to, Date.now()));
  const liveToRef = React.useRef(query.to);
  const transportRef = React.useRef("streaming");
  const [transport, setTransport] = React.useState("paused");
  const [streamError, setStreamError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let active = true,
      inFlight = false;
    let controller: AbortController | undefined;
    let currentQuery = { ...query },
      cursor: string | undefined;
    let lastTo = query.to;
    sinceRef.current = Math.min(query.to, Date.now());
    liveToRef.current = query.to;
    setPage(null);
    setRequests(null);
    setError(null);
    setBusy(false);
    moreRef.current = () => {};
    reloadRef.current = () => {};
    // An empty trace explorer is an input state, not an invalid API request.
    if (kind === "trace" && !/^[a-f0-9]{32}$/.test(traceId ?? "")) return;
    const load = async (mode: "initial" | "next" | "tick" | "reload") => {
      if (!active || inFlight || (mode === "next" && !cursor)) return;
      const reset = mode === "reload";
      let requestQuery = currentQuery;
      if (reset) {
        const to = Math.max(query.to, lastTo, liveToRef.current);
        requestQuery = {
          ...query,
          from: Math.max(query.from, to - MAX_WINDOW_MS),
          to,
        };
      } else if (mode === "tick" && !cursor) {
        // Resume includes time since the last successful response, even after a pause.
        const to = Date.now();
        if (to <= lastTo) return;
        requestQuery = {
          ...query,
          from: Math.max(query.from, lastTo - 30000, to - MAX_WINDOW_MS),
          to,
        };
      }
      const nextCursor =
        mode === "next" || mode === "tick" ? cursor : undefined;
      inFlight = true;
      setBusy(true);
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 20000);
      try {
        const q = { ...requestQuery, cursor: nextCursor };
        const result =
          kind === "metrics"
            ? await getCelldMetrics(token, fleetId, q, request.signal)
            : await getCelldObservations(
                token,
                fleetId,
                kind,
                q,
                request.signal,
                traceId,
              );
        if (!active) return;
        const incoming = "samples" in result ? result.samples : result;
        if ("samples" in result) setRequests(result.requests);
        currentQuery = {
          ...requestQuery,
          from: incoming.from,
          to: incoming.to,
        };
        cursor = incoming.next_cursor;
        lastTo = incoming.to;
        const keepLive = reset && followRef.current && (kind === "logs" || kind === "events") && transportRef.current !== "polling";
        setPage((old) => ({
          ...incoming,
          from:
            reset || !old ? incoming.from : Math.min(old.from, incoming.from),
          to: reset && !keepLive || !old ? incoming.to : Math.max(old.to, incoming.to),
          records: mergeObservations(
            reset && !keepLive ? [] : (old?.records ?? []),
            incoming.records,
          ),
          incomplete: reset
            ? incoming.incomplete
            : old?.incomplete || incoming.incomplete,
        }));
        setError(null);
      } catch (err) {
        if (active)
          setError(
            request.signal.aborted
              ? "The request timed out. Any previous observations are retained."
              : err instanceof Error
                ? err.message
                : "Unable to load observations.",
          );
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        if (active) setBusy(false);
      }
    };
    moreRef.current = () => {
      void load("next");
    };
    reloadRef.current = () => {
      void load("reload");
    };
    void load("initial");
    const timer = setInterval(() => {
      if (followRef.current && (kind === "metrics" || kind === "trace" || transportRef.current === "polling")) void load("tick");
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
      controller?.abort();
      moreRef.current = () => {};
      reloadRef.current = () => {};
    };
    // Query is represented by its stable serialized value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fleetId, kind, key, traceId]);
  React.useEffect(() => {
    setStreamError(null);
    if (!follow || (kind !== "logs" && kind !== "events")) {
      setTransport(follow ? "polling" : "paused");
      return;
    }
    let active = true;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    let delay = 1000;
    transportRef.current = "streaming";
    setTransport("connecting");
    const connect = async () => {
      if (!active) return;
      request = new AbortController();
      try {
        await streamCelldObservations(token, fleetId, kind, query,
          Math.max(sinceRef.current, Date.now() - MAX_WINDOW_MS), request.signal,
          (incoming, checkpoint) => {
            if (!active) return;
            if (checkpoint !== undefined) sinceRef.current = Math.max(sinceRef.current, checkpoint);
            liveToRef.current = Math.max(liveToRef.current, incoming.to);
            setPage(old => ({
              ...incoming,
              from: old?.from ?? query.from,
              to: Math.max(old?.to ?? query.to, incoming.to),
              next_cursor: old?.next_cursor,
              records: mergeObservations(old?.records ?? [], incoming.records),
            }));
          },
          () => {
            if (!active) return;
            delay = 1000;
            setTransport("streaming");
            setStreamError(null);
          });
      } catch (err) {
        if (!active) return;
        if (err instanceof CelldStreamUnsupported) {
          transportRef.current = "polling";
          setTransport("polling");
          setStreamError(null);
          return;
        }
        if (err instanceof CelldStreamGap || err instanceof ApiError && [400, 401, 403].includes(err.status)) {
          setStreamError(err instanceof Error ? err.message : "Live stream stopped.");
          setTransport("paused");
          sinceRef.current = Date.now();
          return;
        }
        setTransport("reconnecting");
        setStreamError("Live connection interrupted. Reconnecting; existing messages are retained.");
      }
      if (active) {
        reconnect = setTimeout(() => { void connect(); }, delay);
        delay = Math.min(delay * 2, 15000);
      }
    };
    void connect();
    return () => {
      active = false;
      request?.abort();
      clearTimeout(reconnect);
    };
  }, [token, fleetId, kind, key, follow]);
  const more = React.useCallback(() => moreRef.current(), []);
  const reload = React.useCallback(() => reloadRef.current(), []);
  return { page, requests, error: error ?? streamError, busy, more, reload, transport };
}
