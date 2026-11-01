import React from "react";
import { Platform, ScrollView } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Pressable } from "@/components/ui/pressable";
import { Action, Failure, ink, muted } from "@/components/support/support-ui";
import { ApiError } from "@/services/api-client";
import { deleteAutomation, errorText, killAutomationRun, runAutomation, type Automation } from "@/services/automations";
import { AutomationConfigForm } from "./automation-config-form";
import { AutomationIde } from "./automation-ide";
import { RunHistory } from "./run-history";
import { RunLogPane } from "./run-log-pane";
import { Badge, ConfirmDialog, DangerAction, subtle } from "./automation-ui";

const PANEL_MIN = 120;
const PANEL_DEFAULT = 260;
const PANEL_COLLAPSED = 40;

type PanelTab = "output" | "runs";

// Web-only drag handle that resizes the bottom panel; the collapse button is the keyboard alternative.
function ResizeHandle({ height, onResize }: { height: number; onResize: (h: number) => void }) {
  const start = React.useRef<{ y: number; h: number } | null>(null);
  if (Platform.OS !== "web") return null;
  const onPointerDown = (e: any) => {
    start.current = { y: e.nativeEvent.clientY ?? e.clientY, h: height };
    const move = (ev: PointerEvent) => {
      if (!start.current) return;
      const max = Math.max(PANEL_MIN, window.innerHeight - 260);
      onResize(Math.min(max, Math.max(PANEL_MIN, start.current.h + start.current.y - ev.clientY)));
    };
    const stop = () => { start.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };
  return <Box accessibilityElementsHidden {...({ onPointerDown } as object)} className="h-1.5 web:cursor-row-resize hover:bg-[#2DD4BF]/40 active:bg-[#2DD4BF]/60" />;
}

export function AutomationDetail({ automation, wide, notices, onChanged, onDeleted, onBack }: {
  automation: Automation; wide: boolean; notices?: React.ReactNode;
  onChanged: (a: Automation) => void; onDeleted: () => void; onBack: () => void;
}) {
  const [logRunId, setLogRunId] = React.useState<string | null>(automation.running_run_id ?? automation.last_run?.id ?? null);
  const [busy, setBusy] = React.useState<"run" | "kill" | "delete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [panelTab, setPanelTab] = React.useState<PanelTab>("output");
  const [panelHeight, setPanelHeight] = React.useState(PANEL_DEFAULT);
  const [panelOpen, setPanelOpen] = React.useState(true);

  React.useEffect(() => {
    setLogRunId(automation.running_run_id ?? automation.last_run?.id ?? null);
    setError(null);
  }, [automation.id]);
  // Follow a run that started elsewhere (condition fire or another client).
  React.useEffect(() => { if (automation.running_run_id) setLogRunId(automation.running_run_id); }, [automation.running_run_id]);

  const showRun = (runId: string) => { setLogRunId(runId); setPanelTab("output"); setPanelOpen(true); };

  const run = async () => {
    setBusy("run"); setError(null);
    try {
      const { run_id } = await runAutomation(automation.id);
      showRun(run_id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("This automation is already running.");
        if (automation.running_run_id) showRun(automation.running_run_id);
      } else setError(errorText(err, "Could not start the run."));
    } finally { setBusy(null); }
  };

  const kill = async () => {
    if (!automation.running_run_id) return;
    setBusy("kill"); setError(null);
    try { await killAutomationRun(automation.running_run_id); } catch (err) { setError(errorText(err, "Could not kill the run.")); }
    finally { setBusy(null); }
  };

  const remove = async () => {
    setBusy("delete"); setError(null);
    try { await deleteAutomation(automation.id); setConfirmDelete(false); onDeleted(); }
    catch (err) { setError(errorText(err, "Could not delete the automation.")); setConfirmDelete(false); }
    finally { setBusy(null); }
  };

  const running = !!automation.running_run_id;

  const header = <Box className={"gap-2 " + (wide ? "px-4 py-3 border-b border-outline-100 dark:border-[#1F2D40] bg-background-0 dark:bg-[#0E1726]" : "")}>
    <Box className="flex-row flex-wrap items-center gap-2">
      <Box className="flex-row items-center gap-1 mr-auto min-w-0 flex-shrink">
        <Pressable onPress={onBack} accessibilityRole="link" accessibilityLabel="Back to all automations"
          className="px-1 rounded-md web:cursor-pointer hover:bg-background-50 dark:hover:bg-[#15233A] focus-visible:outline-2 focus-visible:outline-[#2DD4BF]" style={{ minHeight: 32, justifyContent: "center" }}>
          <Text className={subtle + " font-semibold"}>HH Automations</Text>
        </Pressable>
        <Text className={subtle}>/</Text>
        <Heading size={wide ? "md" : "lg"} numberOfLines={1} className={ink + " flex-shrink"}>{automation.name}</Heading>
        <Box className="ml-2"><Badge label={running ? "running" : automation.enabled ? "enabled" : "disabled"} tone={running ? "info" : automation.enabled ? "ok" : "neutral"} /></Box>
      </Box>
      <Action label={busy === "run" ? "Starting…" : running ? "Running…" : "Run now"} primary onPress={run} disabled={busy !== null || running} />
      {running ? <Action label={busy === "kill" ? "Killing…" : "Kill"} onPress={kill} disabled={busy !== null} /> : null}
      <Box className="w-px self-stretch mx-1 bg-outline-100 dark:bg-[#26364A]" />
      <DangerAction label="Delete" onPress={() => setConfirmDelete(true)} disabled={busy !== null} />
    </Box>
    {automation.description && !wide ? <Text className={muted}>{automation.description}</Text> : null}
    <Failure message={error} />
  </Box>;

  const dialog = confirmDelete ? <ConfirmDialog
    title="Delete automation"
    message={`Delete "${automation.name}"? Its running run is killed, and its script files and entire run history are permanently removed.`}
    confirmLabel="Delete" busy={busy === "delete"} onConfirm={remove} onClose={() => setConfirmDelete(false)} /> : null;

  if (!wide) return <ScrollView className="flex-1 bg-background-50 dark:bg-[#0B1422]" contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 32, gap: 16 }} keyboardShouldPersistTaps="handled">
    {header}
    <AutomationConfigForm automation={automation} onSaved={onChanged} notices={notices} />
    <AutomationIde automationId={automation.id} onShowRun={showRun} />
    <RunLogPane runId={logRunId} />
    <RunHistory automationId={automation.id} selectedRunId={logRunId} onSelect={setLogRunId} />
    {dialog}
  </ScrollView>;

  const tab = (id: PanelTab, label: string) => {
    const selected = panelOpen && panelTab === id;
    return <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={label}
      onPress={() => { setPanelTab(id); setPanelOpen(true); }}
      className={"px-3 justify-center border-b-2 web:cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2DD4BF] " + (selected ? "border-[#147D78] dark:border-[#2DD4BF]" : "border-transparent hover:bg-background-50 dark:hover:bg-[#15233A]")}
      style={{ minHeight: PANEL_COLLAPSED - 2 }}>
      <Text className={"text-xs font-semibold uppercase tracking-wider " + (selected ? "text-typography-900 dark:text-[#E8EBF0]" : "text-typography-600 dark:text-[#8A94A8]")}>{label}</Text>
    </Pressable>;
  };

  return <Box className="flex-1 min-h-0 bg-background-50 dark:bg-[#0B1422]">
    {header}
    <Box className="flex-1 min-h-0 flex-row">
      <Box className="border-r border-outline-100 dark:border-[#1F2D40] bg-background-0 dark:bg-[#0E1726]" style={{ width: 360 }}>
        <AutomationConfigForm automation={automation} onSaved={onChanged} notices={notices} panel />
      </Box>
      <Box className="flex-1 min-w-0 min-h-0">
        <Box className="flex-1 min-h-0"><AutomationIde automationId={automation.id} onShowRun={showRun} fill /></Box>
        <Box className="border-t border-outline-100 dark:border-[#1F2D40] bg-background-0 dark:bg-[#0E1726]" style={{ height: panelOpen ? panelHeight : PANEL_COLLAPSED }}>
          {panelOpen ? <ResizeHandle height={panelHeight} onResize={setPanelHeight} /> : null}
          <Box accessibilityRole="tablist" className="flex-row items-stretch pr-2 border-b border-outline-100 dark:border-[#1F2D40]">
            {tab("output", "Output")}
            {tab("runs", "Runs")}
            <Box className="flex-1" />
            <Pressable accessibilityRole="button" accessibilityLabel={panelOpen ? "Collapse panel" : "Expand panel"} accessibilityState={{ expanded: panelOpen }} onPress={() => setPanelOpen((v) => !v)}
              className="px-3 justify-center rounded-md web:cursor-pointer hover:bg-background-50 dark:hover:bg-[#15233A] focus-visible:outline-2 focus-visible:outline-[#2DD4BF]" style={{ minHeight: PANEL_COLLAPSED - 6 }}>
              <Text className={subtle}>{panelOpen ? "Hide" : "Show"}</Text>
            </Pressable>
          </Box>
          {panelOpen ? <Box className="flex-1 min-h-0">
            {panelTab === "output"
              ? <RunLogPane runId={logRunId} bare />
              : <RunHistory automationId={automation.id} selectedRunId={logRunId} onSelect={showRun} bare />}
          </Box> : null}
        </Box>
      </Box>
    </Box>
    {dialog}
  </Box>;
}
