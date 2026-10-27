import React from "react";
import { ApiError } from "@/services/api-client";
import { getSupportApp, getSupportHistory, listSupportApps, listSupportTabs, mergeSamples, parseFrame, supportRequest, supportSocketUrl } from "@/services/support-client";
import type { AppDetail, History, SupportApp, SupportFrame, SupportTab } from "@/types/support";

export function useSupport(token: string | null, selectedId: string | null) {
  const [tabs, setTabs] = React.useState<SupportTab[]>([]);
  const [apps, setApps] = React.useState<SupportApp[]>([]);
  const [detail, setDetail] = React.useState<AppDetail | null>(null);
  const [history, setHistory] = React.useState<Record<string, History>>({});
  const [connection, setConnection] = React.useState("connecting");
  const [error, setError] = React.useState<string | null>(null);
  const [liveError, setLiveError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasSnapshot, setHasSnapshot] = React.useState(false);
  const reload = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    if (!token) return;
    let stopped = false;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    let handshake: ReturnType<typeof setTimeout> | undefined;
    let loading = false;
    let dirty = false;
    let buffered: SupportFrame[] = [];
    let attempts = 0;
    let generation = 0;
    let ready = false;
    const controller = new AbortController();
    const apply = (frame: SupportFrame) => {
      if (frame.type === "state") {
        setApps((current) => current.map((app) => app.id === frame.app.id ? frame.app : app));
        setDetail((current) => current?.app.id === frame.app.id ? { ...current, app: frame.app } : current);
      }
      if (frame.type === "samples" && frame.app_id === selectedId) setHistory((current) => {
        const next: Record<string, History> = Object.assign(Object.create(null), current);
        for (const stream of new Set(frame.samples.map((sample) => sample.stream))) {
          const page = next[stream] ?? { samples: [], next_before: null };
          const incoming = frame.samples.filter((sample) => sample.stream === stream);
          const merged = mergeSamples(page.samples, incoming);
          next[stream] = { samples: merged, next_before: page.samples.length + incoming.length > merged.length ? merged[0]?.id ?? null : page.next_before };
        }
        return next;
      });
      if (frame.type === "changed") schedule();
    };
    const snapshot = async () => {
      if (loading) { dirty = true; return; }
      loading = true;
      const started = generation;
      try {
        const [nextTabs, nextApps, nextDetail] = await Promise.all([listSupportTabs(token, controller.signal), listSupportApps(token, controller.signal), selectedId ? getSupportApp(token, selectedId, controller.signal).catch((err) => { if (err instanceof ApiError && err.status === 404) return null; throw err; }) : Promise.resolve(null)]);
        const pages = nextDetail ? await Promise.all(nextDetail.streams.map(async (stream) => [stream.name, await getSupportHistory(token, nextDetail.app.id, stream.name, undefined, controller.signal)] as const)) : [];
        if (stopped || started !== generation) return;
        setTabs(nextTabs); setApps(nextApps); setDetail(nextDetail); setHistory(Object.fromEntries(pages)); setError(null); setHasSnapshot(true);
        if (ready) { setConnection("live"); setLiveError(null); attempts = 0; }
      } catch (err) {
        if (!stopped && started === generation) setError(err instanceof Error ? err.message : "Unable to load Support.");
      } finally {
        loading = false;
        if (!stopped) setIsLoading(false);
        if (!stopped) { const pending = buffered; buffered = []; pending.forEach(apply); if (dirty) { dirty = false; schedule(); } }
      }
    };
    const schedule = () => { if (!scheduled && !stopped) scheduled = setTimeout(() => { scheduled = undefined; void snapshot(); }, 100); };
    reload.current = schedule;
    const connect = async () => {
      setConnection(attempts ? "reconnecting" : "connecting");
      try {
        const { ticket } = await supportRequest<{ ticket: string }>(token, "/ws-ticket", "POST", undefined, controller.signal);
        if (stopped) return;
        socket = new WebSocket(supportSocketUrl(ticket));
        handshake = setTimeout(() => { setLiveError("Live updates could not connect. Saved data and management are still available."); socket?.close(); }, 15000);
        socket.onmessage = (event) => {
          try {
            const frame = parseFrame(String(event.data));
            if (frame.type === "ready") { ready = true; clearTimeout(handshake); setHistory({}); void snapshot(); }
            else if (loading) { if (buffered.length >= 64) { buffered = []; socket?.close(); } else buffered.push(frame); }
            else apply(frame);
          } catch (err) { setLiveError((err as Error).message); socket?.close(); }
        };
        socket.onerror = () => setLiveError("Live updates are interrupted. Saved data and management are still available.");
        socket.onclose = () => { ready = false; clearTimeout(handshake); generation++; buffered = []; if (loading) dirty = true; if (!stopped) { setConnection("reconnecting"); retry = setTimeout(() => { void connect(); }, Math.min(30000, 1000 * 2 ** attempts++)); } };
      } catch (err) {
        if (stopped) return;
        setLiveError(err instanceof Error ? err.message : "Unable to connect live updates."); setConnection("disconnected");
        if (!(err instanceof ApiError && [401, 403].includes(err.status))) retry = setTimeout(() => { void connect(); }, Math.min(30000, 1000 * 2 ** attempts++));
      }
    };
    setDetail(null); setHistory({}); setIsLoading(true); setError(null); void snapshot(); void connect();
    return () => { stopped = true; controller.abort(); clearTimeout(retry); clearTimeout(scheduled); clearTimeout(handshake); socket?.close(); reload.current = () => {}; };
  }, [token, selectedId]);
  return { tabs, apps, detail, history, setHistory, connection, error, liveError, isLoading, hasSnapshot, refresh: () => reload.current() };
}
