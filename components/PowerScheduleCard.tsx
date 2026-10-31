import React from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import TimePickerField from "@/components/TimePickerField";
import {
  formatEpochShort,
  getPowerSchedule,
  updatePowerSchedule,
  validatePowerSchedule,
  type PowerScheduleView,
} from "@/services/power-schedule";

const POLL_AFTER_SAVE_MS = 3000;
const POLL_AFTER_SAVE_COUNT = 10;

// One schedule for the whole cluster, shown on the main dashboard. token comes from
// useAuthGuard: loading waits for it because the API base URL is restored with the session.
export default function PowerScheduleCard({ token }: { token: string | null }) {
  const [view, setView] = React.useState<PowerScheduleView | null>(null);
  const [draft, setDraft] = React.useState({ enabled: false, start: "08:00", stop: "23:00" });
  const [loadError, setLoadError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal, syncDraft = false) => {
    try {
      const loaded = await getPowerSchedule(signal);
      if (signal?.aborted) return;
      setView(loaded);
      setLoadError("");
      if (syncDraft) setDraft({ enabled: loaded.schedule.enabled, start: loaded.schedule.start, stop: loaded.schedule.stop });
    } catch (err) {
      if (!signal?.aborted) setLoadError(err instanceof Error ? err.message : "Could not load the power schedule.");
    }
  }, []);

  React.useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void load(controller.signal, true);
    return () => {
      controller.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load, token]);

  const schedule = view?.schedule;
  const validation = validatePowerSchedule(draft.start, draft.stop);
  const changed = !!schedule && (draft.enabled !== schedule.enabled || draft.start !== schedule.start || draft.stop !== schedule.stop);
  const failed = view?.hosts.filter((h) => h.lastError) ?? [];

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await updatePowerSchedule(draft);
      setMessage("Saved");
      await load(undefined, true);
      // Hosts are applied in the background; refresh their status for a short while.
      if (pollRef.current) clearInterval(pollRef.current);
      let remaining = POLL_AFTER_SAVE_COUNT;
      pollRef.current = setInterval(() => {
        remaining -= 1;
        void load();
        if (remaining <= 0 && pollRef.current) clearInterval(pollRef.current);
      }, POLL_AFTER_SAVE_MS);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return <Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4 gap-4">
    <Box className="flex-row items-center justify-between gap-3">
      <Box className="flex-1 gap-0.5">
        <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">Power schedule</Heading>
        <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">All machines{view ? ` · ${view.masterTz}` : ""}</Text>
      </Box>
      <Switch accessibilityLabel="Enable cluster power schedule" value={draft.enabled} disabled={!view} onValueChange={(enabled: boolean) => setDraft((d) => ({ ...d, enabled }))} />
    </Box>

    {loadError ? <Text accessibilityRole="alert" className="text-sm text-error-700 dark:text-error-400">{loadError}</Text> : null}
    {!view && !loadError ? <Text className="text-sm text-typography-500 dark:text-[#8A94A8]">Loading…</Text> : null}

    {view ? <>
      <Box className={`flex-row gap-3 ${draft.enabled ? "" : "opacity-50"}`}>
        <TimePickerField label="Turn off" value={draft.stop} onChange={(stop) => setDraft((d) => ({ ...d, stop }))} />
        <TimePickerField label="Turn on" value={draft.start} onChange={(start) => setDraft((d) => ({ ...d, start }))} />
      </Box>
      {validation ? <Text accessibilityRole="alert" className="text-xs text-error-700 dark:text-error-400">{validation}</Text> : null}

      {failed.map((h) => <Text key={h.machine} accessibilityRole="alert" className="text-xs text-error-700 dark:text-error-400">{h.machine}: {h.lastError}</Text>)}
      {!failed.length && schedule?.enabled && view.next && !changed ? <Text className="text-xs text-typography-600 dark:text-[#94A3B8]">Next shutdown {formatEpochShort(view.next.stopUnix)}</Text> : null}

      <Box className="flex-row flex-wrap items-center gap-3">
        <Button size="sm" isDisabled={saving || !changed || !!validation} onPress={save} className="rounded-xl" style={{ minHeight: 44 }}>
          <ButtonText>{saving ? "Saving…" : "Save"}</ButtonText>
        </Button>
        {message ? <Text accessibilityRole="alert" className="text-xs text-typography-600 dark:text-[#94A3B8]">{message}</Text> : null}
        <Text className="ml-auto text-[11px] text-typography-500 dark:text-[#8A94A8]">Needs BIOS "Power On By RTC" off</Text>
      </Box>
    </> : null}
  </Box>;
}
