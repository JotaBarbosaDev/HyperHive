import { apiFetch } from "./api-client";

export type EnergyTotals = {
  liveWatts: number;
  monthKWh: number;
  monthCost: number;
};

export type EnergyMachine = {
  machine: string;
  liveWatts: number;
  monthKWh: number;
  monthCost: number;
  cpuEstimate: "table" | "generic" | "";
};

export type EnergyVm = {
  name: string;
  liveWatts: number;
  monthKWh: number;
  monthCost: number;
};

export type EnergySummary = {
  pricePerKWh: number | null;
  totals: EnergyTotals;
  machines: EnergyMachine[];
  vms: EnergyVm[];
};

export type EnergyLineRow = {
  liveWatts: number;
  monthKWh: number;
  monthCost: number;
};

export const getEnergySummary = (signal?: AbortSignal) =>
  apiFetch<EnergySummary>("/energy/summary", { signal, reportResult: false });

export const setEnergyPrice = (price: number) =>
  apiFetch<{ pricePerKWh: number }>("/energy/price", {
    method: "PUT",
    body: { pricePerKWh: price },
    reportResult: false,
  });

export const formatWatts = (watts: number) => `~${Math.round(watts)} W`;

export const formatKWh = (kwh: number) => (kwh < 10 ? `${kwh.toFixed(1)} kWh` : `${Math.round(kwh)} kWh`);

export const formatCost = (cost: number) => `€${cost.toFixed(2)}`;

export const energyLine = (row: EnergyLineRow, pricePerKWh: number | null) => {
  const base = `${formatWatts(row.liveWatts)} · ${formatKWh(row.monthKWh)}`;
  return pricePerKWh === null ? base : `${base} · ${formatCost(row.monthCost)}`;
};
