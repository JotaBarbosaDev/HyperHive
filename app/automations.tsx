import React from "react";
import { ActivityIndicator, Platform, ScrollView, useWindowDimensions } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useAutomationSocket } from "@/hooks/useAutomationSocket";
import { selectAutomation, useAutomationNavigation } from "@/hooks/useAutomationNavigation";
import { Action, Failure, Field, ink, muted, surface } from "@/components/support/support-ui";
import { SupportDialog } from "@/components/support/support-dialogs";
import { AutomationDetail } from "@/components/automations/automation-detail";
import { AutomationSettingsCard } from "@/components/automations/automation-settings";
import { Badge, Banner, mono, rowClass, RunStatusBadge, subtle } from "@/components/automations/automation-ui";
import { createAutomation, errorText, formatTime, listAutomations, updateAutomation, type Automation, type AutomationList } from "@/services/automations";

const POLL_MS = 5000;
// Below this the IDE layout gets cramped, so the workspace stacks into one scrolling column.
const IDE_MIN_WIDTH = 1100;

function AutomationCard({ automation, selected, onSelect, onToggle }: { automation: Automation; selected: boolean; onSelect: () => void; onToggle: (enabled: boolean) => void }) {
  const state = automation.state;
  const conditionTone = state?.last_error ? "bad" : state?.condition_value ? "ok" : "neutral";
  return <Pressable onPress={onSelect} accessibilityRole="button" accessibilityLabel={`Open automation ${automation.name}`} accessibilityState={{ selected }}
    className={"gap-2 p-4 rounded-2xl " + rowClass(selected)} style={{ flexBasis: 320, flexGrow: 1, maxWidth: 520 }}>
    <Box className="flex-row items-center gap-2">
      <Text numberOfLines={1} className={ink + " font-semibold flex-1"}>{automation.name}</Text>
      <Switch accessibilityLabel={`Enable ${automation.name}`} value={automation.enabled} onValueChange={onToggle} />
    </Box>
    {automation.condition ? <Text numberOfLines={2} className={mono + " p-2 rounded-lg bg-background-50 dark:bg-[#0A1422]"}>{automation.condition}</Text> : <Text className={muted}>Manual runs only</Text>}
    <Box className="flex-row flex-wrap items-center gap-1.5">
      {automation.condition ? <Badge label={state?.last_error ? "condition error" : `condition ${state?.condition_value ? "true" : "false"}`} tone={conditionTone} /> : null}
      {automation.condition ? <Badge label={state?.armed ? "armed" : "disarmed"} tone={state?.armed ? "info" : "warn"} /> : null}
      {automation.running_run_id ? <Badge label="running" tone="info" /> : null}
      {automation.last_run && !automation.running_run_id ? <RunStatusBadge status={automation.last_run.status} /> : null}
      {automation.last_run?.exit_code !== null && automation.last_run?.exit_code !== undefined && !automation.running_run_id ? <Text className={subtle}>exit {automation.last_run.exit_code}</Text> : null}
    </Box>
    {automation.description ? <Text numberOfLines={2} className={muted}>{automation.description}</Text> : null}
    {state?.last_error ? <Text numberOfLines={2} className="text-xs text-[#BA4F3D] dark:text-[#F4A293]">{state.last_error}</Text> : null}
    {state?.disabled_reason ? <Text numberOfLines={2} className="text-xs text-[#946A18] dark:text-[#F0CC80]">Disabled: {state.disabled_reason}</Text> : null}
    <Text className={subtle}>Last fired {formatTime(state?.last_fired_at)}</Text>
  </Pressable>;
}

export default function AutomationsScreen() {
  const { token, isChecking } = useAuthGuard();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === "web" && width >= IDE_MIN_WIDTH;
  const selectedId = useAutomationNavigation((s) => s.selectedId);
  const [data, setData] = React.useState<AutomationList | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [rowError, setRowError] = React.useState<string | null>(null);

  // The sidebar dropdown renders from the shared store, so every local change is mirrored there.
  // Mirror after commit: updating the store from a setState updater runs during render.
  React.useEffect(() => {
    if (data) useAutomationNavigation.setState({ automations: data.automations, loaded: true });
  }, [data]);
  const publish = React.useCallback((next: AutomationList | null) => setData(next), []);
  const update = (fn: (d: AutomationList) => AutomationList) => setData((d) => (d ? fn(d) : d));

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await listAutomations(signal);
      if (signal?.aborted) return;
      publish({ ...res, automations: res.automations ?? [] }); setError(null);
    } catch (err) {
      if (!signal?.aborted) setError(errorText(err, "Could not load automations."));
    }
  }, [publish]);

  // Condition state changes are not pushed over the websocket, so poll while the screen is open.
  React.useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), POLL_MS);
    return () => { controller.abort(); clearInterval(timer); };
  }, [token, load]);
  React.useEffect(() => () => useAutomationNavigation.setState({ dirty: {} }), []);

  useAutomationSocket({ onRun: () => void load() });

  // A selection that no longer exists (deleted elsewhere) falls back to the overview.
  React.useEffect(() => {
    if (data && selectedId && !data.automations.some((a) => a.id === selectedId)) useAutomationNavigation.setState({ selectedId: null, dirty: {} });
  }, [data, selectedId]);

  const replace = (a: Automation) => update((d) => ({ ...d, automations: d.automations.map((x) => (x.id === a.id ? a : x)) }));

  const toggle = async (a: Automation, enabled: boolean) => {
    setRowError(null);
    replace({ ...a, enabled });
    try {
      replace(await updateAutomation(a.id, { name: a.name, description: a.description, enabled, condition: a.condition, cooldown_seconds: a.cooldown_seconds, for_seconds: a.for_seconds, timeout_seconds: a.timeout_seconds, max_runs_per_hour: a.max_runs_per_hour }));
    } catch (err) {
      replace(a);
      setRowError(errorText(err, `Could not update ${a.name}.`));
    }
  };

  const create = async () => {
    setBusy(true); setCreateError(null);
    try {
      const created = await createAutomation({ name: newName.trim() });
      update((d) => ({ ...d, automations: [...d.automations, created] }));
      selectAutomation(created.id); setCreating(false); setNewName("");
    } catch (err) {
      setCreateError(errorText(err, "Could not create the automation."));
    } finally { setBusy(false); }
  };

  if (isChecking || !token) return <ActivityIndicator accessibilityLabel="Checking session" />;

  const selected = data?.automations.find((a) => a.id === selectedId) ?? null;
  const startCreate = () => { setCreating(true); setCreateError(null); };
  const notices = <>
    {data && !data.node.available ? <Banner tone="info">Node.js is not installed on the master yet. It will be installed automatically on the first Install or run.</Banner> : null}
    {data?.paused ? <Banner tone="warn">All condition fires are paused. Manual runs still work.</Banner> : null}
  </>;

  const createDialog = creating ? <SupportDialog title="New automation" onClose={() => setCreating(false)} footer={<>
    <Action label="Cancel" onPress={() => setCreating(false)} disabled={busy} />
    <Action label={busy ? "Creating…" : "Create"} primary onPress={create} disabled={busy || !newName.trim()} />
  </>}>
    <Field label="Name" value={newName} onChange={setNewName} />
    <Text className={muted}>New automations start disabled with a starter main.ts.</Text>
    <Failure message={createError} />
  </SupportDialog> : null;

  if (selected) return <>
    <AutomationDetail key={selected.id} automation={selected} wide={wide} notices={notices} onChanged={replace}
      onDeleted={() => { useAutomationNavigation.setState({ selectedId: null, dirty: {} }); update((d) => ({ ...d, automations: d.automations.filter((x) => x.id !== selected.id) })); }}
      onBack={() => selectAutomation(null)} />
    {createDialog}
  </>;

  return <ScrollView className="flex-1 bg-background-50 dark:bg-[#0B1422]" contentContainerStyle={{ padding: wide ? 24 : 16, paddingTop: wide ? 32 : 24, paddingBottom: 32, gap: 16, width: "100%", maxWidth: 1600, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
    <Box className="flex-row flex-wrap items-end gap-3">
      <Box className="gap-1 mr-auto" style={{ flexShrink: 1 }}>
        <Text className={subtle + " uppercase tracking-wider font-semibold"}>HH Support</Text>
        <Heading size="xl" className={ink}>HH Automations</Heading>
        <Text className={muted}>Scripts that run on the master as root, manually or when a Support condition becomes true.{data?.node.available && data.node.version ? ` Node ${data.node.version}.` : ""}</Text>
      </Box>
      <Action label="New automation" primary onPress={startCreate} />
    </Box>
    <Failure message={error} />
    <Failure message={rowError} />
    {notices}
    {!data && !error ? <ActivityIndicator accessibilityLabel="Loading automations" /> : null}
    {data && !data.automations.length ? <Box className={surface + " gap-2 items-start"}>
      <Text className={ink + " font-semibold"}>No automations yet</Text>
      <Text className={muted}>Create one to run a script manually or when a Support condition becomes true.</Text>
      <Action label="Create your first automation" primary onPress={startCreate} />
    </Box> : null}
    {data?.automations.length ? <Box className="flex-row flex-wrap gap-3">
      {data.automations.map((a) => <AutomationCard key={a.id} automation={a} selected={false} onSelect={() => selectAutomation(a.id)} onToggle={(v) => void toggle(a, v)} />)}
    </Box> : null}
    <Box style={{ maxWidth: 720 }}>
      <AutomationSettingsCard onPausedChange={(paused) => update((d) => ({ ...d, paused }))} />
    </Box>
    {createDialog}
  </ScrollView>;
}
