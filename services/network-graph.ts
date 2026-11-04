import { apiFetch } from "./api-client";

export type NetworkGraphNode = {
  id: string;
  type: string;
  label: string;
  host: string;
  status: string;
  details: Record<string, unknown>;
};

// A configured route, not proof of traffic. `match` says how the target was identified.
export type NetworkGraphEdge = {
  source: string;
  target: string;
  type: string;
  match: string;
};

// The ip:port sockets that carry an edge, the key into NetworkTraffic.endpoints.
export type NetworkGraphFlow = {
  source: string;
  target: string;
  endpoints: string[];
};

// Where pieces of the map were moved to, by board node ID. A piece inside a box is relative to it.
export type NetworkPositions = Record<string, { x: number; y: number }>;

export type NetworkGraph = {
  generatedAt: string;
  nodes: NetworkGraphNode[];
  edges: NetworkGraphEdge[];
  flows: NetworkGraphFlow[];
  positions: NetworkPositions;
  warnings: string[];
};

// Bytes per second. On a node it is the node's own view; on an endpoint, `sent` goes
// towards the target and `received` comes back from it.
export type NetworkRate = { sent: number; received: number };

// Only what moved during the last interval is listed.
export type NetworkTraffic = {
  at: string;
  endpoints: Record<string, NetworkRate>;
  nodes: Record<string, NetworkRate>;
  warnings: string[];
};

export const getNetworkGraph = (signal?: AbortSignal) =>
  apiFetch<NetworkGraph>("/network/graph", { signal, reportResult: false });

export const getNetworkTraffic = (signal?: AbortSignal) =>
  apiFetch<NetworkTraffic>("/network/traffic", { signal, reportResult: false });

// Only the given pieces change, so this never undoes a move made on another page.
export const saveNetworkLayout = (positions: NetworkPositions) =>
  apiFetch<void>("/network/layout", { method: "PUT", body: positions, reportResult: false });

export const resetNetworkLayout = () =>
  apiFetch<void>("/network/layout", { method: "DELETE", reportResult: false });

export const NETWORK_HISTORY_RANGES = ["1d", "7d", "30d", "3m", "6m", "1y"] as const;
export type NetworkHistoryRange = (typeof NETWORK_HISTORY_RANGES)[number];

// Bytes per second. Null rates mean nothing was sampled then, which is not the same as idle.
export type NetworkHistoryPoint = {
  at: string;
  sent: number | null;
  received: number | null;
  peakSent: number | null;
  peakReceived: number | null;
};

export type NetworkHistory = {
  range: NetworkHistoryRange;
  stepSeconds: number;
  points: NetworkHistoryPoint[];
  sentBytes: number;
  receivedBytes: number;
  averageSent: number;
  averageReceived: number;
  peakSent: number;
  peakReceived: number;
};

export const getNetworkTrafficHistory = (range: NetworkHistoryRange, keys: string[], signal?: AbortSignal) => {
  const query = new URLSearchParams({ range });
  for (const key of keys) query.append("key", key);
  return apiFetch<NetworkHistory>(`/network/traffic/history?${query}`, { signal, reportResult: false });
};
