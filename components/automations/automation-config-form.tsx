import React from "react";
import { ScrollView, TextInput } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Action, Failure, ink, surface } from "@/components/support/support-ui";
import { setAutomationDirty } from "@/hooks/useAutomationNavigation";
import { errorText, evaluateCondition, formatTime, updateAutomation, type Automation, type AutomationConfig, type EvaluateResult } from "@/services/automations";
import { Banner, mono, SnapshotView, subtle } from "./automation-ui";
import { ConditionInput } from "./condition-input";

const toConfig = (a: Automation): AutomationConfig => ({
  name: a.name, description: a.description, enabled: a.enabled, condition: a.condition,
  cooldown_seconds: a.cooldown_seconds, for_seconds: a.for_seconds, timeout_seconds: a.timeout_seconds, max_runs_per_hour: a.max_runs_per_hour,
});

type NumberKey = "cooldown_seconds" | "for_seconds" | "timeout_seconds" | "max_runs_per_hour";
const LIMITS: { key: NumberKey; label: string; unit: string; hint: string }[] = [
  { key: "for_seconds", label: "Hold for", unit: "s", hint: "true this long before firing" },
  { key: "cooldown_seconds", label: "Cooldown", unit: "s", hint: "minimum gap between fires" },
  { key: "timeout_seconds", label: "Timeout", unit: "s", hint: "run is killed after this" },
  { key: "max_runs_per_hour", label: "Max runs", unit: "/h", hint: "more disables the automation" },
];

const EXAMPLES = [
  "app('db').cpu >= 95",
  "app('db','instance-1').load > 4",
  "app('db')['disk.used'] > 90",
  "app('web').connectivity == 'offline'",
  "app('web').health != 'healthy'",
];

const field = "border rounded-md text-sm text-typography-900 dark:text-[#E8EBF0] bg-background-0 dark:bg-[#0A1422] border-outline-200 dark:border-[#2A3B52] focus:border-[#147D78] dark:focus:border-[#2DD4BF] ";
const label = "text-sm font-medium text-typography-900 dark:text-[#E8EBF0]";
const link = "text-xs font-semibold text-[#147D78] dark:text-[#6ED5C4]";

// One sentence for the live trigger state, coloured only by the part that needs attention.
function TriggerState({ automation }: { automation: Automation }) {
  const state = automation.state;
  if (!automation.condition) return <Text className={subtle}>No condition: runs only when started by hand.</Text>;
  const tone = state?.last_error ? "text-[#BA4F3D] dark:text-[#F4A293]" : state?.condition_value ? "text-[#147D78] dark:text-[#6ED5C4]" : "text-typography-700 dark:text-[#B4BECD]";
  return <Text className={subtle}>
    <Text className={"font-semibold " + tone}>{state?.last_error ? "Error" : state?.condition_value ? "True" : "False"}</Text>
    {state?.true_since ? ` since ${formatTime(state.true_since)}` : ""}
    {" · "}{state?.armed ? "armed" : "waits to turn false"}
    {" · last fired "}{formatTime(state?.last_fired_at)}
  </Text>;
}

// Configuration for one automation, ordered by how often each part is touched:
// enabled, the trigger, its limits, then name and description.
// `panel` makes it the IDE's left column (own scroll, save bar pinned when there are edits).
export const AutomationConfigForm = React.memo(function AutomationConfigForm({ automation, onSaved, notices, panel = false }: { automation: Automation; onSaved: (a: Automation) => void; notices?: React.ReactNode; panel?: boolean }) {
  const [draft, setDraft] = React.useState<AutomationConfig>(() => toConfig(automation));
  const [numbers, setNumbers] = React.useState<Record<NumberKey, string>>(() => numbersOf(automation));
  const [saving, setSaving] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [test, setTest] = React.useState<EvaluateResult | null>(null);
  const [testError, setTestError] = React.useState<string | null>(null);
  const [showExamples, setShowExamples] = React.useState(false);
  const [showVariables, setShowVariables] = React.useState(false);

  const server = toConfig(automation);
  const dirty = draft.name !== server.name || draft.description !== server.description || draft.condition !== server.condition
    || LIMITS.some((f) => numbers[f.key].trim() !== String(server[f.key]));
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;
  React.useEffect(() => { setAutomationDirty("config", dirty); if (dirty) setSaved(false); }, [dirty]);
  React.useEffect(() => () => setAutomationDirty("config", false), []);

  const reset = () => { setDraft(toConfig(automation)); setNumbers(numbersOf(automation)); setError(null); };
  const lastId = React.useRef(automation.id);
  // Pick up server changes (other clients, enable toggles) unless they would overwrite local edits.
  React.useEffect(() => {
    const switched = lastId.current !== automation.id;
    lastId.current = automation.id;
    if (switched) { setTest(null); setTestError(null); setSaved(false); }
    if (switched || !dirtyRef.current) reset();
  }, [automation.id, automation.updated_at]);

  const numberErrors = Object.fromEntries(LIMITS.map((f) => [f.key, /^\d+$/.test(numbers[f.key].trim()) ? "" : `${f.label} must be a whole number ≥ 0.`])) as Record<NumberKey, string>;
  const limitError = LIMITS.map((f) => numberErrors[f.key]).find(Boolean);
  const invalid = !draft.name.trim() || !!limitError;

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const body: AutomationConfig = { ...draft, name: draft.name.trim(), enabled: automation.enabled };
      for (const f of LIMITS) body[f.key] = Number(numbers[f.key]);
      const result = await updateAutomation(automation.id, body);
      dirtyRef.current = false;
      onSaved(result);
      setSaved(true);
    } catch (err) {
      setError(errorText(err, "Could not save the automation."));
    } finally {
      setSaving(false);
    }
  };

  // Enabling applies at once, like the overview switch; it sends the saved config, not the draft.
  const toggle = async (enabled: boolean) => {
    setToggling(true); setError(null);
    try { onSaved(await updateAutomation(automation.id, { ...server, enabled })); }
    catch (err) { setError(errorText(err, `Could not ${enabled ? "enable" : "disable"} the automation.`)); }
    finally { setToggling(false); }
  };

  const runTest = async () => {
    setTesting(true); setTest(null); setTestError(null);
    try { setTest(await evaluateCondition(draft.condition)); } catch (err) { setTestError(errorText(err, "Could not evaluate the condition.")); }
    finally { setTesting(false); }
  };

  const state = automation.state;
  const body = <>
    {state?.disabled_reason ? <Banner tone="warn">Disabled automatically: {state.disabled_reason}</Banner> : null}
    {state?.last_error ? <Banner tone="bad">Condition error: {state.last_error}</Banner> : null}
    {state?.last_fire_error ? <Banner tone="bad">Last fire failed: {state.last_fire_error}</Banner> : null}
    {notices}

    <Box className="flex-row items-center gap-3">
      <Box className="flex-1">
        <Text className={label}>Enabled</Text>
        <Text className={subtle}>{automation.enabled ? "Fires when the condition turns true." : "Condition is ignored; Run now still works."}</Text>
      </Box>
      <Switch accessibilityLabel="Enable automation" value={automation.enabled} disabled={toggling} onValueChange={(v: boolean) => void toggle(v)} />
    </Box>

    <Box className="gap-2">
      <Box className="flex-row items-baseline">
        <Text className={label + " mr-auto"}>Run when</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showVariables }} onPress={() => setShowVariables((v) => !v)} className="web:cursor-pointer rounded px-1 focus-visible:outline-2 focus-visible:outline-[#2DD4BF]">
          <Text className={link}>{showVariables ? "Hide variables" : "Variables"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showExamples }} onPress={() => setShowExamples((v) => !v)} className="web:cursor-pointer rounded px-1 focus-visible:outline-2 focus-visible:outline-[#2DD4BF]">
          <Text className={link}>{showExamples ? "Hide examples" : "Examples"}</Text>
        </Pressable>
      </Box>
      <ConditionInput value={draft.condition} showVariables={showVariables} onChange={(condition) => { setDraft((d) => ({ ...d, condition })); setTest(null); }} />
      {showExamples ? <Box>
        {EXAMPLES.map((example) => <Pressable key={example} accessibilityRole="button" accessibilityLabel={`Use ${example}`} onPress={() => { setDraft((d) => ({ ...d, condition: example })); setTest(null); }}
          className="px-2 rounded web:cursor-pointer hover:bg-background-50 dark:hover:bg-[#15233A] focus-visible:outline-2 focus-visible:outline-[#2DD4BF]" style={{ minHeight: 28, justifyContent: "center" }}>
          <Text className={mono}>{example}</Text>
        </Pressable>)}
      </Box> : null}
      <Box className="flex-row items-center gap-3">
        <Box className="flex-1"><TriggerState automation={automation} /></Box>
        <Box><Action label={testing ? "Testing…" : "Test"} compact onPress={runTest} disabled={testing || !draft.condition.trim()} /></Box>
      </Box>
      <Failure message={testError} />
      {test ? <Box className="gap-1 pl-3 border-l-2 border-outline-200 dark:border-[#2A3B52]">
        <Text className={subtle}>This text evaluates to <Text className={"font-semibold " + (test.error ? "text-[#BA4F3D] dark:text-[#F4A293]" : ink)}>{test.error ? "an error" : String(test.value)}</Text></Text>
        {test.error ? <Text selectable className="text-xs text-red-700 dark:text-red-300">{test.error}</Text> : null}
        <SnapshotView snapshot={test.snapshot} />
      </Box> : null}
    </Box>

    <Box className="gap-1">
      <Text className={label + " mb-1"}>Limits</Text>
      {LIMITS.map((f) => <Box key={f.key} className="flex-row items-center gap-3" style={{ minHeight: 40 }}>
        <Box className="flex-1 min-w-0">
          <Text className="text-sm text-typography-800 dark:text-[#CBD5E1]">{f.label}</Text>
          <Text numberOfLines={1} className={subtle}>{f.hint}</Text>
        </Box>
        <Box className={"flex-row items-center " + field + (numberErrors[f.key] ? "border-red-600 dark:border-red-400" : "")} style={{ width: 96 }}>
          <TextInput accessibilityLabel={`${f.label} (${f.unit})`} accessibilityHint={f.hint} value={numbers[f.key]} onChangeText={(v) => setNumbers((n) => ({ ...n, [f.key]: v }))} keyboardType="number-pad"
            className="flex-1 min-w-0 pl-2 py-1.5 text-sm text-right text-typography-900 dark:text-[#E8EBF0] web:outline-none" style={{ fontVariant: ["tabular-nums"] }} />
          <Text className={subtle + " w-7 pl-1"}>{f.unit}</Text>
        </Box>
      </Box>)}
      {limitError ? <Text accessibilityLiveRegion="polite" className="text-xs text-red-700 dark:text-red-300">{limitError}</Text> : null}
    </Box>

    <Box className="gap-3 pt-4 border-t border-outline-100 dark:border-[#1F2D40]">
      <Box className="gap-1">
        <Text className={label}>Name</Text>
        <TextInput accessibilityLabel="Name" value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} autoCapitalize="none"
          className={field + "px-3 py-2 " + (draft.name.trim() ? "" : "border-red-600 dark:border-red-400")} />
        {draft.name.trim() ? null : <Text className="text-xs text-red-700 dark:text-red-300">Name is required.</Text>}
      </Box>
      <Box className="gap-1">
        <Text className={label}>Description</Text>
        <TextInput accessibilityLabel="Description" value={draft.description} onChangeText={(description) => setDraft((d) => ({ ...d, description }))} multiline placeholder="Optional" placeholderTextColor="#8A94A8"
          className={field + "px-3 py-2"} style={{ minHeight: 56, textAlignVertical: "top" }} />
      </Box>
    </Box>
  </>;

  const showBar = dirty || !!error || saved;
  const bar = showBar ? <Box className={"gap-2 " + (panel ? "px-4 py-3 border-t border-outline-100 dark:border-[#1F2D40] bg-background-0 dark:bg-[#0E1726]" : "")}>
    <Failure message={error} />
    <Box className="flex-row items-center gap-2">
      <Text accessibilityLiveRegion="polite" className={subtle + " mr-auto"}>{dirty ? "Unsaved changes" : "Saved"}</Text>
      {dirty ? <Action label="Revert" onPress={reset} disabled={saving} /> : null}
      {dirty ? <Action label={saving ? "Saving…" : "Save"} primary onPress={save} disabled={saving || invalid} /> : null}
    </Box>
  </Box> : null;

  if (!panel) return <Box className={surface + " gap-5"}>{body}{bar}</Box>;
  return <Box className="flex-1 min-h-0">
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">{body}</ScrollView>
    {bar}
  </Box>;
});

function numbersOf(a: Automation): Record<NumberKey, string> {
  return Object.fromEntries(LIMITS.map((f) => [f.key, String(a[f.key])])) as Record<NumberKey, string>;
}
