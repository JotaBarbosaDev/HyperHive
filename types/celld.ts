export type CelldPorts = { http: number; internal: number };
export type CelldStorageHealth = { healthy: boolean; error?: string };
export type CelldMachineHealth = {
  name: string;
  ip?: string;
  connected: boolean;
  running?: boolean;
  healthy: boolean;
  ports?: CelldPorts;
  url?: string;
  error?: string;
};
export type CelldStatus = "provisioning" | "running" | "stopped" | "degraded" | "deleting" | "error";
export type CelldFleet = {
  id: string;
  name: string;
  desired_state: "running" | "stopped" | "deleting";
  status: CelldStatus;
  servers: CelldMachineHealth[];
  ports: CelldPorts;
  storage: { bucket: string; endpoint: string; region: string };
  urls: string[];
  deploy: { command: string; credentials_url: string; environment: string[] };
  checked_at: string;
  error?: string;
};
export type CelldFleetList = {
  fleets: CelldFleet[];
  storage: CelldStorageHealth & {
    bucket_count: number | null;
    buckets: string[] | null;
    managed_bucket_count: number;
    checked_at: string;
  };
  reset_pending: boolean;
  error?: string;
};
export type CelldFleetInput = { name: string; servers: string[]; ports?: CelldPorts };
export type CelldCredentials = { aws_access_key_id: string; aws_secret_access_key: string };
export type CelldAction = "start" | "stop" | "restart" | "delete";
export type CelldFleetHealth = {
  healthy: boolean;
  storage: CelldStorageHealth;
  machines: CelldMachineHealth[];
  checked_at?: string;
  fleets?: { id: string; name: string; healthy: boolean; status: CelldStatus; checked_at: string; error?: string }[];
};

export type ObservationState = "pending" | "fresh" | "partial" | "stale" | "offline" | "unsupported" | string;
export type CelldResources = { sampled_ms?: number; cpu_percent_x100?: number; rss_bytes?: number; owned_cells?: number; resident_cells?: number; [key: string]: number | boolean | Record<string, number> | undefined };
export type CelldWorkload = { kind?: string; id?: string; parent?: string; version?: string; state?: string; live?: number; retiring?: number; heap_bytes?: number; memory_bytes?: number; cpu_percent?: number; cells?: number; requests?: number; limit?: number };
export type CelldSnapshot = { node_id?: string; collected_ms?: number; attempted_ms?: number; state?: ObservationState; error?: string; dropped?: number; resources?: CelldResources; workloads?: CelldWorkload[]; capabilities?: { name: string; state: string; detail?: string }[] };
export type CelldObservability = { fleet_id: string; historical?: boolean; nodes?: CelldSnapshot[]; deployment?: { collected_ms?: number; state?: string; error?: string; workloads?: CelldWorkload[] }; storage?: { bytes?: number; global_bytes?: number; fleet_budget_bytes?: number; global_budget_bytes?: number; retention_days?: number; dropped?: number; rejected_batches?: number; pruned_segments?: number; error?: string }; cpu_aggregation?: string; incomplete?: boolean; error?: string };
export type CelldObservation = { id: string; node?: string; generation?: string; received_ms?: number; record?: { sequence?: number; time_ms?: number; kind?: string; source?: string; severity?: string; body?: string; workload?: string; trace_id?: string; span_id?: string; parent_span_id?: string; duration_us?: number; failed?: boolean; attributes?: Record<string, unknown> }; snapshot?: CelldSnapshot };
export type CelldObservationPage = { records: CelldObservation[]; next_cursor?: string; from: number; to: number; truncated?: boolean; incomplete?: boolean; error?: string };
export type CelldMetrics = { samples: CelldObservationPage; requests: { count?: number; errors?: number; rate_per_second?: number; mean_duration_us?: number; max_duration_us?: number; observed?: boolean; incomplete?: boolean; error?: string } };
export type CelldObservationQuery = { from: number; to: number; node?: string; workload?: string; source?: string; severity?: string; text?: string; limit?: number; cursor?: string };

export type CelldDetailTab = "overview" | "workloads" | "logs" | "metrics" | "events" | "trace" | "deployment";
