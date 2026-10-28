import type { CelldFleetList } from "@/types/celld";

export function celldSummary(data: CelldFleetList | null, error: string | null) {
  if (!data) return { service: error ? "unavailable" : "unknown", runtime: "unknown" };
  if (error) return { service: "unavailable", runtime: "unknown" };
  if (data.reset_pending) return { service: "connected", runtime: "cleanup pending" };
  const expected = data.fleets.filter(fleet => fleet.desired_state === "running");
  if (!expected.length) return { service: "connected", runtime: "no running fleets" };
  if (expected.some(fleet => fleet.status === "error" || fleet.status === "degraded" || fleet.servers.some(node => node.connected === false || node.healthy === false || node.running === false))) return { service: "connected", runtime: "degraded" };
  if (expected.some(fleet => fleet.status !== "running" || !fleet.servers.length || fleet.servers.some(node => node.running !== true || node.healthy !== true))) return { service: "connected", runtime: "unknown" };
  return { service: "connected", runtime: "running" };
}
