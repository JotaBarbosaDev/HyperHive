import React from "react";
import { ScrollView, TextInput } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText } from "@/components/ui/button";
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { getApiBaseUrl } from "@/config/apiConfig";
import type { AppInput, SupportApp, SupportTab } from "@/types/support";
import { Action, Failure, Field, ink, muted, State, surface } from "./support-ui";

export function SupportDialog({ title, children, footer, onClose }: { title: string; children: React.ReactNode; footer: React.ReactNode; onClose: () => void }) {
  return <Modal isOpen onClose={onClose} size="lg"><ModalBackdrop /><ModalContent className={surface}><ModalHeader><Heading size="lg" className={ink}>{title}</Heading></ModalHeader><ModalBody><ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled"><Box className="gap-4 py-3">{children}</Box></ScrollView></ModalBody><ModalFooter className="flex-wrap gap-2 pt-4">{footer}</ModalFooter></ModalContent></Modal>;
}

export function AppDetails({ app, tabName, streamCount, revision, onClose, onSettings, onRotate }: { app: SupportApp; tabName?: string; streamCount?: number; revision?: number; onClose: () => void; onSettings: () => void; onRotate: () => void }) {
  return <SupportDialog title="App details" onClose={onClose} footer={<><Action label="App settings" onPress={onSettings} /><Action label="Rotate secret" onPress={onRotate} /><Action label="Close" onPress={onClose} /></>}>
    <Heading size="md" className={ink}>{app.name}</Heading>
    <Box className="flex-row flex-wrap gap-2"><State value={app.connectivity} /><State value={app.health} /></Box>
    {app.health_message ? <Text selectable className={ink}>{app.health_message}</Text> : null}
    <Box className="gap-1"><Text className={muted}>App ID</Text><Text selectable className={ink + " font-mono text-xs web:break-all"}>{app.id}</Text></Box>
    <Text className={muted}>Tab: {tabName ?? "Unknown"} · {app.retention_days} day retention · {app.heartbeat_timeout_seconds}s heartbeat timeout</Text>
    <Text className={muted}>Last heartbeat: {app.last_heartbeat_at ? new Date(app.last_heartbeat_at).toLocaleString() : "Not received yet"}</Text>
    <Text className={muted}>{streamCount ?? "—"} discovered streams · layout revision {revision ?? "—"}</Text>
    {app.tags.length ? <Text className={muted}>{app.tags.map((tag) => "#" + tag).join(" ")}</Text> : null}
    <Heading size="sm" className={ink}>Instances ({app.instances.length})</Heading>
    {app.instances.map((instance) => <Box key={instance.instance_id} className="gap-2 p-3 rounded-lg border border-outline-100 dark:border-[#26364A]">
      <Text selectable className={ink + " font-mono text-xs web:break-all"}>{instance.instance_id}</Text>
      <Box className="flex-row flex-wrap gap-2"><State value={instance.connectivity} /><State value={instance.health} /></Box>
      {instance.health_message ? <Text selectable className={ink}>{instance.health_message}</Text> : null}
      <Text className={muted}>Last heartbeat: {instance.last_heartbeat_at ? new Date(instance.last_heartbeat_at).toLocaleString() : "Not received yet"}</Text>
    </Box>)}
    {!app.instances.length ? <Text className={muted}>No named instances have sent a heartbeat.</Text> : null}
  </SupportDialog>;
}

export function AppForm({ app, tabs, initialTabId, apps, onClose, onSave, onDelete }: { app?: SupportApp; tabs: SupportTab[]; initialTabId?: string; apps: SupportApp[]; onClose: () => void; onSave: (input: AppInput, sourceId?: string) => Promise<void>; onDelete?: () => void }) {
  const [sourceId, setSourceId] = React.useState<string | undefined>();
  const [name, setName] = React.useState(app?.name ?? "");
  const [tabId, setTabId] = React.useState(app?.tab_id ?? initialTabId ?? tabs[0]?.id ?? "");
  const [tags, setTags] = React.useState<string[]>(app?.tags ?? []);
  const [tagDraft, setTagDraft] = React.useState("");
  const [editingTag, setEditingTag] = React.useState<string | null>(null);
  const tagInput = React.useRef<TextInput>(null);
  const [timeout, setTimeoutValue] = React.useState(String(app?.heartbeat_timeout_seconds ?? 120));
  const [retention, setRetention] = React.useState(String(app?.retention_days ?? 7));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const selectSource = (source?: SupportApp) => {
    setSourceId(source?.id);
    setTabId(source?.tab_id ?? initialTabId ?? tabs[0]?.id ?? "");
    setTags(source?.tags ?? []);
    setTagDraft(""); setEditingTag(null);
    setTimeoutValue(String(source?.heartbeat_timeout_seconds ?? 120));
    setRetention(String(source?.retention_days ?? 7));
  };
  const withDraft = (value: string) => [...new Set([...tags.filter((tag) => tag !== editingTag || !value.trim()), ...value.split(",").map((tag) => tag.trim()).filter(Boolean)])];
  const addTags = (value = tagDraft) => {
    const labels = withDraft(value);
    if (labels.length > 32 || labels.some((tag) => tag.length > 64)) { setError("Use up to 32 tags, with at most 64 characters each."); return; }
    setTags(labels); setTagDraft(""); setEditingTag(null); setError(null);
    tagInput.current?.focus();
  };
  const suggestions = [...new Set(apps.flatMap((entry) => entry.tags))]
    .filter((tag) => !tags.includes(tag) && tag.toLowerCase().includes(tagDraft.trim().toLowerCase()))
    .sort((a, b) => a.localeCompare(b)).slice(0, 8);
  const save = async () => {
    const labels = withDraft(tagDraft);
    if (!name.trim() || name.trim().length > 120 || !tabs.some((tab) => tab.id === tabId) || !Number.isInteger(Number(timeout)) || Number(timeout) < 10 || Number(timeout) > 86400 || !Number.isInteger(Number(retention)) || Number(retention) < 1 || Number(retention) > 365 || labels.length > 32 || labels.some((value) => value.length > 64)) { setError("Enter a name, one tab, up to 32 tags (64 characters each), heartbeat 10–86400 seconds and retention 1–365 days."); return; }
    setBusy(true); setError(null);
    try { await onSave({ name: name.trim(), tab_id: tabId, tags: labels, heartbeat_timeout_seconds: Number(timeout), retention_days: Number(retention) }, sourceId); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  return <SupportDialog title={app ? "App settings" : "Create an App"} onClose={() => { if (!busy) onClose(); }} footer={<>
    {onDelete ? <Action label="Delete App" disabled={busy} onPress={onDelete} /> : null}<Action label="Cancel" disabled={busy} onPress={onClose} /><Action primary label={busy ? "Saving…" : "Save App"} disabled={busy} onPress={() => { void save(); }} />
  </>}>
    {!app && apps.length > 0 ? <>
      <Text className={muted}>Start from an existing App</Text>
      <Box className="flex-row flex-wrap gap-2"><Action label="Blank App" selected={!sourceId} disabled={busy} onPress={() => selectSource()} />{apps.map((source) => <Action key={source.id} label={`Replicate ${source.name}`} selected={sourceId === source.id} disabled={busy} onPress={() => selectSource(source)} />)}</Box>
      {sourceId ? <Text className={muted}>Copies stream definitions, all widget settings, positions and sizes, heartbeat timeout and retention. Starts with fresh telemetry and new credentials. Choose a new name, tags and destination tab below.</Text> : null}
    </> : null}
    <Field label="App name" value={name} onChange={setName} />
    <Text className={muted}>Tab · choose one</Text><Box className="flex-row flex-wrap gap-2">{tabs.map((tab) => <Action key={tab.id} selected={tabId === tab.id} label={tab.name} disabled={busy} onPress={() => setTabId(tab.id)} />)}</Box>
    <Box className="gap-2">
      <Text className={muted}>Tags · {tags.length}/32</Text>
      <Box className="flex-row flex-wrap gap-2">{tags.map((tag) => <Box key={tag} className="max-w-full flex-row items-center rounded-full border border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#153B3B]">
        <Button variant="link" action="default" isDisabled={busy} accessibilityLabel={`Edit tag ${tag}`} className="min-h-11 h-auto min-w-0 flex-shrink rounded-l-full px-3" onPress={() => { setEditingTag(tag); setTagDraft(tag); tagInput.current?.focus(); }}><ButtonText className={ink + " flex-shrink"}>{tag}</ButtonText></Button>
        <Button variant="link" action="default" isDisabled={busy} accessibilityLabel={`Remove tag ${tag}`} className="h-11 w-11 rounded-r-full" onPress={() => { setTags(tags.filter((value) => value !== tag)); if (editingTag === tag) { setEditingTag(null); setTagDraft(""); } }}><ButtonText className={ink + " text-lg"}>×</ButtonText></Button>
      </Box>)}</Box>
      <Box className="flex-row items-center gap-2">
        <TextInput ref={tagInput} accessibilityLabel={editingTag ? "Edit tag" : "Add tag"} accessibilityHint="Press Enter or Add tag to create a chip. Save App also includes unfinished input." placeholder={editingTag ? "Edit tag" : "Type a tag…"} placeholderTextColor="#8A94A8" value={tagDraft} onChangeText={setTagDraft} onSubmitEditing={() => addTags()} submitBehavior="submit" returnKeyType="done" editable={!busy} autoCapitalize="none" autoCorrect={false} className="flex-1 min-w-0 border border-outline-200 dark:border-[#2A3B52] rounded-lg p-2 min-h-11 text-typography-900 dark:text-[#E8EBF0]" />
        <Action label={editingTag ? "Update tag" : "Add tag"} disabled={busy || !tagDraft.trim()} onPress={() => addTags()} />
      </Box>
      {editingTag ? <Action label="Cancel tag edit" disabled={busy} onPress={() => { setEditingTag(null); setTagDraft(""); }} /> : null}
      <Text className={muted}>Press Enter to add. Select a tag to edit it, or × to remove. Changes apply when you save the App.</Text>
      {suggestions.length > 0 ? <><Text className={muted}>{tagDraft.trim() ? "Matching tags" : "Suggested tags from your Apps"}</Text><Box className="flex-row flex-wrap gap-2">{suggestions.map((tag) => <Button key={tag} variant="outline" action="secondary" isDisabled={busy} accessibilityLabel={`Use tag ${tag}`} className="rounded-full min-h-11 h-auto max-w-full px-3" onPress={() => addTags(tag)}><ButtonText className="flex-shrink">{tag}</ButtonText></Button>)}</Box></> : null}
    </Box>
    {sourceId ? <Text className={muted}>Heartbeat timeout and retention are inherited from the source App. You can change them in App settings after replication.</Text> : <Box className="flex-row flex-wrap gap-4"><Field label="Heartbeat timeout (seconds)" value={timeout} onChange={setTimeoutValue} /><Field label="History retention (days)" value={retention} onChange={setRetention} /></Box>}
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
