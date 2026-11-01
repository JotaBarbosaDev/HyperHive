import { apiFetch } from "./api-client";

// Contract: HyperHive docs/automations.md. All calls go to the master REST API.

export type RunStatus = "running" | "succeeded" | "failed" | "timeout" | "killed" | "interrupted";
export type RunTrigger = "manual" | "condition" | "npm-install";

export type RunSummary = {
  id: string;
  automation_id: string;
  automation_name: string;
  trigger: RunTrigger;
  condition: string;
  snapshot: Record<string, unknown> | null;
  status: RunStatus;
  exit_code: number | null;
  started_at: string;
  ended_at: string | null;
  output_truncated: boolean;
  error: string;
};

export type RunDetail = RunSummary & { output: string };

export type AutomationState = {
  condition_value: boolean;
  last_evaluated_at: string | null;
  last_error: string;
  armed: boolean;
  true_since: string | null;
  last_fired_at: string | null;
  last_fire_error: string;
  disabled_reason: string;
  snapshot: Record<string, unknown> | null;
};

export type Automation = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: string;
  cooldown_seconds: number;
  for_seconds: number;
  timeout_seconds: number;
  max_runs_per_hour: number;
  created_at: string;
  updated_at: string;
  state: AutomationState | null;
  running_run_id: string | null;
  last_run: RunSummary | null;
};

export type AutomationConfig = Pick<Automation, "name" | "description" | "enabled" | "condition" | "cooldown_seconds" | "for_seconds" | "timeout_seconds" | "max_runs_per_hour">;

export type AutomationList = {
  paused: boolean;
  node: { available: boolean; version: string };
  automations: Automation[];
};

export type AutomationSettings = { paused: boolean; retention_days: number; retention_count: number };
export type EvaluateResult = { value: boolean; error: string; snapshot: Record<string, unknown> | null };
export type CatalogStream = { name: string; type: string; unit?: string; label?: string; value?: unknown };
export type CatalogApp = { id: string; name: string; connectivity: string; health: string; instances: string[]; streams: CatalogStream[] };
export type ConditionCatalog = { apps: CatalogApp[] };
export type AutomationFile = { path: string; size: number; modified_at: string };

const opts = { reportResult: false } as const;
const enc = encodeURIComponent;

export const listAutomations = (signal?: AbortSignal) => apiFetch<AutomationList>("/automations", { ...opts, signal });
export const getAutomation = (id: string, signal?: AbortSignal) => apiFetch<Automation>(`/automations/${enc(id)}`, { ...opts, signal });
export const createAutomation = (body: Partial<AutomationConfig> & { name: string }) => apiFetch<Automation>("/automations", { ...opts, method: "POST", body });
export const updateAutomation = (id: string, body: AutomationConfig) => apiFetch<Automation>(`/automations/${enc(id)}`, { ...opts, method: "PUT", body });
export const deleteAutomation = (id: string) => apiFetch<void>(`/automations/${enc(id)}`, { ...opts, method: "DELETE" });
// 409 means the automation already has a running run.
export const runAutomation = (id: string) => apiFetch<{ run_id: string }>(`/automations/${enc(id)}/run`, { ...opts, method: "POST", handledErrorStatuses: [409] });
export const evaluateCondition = (condition: string) => apiFetch<EvaluateResult>("/automations/evaluate", { ...opts, method: "POST", body: { condition } });
export const getConditionCatalog = (signal?: AbortSignal) => apiFetch<ConditionCatalog>("/automations/catalog", { ...opts, signal });

export const getAutomationSettings = (signal?: AbortSignal) => apiFetch<AutomationSettings>("/automations/settings", { ...opts, signal });
export const updateAutomationSettings = (body: AutomationSettings) => apiFetch<AutomationSettings>("/automations/settings", { ...opts, method: "PUT", body });

export const listAutomationFiles = (id: string, signal?: AbortSignal) => apiFetch<{ files: AutomationFile[] }>(`/automations/${enc(id)}/files`, { ...opts, signal });
const fileUrl = (id: string, path: string) => `/automations/${enc(id)}/files/content?path=${enc(path)}`;
export const readAutomationFile = (id: string, path: string) => apiFetch<{ path: string; content: string }>(fileUrl(id, path), opts);
export const writeAutomationFile = (id: string, path: string, content: string) => apiFetch<AutomationFile>(fileUrl(id, path), { ...opts, method: "PUT", body: { content } });
export const renameAutomationFile = (id: string, from: string, to: string) => apiFetch<AutomationFile>(`/automations/${enc(id)}/files/rename`, { ...opts, method: "POST", body: { from, to }, handledErrorStatuses: [409] });
export const deleteAutomationFile = (id: string, path: string) => apiFetch<void>(fileUrl(id, path), { ...opts, method: "DELETE" });

export const getAutomationPackage = () => apiFetch<{ content: string }>("/automations/package", opts);
export const updateAutomationPackage = (content: string) => apiFetch<unknown>("/automations/package", { ...opts, method: "PUT", body: { content } });
export const installAutomationPackage = () => apiFetch<{ run_id: string }>("/automations/package/install", { ...opts, method: "POST" });
export const getAutomationSdkTypes = () => apiFetch<string>("/automations/sdk/hh.d.ts", { ...opts, headers: { Accept: "text/plain" } });

export const listAutomationRuns = (automationId: string, limit = 50, signal?: AbortSignal) =>
  apiFetch<{ runs: RunSummary[] }>(`/automations/runs?automation_id=${enc(automationId)}&limit=${limit}`, { ...opts, signal });
export const getAutomationRun = (runId: string, signal?: AbortSignal) => apiFetch<RunDetail>(`/automations/runs/${enc(runId)}`, { ...opts, signal });
export const killAutomationRun = (runId: string) => apiFetch<unknown>(`/automations/runs/${enc(runId)}/kill`, { ...opts, method: "POST" });

export const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const formatTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");

export const formatDuration = (run: Pick<RunSummary, "started_at" | "ended_at">) => {
  if (!run.ended_at) return "—";
  const ms = new Date(run.ended_at).getTime() - new Date(run.started_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} m ${s % 60} s`;
};
