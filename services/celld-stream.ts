import { getApiBaseUrl } from "@/config/apiConfig";
import { ApiError, triggerUnauthorized } from "./api-client";
import { observationQuery, parseObservationPage } from "./celld";
import type { CelldObservationPage, CelldObservationQuery } from "@/types/celld";

export class CelldStreamUnsupported extends Error {}
export class CelldStreamGap extends Error {}

// Fetch keeps authentication in headers, unlike native EventSource. The reader
// decodes fragmented UTF-8/SSE frames and never buffers an unbounded response.
export async function streamCelldObservations(
  token: string,
  fleetId: string,
  kind: "logs" | "events",
  query: CelldObservationQuery,
  since: number,
  signal: AbortSignal,
  onPage: (page: CelldObservationPage, checkpoint?: number) => void,
  onOpen: () => void,
) {
  if (typeof TextDecoder === "undefined") throw new CelldStreamUnsupported("Streaming is unavailable in this client.");
  const base = getApiBaseUrl();
  if (!base) throw new Error("API base URL is missing.");
  const { cursor, ...filters } = query;
  const params = observationQuery(filters) + "&since=" + encodeURIComponent(since);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort);
  if (signal.aborted) abort();
  let timeout = setTimeout(abort, 10000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/celld/fleets/${encodeURIComponent(fleetId)}/${kind}/stream?${params}`, {
      headers: { Accept: "text/event-stream", Authorization: /^Bearer\s/i.test(token) ? token : `Bearer ${token}` },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if ([404, 405, 501].includes(response.status)) throw new CelldStreamUnsupported("This API does not support live log streams.");
    if (!response.ok) {
      if (response.status === 401) triggerUnauthorized();
      throw new ApiError(response.status === 401 ? "Session expired" : "Unable to connect to the live log stream.", response.status, null);
    }
    if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body?.getReader) {
      throw new CelldStreamUnsupported("This client or proxy does not support streaming responses.");
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!signal.aborted) {
      timeout = setTimeout(abort, 45000);
      const { value, done } = await reader.read();
      clearTimeout(timeout);
      if (done) throw new Error("Live connection closed.");
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 1048576) throw new Error("Live stream frame exceeds the size limit.");
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        let event = "message";
        const data: string[] = [];
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
        }
        if (!data.length) continue;
        const payload = JSON.parse(data.join("\n"));
        if (event === "ready") onOpen();
        else if (event === "history") onPage(parseObservationPage(payload));
        else if (event === "caught_up") {
          if (!Number.isSafeInteger(payload.received_ms)) throw new Error("Invalid stream checkpoint.");
          onPage(parseObservationPage({ records: [], from: payload.from, to: payload.to }), payload.received_ms);
        }
        else if (event === "observations") {
          const page = parseObservationPage(payload);
          const received = page.records.map(row => row.received_ms).filter((ms): ms is number => ms !== undefined);
          onPage(page, received.length ? Math.max(...received) : undefined);
        }
        else if (event === "gap") throw new CelldStreamGap(payload.error ?? "Live history has a gap. Reload the window.");
        else if (event === "reconnect") throw new Error(payload.error ?? "Reconnecting live logs.");
      }
    }
  } finally {
    clearTimeout(timeout);
    controller.abort();
    signal.removeEventListener("abort", abort);
    try { await reader?.cancel(); } catch { /* Request was already aborted. */ }
    reader?.releaseLock();
  }
}
