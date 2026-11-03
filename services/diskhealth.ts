import { apiFetch } from "./api-client";
import { resolveToken } from "./vms-client";
import {
  DiskHealthBand,
  DiskHealthDisk,
  DiskHealthHistory,
  DiskHealthList,
  DiskHealthPoint,
  DiskHealthSample,
} from "@/types/diskhealth";

const BANDS: DiskHealthBand[] = ["good", "watch", "at_risk", "critical"];

const num = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const optionalNum = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const str = (value: unknown): string => (typeof value === "string" ? value : "");

const band = (value: unknown): DiskHealthBand | "" =>
  BANDS.includes(value as DiskHealthBand) ? (value as DiskHealthBand) : "";

const normalizeSample = (raw: any): DiskHealthSample => ({
  capturedAt: str(raw?.capturedAt),
  machineName: str(raw?.machineName),
  device: str(raw?.device),
  score: optionalNum(raw?.score),
  temperatureC: num(raw?.temperatureC),
  powerOnHours: num(raw?.powerOnHours),
  pendingSectors: num(raw?.pendingSectors),
  offlineUncorrectable: num(raw?.offlineUncorrectable),
  reallocatedSectors: num(raw?.reallocatedSectors),
  reportedUncorrectable: num(raw?.reportedUncorrectable),
  mediaErrors: num(raw?.mediaErrors),
  crcErrorCount: num(raw?.crcErrorCount),
  percentageUsed: num(raw?.percentageUsed),
  availableSpare: num(raw?.availableSpare),
  availableSpareThreshold: num(raw?.availableSpareThreshold),
  criticalWarning: num(raw?.criticalWarning),
  smartPassed: raw?.smartPassed !== false,
  selfTestFailed: raw?.selfTestFailed === true,
  healthStatus: str(raw?.healthStatus),
  smartctlError: str(raw?.smartctlError),
});

export const normalizeDiskHealthDisk = (raw: any): DiskHealthDisk => ({
  serial: str(raw?.serial),
  model: str(raw?.model),
  machineName: str(raw?.machineName),
  device: str(raw?.device),
  transport: str(raw?.transport),
  rotational: raw?.rotational === true,
  capacityBytes: num(raw?.capacityBytes),
  firstSeen: str(raw?.firstSeen),
  lastSeen: str(raw?.lastSeen),
  retiredAt: str(raw?.retiredAt) || null,
  smartAvailable: raw?.smartAvailable === true,
  score: optionalNum(raw?.score),
  band: band(raw?.band),
  wearOutAt: str(raw?.wearOutAt) || null,
  reasons: Array.isArray(raw?.reasons) ? raw.reasons.filter((r: unknown) => typeof r === "string" && r) : [],
  pastRatedEndurance: raw?.pastRatedEndurance === true,
  latest: raw?.latest ? normalizeSample(raw.latest) : undefined,
});

export const normalizeDiskHealthList = (raw: any): DiskHealthList => ({
  lastPollAt: str(raw?.lastPollAt) || null,
  disks: Array.isArray(raw?.disks) ? raw.disks.map(normalizeDiskHealthDisk).filter((d: DiskHealthDisk) => d.serial) : [],
});

const normalizePoint = (raw: any): DiskHealthPoint => ({
  at: str(raw?.at),
  resolution: raw?.resolution === "daily" ? "daily" : "6h",
  score: optionalNum(raw?.score),
  band: band(raw?.band),
  temperatureC: num(raw?.temperatureC),
  powerOnHours: num(raw?.powerOnHours),
  pendingSectors: num(raw?.pendingSectors),
  offlineUncorrectable: num(raw?.offlineUncorrectable),
  reallocatedSectors: num(raw?.reallocatedSectors),
  reportedUncorrectable: num(raw?.reportedUncorrectable),
  mediaErrors: num(raw?.mediaErrors),
  crcErrorCount: num(raw?.crcErrorCount),
  percentageUsed: num(raw?.percentageUsed),
  smartPassed: raw?.smartPassed !== false,
});

export const normalizeDiskHealthHistory = (raw: any): DiskHealthHistory => ({
  disk: normalizeDiskHealthDisk(raw?.disk),
  points: Array.isArray(raw?.points)
    ? raw.points.map(normalizePoint).filter((p: DiskHealthPoint) => p.at && !Number.isNaN(Date.parse(p.at)))
    : [],
});

export type DiskHealthState = "active" | "retired" | "all";

// Background data for the SMART page: errors are not toasted, the page shows "No SMART data" instead.
export async function listDiskHealth(state: DiskHealthState = "all"): Promise<DiskHealthList> {
  const token = await resolveToken();
  const data = await apiFetch<any>(`/diskhealth/?state=${state}`, { token, reportResult: false });
  return normalizeDiskHealthList(data);
}

export async function getDiskHealthHistory(serial: string, days?: number): Promise<DiskHealthHistory> {
  const token = await resolveToken();
  const query = days && days > 0 ? `?days=${Math.floor(days)}` : "";
  const data = await apiFetch<any>(`/diskhealth/${encodeURIComponent(serial)}${query}`, { token, reportResult: false });
  return normalizeDiskHealthHistory(data);
}

// Deletes a retired disk and all its history; the backend refuses active disks (409).
export async function purgeDiskHealth(serial: string): Promise<void> {
  const token = await resolveToken();
  await apiFetch<unknown>(`/diskhealth/${encodeURIComponent(serial)}`, { method: "DELETE", token });
}
