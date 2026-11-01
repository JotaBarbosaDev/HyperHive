import React from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { RunStatus } from "@/services/automations";
import { Action, muted } from "@/components/support/support-ui";
import { SupportDialog } from "@/components/support/support-dialogs";

export const mono = "font-mono text-xs text-typography-900 dark:text-[#E8EBF0]";
export const subtle = "text-xs text-typography-600 dark:text-[#8A94A8]";

// Selectable list rows (automations, runs, files): visible hover, focus and selected states in both themes.
export const rowClass = (selected: boolean) => "border web:cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2DD4BF] active:opacity-80 " + (selected
  ? "border-[#147D78] bg-[#E7F6F2] dark:border-[#2DD4BF] dark:bg-[#153B3B]"
  : "border-outline-100 dark:border-[#26364A] bg-background-0 dark:bg-[#101B2B] hover:bg-background-50 dark:hover:bg-[#15233A]");

// Destructive actions stay outlined in the danger color so they never compete with the primary action.
export function DangerAction({ label, onPress, disabled = false, compact = false }: { label: string; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  return <Button size={compact ? "xs" : "sm"} variant="outline" action="negative" isDisabled={disabled} accessibilityLabel={label} onPress={onPress}
    className={"rounded-lg self-start border-[#BA4F3D] dark:border-[#F4A293] " + (compact ? "h-6 min-h-6 px-2" : "min-h-9")}>
    <ButtonText className="text-[#BA4F3D] dark:text-[#F4A293]">{label}</ButtonText>
  </Button>;
}

type Tone = "ok" | "bad" | "warn" | "info" | "neutral";
const toneClass: Record<Tone, [string, string]> = {
  ok: ["bg-[#E7F6F2] dark:bg-[#153B3B]", "text-[#147D78] dark:text-[#6ED5C4]"],
  bad: ["bg-[#FFF0EC] dark:bg-[#3C2629]", "text-[#BA4F3D] dark:text-[#F4A293]"],
  warn: ["bg-[#FFF5DF] dark:bg-[#38321F]", "text-[#946A18] dark:text-[#F0CC80]"],
  info: ["bg-[#E8F0FE] dark:bg-[#1A2A44]", "text-[#2F5FB3] dark:text-[#9DBBF2]"],
  neutral: ["bg-background-100 dark:bg-[#1A2638]", "text-typography-700 dark:text-[#B4BECD]"],
};

export function Badge({ label, tone }: { label: string; tone: Tone }) {
  const [bg, fg] = toneClass[tone];
  return <Box className={"self-start px-2 py-0.5 rounded-md " + bg}><Text className={"text-xs font-semibold " + fg}>{label}</Text></Box>;
}

const runTone: Record<RunStatus, Tone> = { running: "info", succeeded: "ok", failed: "bad", timeout: "bad", killed: "warn", interrupted: "warn" };
export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Badge label={status} tone={runTone[status] ?? "neutral"} />;
}

export function Banner({ tone, children }: { tone: "warn" | "bad" | "info"; children: React.ReactNode }) {
  const [bg, fg] = toneClass[tone];
  return <Box role="alert" className={"p-3 rounded-xl " + bg}><Text selectable className={"text-sm " + fg}>{children}</Text></Box>;
}

export function ConfirmDialog({ title, message, confirmLabel, busy, onConfirm, onClose }: { title: string; message: string; confirmLabel: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return <SupportDialog title={title} onClose={onClose} footer={<><Action label="Cancel" onPress={onClose} disabled={busy} /><DangerAction label={busy ? "Working…" : confirmLabel} onPress={onConfirm} disabled={busy} /></>}>
    <Text className={muted}>{message}</Text>
  </SupportDialog>;
}

export function SnapshotView({ snapshot }: { snapshot: Record<string, unknown> | null | undefined }) {
  const entries = Object.entries(snapshot ?? {});
  if (!entries.length) return <Text className={muted}>No snapshot values.</Text>;
  return <Box className="gap-0.5">{entries.map(([key, value]) => <Text key={key} selectable className={mono}>{key} = {JSON.stringify(value)}</Text>)}</Box>;
}
