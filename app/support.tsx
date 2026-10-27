import React from "react";
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useSupport } from "@/hooks/useSupport";
import { useSupportLayout } from "@/hooks/useSupportLayout";
import { WidgetForm } from "@/components/support/widget-form";
import { saveSupportApp, supportRequest } from "@/services/support-client";
import type { AppInput, SupportApp, SupportTab, Widget } from "@/types/support";
import { Action, Failure, Field, ink, muted, State, surface } from "@/components/support/support-ui";
import { AppForm, CredentialsDialog, SupportDialog, TabForm } from "@/components/support/support-dialogs";
import { availableWidgetPosition, SupportWidget } from "@/components/support/support-widget";
import { defaultWidgetSize } from "@/components/support/widget-format";

export default function SupportScreen() {
  const { token, isChecking } = useAuthGuard();
  const { width } = useWindowDimensions();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [tabId, setTabId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const data = useSupport(token, selectedId);
  const [appForm, setAppForm] = React.useState<SupportApp | "new" | null>(null);
  const [tabForm, setTabForm] = React.useState<SupportTab | "new" | null>(null);
  const [credentials, setCredentials] = React.useState<{ id: string; secret: string } | null>(null);
  const [confirmation, setConfirmation] = React.useState<"delete" | "rotate" | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [widgetForm, setWidgetForm] = React.useState<Widget | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [gridWidth, setGridWidth] = React.useState(720);
  const [interactionBottom, setInteractionBottom] = React.useState<number | null>(null);
  const selectionInitialized = React.useRef(false);
  const narrow = width < 1000;
  const selected = data.apps.find((app) => app.id === selectedId);
  const detail = data.detail?.app.id === selectedId ? data.detail : null;
  const dashboard = useSupportLayout(token, selectedId, detail?.layout);
  const { layout } = dashboard;
  const visibleApps = data.apps.filter((app) => (!tabId || app.tab_id === tabId) && [app.name, ...app.tags].join(" ").toLowerCase().includes(search.toLowerCase()));
  React.useEffect(() => {
    if (!selectedId && visibleApps.length && !selectionInitialized.current) { selectionInitialized.current = true; setSelectedId(visibleApps[0].id); }
  }, [selectedId, data.apps, data.hasSnapshot, data.isLoading, tabId, search]);
  React.useEffect(() => { setEditing(false); setInteractionBottom(null); setError(null); setAdding(false); setWidgetForm(null); }, [selectedId]);
  const choose = (id: string) => { if (dashboard.dirty && id !== selectedId) { setError("Wait for the dashboard to save, or resolve its save error before switching Apps."); return; } selectionInitialized.current = true; setSelectedId(id); setEditing(false); };
  const invoke = async (job: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await job(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save the change."); }
    finally { setBusy(false); }
  };
  const updateWidget = (widget: Widget) => {
    if (layout) dashboard.change(layout.widgets.map((current) => current.id === widget.id ? widget : current));
  };
  const saveApp = async (input: AppInput) => {
    if (!token) return;
    const result = await saveSupportApp(token, input, appForm !== "new" ? appForm?.id : undefined);
    setAppForm(null); setTabId(input.tab_id); data.refresh();
    if ("secret" in result) { setCredentials({ id: result.app.id, secret: result.secret }); choose(result.app.id); }
  };
  const confirm = async () => {
    if (!token || !selectedId) return;
    if (confirmation === "rotate") {
      const result = await supportRequest<{ secret: string }>(token, "/apps/" + encodeURIComponent(selectedId) + "/rotate-secret", "POST");
      setCredentials({ id: selectedId, secret: result.secret });
    } else {
      await supportRequest(token, "/apps/" + encodeURIComponent(selectedId), "DELETE");
      setSelectedId(null); setAppForm(null);
    }
    setConfirmation(null); data.refresh();
  };
  const saveWidget = (settings: Pick<Widget, "stream" | "stream_type" | "kind" | "min" | "max" | "window_minutes" | "severity">) => {
    if (!layout) return;
    if (widgetForm) {
      const { min, max, window_minutes, severity, ...unchanged } = widgetForm;
      updateWidget({ ...unchanged, ...settings });
    } else {
      const { w, h } = defaultWidgetSize(settings.kind);
      const widget: Widget = { id: "widget-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8), ...settings, ...availableWidgetPosition(layout.widgets, w, h), w, h };
      dashboard.change([...layout.widgets, widget]);
    }
    setAdding(false); setWidgetForm(null);
  };
  if (isChecking || !token) return <ActivityIndicator accessibilityLabel="Checking session" />;
  return <ScrollView scrollEnabled={interactionBottom === null} className="flex-1 bg-background-50 dark:bg-[#0B1422]" contentContainerStyle={{ padding: narrow ? 16 : 28, paddingTop: 80, gap: 20 }} keyboardShouldPersistTaps="handled">
    <Box className="flex-row flex-wrap items-center justify-between gap-4">
      <Box className="gap-1"><Text className={muted + " uppercase tracking-widest text-xs"}>Logs / App telemetry</Text><Heading size="2xl" className={ink}>HH Support</Heading><Text className={muted}>Follow the heartbeat. Find what changed.</Text></Box>
      <Box className="flex-row flex-wrap items-center gap-2"><State value={data.connection} /><Action label="Refresh" onPress={data.refresh} /><Action primary label="Register App" disabled={!data.tabs.length} onPress={() => setAppForm("new")} /></Box>
    </Box>
    <Failure message={data.error} /><Failure message={data.liveError} /><Failure message={error} /><Failure message={dashboard.error} />
    <Box className="flex-row flex-wrap items-center gap-2">
      <Action label={`All Apps (${data.apps.length})`} selected={!tabId} onPress={() => setTabId(null)} />
      {data.tabs.map((tab) => <Action key={tab.id} label={`${tab.name} (${data.apps.filter((app) => app.tab_id === tab.id).length})`} selected={tabId === tab.id} disabled={dashboard.dirty} onPress={() => { setTabId(tab.id); const first = data.apps.find((app) => app.tab_id === tab.id); if (first) choose(first.id); else setSelectedId(null); }} />)}
      <Action label="Create tab" onPress={() => setTabForm("new")} />{tabId ? <Action label="Edit tab" onPress={() => setTabForm(data.tabs.find((tab) => tab.id === tabId) ?? null)} /> : null}
    </Box>
    {data.isLoading && !data.hasSnapshot ? <ActivityIndicator accessibilityLabel="Loading Apps" /> : null}
    <Box style={{ flexDirection: narrow ? "column" : "row", gap: 20, alignItems: "stretch" }}>
      <Box className={surface + " gap-4"} style={{ width: narrow ? "100%" : 260, flexShrink: 0, alignSelf: "flex-start" }}>
        <Box className="flex-row items-center justify-between"><Text className={ink + " font-semibold"}>Apps</Text><Text className={muted}>{visibleApps.length} shown</Text></Box>
        <Field label="Search Apps or tags" value={search} onChange={setSearch} />
        <ScrollView style={{ maxHeight: narrow ? 220 : 600 }} nestedScrollEnabled>
          <Box className="gap-2">{visibleApps.map((app) => <Pressable key={app.id} accessibilityRole="button" accessibilityLabel={`Open ${app.name}`} accessibilityState={{ selected: app.id === selectedId }} onPress={() => choose(app.id)} className={"p-3 rounded-xl border gap-2 " + (app.id === selectedId ? "border-[#147D78] bg-[#E7F6F2] dark:bg-[#153B3B]" : "border-transparent bg-background-50 dark:bg-[#0B1422]")}>
            <Text className={ink + " font-semibold"}>{app.name}</Text><Box className="flex-row flex-wrap gap-1"><State value={app.connectivity} /><State value={app.health} /></Box>{app.tags.length ? <Text className={muted + " text-xs"}>{app.tags.map((tag) => "#" + tag).join(" ")}</Text> : null}
          </Pressable>)}</Box>
        </ScrollView>
        {!visibleApps.length ? <Text className={muted}>{search ? "No Apps match. Try another name or tag." : "No Apps here yet. Register an App to start receiving telemetry."}</Text> : null}
      </Box>
      <Box style={{ flex: 1, minWidth: 0 }} className="gap-4">
        {selected ? <>
          <Box className={surface + " gap-4"}>
            <Box className="flex-row flex-wrap justify-between gap-3"><Box className="gap-1"><Heading size="xl" className={ink}>{selected.name}</Heading><Text selectable className={muted + " font-mono text-xs"}>{selected.id}</Text></Box><Box className="flex-row flex-wrap gap-2"><Action label="App settings" onPress={() => setAppForm(selected)} /><Action label="Rotate secret" disabled={busy} onPress={() => setConfirmation("rotate")} /></Box></Box>
            <Box className="flex-row flex-wrap gap-3"><State value={selected.connectivity} /><State value={selected.health} /><Text className={muted}>{selected.instances.length} instances · {selected.retention_days} day retention · {selected.heartbeat_timeout_seconds}s heartbeat</Text></Box>
            {selected.health_message ? <Text selectable className={ink}>{selected.health_message}</Text> : null}
            <Text className={muted}>Last heartbeat: {selected.last_heartbeat_at ? new Date(selected.last_heartbeat_at).toLocaleString() : "Not received yet"}</Text>
            {selected.instances.length ? <ScrollView horizontal><Box className="flex-row gap-3">{selected.instances.map((instance) => <Box key={instance.instance_id} className="gap-2 p-3 rounded-lg bg-background-50 dark:bg-[#0B1422]"><Text selectable className={ink + " font-mono text-xs"}>{instance.instance_id}</Text><Box className="flex-row gap-1"><State value={instance.connectivity} /><State value={instance.health} /></Box>{instance.health_message ? <Text className={muted}>{instance.health_message}</Text> : null}</Box>)}</Box></ScrollView> : null}
          </Box>
          <Box className="flex-row flex-wrap items-center justify-between gap-3"><Box><Heading size="md" className={ink}>Telemetry dashboard</Heading><Text className={muted}>{detail?.streams.length ?? 0} discovered streams · layout revision {layout?.revision ?? "—"}{dashboard.saving ? " · saving to server…" : dashboard.dirty ? " · unsaved changes" : " · saved on server"}</Text></Box>
            <Box className="flex-row flex-wrap gap-2"><Action label="Add widget" disabled={!detail || busy || dashboard.conflict || (layout?.widgets.length ?? 0) >= 50} onPress={() => { setWidgetForm(null); setAdding(true); }} />
              {!editing ? <Action label="Edit layout" disabled={!detail || dashboard.conflict} onPress={() => setEditing(true)} /> : <Action label="Done positioning" onPress={() => setEditing(false)} />}
              {dashboard.error && !dashboard.conflict ? <Action primary label="Retry saving" disabled={dashboard.saving} onPress={dashboard.retry} /> : null}
              {dashboard.dirty && !dashboard.saving ? <Action label={dashboard.conflict ? "Reload saved layout" : "Discard unsaved changes"} onPress={() => { dashboard.discard(); setEditing(false); data.refresh(); }} /> : null}
            </Box>
          </Box>
          {editing ? <Text className={muted}>Drag a widget’s header to move it anywhere. Drag its bottom-right corner to resize. Widgets snap to the grid when released; gaps stay where you leave them. Changes save automatically.</Text> : null}
          {!detail ? <ActivityIndicator accessibilityLabel="Loading App telemetry" /> : !layout?.widgets.length ? <Box className={surface + " gap-3"}><Heading size="md" className={ink}>{detail.streams.length ? "Build your App’s dashboard" : "Waiting for the first sender"}</Heading><Text className={muted}>{detail.streams.length ? "Choose an incoming stream and display it as a value, chart, gauge, progress, text, status, feed or table." : "Add widgets now using incoming stream names, or send samples to discover streams automatically."}</Text></Box> : <ScrollView horizontal nestedScrollEnabled scrollEnabled={interactionBottom === null} contentContainerStyle={{ minWidth: "100%" }}>
            <Box onLayout={(event) => { const measured = event.nativeEvent.layout.width; if (measured > 0) setGridWidth(measured); }} style={{ width: "100%", minWidth: 680, height: (Math.max(1, interactionBottom ?? 0, ...layout.widgets.map((widget) => widget.y + widget.h)) + (editing ? 4 : 0)) * 60 + 8, position: "relative", ...(editing ? { backgroundColor: "rgba(20,125,120,0.04)" } : {}) }}>
              {editing ? Array.from({ length: 13 }, (_, column) => <Box key={column} pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: column * gridWidth / 12, borderLeftWidth: 1, borderColor: "rgba(20,125,120,0.16)" }} />) : null}
              {layout.widgets.map((widget) => <SupportWidget key={selectedId + widget.id} widget={widget} stream={detail.streams.find((stream) => stream.name === widget.stream)} page={data.history[widget.stream]} token={token} appId={selectedId!} retentionDays={selected.retention_days} cellWidth={gridWidth / 12} editing={editing && !dashboard.conflict} onChange={updateWidget} onInteraction={setInteractionBottom} onEdit={() => { setWidgetForm(widget); setAdding(true); }} onRemove={() => dashboard.change(layout.widgets.filter((entry) => entry.id !== widget.id))} />)}
            </Box>
          </ScrollView>}
        </> : <Box className={surface + " gap-3"}><Heading size="lg" className={ink}>Your Apps, in view</Heading><Text className={muted}>Choose an App to investigate its health, instance heartbeats and live telemetry. Register your first App to get a one-time ingestion secret.</Text></Box>}
      </Box>
    </Box>
    {appForm ? <AppForm key={appForm === "new" ? "new" : appForm.id} app={appForm === "new" ? undefined : appForm} tabs={data.tabs} onClose={() => setAppForm(null)} onSave={saveApp} onDelete={appForm === "new" ? undefined : () => { setAppForm(null); setConfirmation("delete"); }} /> : null}
    {tabForm ? <TabForm tab={tabForm === "new" ? undefined : tabForm} onClose={() => setTabForm(null)} onSave={async (name) => { await supportRequest(token, "/tabs" + (tabForm === "new" ? "" : "/" + encodeURIComponent(tabForm.id)), tabForm === "new" ? "POST" : "PUT", { name }); setTabForm(null); data.refresh(); }} onDelete={tabForm === "new" ? undefined : async () => { await supportRequest(token, "/tabs/" + encodeURIComponent(tabForm.id), "DELETE"); setTabForm(null); setTabId(null); data.refresh(); }} /> : null}
    {confirmation ? <SupportDialog title={confirmation === "delete" ? "Delete App permanently?" : "Replace the ingestion secret?"} onClose={() => { if (!busy) setConfirmation(null); }} footer={<><Action label="Cancel" disabled={busy} onPress={() => setConfirmation(null)} /><Action primary label={busy ? "Working…" : confirmation === "delete" ? "Delete App permanently" : "Replace secret"} disabled={busy} onPress={() => { void invoke(confirm); }} /></>}><Text className={ink}>{confirmation === "delete" ? `This deletes ${selected?.name}, all its streams, history and layout. This cannot be undone.` : "Existing senders stop authenticating immediately. Save the new secret and update every sender."}</Text><Failure message={error} /></SupportDialog> : null}
    {credentials ? <CredentialsDialog credentials={credentials} onSaved={() => setCredentials(null)} /> : null}
    {adding && detail ? <WidgetForm key={widgetForm?.id ?? "new"} widget={widgetForm ?? undefined} streams={detail.streams} onSave={saveWidget} onClose={() => { setAdding(false); setWidgetForm(null); }} /> : null}
  </ScrollView>;
}
