import { apiFetch, ApiError } from "./api-client";
import type { CelldAction, CelldCredentials, CelldFleet, CelldFleetHealth, CelldFleetInput, CelldFleetList } from "@/types/celld";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const optionalError = (value: Record<string, unknown>) => value.error === undefined || typeof value.error === "string";
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const ports = (value: unknown) => isRecord(value) && Number.isInteger(value.http) && Number.isInteger(value.internal);
const machine = (value: unknown) => isRecord(value) && typeof value.name === "string" &&
  (value.ip === undefined || typeof value.ip === "string") && typeof value.connected === "boolean" && typeof value.healthy === "boolean" && optionalError(value);
const statuses = new Set(["provisioning", "running", "stopped", "degraded", "deleting", "error"]);

function parseFleet(value: unknown): CelldFleet {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string" ||
    !["running", "stopped", "deleting"].includes(value.desired_state as string) || !statuses.has(value.status as string) ||
    !Array.isArray(value.servers) || !value.servers.every(machine) || !ports(value.ports) || !strings(value.urls) ||
    !isRecord(value.storage) || ![value.storage.bucket, value.storage.endpoint, value.storage.region].every((v) => typeof v === "string") ||
    !isRecord(value.deploy) || typeof value.deploy.command !== "string" || !strings(value.deploy.environment) ||
    typeof value.checked_at !== "string" || !optionalError(value)) {
    throw new Error("The API returned an invalid fleet response.");
  }
  return value as CelldFleet;
}

async function request<T>(path: string, token: string, method = "GET", body?: unknown, signal?: AbortSignal, acceptedStatuses?: number[]): Promise<T> {
  try {
    return await apiFetch<T>(path, { token: /^Bearer\s/i.test(token) ? token : "Bearer " + token, method, body, signal, acceptedStatuses, handledErrorStatuses: [400, 409], reportResult: false });
  } catch (error) {
    if (error instanceof ApiError && isRecord(error.data) && typeof error.data.error === "string") {
      throw new ApiError(error.data.error, error.status, error.data);
    }
    throw error;
  }
}

export async function fetchCelldHealth(token: string, signal?: AbortSignal): Promise<CelldFleetHealth> {
  const value = await request<unknown>("/celld/health", token, "GET", undefined, signal, [503]);
  if (!isRecord(value) || typeof value.healthy !== "boolean" || !isRecord(value.storage) ||
    typeof value.storage.healthy !== "boolean" || !optionalError(value.storage) || !Array.isArray(value.machines) || !value.machines.every(machine)) {
    throw new Error("The API returned an invalid health response.");
  }
  return value as CelldFleetHealth;
}

export async function fetchCelldFleets(token: string, signal?: AbortSignal): Promise<CelldFleetList> {
  let value: unknown;
  try { value = await request<unknown>("/celld/fleets", token, "GET", undefined, signal); }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new Error("Fleet management is unavailable on this API. Update the master to enable the new fleet endpoints.");
    throw error;
  }
  if (!isRecord(value) || !Array.isArray(value.fleets) || !isRecord(value.storage) ||
    typeof value.storage.healthy !== "boolean" || !optionalError(value.storage) || !optionalError(value) ||
    !(value.storage.bucket_count === null || (Number.isInteger(value.storage.bucket_count) && (value.storage.bucket_count as number) >= 0)) ||
    !(value.storage.buckets === null || strings(value.storage.buckets)) || typeof value.storage.managed_bucket_count !== "number" ||
    typeof value.storage.checked_at !== "string" || typeof value.reset_pending !== "boolean") {
    throw new Error("The API returned an invalid fleet list.");
  }
  value.fleets.forEach(parseFleet);
  return value as CelldFleetList;
}
const fleetPath = (id: string) => "/celld/fleets/" + encodeURIComponent(id);
export async function getCelldFleet(token: string, id: string, signal?: AbortSignal) {
  return parseFleet(await request(fleetPath(id), token, "GET", undefined, signal));
}
export async function saveCelldFleet(token: string, input: CelldFleetInput, id?: string, signal?: AbortSignal) {
  return parseFleet(await request(id ? fleetPath(id) : "/celld/fleets", token, id ? "PATCH" : "POST", input, signal));
}
export async function runCelldAction(token: string, id: string, action: CelldAction, signal?: AbortSignal) {
  return parseFleet(await request(fleetPath(id) + (action === "delete" ? "" : "/" + action), token, action === "delete" ? "DELETE" : "POST", undefined, signal));
}
export async function getCelldCredentials(token: string, id: string, signal?: AbortSignal): Promise<CelldCredentials> {
  const value = await request<unknown>(fleetPath(id) + "/credentials", token, "GET", undefined, signal);
  if (!isRecord(value) || typeof value.aws_access_key_id !== "string" || typeof value.aws_secret_access_key !== "string") throw new Error("The API returned invalid fleet credentials.");
  return value as CelldCredentials;
}

export function observationQuery(query: import("@/types/celld").CelldObservationQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
  return params.toString();
}
const optionalList = (value: unknown, check: (row: unknown) => boolean) => value == null || (Array.isArray(value) && value.every(check));
const numericFields = (value: Record<string, unknown>, keys: string[]) => keys.every((key) => value[key] === undefined || (typeof value[key] === "number" && Number.isFinite(value[key])));
const workloadSample = (value: unknown) => isRecord(value) && numericFields(value, ["live", "retiring", "heap_bytes", "memory_bytes", "cpu_percent", "cells", "requests", "limit"]);
const snapshotSample = (value: unknown) => isRecord(value) && numericFields(value, ["collected_ms", "attempted_ms", "dropped"]) && (value.resources == null || (isRecord(value.resources) && numericFields(value.resources, ["sampled_ms", "cpu_percent_x100", "rss_bytes", "owned_cells", "resident_cells"]))) && optionalList(value.workloads, workloadSample) && optionalList(value.capabilities, (cap) => isRecord(cap) && typeof cap.name === "string" && typeof cap.state === "string");
export function parseObservationPage(value: unknown): import("@/types/celld").CelldObservationPage {
  if (!isRecord(value) || !Array.isArray(value.records) || !value.records.every((row) => isRecord(row) && typeof row.id === "string" && numericFields(row, ["received_ms"]) && (row.record === undefined || (isRecord(row.record) && numericFields(row.record, ["time_ms", "duration_us", "sequence"]))) && (row.snapshot === undefined || snapshotSample(row.snapshot))) || typeof value.from !== "number" || !Number.isFinite(value.from) || typeof value.to !== "number" || !Number.isFinite(value.to) || (value.next_cursor !== undefined && typeof value.next_cursor !== "string")) throw new Error("The API returned an invalid observation page.");
  return value as import("@/types/celld").CelldObservationPage;
}
export async function getCelldObservability(token: string, id: string, signal?: AbortSignal) {
  const value = await request<unknown>(fleetPath(id) + "/observability", token, "GET", undefined, signal);
  if (!isRecord(value) || typeof value.fleet_id !== "string" || !optionalList(value.nodes, snapshotSample) || (value.deployment !== undefined && (!isRecord(value.deployment) || !optionalList(value.deployment.workloads, workloadSample))) || (value.storage !== undefined && !isRecord(value.storage))) throw new Error("The API returned an invalid observability overview.");
  return { ...value, nodes: value.nodes ?? [] } as import("@/types/celld").CelldObservability;
}
export async function getCelldObservations(token: string, id: string, kind: "logs" | "events" | "trace", query: import("@/types/celld").CelldObservationQuery, signal?: AbortSignal, traceId?: string) {
  if (kind === "trace" && !/^[a-f0-9]{32}$/.test(traceId ?? "")) throw new Error("Enter a trace ID with 32 lowercase hexadecimal characters.");
  return parseObservationPage(await request(fleetPath(id) + "/" + (kind === "trace" ? "traces/" + encodeURIComponent(traceId!) : kind) + "?" + observationQuery(query), token, "GET", undefined, signal));
}
export async function getCelldMetrics(token: string, id: string, query: import("@/types/celld").CelldObservationQuery, signal?: AbortSignal) {
  const value = await request<unknown>(fleetPath(id) + "/metrics?" + observationQuery(query), token, "GET", undefined, signal);
  if (!isRecord(value) || !isRecord(value.requests) || !numericFields(value.requests, ["count", "errors", "rate_per_second", "mean_duration_us", "max_duration_us"])) throw new Error("The API returned invalid metrics.");
  parseObservationPage(value.samples);
  return value as import("@/types/celld").CelldMetrics;
}
export async function downloadCelldLogs(token: string, id: string, query: import("@/types/celld").CelldObservationQuery, signal?: AbortSignal) {
  const value = await request<unknown>(fleetPath(id) + "/logs?" + observationQuery({ ...query, cursor: undefined, limit: 2000 }) + "&download=true", token, "GET", undefined, signal);
  if (typeof value !== "string") throw new Error("The API returned an invalid NDJSON export.");
  return value;
}
