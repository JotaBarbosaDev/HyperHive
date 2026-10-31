import React from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import {
  formatEpoch,
  getPowerSchedule,
  updatePowerSchedule,
  validatePowerSchedule,
  type PowerScheduleHost,
  type PowerScheduleView,
} from "@/services/power-schedule";

const POLL_AFTER_SAVE_MS = 3000;
const POLL_AFTER_SAVE_COUNT = 10;

function HostRow({ host }: { host: PowerScheduleHost }) {
  const neverApplied = !host.appliedAt && !host.lastError;
  let detail = "Not applied yet.";
  if (host.lastError) detail = `Last attempt failed: ${host.lastError}`;
  else if (!neverApplied) detail = host.enabled ? `Off ${formatEpoch(host.stopUnix)} · wakes ${formatEpoch(host.wakeUnix)} · job ${host.jobId}` : "Schedule cleared on this host.";
  return <Box className="gap-1 py-2 border-t border-outline-200 dark:border-[#243247]">
    <Box className="flex-row flex-wrap items-center gap-2">
      <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">{host.machine}</Text>
      <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">{host.connected ? "online" : "offline (applies on next connect)"}</Text>
    </Box>
    <Text accessibilityRole={host.lastError ? "alert" : undefined} className={host.lastError ? "text-xs text-error-700 dark:text-error-400" : "text-xs text-typography-600 dark:text-[#94A3B8]"}>{detail}</Text>
  </Box>;
}

// One schedule for the whole cluster, shown on the main dashboard.
export default function PowerScheduleCard() {
  const [view, setView] = React.useState<PowerScheduleView | null>(null);
  const [draft, setDraft] = React.useState({ enabled: false, start: "", stop: "" });
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
      if (!signal?.aborted) setLoadError(err instanceof Error ? err.message : "Could not load the power schedule. Update the HyperHive backend.");
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal, true);
    return () => {
      controller.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const schedule = view?.schedule;
  const start = draft.start.trim();
  const stop = draft.stop.trim();
  const validation = validatePowerSchedule(start, stop);
  const changed = !!schedule && (draft.enabled !== schedule.enabled || start !== schedule.start || stop !== schedule.stop);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await updatePowerSchedule({ enabled: draft.enabled, start, stop });
      setMessage("Saved. Applying to all machines…");
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
      setMessage(err instanceof Error ? err.message : "Could not save the power schedule.");
    } finally {
      setSaving(false);
    }
  };

  return <Box className="mt-4 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] px-4 py-3 gap-3">
    <Box className="gap-1">
      <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">Power schedule (all machines)</Heading>
      <Text className="text-xs text-typography-600 dark:text-[#94A3B8]">This schedule applies to every machine in the cluster. Slaves power off at the stop time, the master host 3 minutes later, and all wake at the start time. Running VMs get a normal OS shutdown.</Text>
    </Box>
    {loadError ? <Text accessibilityRole="alert" className="text-sm text-error-700 dark:text-error-400">{loadError}</Text> : null}
    {!view && !loadError ? <Text className="text-sm text-typography-700 dark:text-[#CBD5E1]">Loading power schedule…</Text> : null}
    {view ? <>
      <Box className="flex-row items-center justify-between gap-2">
        <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">Enabled</Text>
        <Switch accessibilityLabel="Enable cluster power schedule" value={draft.enabled} onValueChange={(enabled: boolean) => setDraft((d) => ({ ...d, enabled }))} />
      </Box>
      <Box className="flex-row flex-wrap gap-2">
        {(["start", "stop"] as const).map((key) => <Box key={key} className="flex-1 min-w-[120px] gap-1">
          <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">{key === "start" ? "Start (wake)" : "Stop (power off)"}</Text>
          <Input className="rounded-xl" style={{ minHeight: 44 }}>
            <InputField accessibilityLabel={`Power schedule ${key} time`} placeholder={key === "start" ? "e.g. 08:00" : "e.g. 01:00"} value={draft[key]} autoCapitalize="none" autoCorrect={false} onChangeText={(value: string) => setDraft((d) => ({ ...d, [key]: value }))} />
          </Input>
        </Box>)}
      </Box>
      <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Times are in the master's timezone ({view.masterTz}). Stop may be after midnight. A machine started inside the off window stays on until the next stop.</Text>
      {validation ? <Text accessibilityRole="alert" className="text-xs text-error-700 dark:text-error-400">{validation}</Text> : null}
      <Box className="rounded-xl border border-warning-300 dark:border-warning-700 bg-warning-50 dark:bg-warning-900/20 p-3">
        <Text className="text-xs text-typography-800 dark:text-[#E8EBF0]">BIOS "Power On By RTC" must be DISABLED on every machine. When it is enabled, the firmware overwrites the wake alarm and machines will not start. Machines also will not wake after a power cut or crash before the stop time.</Text>
      </Box>
      <Box className="flex-row flex-wrap items-center gap-3">
        <Button size="sm" isDisabled={saving || !changed || !!validation} onPress={save} className="rounded-xl" style={{ minHeight: 44 }}>
          <ButtonText>{saving ? "Saving…" : "Save for all machines"}</ButtonText>
        </Button>
        {message ? <Text accessibilityRole="alert" className="text-xs text-typography-700 dark:text-[#CBD5E1]">{message}</Text> : null}
      </Box>
      {view.next ? <Text className="text-xs text-typography-600 dark:text-[#94A3B8]">Next off: slaves {formatEpoch(view.next.stopUnix)}, master host {formatEpoch(view.next.masterStopUnix)}. Wake {formatEpoch(view.next.wakeUnix)}.</Text> : null}
      <Box>
        <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0] mb-1">Hosts</Text>
        {view.hosts.length === 0 ? <Text className="text-xs text-typography-600 dark:text-[#94A3B8]">No machines connected.</Text> : view.hosts.map((host) => <HostRow key={host.machine} host={host} />)}
      </Box>
    </> : null}
  </Box>;
}
