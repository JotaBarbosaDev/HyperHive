import { apiFetch } from "./api-client";

// Estimates from hardware inventory and CPU load, not a power meter. See docs/power-cost.md in the backend repo.
// projectedMonth* estimate the whole current month; missing on masters older than the projection.
export type EnergyUsage = { liveWatts: number; monthKWh: number; monthCost: number; projectedMonthKWh?: number; projectedMonthCost?: number };

export type EnergyRange = "30d" | "90d" | "6m";
export type EnergySeriesRef = { kind: "host" | "vm"; name: string };
// One value per bucket. null is "no data" (master or host down); 0 on a VM is "stopped".
export type EnergySeries = EnergySeriesRef & { machine: string; wh: (number | null)[]; runningS: (number | null)[] };
// Bucket i starts at start + i * stepSeconds (Unix seconds).
export type EnergyTimeline = { start: number; stepSeconds: number; count: number; series: EnergySeries[] };

// Without series: every host and VM at one hour per bucket. With it: that series at the range's own step.
export const getEnergyTimeline = (range: EnergyRange, series?: EnergySeriesRef, signal?: AbortSignal) =>
  apiFetch<EnergyTimeline>(
    `/energy/timeline?range=${range}` + (series ? `&kind=${series.kind}&name=${encodeURIComponent(series.name)}` : ""),
    { signal, reportResult: false },
  );

export type EnergySummary = {
  pricePerKWh: number | null;
  totals: EnergyUsage;
  // cpuEstimate is "table" (known CPU TDP) or "generic" (fallback guess).
  machines: (EnergyUsage & { machine: string; cpuEstimate: string })[];
  vms: (EnergyUsage & { name: string })[];
  // Last 12 months, oldest first, zero-filled. Missing on masters older than the history field.
  months?: { month: string; kWh: number; cost: number }[];
};

export const getEnergySummary = (signal?: AbortSignal) =>
  apiFetch<EnergySummary>("/energy/summary", { signal, reportResult: false });

export const setEnergyPrice = (pricePerKWh: number) =>
  apiFetch<unknown>("/energy/price", { method: "PUT", body: { pricePerKWh }, reportResult: false });

// Mirrors the backend range (0 to 10 per kWh). Accepts a decimal comma.
export const parseEnergyPrice = (text: string): number | null => {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
};

// "~180 W · 42.0 kWh · €8.82"; the cost is left out while no price is set.
export const formatEnergy = (usage: EnergyUsage, hasPrice: boolean) =>
  `~${Math.round(usage.liveWatts)} W · ${usage.monthKWh.toFixed(usage.monthKWh < 10 ? 2 : 1)} kWh` +
  (hasPrice ? ` · €${usage.monthCost.toFixed(2)}` : "");

// Used by the VMs page and the machine detail page.
export const formatWatts = (watts: number) => `~${Math.round(watts)} W`;
export const formatKWh = (kwh: number) => (kwh < 10 ? `${kwh.toFixed(1)} kWh` : `${Math.round(kwh)} kWh`);
export const formatCost = (cost: number) => `€${cost.toFixed(2)}`;
// "42 kWh · €8.82" for the projected month, or null on an older master.
export const projectionText = (row: EnergyUsage, hasPrice: boolean) =>
  row.projectedMonthKWh == null
    ? null
    : formatKWh(row.projectedMonthKWh) + (hasPrice && row.projectedMonthCost != null ? ` · ${formatCost(row.projectedMonthCost)}` : "");
export const energyLine = (row: EnergyUsage, pricePerKWh: number | null) => {
  const base = `${formatWatts(row.liveWatts)} · ${formatKWh(row.monthKWh)}`;
  return pricePerKWh === null ? base : `${base} · ${formatCost(row.monthCost)}`;
};

type SegmentState = "running" | "stopped" | "none";

// Each strip segment covers several buckets (96 keeps a strip light to render): running if any had running time,
// stopped if any had data, otherwise no data.
export const stripSegments = (series: EnergySeries, segments = 96): SegmentState[] => {
  const count = series.runningS.length;
  return Array.from({ length: Math.min(segments, count) }, (_, i) => {
    const slice = series.runningS.slice(Math.floor((i * count) / Math.min(segments, count)), Math.floor(((i + 1) * count) / Math.min(segments, count)));
    if (slice.some((v) => v != null && v > 0)) return "running";
    return slice.some((v) => v != null) ? "stopped" : "none";
  });
};

// Average watts per bucket, thinned to at most `points` chart points. The last
// bucket is still filling, so it is left out. A gap in the data stays a gap.
export const wattPoints = (timeline: EnergyTimeline, series: EnergySeries, points = 300) => {
  const count = timeline.count - 1;
  const group = Math.max(1, Math.ceil(count / points));
  const out: { x: Date; y: number | null }[] = [];
  for (let from = 0; from < count; from += group) {
    const values = series.wh.slice(from, Math.min(from + group, count)).filter((v): v is number => v != null);
    out.push({
      x: new Date((timeline.start + from * timeline.stepSeconds) * 1000),
      y: values.length ? values.reduce((a, b) => a + b, 0) / values.length / (timeline.stepSeconds / 3600) : null,
    });
  }
  return out;
};
