import React from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Action, Failure, ink, muted, surface } from "@/components/support/support-ui";
import { useAutomationSocket } from "@/hooks/useAutomationSocket";
import { errorText, formatDuration, formatTime, getAutomationRun, killAutomationRun, type RunDetail } from "@/services/automations";
import { mono, RunStatusBadge, SnapshotView } from "./automation-ui";

// Shows one run: existing output from GET /automations/runs/{id}, then live AutomationLog chunks.
// `bare` drops the card chrome so the IDE bottom panel can fill its height with the log.
export function RunLogPane({ runId, title = "Run output", onClose, bare = false }: { runId: string | null; title?: string; onClose?: () => void; bare?: boolean }) {
  const [run, setRun] = React.useState<RunDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [killing, setKilling] = React.useState(false);
  const [showSnapshot, setShowSnapshot] = React.useState(false);
  const pending = React.useRef<string[]>([]);
  const loaded = React.useRef(false);
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    setRun(null); setError(null); setShowSnapshot(false);
    pending.current = []; loaded.current = false;
    if (!runId) return;
    const controller = new AbortController();
    setLoading(true);
    getAutomationRun(runId, controller.signal)
      .then((detail) => {
        if (controller.signal.aborted) return;
        // Chunks that arrived during the fetch are only kept while the run is still producing output;
        // a few may overlap with the fetched output.
        const extra = detail.status === "running" ? pending.current.join("") : "";
        setRun({ ...detail, output: (detail.output ?? "") + extra });
        loaded.current = true;
      })
      .catch((err) => { if (!controller.signal.aborted) setError(errorText(err, "Could not load the run.")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [runId]);

  useAutomationSocket({
    onLog: (id, chunk) => {
      if (id !== runId) return;
      if (!loaded.current) { pending.current.push(chunk); return; }
      setRun((r) => (r ? { ...r, output: r.output + chunk } : r));
    },
    onRun: (summary) => {
      if (summary.id !== runId) return;
      setRun((r) => (r ? { ...r, ...summary, output: r.output } : r));
    },
  });

  const kill = async () => {
    if (!run) return;
    setKilling(true); setError(null);
    try { await killAutomationRun(run.id); } catch (err) { setError(errorText(err, "Could not kill the run.")); }
    finally { setKilling(false); }
  };

  return <Box className={bare ? "flex-1 min-h-0 gap-2 p-3" : surface + " gap-3"}>
    <Box className="flex-row flex-wrap items-center gap-2">
      {bare ? <Text className={muted + " mr-auto"}>{run ? `${run.trigger} · started ${formatTime(run.started_at)} · ${run.status === "running" ? "running" : `took ${formatDuration(run)}`}${run.exit_code !== null && run.status !== "running" ? ` · exit ${run.exit_code}` : ""}` : ""}</Text> : <Heading size="md" className={ink + " mr-auto"}>{title}</Heading>}
      {run ? <RunStatusBadge status={run.status} /> : null}
      {run?.status === "running" ? <Action label={killing ? "Killing…" : "Kill"} onPress={kill} disabled={killing} /> : null}
      {run?.snapshot && Object.keys(run.snapshot).length ? <Action label={showSnapshot ? "Hide snapshot" : "Snapshot"} onPress={() => setShowSnapshot((v) => !v)} selected={showSnapshot} /> : null}
      {onClose ? <Action label="Close" onPress={onClose} /> : null}
    </Box>
    {!runId ? <Text className={muted}>No run selected. Press RUN or pick a run from the history.</Text> : null}
    {loading ? <ActivityIndicator /> : null}
    <Failure message={error} />
    {run ? <>
      {bare ? null : <Text className={muted}>
        {run.trigger} · started {formatTime(run.started_at)} · {run.status === "running" ? "running" : `took ${formatDuration(run)}`}{run.exit_code !== null && run.status !== "running" ? ` · exit ${run.exit_code}` : ""}
      </Text>}
      {run.error ? <Failure message={run.error} /> : null}
      {showSnapshot ? <Box className="p-3 rounded-xl bg-background-50 dark:bg-[#0A1422] gap-1">
        {run.condition ? <Text selectable className={mono}>{run.condition}</Text> : null}
        <SnapshotView snapshot={run.snapshot} />
      </Box> : null}
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        style={bare ? { flex: 1, minHeight: 0 } : { maxHeight: 360, minHeight: 120 }}
        className="rounded-xl p-3 border bg-[#F1F5F9] border-outline-100 dark:bg-[#0B1220] dark:border-[#26364A]"
      >
        <Text selectable accessibilityLiveRegion="polite" className="font-mono text-xs text-[#1E293B] dark:text-[#D6DEEB]">
          {run.output || (run.status === "running" ? "Waiting for output…" : "No output.")}
        </Text>
      </ScrollView>
      {run.output_truncated ? <Text className={muted}>Output was truncated at 1 MiB.</Text> : null}
    </> : null}
  </Box>;
}
