import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import type { CelldFleet } from "@/types/celld";

export const cardClassName = "p-5 rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1524] shadow-soft-1";
export const mutedClassName = "text-sm text-typography-600 dark:text-[#8A94A8]";
export const titleClassName = "text-typography-900 dark:text-[#E8EBF0]";
export const modalClassName = "rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1524] p-6";

export function StatusBadge({ value }: { value: string }) {
  const tone = ["running", "healthy", "ready", "fresh", "supported", "connected"].includes(value.toLowerCase()) ? "bg-emerald-50 text-emerald-700 dark:bg-[#0E1C13] dark:text-emerald-300" :
    ["error", "degraded", "unavailable", "offline"].includes(value.toLowerCase()) ? "bg-red-50 text-red-700 dark:bg-[#2A1212] dark:text-red-300" :
    ["stopped", "disabled", "unsupported", "no running fleets", "unknown"].includes(value.toLowerCase()) ? "bg-background-100 text-typography-600 dark:bg-[#1A2637] dark:text-[#B4BDCC]" : "bg-amber-50 text-amber-700 dark:bg-[#261F10] dark:text-amber-300";
  return <Box className={"self-start rounded-full px-3 py-1 " + tone}><Text className={"text-xs font-semibold capitalize " + tone}>{value}</Text></Box>;
}
export function ErrorMessage({ message }: { message?: string | null }) {
  return message ? <Box role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-[#2A1212]"><Text selectable className="text-sm text-red-700 dark:text-red-300">{message}</Text></Box> : null;
}
export function observedAt(value?: string) {
  if (!value || value.startsWith("0001-")) return "Not checked yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not checked yet" : date.toLocaleString("en-GB");
}
export function canChange(fleet: CelldFleet) { return !["provisioning", "deleting"].includes(fleet.status); }
