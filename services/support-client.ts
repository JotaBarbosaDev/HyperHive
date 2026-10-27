import { apiFetch } from "./api-client";
import { getApiBaseUrl } from "@/config/apiConfig";
import type { AppDetail, AppInput, History, Sample, Severity, StreamType, SupportApp, SupportFrame, SupportLayout, SupportTab, WidgetKind } from "@/types/support";

export const SUPPORT_BUFFER_LIMIT = 1000;
export const compatibleWidgets: Record<StreamType, WidgetKind[]> = { number: ["value", "line", "area", "bar", "sparkline", "gauge", "progress", "table"], text: ["value", "text", "table"], boolean: ["value", "boolean", "table"], log: ["logs", "table"], event: ["events", "table"] };
export const widgetLabels: Record<WidgetKind, string> = { value: "Latest value", line: "Line chart", area: "Area chart", bar: "Bar chart", sparkline: "Sparkline", gauge: "Gauge", progress: "Progress", text: "Text", boolean: "Status", logs: "Log feed", events: "Event feed", table: "Sample table" };
export const trendWidgets: WidgetKind[] = ["line", "area", "bar", "sparkline"];
export function parseHistory(value: unknown): History {
  const page = value as History;
  if (!page || !Array.isArray(page.samples) || page.samples.length > 1000 || !(page.next_before === null || Number.isSafeInteger(page.next_before)) || page.samples.some((sample) => !Number.isSafeInteger(sample.id) || typeof sample.stream !== "string" || typeof sample.received_at !== "string" || Number.isNaN(Date.parse(sample.received_at)))) throw new Error("Invalid Support history response.");
  return page;
}
export function mergeSamples(previous: Sample[], incoming: Sample[], limit = SUPPORT_BUFFER_LIMIT): Sample[] {
  return [...new Map([...previous, ...incoming].map((sample) => [sample.id, sample])).values()].sort((first, second) => first.id - second.id).slice(-limit);
}
export function parseFrame(raw: string): SupportFrame {
  if (raw.length > 8 * 1024 * 1024) throw new Error("Support live frame exceeds the size limit.");
  const frame = JSON.parse(raw);
  if (!frame || !["ready", "changed", "state", "samples"].includes(frame.type)) throw new Error("Invalid Support live frame.");
  if (frame.type === "samples" && (typeof frame.app_id !== "string" || !Array.isArray(frame.samples) || frame.samples.length > 1000 || frame.samples.some((sample: Sample) => !Number.isSafeInteger(sample.id) || typeof sample.stream !== "string" || typeof sample.received_at !== "string"))) throw new Error("Invalid Support samples.");
  if (frame.type === "state" && (!frame.app || typeof frame.app.id !== "string" || !Array.isArray(frame.app.instances))) throw new Error("Invalid Support state.");
  return frame;
}
export function supportSocketUrl(ticket: string) {
  const base = getApiBaseUrl();
  if (!base) throw new Error("API base URL is missing.");
  const url = new URL(base.replace(/\/$/, "") + "/support/ws");
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("ticket", ticket);
  return url.toString();
}
export async function supportRequest<T>(token: string, path: string, method = "GET", body?: unknown, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, 20000);
  try { return await apiFetch<T>("/support" + path, { token: /^Bearer\s/i.test(token) ? token : "Bearer " + token, method, body, signal: controller.signal, reportResult: false, handledErrorStatuses: [409] }); }
  catch (err) { if (controller.signal.aborted && !signal?.aborted) throw new Error("Support request timed out. Check the saved state before repeating a change."); throw err; }
  finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
}
export const listSupportTabs = (token: string, signal?: AbortSignal) => supportRequest<SupportTab[]>(token, "/tabs", "GET", undefined, signal);
export const listSupportApps = (token: string, signal?: AbortSignal) => supportRequest<SupportApp[]>(token, "/apps", "GET", undefined, signal);
export const getSupportApp = (token: string, id: string, signal?: AbortSignal) => supportRequest<AppDetail>(token, "/apps/" + encodeURIComponent(id), "GET", undefined, signal);
export const saveSupportApp = (token: string, input: AppInput, id?: string) => id ? supportRequest<SupportApp>(token, "/apps/" + encodeURIComponent(id), "PUT", input) : supportRequest<{ app: SupportApp; secret: string }>(token, "/apps", "POST", input);
export const saveSupportLayout = (token: string, id: string, layout: SupportLayout) => supportRequest<SupportLayout>(token, "/apps/" + encodeURIComponent(id) + "/layout", "PUT", layout);
export const getSupportHistory = async (token: string, id: string, stream: string, before?: number, signal?: AbortSignal, filters?: { severity?: Severity[] }) => {
  const query = new URLSearchParams({ stream, limit: "200" });
  if (before !== undefined) query.set("before", String(before));
  if (filters?.severity?.length) query.set("severity", filters.severity.join(","));
  return parseHistory(await supportRequest<History>(token, "/apps/" + encodeURIComponent(id) + "/samples?" + query, "GET", undefined, signal));
};
