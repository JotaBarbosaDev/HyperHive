import React from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Pressable } from "@/components/ui/pressable";
import { Action, Failure, ink, muted, surface } from "@/components/support/support-ui";
import { useAutomationSocket } from "@/hooks/useAutomationSocket";
import { errorText, formatDuration, formatTime, listAutomationRuns, type RunSummary } from "@/services/automations";
import { rowClass, RunStatusBadge } from "./automation-ui";

// `bare` renders just the scrollable list for the IDE bottom panel.
export const RunHistory = React.memo(function RunHistory({ automationId, selectedRunId, onSelect, bare = false }: { automationId: string; selectedRunId: string | null; onSelect: (runId: string) => void; bare?: boolean }) {
  const [runs, setRuns] = React.useState<RunSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await listAutomationRuns(automationId, 50, signal);
      if (!signal?.aborted) { setRuns(res.runs ?? []); setError(null); }
    } catch (err) {
      if (!signal?.aborted) setError(errorText(err, "Could not load run history."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [automationId]);

  React.useEffect(() => {
    setRuns(null);
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useAutomationSocket({
    onRun: (run) => {
      if (run.automation_id !== automationId) return;
      setRuns((current) => {
        const list = current ?? [];
        return list.some((r) => r.id === run.id) ? list.map((r) => (r.id === run.id ? run : r)) : [run, ...list];
      });
    },
  });

  const rows = <>
    <Failure message={error} />
    {!runs && loading ? <ActivityIndicator /> : null}
    {runs && !runs.length ? <Text className={muted}>No runs yet. Press Run now to start one.</Text> : null}
    {runs?.map((run) => {
      const active = run.id === selectedRunId;
      return <Pressable key={run.id} onPress={() => onSelect(run.id)} accessibilityRole="button" accessibilityLabel={`Show run started ${formatTime(run.started_at)}`} accessibilityState={{ selected: active }}
        className={"flex-row flex-wrap items-center gap-3 px-3 py-2 rounded-xl " + rowClass(active)}
        style={{ minHeight: 44 }}>
        <RunStatusBadge status={run.status} />
        <Text className={ink + " text-sm"}>{formatTime(run.started_at)}</Text>
        <Text className={muted}>{run.trigger}</Text>
        <Text className={muted + " ml-auto"}>{run.exit_code !== null && run.status !== "running" ? `exit ${run.exit_code} · ` : ""}{formatDuration(run)}</Text>
      </Pressable>;
    })}
  </>;

  if (bare) return <Box className="flex-1 min-h-0">
    <Box className="flex-row items-center px-3 pt-2"><Text className={muted + " mr-auto"}>Last 50 runs</Text><Action label={loading ? "Loading…" : "Refresh"} compact onPress={() => void load()} disabled={loading} /></Box>
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 6 }}>{rows}</ScrollView>
  </Box>;

  return <Box className={surface + " gap-3"}>
    <Box className="flex-row items-center gap-2">
      <Heading size="md" className={ink + " mr-auto"}>Run history</Heading>
      <Action label={loading ? "Loading…" : "Refresh"} onPress={() => void load()} disabled={loading} />
    </Box>
    {rows}
  </Box>;
});
