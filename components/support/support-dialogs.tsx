import React from "react";
import { ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { getApiBaseUrl } from "@/config/apiConfig";
import type { AppInput, SupportApp, SupportTab } from "@/types/support";
import { Action, Failure, Field, ink, muted, surface } from "./support-ui";

export function SupportDialog({ title, children, footer, onClose }: { title: string; children: React.ReactNode; footer: React.ReactNode; onClose: () => void }) {
  return <Modal isOpen onClose={onClose} size="lg"><ModalBackdrop /><ModalContent className={surface}><ModalHeader><Heading size="lg" className={ink}>{title}</Heading></ModalHeader><ModalBody><ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled"><Box className="gap-4 py-3">{children}</Box></ScrollView></ModalBody><ModalFooter className="flex-wrap gap-2 pt-4">{footer}</ModalFooter></ModalContent></Modal>;
}

export function AppForm({ app, tabs, onClose, onSave, onDelete }: { app?: SupportApp; tabs: SupportTab[]; onClose: () => void; onSave: (input: AppInput) => Promise<void>; onDelete?: () => void }) {
  const [name, setName] = React.useState(app?.name ?? "");
  const [tabId, setTabId] = React.useState(app?.tab_id ?? tabs[0]?.id ?? "");
  const [tags, setTags] = React.useState(app?.tags.join(", ") ?? "");
  const [timeout, setTimeoutValue] = React.useState(String(app?.heartbeat_timeout_seconds ?? 120));
  const [retention, setRetention] = React.useState(String(app?.retention_days ?? 7));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const save = async () => {
    const labels = [...new Set(tags.split(",").map((value) => value.trim()).filter(Boolean))];
    if (!name.trim() || name.trim().length > 120 || !tabs.some((tab) => tab.id === tabId) || !Number.isInteger(Number(timeout)) || Number(timeout) < 10 || Number(timeout) > 86400 || !Number.isInteger(Number(retention)) || Number(retention) < 1 || Number(retention) > 365 || labels.length > 32 || labels.some((value) => value.length > 64)) { setError("Enter a name, one tab, up to 32 tags (64 characters each), heartbeat 10–86400 seconds and retention 1–365 days."); return; }
    setBusy(true); setError(null);
    try { await onSave({ name: name.trim(), tab_id: tabId, tags: labels, heartbeat_timeout_seconds: Number(timeout), retention_days: Number(retention) }); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  return <SupportDialog title={app ? "App settings" : "Register App"} onClose={() => { if (!busy) onClose(); }} footer={<>
    {onDelete ? <Action label="Delete App" disabled={busy} onPress={onDelete} /> : null}<Action label="Cancel" disabled={busy} onPress={onClose} /><Action primary label={busy ? "Saving…" : "Save App"} disabled={busy} onPress={() => { void save(); }} />
  </>}>
    <Field label="App name" value={name} onChange={setName} />
    <Text className={muted}>Tab · choose one</Text><Box className="flex-row flex-wrap gap-2">{tabs.map((tab) => <Action key={tab.id} selected={tabId === tab.id} label={tab.name} disabled={busy} onPress={() => setTabId(tab.id)} />)}</Box>
    <Field label="Tags (comma separated)" value={tags} onChange={setTags} />
    <Box className="flex-row flex-wrap gap-4"><Field label="Heartbeat timeout (seconds)" value={timeout} onChange={setTimeoutValue} /><Field label="History retention (days)" value={retention} onChange={setRetention} /></Box>
    <Text className={muted}>Reducing retention expires old telemetry. Each discovered instance stays monitored for this App’s lifetime.</Text><Failure message={error} />
  </SupportDialog>;
}

export function TabForm({ tab, onClose, onSave, onDelete }: { tab?: SupportTab; onClose: () => void; onSave: (name: string) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [name, setName] = React.useState(tab?.name ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const invoke = async (job: () => Promise<void>) => { setBusy(true); setError(null); try { await job(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } };
  return <SupportDialog title={tab ? "Edit tab" : "Create tab"} onClose={() => { if (!busy) onClose(); }} footer={<>
    {onDelete ? <Action label="Delete empty tab" disabled={busy} onPress={() => { void invoke(onDelete); }} /> : null}<Action label="Cancel" disabled={busy} onPress={onClose} /><Action primary label="Save tab" disabled={busy || !name.trim() || name.trim().length > 120} onPress={() => { void invoke(() => onSave(name.trim())); }} />
  </>}><Field label="Tab name" value={name} onChange={setName} /><Text className={muted}>Tabs organize Apps. Move Apps to another tab before deleting this one.</Text><Failure message={error} /></SupportDialog>;
}

export function ingestionCommand(appId: string, secret: string) {
  const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
  const url = (getApiBaseUrl() ?? "").replace(/\/$/, "") + "/support/ingest";
  return ["curl --request POST " + quote(url), "--header " + quote("X-App-ID: " + appId), "--header " + quote("Authorization: Bearer " + secret), "--header 'Content-Type: application/json'", "--data '{\"heartbeat\":true,\"health\":{\"status\":\"healthy\"},\"streams\":[{\"name\":\"cpu\",\"type\":\"number\",\"unit\":\"%\",\"label\":\"CPU\"}],\"samples\":[{\"stream\":\"cpu\",\"value\":24.5}]}'"].join(" \\\n  ");
}

export function CredentialsDialog({ credentials, onSaved }: { credentials: { id: string; secret: string }; onSaved: () => void }) {
  const [copied, setCopied] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const copy = async (label: string, value: string) => { try { await Clipboard.setStringAsync(value); setCopied(label); setError(null); } catch { setError("Clipboard is unavailable. Select and copy the credentials below."); } };
  return <SupportDialog title="Connect your App" onClose={() => undefined} footer={<Action primary label="I saved the credentials" onPress={onSaved} />}>
    <Text className={muted}>Save this secret now. It cannot be viewed again. Send a heartbeat before the configured timeout to keep the App online.</Text>
    <Box className="p-4 gap-2 rounded-xl bg-background-50 dark:bg-[#0A1422]"><Text className={muted}>App ID</Text><Text selectable className={ink + " font-mono"}>{credentials.id}</Text><Text className={muted}>Secret · shown once</Text><Text selectable className={ink + " font-mono"}>{credentials.secret}</Text></Box>
    <Action label="Copy credentials" onPress={() => { void copy("Credentials copied", "App ID: " + credentials.id + "\nSecret: " + credentials.secret); }} />
    <Text className={ink + " font-semibold"}>Send your first sample</Text><Text className={muted}>Run this command from your sender. Configure it to keep sending heartbeats; optional instance_id identifies an individual sender.</Text>
    <Box className="p-4 rounded-xl bg-background-50 dark:bg-[#0A1422]"><Text selectable className={ink + " font-mono text-xs"}>{ingestionCommand(credentials.id, credentials.secret)}</Text></Box>
    <Action label="Copy ingestion command" onPress={() => { void copy("Command copied", ingestionCommand(credentials.id, credentials.secret)); }} />
    {copied ? <Text accessibilityLiveRegion="polite" className="text-[#147D78] dark:text-[#6ED5C4]">{copied}</Text> : null}<Failure message={error} />
  </SupportDialog>;
}
