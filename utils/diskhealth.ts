import { DiskHealthBand, DiskHealthDisk, DiskHealthPoint } from "@/types/diskhealth";

export type DiskHealthBadgeAction = "success" | "info" | "warning" | "error" | "muted";

const BAND_ACTION: Record<DiskHealthBand, DiskHealthBadgeAction> = {
  good: "success",
  watch: "info",
  at_risk: "warning",
  critical: "error",
};

const BAND_LABEL: Record<DiskHealthBand, string> = {
  good: "Good",
  watch: "Watch",
  at_risk: "At risk",
  critical: "Critical",
};

// Score ranges shaded behind the score chart, matching master/diskhealth BandFor.
export const BAND_RANGES: { band: DiskHealthBand; from: number; to: number; color: string }[] = [
  { band: "critical", from: 0, to: 30, color: "#EF4444" },
  { band: "at_risk", from: 30, to: 60, color: "#F59E0B" },
  { band: "watch", from: 60, to: 80, color: "#3B82F6" },
  { band: "good", from: 80, to: 100, color: "#22C55E" },
];

export const hasScore = (disk?: DiskHealthDisk | null): boolean =>
  !!disk && disk.smartAvailable && disk.score !== null && disk.band !== "";

export const bandBadgeAction = (disk?: DiskHealthDisk | null): DiskHealthBadgeAction =>
  disk && hasScore(disk) ? BAND_ACTION[disk.band as DiskHealthBand] : "muted";

export const bandBadgeLabel = (disk?: DiskHealthDisk | null): string =>
  disk && hasScore(disk) ? `${BAND_LABEL[disk.band as DiskHealthBand]} · ${disk.score}` : "No SMART data";

export const bandColor = (band?: string): string =>
  BAND_RANGES.find((r) => r.band === band)?.color ?? "#94A3B8";

export const pickDiskHealth = (disks: DiskHealthDisk[], serial?: string | null): DiskHealthDisk | undefined => {
  const key = serial?.trim();
  if (!key) return undefined;
  return disks.find((d) => d.serial === key);
};

const remainingText = (ms: number): string => {
  const days = Math.round(ms / 86_400_000);
  if (days < 60) return `~${Math.max(days, 0)} days`;
  if (days < 730) return `~${Math.round(days / 30.4)} months`;
  return `~${Math.round(days / 365)} years`;
};

// One line for the disk list: the first reason, or wear and remaining life on a healthy SSD.
export const diskHealthSummary = (disk?: DiskHealthDisk | null, now: number = Date.now()): string => {
  if (!disk) return "No SMART data";
  if (!hasScore(disk)) return disk.reasons[0] ?? "No SMART data";
  const first = disk.reasons[0] ?? "";
  if (first && first !== "No problems found") return first;
  if (disk.pastRatedEndurance) return `Wear ${disk.latest?.percentageUsed ?? 100}%, past rated endurance`;
  if (disk.wearOutAt && !disk.rotational) {
    const at = Date.parse(disk.wearOutAt);
    if (Number.isFinite(at)) return `Wear ${disk.latest?.percentageUsed ?? 0}%, ${remainingText(at - now)} left (estimate)`;
  }
  return first || "No problems found";
};

export const lastPollText = (lastPollAt: string | null | undefined, now: number = Date.now()): string => {
  if (!lastPollAt) return "No health poll yet";
  const at = Date.parse(lastPollAt);
  if (!Number.isFinite(at)) return "No health poll yet";
  const hours = Math.max(0, Math.floor((now - at) / 3_600_000));
  if (hours < 1) return "Last health poll under 1 h ago";
  if (hours < 48) return `Last health poll ${hours} h ago`;
  return `Last health poll ${Math.floor(hours / 24)} days ago`;
};

export const COUNTER_SERIES: { key: keyof DiskHealthPoint; label: string; color: string; nvmeOnly?: boolean }[] = [
  { key: "pendingSectors", label: "Pending", color: "#EF4444" },
  { key: "reallocatedSectors", label: "Reallocated", color: "#F59E0B" },
  { key: "offlineUncorrectable", label: "Offline uncorrectable", color: "#A855F7" },
  { key: "reportedUncorrectable", label: "Reported uncorrectable", color: "#EC4899" },
  { key: "mediaErrors", label: "Media errors", color: "#06B6D4" },
  { key: "crcErrorCount", label: "CRC errors", color: "#64748B" },
];

// Splits counters into series that changed from zero and labels that stayed at zero.
export const counterSeries = (points: DiskHealthPoint[]) => {
  const shown: { label: string; color: string; data: { x: Date; y: number }[] }[] = [];
  const zero: string[] = [];
  COUNTER_SERIES.forEach((series) => {
    const data = points.map((p) => ({ x: new Date(p.at), y: Number(p[series.key]) || 0 }));
    if (data.some((d) => d.y !== 0)) shown.push({ label: series.label, color: series.color, data });
    else zero.push(series.label);
  });
  return { shown, zero };
};

// Dashed line from the latest wear sample to 100% at the estimated wear-out date.
export const wearProjection = (points: DiskHealthPoint[], wearOutAt?: string | null): { x: Date; y: number }[] => {
  if (!wearOutAt || points.length === 0) return [];
  const end = Date.parse(wearOutAt);
  const last = points[points.length - 1];
  const start = Date.parse(last.at);
  if (!Number.isFinite(end) || !Number.isFinite(start) || end <= start) return [];
  return [
    { x: new Date(start), y: last.percentageUsed },
    { x: new Date(end), y: 100 },
  ];
};

export const isFlashDisk = (disk?: DiskHealthDisk | null): boolean =>
  !!disk && !disk.rotational;
