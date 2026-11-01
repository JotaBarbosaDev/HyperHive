import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Action, Failure, Field, ink, muted, surface } from "@/components/support/support-ui";
import { errorText, getAutomationSettings, updateAutomationSettings, type AutomationSettings } from "@/services/automations";

// Global pause and run retention. PUT replaces the whole object, so retention is always sent back.
export function AutomationSettingsCard({ onPausedChange }: { onPausedChange: (paused: boolean) => void }) {
  const [settings, setSettings] = React.useState<AutomationSettings | null>(null);
  const [days, setDays] = React.useState("");
  const [count, setCount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const apply = (s: AutomationSettings) => { setSettings(s); setDays(String(s.retention_days)); setCount(String(s.retention_count)); onPausedChange(s.paused); };

  React.useEffect(() => {
    const controller = new AbortController();
    getAutomationSettings(controller.signal).then((s) => { if (!controller.signal.aborted) apply(s); })
      .catch((err) => { if (!controller.signal.aborted) setError(errorText(err, "Could not load settings.")); });
    return () => controller.abort();
  }, []);

  const save = async (next: AutomationSettings) => {
    setBusy(true); setError(null); setMessage("");
    try {
      const res = await updateAutomationSettings(next);
      apply(res && typeof res === "object" && "paused" in res ? res : next);
      setMessage("Saved");
    } catch (err) {
      setError(errorText(err, "Could not save settings."));
    } finally { setBusy(false); }
  };

  const valid = /^\d+$/.test(days.trim()) && /^\d+$/.test(count.trim());
  const changed = !!settings && (days.trim() !== String(settings.retention_days) || count.trim() !== String(settings.retention_count));

  return <Box className={surface + " gap-3"}>
    <Box className="flex-row items-center gap-3">
      <Box className="flex-1">
        <Text className={ink + " font-semibold"}>Pause all condition fires</Text>
        <Text className={muted}>Manual runs still work while paused.</Text>
      </Box>
      <Switch accessibilityLabel="Pause all automations" value={!!settings?.paused} disabled={!settings || busy}
        onValueChange={(paused: boolean) => { if (settings) void save({ ...settings, paused }); }} />
    </Box>
    {settings ? <Box className="flex-row flex-wrap items-end gap-3">
      <Box style={{ minWidth: 140, flexGrow: 1 }}><Field label="Keep runs (days)" value={days} onChange={setDays} /></Box>
      <Box style={{ minWidth: 140, flexGrow: 1 }}><Field label="Keep last runs (count)" value={count} onChange={setCount} /></Box>
      <Action label={busy ? "Saving…" : "Save retention"} onPress={() => void save({ ...settings, retention_days: Number(days), retention_count: Number(count) })} disabled={busy || !valid || !changed} />
    </Box> : !error ? <Text className={muted}>Loading settings…</Text> : null}
    {!valid && settings ? <Text className="text-sm text-red-700 dark:text-red-300">Retention values must be whole numbers ≥ 0.</Text> : null}
    <Failure message={error} />
    {message ? <Text accessibilityLiveRegion="polite" className={muted}>{message}</Text> : null}
  </Box>;
}
