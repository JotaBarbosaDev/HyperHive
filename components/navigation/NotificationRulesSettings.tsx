import React from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import {
  listNotificationRules,
  notificationSeverities,
  updateNotificationRule,
  validateQuietHours,
  type NotificationRule,
} from "@/services/notification-rules";

const severityLabel = { info: "Info", warning: "Warning", error: "Error", critical: "Critical" } as const;

function RuleEditor({ rule, onSaved }: { rule: NotificationRule; onSaved: (rule: NotificationRule) => void }) {
  const [draft, setDraft] = React.useState(rule);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  React.useEffect(() => setDraft(rule), [rule]);

  const quietError = validateQuietHours(draft.quietStart.trim(), draft.quietEnd.trim());
  const changed = draft.enabled !== rule.enabled || draft.minPushSeverity !== rule.minPushSeverity || draft.quietStart.trim() !== rule.quietStart || draft.quietEnd.trim() !== rule.quietEnd;
  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const saved = await updateNotificationRule(rule.category, { enabled: draft.enabled, minPushSeverity: draft.minPushSeverity, quietStart: draft.quietStart.trim(), quietEnd: draft.quietEnd.trim() });
      onSaved({ ...saved, description: saved.description || rule.description });
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the rule.");
    } finally {
      setSaving(false);
    }
  };

  return <Box className="gap-2 rounded-xl border border-outline-200 dark:border-[#344257] p-3">
    <Box className="flex-row items-center justify-between gap-2">
      <Box className="flex-1 gap-1">
        <Text className="text-sm font-semibold capitalize text-typography-900 dark:text-[#E8EBF0]">{rule.category}</Text>
        <Text className="text-xs text-typography-600 dark:text-[#94A3B8]">{rule.description}</Text>
      </Box>
      <Switch accessibilityLabel={`Enable ${rule.category} notifications`} value={draft.enabled} onValueChange={(enabled: boolean) => setDraft((d) => ({ ...d, enabled }))} />
    </Box>
    {!draft.enabled ? <Text className="text-xs text-typography-600 dark:text-[#94A3B8]">Disabled: kept in history only, with no toast or push.</Text> : <>
      <Text className="text-xs text-typography-700 dark:text-[#CBD5E1]">Push to phone and browser from</Text>
      <Box className="flex-row flex-wrap gap-2">
        {notificationSeverities.map((severity) => <Button key={severity} size="sm" variant={draft.minPushSeverity === severity ? "solid" : "outline"} action={draft.minPushSeverity === severity ? "primary" : "secondary"} accessibilityLabel={`Push ${rule.category} from ${severityLabel[severity]}`} onPress={() => setDraft((d) => ({ ...d, minPushSeverity: severity }))} className="rounded-lg" style={{ minHeight: 44 }}>
          <ButtonText>{severityLabel[severity]}</ButtonText>
        </Button>)}
      </Box>
      <Text className="text-xs text-typography-700 dark:text-[#CBD5E1]">Quiet hours (server time). Only critical notifications push during them.</Text>
      <Box className="flex-row gap-2">
        {(["quietStart", "quietEnd"] as const).map((key) => <Input key={key} className="flex-1 rounded-lg" style={{ minHeight: 44 }}>
          <InputField accessibilityLabel={`${rule.category} quiet hours ${key === "quietStart" ? "start" : "end"}`} placeholder={key === "quietStart" ? "Start, e.g. 22:00" : "End, e.g. 07:00"} value={draft[key]} autoCapitalize="none" autoCorrect={false} onChangeText={(value: string) => setDraft((d) => ({ ...d, [key]: value }))} />
        </Input>)}
      </Box>
      {quietError ? <Text accessibilityRole="alert" className="text-xs text-error-700 dark:text-error-400">{quietError}</Text> : null}
    </>}
    <Box className="flex-row items-center gap-3">
      <Button size="sm" isDisabled={saving || !changed || (draft.enabled && !!quietError)} onPress={save} className="rounded-lg" style={{ minHeight: 44 }}>
        <ButtonText>{saving ? "Saving…" : "Save"}</ButtonText>
      </Button>
      {message ? <Text accessibilityRole="alert" className="text-xs text-typography-700 dark:text-[#CBD5E1]">{message}</Text> : null}
    </Box>
  </Box>;
}

// Global notification rules: one per category, applied to web push, Android push and toasts.
export default function NotificationRulesSettings() {
  const [rules, setRules] = React.useState<NotificationRule[] | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const controller = new AbortController();
    listNotificationRules(controller.signal)
      .then((loaded) => { if (!controller.signal.aborted) setRules(loaded); })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load notification rules. Update the HyperHive backend."); });
    return () => controller.abort();
  }, []);

  if (error) return <Text accessibilityRole="alert" className="text-sm text-error-700 dark:text-error-400">{error}</Text>;
  if (!rules) return <Text className="text-sm text-typography-700 dark:text-[#CBD5E1]">Loading notification rules…</Text>;
  return <Box className="gap-3 pb-2">
    <Text className="text-sm text-typography-700 dark:text-[#CBD5E1]">These rules apply to every user and device. Notifications are always saved in history.</Text>
    {rules.map((rule) => <RuleEditor key={rule.category} rule={rule} onSaved={(saved) => setRules((current) => current?.map((r) => r.category === saved.category ? saved : r) ?? null)} />)}
  </Box>;
}
