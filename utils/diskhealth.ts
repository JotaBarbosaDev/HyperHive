import { DiskHealthBand, DiskHealthDisk, DiskHealthPoint, DiskHealthSample } from "@/types/diskhealth";

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

// BAND_RANGES colors fail text contrast on one theme or the other, so text uses these.
const BAND_TEXT: Record<DiskHealthBand, { light: string; dark: string }> = {
  good: { light: "#15803D", dark: "#4ADE80" },
  watch: { light: "#1D4ED8", dark: "#60A5FA" },
  at_risk: { light: "#B45309", dark: "#FBBF24" },
  critical: { light: "#B91C1C", dark: "#F87171" },
};

export const hasScore = (disk?: DiskHealthDisk | null): boolean =>
  !!disk && disk.smartAvailable && disk.score !== null && disk.band !== "";

export const bandBadgeAction = (disk?: DiskHealthDisk | null): DiskHealthBadgeAction =>
  disk && hasScore(disk) ? BAND_ACTION[disk.band as DiskHealthBand] : "muted";

export const bandBadgeLabel = (disk?: DiskHealthDisk | null): string =>
  disk && hasScore(disk) ? `${BAND_LABEL[disk.band as DiskHealthBand]} · ${disk.score}` : "No SMART data";

export const bandColor = (band?: string): string =>
  BAND_RANGES.find((r) => r.band === band)?.color ?? "#94A3B8";

export const bandLabel = (band?: string): string => BAND_LABEL[band as DiskHealthBand] ?? "No SMART data";

export const bandTextColor = (band: string | undefined, isDark: boolean): string => {
  const tone = BAND_TEXT[band as DiskHealthBand];
  if (!tone) return isDark ? "#9AA4B8" : "#475569";
  return isDark ? tone.dark : tone.light;
};

// A live row wins over a retired row for the same serial: a disk that came back
// must not keep showing the history of its retired namesake.
export const pickDiskHealth = (disks: DiskHealthDisk[], serial?: string | null): DiskHealthDisk | undefined => {
  const key = serial?.trim();
  if (!key) return undefined;
  const live = disks.find((d) => d.serial === key && !d.retiredAt);
  return live ?? disks.find((d) => d.serial === key);
};

export const remainingText = (ms: number): string => {
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

type CounterKey =
  | "pendingSectors"
  | "reallocatedSectors"
  | "offlineUncorrectable"
  | "reportedUncorrectable"
  | "mediaErrors"
  | "crcErrorCount";

// Dash patterns keep the series apart without relying on hue alone.
export const COUNTER_SERIES: { key: CounterKey; label: string; color: string; dash?: string; flashOnly?: boolean }[] = [
  { key: "pendingSectors", label: "Pending", color: "#EF4444" },
  { key: "reallocatedSectors", label: "Reallocated", color: "#F59E0B", dash: "8,4" },
  { key: "offlineUncorrectable", label: "Offline uncorrectable", color: "#A855F7", dash: "2,4" },
  { key: "reportedUncorrectable", label: "Reported uncorrectable", color: "#EC4899", dash: "8,4,2,4" },
  { key: "mediaErrors", label: "Media errors", color: "#06B6D4", dash: "12,6", flashOnly: true },
  { key: "crcErrorCount", label: "CRC errors", color: "#64748B", dash: "4,4" },
];

// Splits counters into series that changed from zero and labels that stayed at zero.
export const counterSeries = (points: DiskHealthPoint[]) => {
  const shown: { label: string; color: string; dash?: string; data: { x: Date; y: number; series: string }[] }[] = [];
  const zero: string[] = [];
  COUNTER_SERIES.forEach((series) => {
    const data = points.map((p) => ({ x: new Date(p.at), y: Number(p[series.key]) || 0, series: series.label }));
    if (data.some((d) => d.y !== 0)) shown.push({ label: series.label, color: series.color, dash: series.dash, data });
    else zero.push(series.label);
  });
  return { shown, zero };
};

export type DiskCounterRow = {
  label: string;
  color: string;
  dash?: string;
  value: number;
  change: number | null;
  charted: boolean;
};

// One row per counter with its current value and the change across the loaded
// points. Flash-only counters are hidden on HDDs unless they report something.
export const counterRows = (points: DiskHealthPoint[], latest: DiskHealthSample | undefined, flash: boolean): DiskCounterRow[] => {
  const first = points[0];
  const last = points[points.length - 1];
  return COUNTER_SERIES.flatMap((series) => {
    const value = Number(latest?.[series.key] ?? last?.[series.key]) || 0;
    if (series.flashOnly && !flash && value === 0) return [];
    return [
      {
        label: series.label,
        color: series.color,
        dash: series.dash,
        value,
        change: points.length >= 2 ? (Number(last[series.key]) || 0) - (Number(first[series.key]) || 0) : null,
        charted: points.some((p) => (Number(p[series.key]) || 0) !== 0),
      },
    ];
  });
};

export type DiskSeriesStats = { latest: number; low: number; high: number; change: number };

export const seriesStats = (values: number[]): DiskSeriesStats | null => {
  if (!values.length) return null;
  return {
    latest: values[values.length - 1],
    low: Math.min(...values),
    high: Math.max(...values),
    change: values[values.length - 1] - values[0],
  };
};

export const changeText = (change: number): string => {
  if (change === 0) return "No change";
  return `${change > 0 ? "+" : "\u2212"}${Math.abs(change).toLocaleString()}`;
};

// Temperature 0 means the poll got no reading, so it is a gap, not a cold disk.
export const temperatureSeries = (points: DiskHealthPoint[]): { x: Date; y: number }[] =>
  points.filter((p) => p.temperatureC > 0).map((p) => ({ x: new Date(p.at), y: p.temperatureC }));

// Padded axis range that keeps a nearly flat temperature readable.
export const temperatureDomain = (values: number[]): [number, number] | undefined => {
  if (!values.length) return undefined;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = Math.max(2, (high - low) * 0.15);
  let from = Math.max(0, Math.floor(low - pad));
  let to = Math.ceil(high + pad);
  if (to - from < 5) {
    const mid = (from + to) / 2;
    from = Math.max(0, Math.floor(mid - 2.5));
    to = Math.ceil(mid + 2.5);
  }
  return [from, to];
};

export const powerOnText = (hours: number): string => {
  if (hours < 48) return `${hours} hours`;
  if (hours < 24 * 60) return `${Math.round(hours / 24)} days`;
  if (hours < 24 * 730) return `${Math.round(hours / 730)} months`;
  return `${(hours / 8766).toFixed(1)} years`;
};

const DAY_MS = 86_400_000;

// Time axis label sized to the visible span, so short ranges do not repeat a date.
export const chartTickText = (value: Date | number, spanMs: number): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (spanMs > 400 * DAY_MS) return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  const day = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (spanMs > 3 * DAY_MS) return day;
  return `${day} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
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
