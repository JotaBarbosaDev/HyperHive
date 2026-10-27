import type { Sample, WidgetKind } from "@/types/support";
import { bytes } from "@/components/celld/observability";

export function measurementText(value: number, unit?: string): string {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (unit === "%") return value.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " %";
  if (["bytes", "B", "bytes/s", "B/s"].includes(unit ?? "")) return sign + bytes(absolute) + (unit!.endsWith("/s") ? "/s" : "");
  if (unit === "s" && absolute >= 60) {
    const units = [[86400, "d"], [3600, "h"], [60, "m"], [1, "s"]] as const;
    let remaining = Math.floor(absolute);
    const parts: string[] = [];
    for (const [seconds, label] of units) {
      const count = Math.floor(remaining / seconds);
      if (count || parts.length) parts.push(count + label);
      remaining %= seconds;
      if (parts.length === 2) break;
    }
    return sign + parts.join(" ");
  }
  return sampleText(value) + (unit ? " " + unit : "");
}

export function sampleText(value: Sample["value"]): string {
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") return value;
  if ("message" in value) return value.message;
  return value.name + (Object.keys(value.fields).length ? " · " + Object.entries(value.fields).map(([key, field]) => key + ": " + (typeof field === "object" ? JSON.stringify(field) : String(field))).join(" · ") : "");
}

export function minimumWidgetHeight(kind: WidgetKind): number {
  if (["value", "text", "boolean"].includes(kind)) return 1;
  return ["sparkline", "progress"].includes(kind) ? 2 : 3;
}

export function defaultWidgetSize(kind: WidgetKind): { w: number; h: number } {
  if (kind === "text") return { w: 3, h: 1 };
  if (kind === "boolean") return { w: 2, h: 1 };
  if (kind === "value") return { w: 3, h: 2 };
  if (["sparkline", "progress"].includes(kind)) return { w: 4, h: 2 };
  if (kind === "gauge") return { w: 3, h: 3 };
  return { w: ["logs", "events", "table"].includes(kind) ? 8 : 6, h: 5 };
}
