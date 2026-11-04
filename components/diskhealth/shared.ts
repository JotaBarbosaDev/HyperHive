import { Platform } from "react-native";

export const RANGES = [
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "all", label: "All", days: 0 },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export const cardClass = "rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] p-4";
export const mutedText = "text-typography-600 dark:text-[#9AA4B8]";
export const strongText = "text-typography-900 dark:text-[#E8EBF0]";

// Keeps digits from shifting between samples and lines up counter columns.
export const tabularNumbers = { fontVariant: ["tabular-nums" as const] };

// Box and VStack render a plain div on web, where `accessible` is not a valid
// attribute, while `role` and `aria-label` work on both platforms.
export const imageLabel = (label: string) => ({
  role: "img" as const,
  "aria-label": label,
  ...(Platform.OS === "web" ? {} : { accessible: true }),
});

export const rangeText = (days: number) => (days ? `last ${days} days` : "full history");

export const shortRangeText = (days: number) => (days ? `${days}d` : "all");

export const formatBytes = (bytes: number) => {
  if (!bytes) return "—";
  const tb = 1e12;
  const gb = 1e9;
  return bytes >= tb ? `${(bytes / tb).toFixed(2)} TB` : `${(bytes / gb).toFixed(0)} GB`;
};

export const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown time";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

export const sampleCountText = (count: number) => `${count} sample${count === 1 ? "" : "s"}`;
