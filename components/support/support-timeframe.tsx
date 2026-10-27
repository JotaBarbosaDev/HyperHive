import React from "react";
import { Platform } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Action, Field, Failure, muted } from "./support-ui";
import { SupportDialog } from "./support-dialogs";
import type { SupportTimeframe } from "@/types/support";

export function timeframeBounds(timeframe: SupportTimeframe, now = Date.now()) {
  return { since: timeframe.minutes ? new Date(now - timeframe.minutes * 60000).toISOString() : timeframe.since, until: timeframe.until };
}
export function inTimeframe(received: string, timeframe: SupportTimeframe, now = Date.now()) {
  const bounds = timeframeBounds(timeframe, now);
  const time = Date.parse(received);
  return Number.isFinite(time) && (!bounds.since || time >= Date.parse(bounds.since)) && (!bounds.until || time <= Date.parse(bounds.until));
}
export function SupportTimeframeControl({ value, onChange }: { value: SupportTimeframe; onChange: (value: SupportTimeframe) => void }) {
  const [custom, setCustom] = React.useState(false);
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const openCustom = () => {
    const now = Date.now();
    const bounds = timeframeBounds(value, now);
    const localInput = (time: string) => {
      const date = new Date(time);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };
    setStart(localInput(bounds.since ?? new Date(now - 86400000).toISOString()));
    setEnd(localInput(bounds.until ?? new Date(now).toISOString()));
    setError(null); setCustom(true);
  };
  const apply = () => {
    const parse = (input: string) => /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(input.trim()) ? Date.parse(input.trim().replace(" ", "T")) : NaN;
    const since = parse(start), until = parse(end);
    if (!Number.isFinite(since) || !Number.isFinite(until) || since >= until) { setError("Enter valid local start and end times, with end after start."); return; }
    setError(null); onChange({ since: new Date(since).toISOString(), until: new Date(until).toISOString() }); setCustom(false);
  };
  return <Box className="gap-2">
    <Box className="flex-row flex-wrap items-center gap-2"><Text size="xs" className={muted}>Page timeframe</Text>{[[30, "30 mins"], [1440, "1 day"], [10080, "7 days"]].map(([minutes, label]) => <Action key={minutes} label={String(label)} selected={value.minutes === minutes} onPress={() => { setCustom(false); setError(null); onChange({ minutes: Number(minutes) }); }} />)}<Action label="Custom timeframe" selected={!value.minutes} onPress={openCustom} /></Box>
    {custom ? <SupportDialog title="Custom timeframe" onClose={() => setCustom(false)} footer={<><Action label="Cancel" onPress={() => setCustom(false)} /><Action primary label="Apply timeframe" onPress={apply} /></>}>
      <Text size="xs" className={muted}>Choose the start and end in your local time.</Text>
      {Platform.OS === "web" ? <>
        <label className={muted + " flex min-w-0 flex-col gap-1"}>Start time<input type="datetime-local" aria-label="Start time" value={start} max={end || undefined} onChange={(event) => setStart(event.target.value)} className="min-w-0 w-full rounded-lg border border-outline-200 dark:border-[#2A3B52] bg-transparent p-2 text-typography-900 dark:text-[#E8EBF0] [color-scheme:light] dark:[color-scheme:dark]" /></label>
        <label className={muted + " flex min-w-0 flex-col gap-1"}>End time<input type="datetime-local" aria-label="End time" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} className="min-w-0 w-full rounded-lg border border-outline-200 dark:border-[#2A3B52] bg-transparent p-2 text-typography-900 dark:text-[#E8EBF0] [color-scheme:light] dark:[color-scheme:dark]" /></label>
      </> : <><Field label="Start time (YYYY-MM-DD HH:mm)" value={start} onChange={setStart} /><Field label="End time (YYYY-MM-DD HH:mm)" value={end} onChange={setEnd} /></>}
      <Failure message={error} />
    </SupportDialog> : null}
    <Text size="xs" className={muted}>{value.minutes ? `Last ${value.minutes === 10080 ? "7 days" : value.minutes === 1440 ? "1 day" : "30 minutes"} · live` : `${new Date(value.since!).toLocaleString()} → ${new Date(value.until!).toLocaleString()}`} · All widgets · Receipt time · Limited by App retention. Health badges show current state.</Text>
  </Box>;
}
