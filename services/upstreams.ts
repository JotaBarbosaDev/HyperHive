import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {apiFetch, ApiError, setAuthToken, triggerUnauthorized, ApiRequestOptions} from "./api-client";
import {loadApiBaseUrl, loadAuthToken} from "./auth-storage";
import {Upstream, UpstreamCapabilities, UpstreamPayload} from "@/types/upstream";

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!getApiBaseUrl()) setApiBaseUrl(await loadApiBaseUrl());
  if (!getApiBaseUrl()) throw new Error("Configure the API by signing in again.");
  const token = await loadAuthToken();
  if (!token) {setAuthToken(null); triggerUnauthorized(); throw new Error("Sign in to manage upstreams.");}
  setAuthToken(token);
  return apiFetch<T>(path, {...options, token});
}
// Bound the entire read, including auth storage and response parsing. A stalled
// capability endpoint must not leave every target selector loading indefinitely.
async function readUpstream<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => {controller.abort(); reject(new Error("Pool loading was cancelled."));};
    if (signal?.aborted) {onAbort(); return;}
    signal?.addEventListener("abort", onAbort, {once: true});
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Pool loading timed out. Retry or use a direct host and port."));
    }, 20000);
  });
  try {return await Promise.race([interrupted, request<T>(path, {signal: controller.signal})]);}
  finally {
    if (timer) clearTimeout(timer);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  }
}
export const listUpstreams = (signal?: AbortSignal) => readUpstream<Upstream[]>("/upstream/list", signal);
export const getUpstreamCapabilities = (signal?: AbortSignal) => readUpstream<UpstreamCapabilities>("/upstream/capabilities", signal);
export const createUpstream = (payload: UpstreamPayload) => request<Upstream>("/upstream/create", {method: "POST", body: payload});
export const updateUpstream = (id: number, payload: UpstreamPayload) => request<Upstream>(`/upstream/${id}`, {method: "PUT", body: payload});
export const deleteUpstream = (id: number, revision: number) => request<void>(`/upstream/${id}`, {method: "DELETE", headers: {"If-Match": `"${revision}"`}});
export function upstreamErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.data && typeof error.data === "object" && "error" in error.data) {
    const data = error.data as {error: unknown; recovery_id?: number};
    const message = String(data.error).replaceAll("_", " ");
    return data.recovery_id ? `${message}. Recovery operation: ${data.recovery_id}.` : message;
  }
  return error instanceof Error ? error.message : "Unable to manage upstreams.";
}
