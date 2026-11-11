import { apiFetch } from "./api-client";

// Estimates from hardware inventory and CPU load, not a power meter. See docs/power-cost.md in the backend repo.
export type EnergyUsage = { liveWatts: number; monthKWh: number; monthCost: number };

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
