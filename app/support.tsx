import React from "react";
import { ActivityIndicator, ScrollView, useWindowDimensions } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { SupportActions } from "@/components/support/support-actions";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useSupport } from "@/hooks/useSupport";
import { useSupportNavigation } from "@/hooks/useSupportNavigation";
import { useSupportLayout } from "@/hooks/useSupportLayout";
import { WidgetForm } from "@/components/support/widget-form";
import { replicateSupportApp, saveSupportApp, supportRequest, trendWidgets } from "@/services/support-client";
import type { AppInput, SupportApp, SupportTab, Widget } from "@/types/support";
import { Action, Failure, Field, ink, muted, State, surface } from "@/components/support/support-ui";
import { AppDetails, AppForm, CredentialsDialog, SupportDialog, TabForm } from "@/components/support/support-dialogs";
import { availableWidgetPosition, SupportWidget } from "@/components/support/support-widget";
import { SupportTimeframeControl } from "@/components/support/support-timeframe";
import type { SupportTimeframe } from "@/types/support";
import { defaultWidgetSize, minimumWidgetHeight, minimumWidgetWidth } from "@/components/support/widget-format";

export default function SupportScreen() {
  const { token, isChecking } = useAuthGuard();
  const { width } = useWindowDimensions();
  const selectedId = useSupportNavigation((state) => state.selectedId);
  const tabId = useSupportNavigation((state) => state.tabId);
  const [managing, setManaging] = React.useState(false);
  const [managingApps, setManagingApps] = React.useState<"edit" | "delete" | null>(null);
  const [appSearch, setAppSearch] = React.useState("");
  const setSelectedId = (selectedId: string | null) => useSupportNavigation.setState({ selectedId });
  const setTabId = (tabId: string | null) => useSupportNavigation.setState({ tabId });
  const [expandedWidgetId, setExpandedWidgetId] = React.useState<string | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);
  const [timeframe, setTimeframe] = React.useState<SupportTimeframe>({ minutes: 1440 });
  const data = useSupport(token, selectedId, timeframe);
  const [appForm, setAppForm] = React.useState<SupportApp | "new" | null>(null);
  const [tabForm, setTabForm] = React.useState<SupportTab | "new" | null>(null);
  const [credentials, setCredentials] = React.useState<{ id: string; secret: string } | null>(null);
  const [confirmationApp, setConfirmationApp] = React.useState<SupportApp | null>(null);
  const [confirmation, setConfirmation] = React.useState<"delete" | "rotate" | null>(null);
  const [confirmationName, setConfirmationName] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [widgetForm, setWidgetForm] = React.useState<Widget | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [gridWidth, setGridWidth] = React.useState(720);
  const [interactionBottom, setInteractionBottom] = React.useState<number | null>(null);
  const selectionInitialized = React.useRef(false);
  const narrow = width < 768;
  const selected = data.apps.find((app) => app.id === selectedId);
  const detail = data.detail?.app.id === selectedId ? data.detail : null;
  const dashboard = useSupportLayout(token, selectedId, detail?.layout);
  const { layout } = dashboard;
  const activeTab = data.tabs.find((tab) => tab.id === tabId);
  const scopeName = activeTab?.name ?? "All Apps";
  const scopedApps = data.apps.filter((app) => !tabId || app.tab_id === tabId);
  React.useEffect(() => { useSupportNavigation.setState({ tabs: data.tabs, apps: data.apps, connection: data.connection }); }, [data.tabs, data.apps, data.connection]);
  React.useEffect(() => { useSupportNavigation.setState({ dirty: dashboard.dirty }); }, [dashboard.dirty]);
  React.useEffect(() => () => { useSupportNavigation.setState({ dirty: false, connection: "disconnected" }); }, []);
  React.useEffect(() => {
    if (!selectedId && scopedApps.length && !selectionInitialized.current) { selectionInitialized.current = true; setSelectedId(scopedApps[0].id); setTabId(scopedApps[0].tab_id); }
  }, [selectedId, data.apps, data.hasSnapshot, data.isLoading, tabId]);
  React.useEffect(() => { setEditing(false); setInteractionBottom(null); setError(null); setAdding(false); setWidgetForm(null); setShowDetails(false); setExpandedWidgetId(null); }, [selectedId]);
  React.useEffect(() => { setConfirmationName(""); }, [confirmation, confirmationApp]);
  const choose = (id: string) => { if (dashboard.dirty && id !== selectedId) { setError("Wait for the dashboard to save, or resolve its save error before switching Apps."); return; } selectionInitialized.current = true; setSelectedId(id); setEditing(false); };
  const invoke = async (job: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await job(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save the change."); }
    finally { setBusy(false); }
  };
  const updateWidget = React.useCallback((widget: Widget) => {
    if (layout) dashboard.change(layout.widgets.map((current) => current.id === widget.id ? widget : current));
  }, [layout, dashboard.change]);
  const expandWidget = React.useCallback((widget: Widget) => setExpandedWidgetId(widget.id), []);
  const closeWidgetPanel = React.useCallback(() => setExpandedWidgetId(null), []);
  const editWidget = React.useCallback((widget: Widget) => { setWidgetForm(widget); setAdding(true); }, []);
  const removeWidget = React.useCallback((widget: Widget) => {
    if (layout) dashboard.change(layout.widgets.filter((entry) => entry.id !== widget.id));
  }, [layout, dashboard.change]);
  const saveApp = async (input: AppInput, sourceId?: string) => {
    if (!token) return;
    const result = sourceId
      ? await replicateSupportApp(token, sourceId, { name: input.name, tab_id: input.tab_id, tags: input.tags })
      : await saveSupportApp(token, input, appForm !== "new" ? appForm?.id : undefined);
    setAppForm(null); data.refresh();
    if ("secret" in result) { setTabId(input.tab_id); setCredentials({ id: result.app.id, secret: result.secret }); choose(result.app.id); }
    else if (result.id === selectedId) setTabId(input.tab_id);
  };
  const confirm = async () => {
    if (!token || !confirmationApp || (confirmation === "delete" && confirmationName !== confirmationApp.name)) return;
    if (confirmation === "rotate") {
      const result = await supportRequest<{ secret: string }>(token, "/apps/" + encodeURIComponent(confirmationApp.id) + "/rotate-secret", "POST");
      setCredentials({ id: confirmationApp.id, secret: result.secret });
    } else {
      await supportRequest(token, "/apps/" + encodeURIComponent(confirmationApp.id), "DELETE");
      if (selectedId === confirmationApp.id) setSelectedId(null); setAppForm(null);
    }
    setConfirmation(null); setConfirmationApp(null); data.refresh();
  };
  const saveWidget = (settings: Pick<Widget, "stream" | "stream_type" | "kind" | "min" | "max" | "window_minutes" | "severity">) => {
    if (!layout) return;
    if (widgetForm) {
      const { min, max, window_minutes, severity, ...unchanged } = widgetForm;
      const w = Math.max(widgetForm.w, minimumWidgetWidth(settings.kind));
      updateWidget({ ...unchanged, ...settings, w, h: Math.max(widgetForm.h, minimumWidgetHeight(settings.kind)), x: Math.min(widgetForm.x, 12 - w) });
    } else {
      const { w, h } = defaultWidgetSize(settings.kind);
      const widget: Widget = { id: "widget-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8), ...settings, ...availableWidgetPosition(layout.widgets, w, h), w, h };
      dashboard.change([...layout.widgets, widget]);
    }
    setAdding(false); setWidgetForm(null);
  };
  if (isChecking || !token) return <ActivityIndicator accessibilityLabel="Checking session" />;
  return <ScrollView scrollEnabled={interactionBottom === null} className="flex-1 bg-background-50 dark:bg-[#0B1422]" contentContainerStyle={{ padding: narrow ? 16 : 24, paddingTop: 80, paddingBottom: 32, gap: 12 }} keyboardShouldPersistTaps="handled">
    <Box className="flex-row flex-wrap items-center justify-between gap-3">
      <Box className="flex-row flex-wrap items-center gap-3"><Heading size="2xl" className={ink}>HH Support</Heading><State value={data.connection} /></Box>
    </Box>
    <SupportTimeframeControl value={timeframe} onChange={setTimeframe} />
    <Failure message={data.error} /><Failure message={data.liveError} /><Failure message={error} /><Failure message={dashboard.error} />
    {data.isLoading && !data.hasSnapshot ? <ActivityIndicator accessibilityLabel="Loading Apps" /> : null}
    <Box nativeID="support-workspace" accessibilityLabel={scopeName} className="gap-3 min-w-0">
        <Box className="flex-row flex-wrap items-center justify-between gap-3">
          <Box className="flex-row flex-wrap items-center gap-2 min-w-0" style={{ maxWidth: "100%", flexShrink: 1 }}>
            {!narrow ? <Text className={muted}>{scopeName} /</Text> : null}
            <Heading size="md" className={ink + " max-w-full web:[overflow-wrap:anywhere]"}>{selected?.name ?? "No App selected"}</Heading>
            {selected ? <><State value={selected.connectivity} /><State value={selected.health} /></> : null}
          </Box>
          <Box className="flex-row flex-wrap items-center gap-2" style={{ maxWidth: "100%" }}>
            {editing ? <Action label="Done positioning" onPress={() => setEditing(false)} /> : null}
            <SupportActions createApp={{ label: "Create an App", disabled: dashboard.dirty || !data.tabs.length, onPress: () => setAppForm("new") }} manageApps={[
              { label: "Edit Apps", disabled: dashboard.dirty || !data.apps.length, onPress: () => { setAppSearch(""); setManagingApps("edit"); } },
              { label: "Delete Apps", disabled: dashboard.dirty || !data.apps.length, onPress: () => { setAppSearch(""); setManagingApps("delete"); } },
            ]} manageTabs={{ label: "Manage Tabs", disabled: dashboard.dirty, onPress: () => setManaging(true) }} actions={selected ? [
              { label: "Add widget", disabled: !detail || busy || dashboard.conflict || (layout?.widgets.length ?? 0) >= 50, onPress: () => { setWidgetForm(null); setAdding(true); } },
              { label: editing ? "Done positioning" : "Edit layout", disabled: !detail || dashboard.conflict, onPress: () => setEditing(!editing) },
              { label: "App details", onPress: () => setShowDetails(true) },
            ] : []} />
          </Box>
        </Box>
        {dashboard.error && !dashboard.conflict ? <Action primary label="Retry saving" disabled={dashboard.saving} onPress={dashboard.retry} /> : null}
        {dashboard.dirty && !dashboard.saving ? <Action label={dashboard.conflict ? "Reload saved layout" : "Discard unsaved changes"} onPress={() => { dashboard.discard(); setEditing(false); data.refresh(); }} /> : null}
        {selected ? <>
          {editing ? <Text className={muted}>Drag a widget’s header to move it anywhere. Drag its bottom-right corner to resize. Widgets snap to the grid when released; gaps stay where you leave them. Changes save automatically.</Text> : null}
          {!detail ? <ActivityIndicator accessibilityLabel="Loading App telemetry" /> : !layout?.widgets.length ? <Box className={surface + " gap-3"}><Heading size="md" className={ink}>{detail.streams.length ? "Build your App’s dashboard" : "Waiting for the first sender"}</Heading><Text className={muted}>{detail.streams.length ? "Choose an incoming stream and display it as a value, chart, gauge, progress, text, status, feed or table." : "Add widgets now using incoming stream names, or send samples to discover streams automatically."}</Text></Box> : <ScrollView horizontal nestedScrollEnabled scrollEnabled={interactionBottom === null} contentContainerStyle={{ minWidth: "100%" }}>
            <Box onLayout={(event) => { const measured = event.nativeEvent.layout.width; if (measured > 0) setGridWidth(measured); }} style={{ width: "100%", minWidth: 680, height: (Math.max(1, interactionBottom ?? 0, ...layout.widgets.map((widget) => widget.y + widget.h)) + (editing ? 4 : 0)) * 60 + 8, position: "relative", ...(editing ? { backgroundColor: "rgba(20,125,120,0.04)" } : {}) }}>
              {editing ? Array.from({ length: 13 }, (_, column) => <Box key={column} pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: column * gridWidth / 12, borderLeftWidth: 1, borderColor: "rgba(20,125,120,0.16)" }} />) : null}
              {layout.widgets.map((widget) => <SupportWidget key={selectedId + widget.id + JSON.stringify(timeframe)} timeframe={timeframe} expanded={expandedWidgetId === widget.id} onExpand={expandWidget} onClosePanel={closeWidgetPanel} widget={widget} stream={detail.streams.find((stream) => stream.name === widget.stream)} page={trendWidgets.includes(widget.kind) ? data.chartHistory[widget.stream] ?? data.history[widget.stream] : data.history[widget.stream]} token={token} appId={selectedId!} retentionDays={selected.retention_days} cellWidth={gridWidth / 12} editing={editing && !dashboard.conflict} onChange={updateWidget} onInteraction={setInteractionBottom} onEdit={editWidget} onRemove={removeWidget} />)}
            </Box>
          </ScrollView>}
        </> : <Box className={surface + " gap-3"}><Heading size="lg" className={ink}>{scopedApps.length ? "Choose an App" : `No Apps in ${scopeName}`}</Heading><Text className={muted}>{scopedApps.length ? "Select an App from HH Support in the navigation menu." : "Register an App in this workspace to start receiving telemetry."}</Text>{!data.tabs.length ? <Action label="Create your first tab" onPress={() => setTabForm("new")} /> : !scopedApps.length ? <Action primary label="Create an App" disabled={dashboard.dirty} onPress={() => setAppForm("new")} /> : null}</Box>}
    </Box>
    {managing ? <SupportDialog title="Manage Tabs" onClose={() => setManaging(false)} footer={<Action label="Close" onPress={() => setManaging(false)} />}>
      <Action primary label="Create tab" disabled={dashboard.dirty} onPress={() => { setManaging(false); setTabForm("new"); }} />
      {data.tabs.map((tab) => <Box key={tab.id} className="flex-row flex-wrap items-center justify-between gap-2"><Box><Text className={ink + " font-semibold"}>{tab.name}</Text><Text className={muted}>{data.apps.filter((app) => app.tab_id === tab.id).length} Apps</Text></Box><Action label={`Edit ${tab.name}`} disabled={dashboard.dirty} onPress={() => { setManaging(false); setTabForm(tab); }} /></Box>)}
      <Text className={muted}>Workspaces organize Apps in the navigation menu. Only empty workspaces can be removed.</Text>
    </SupportDialog> : null}
    {managingApps ? <SupportDialog title={managingApps === "edit" ? "Edit Apps" : "Delete Apps"} onClose={() => setManagingApps(null)} footer={<Action label="Close" onPress={() => setManagingApps(null)} />}>
      <Field label="Search Apps or tags" value={appSearch} onChange={setAppSearch} />
      {data.apps.filter((app) => [app.name, ...app.tags].join(" ").toLowerCase().includes(appSearch.toLowerCase())).map((app) => <Box key={app.id} className="flex-row flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-outline-100 dark:border-[#26364A]"><Box className="flex-1 min-w-0 gap-1"><Text className={ink + " font-semibold"}>{app.name}</Text><Text className={muted}>{data.tabs.find((tab) => tab.id === app.tab_id)?.name}{app.tags.length ? " · " + app.tags.join(", ") : ""}</Text></Box><Action label={`${managingApps === "edit" ? "Edit" : "Delete"} ${app.name}`} disabled={dashboard.dirty} onPress={() => { setManagingApps(null); if (managingApps === "edit") setAppForm(app); else { setConfirmationApp(app); setConfirmation("delete"); } }} /></Box>)}
      {!data.apps.some((app) => [app.name, ...app.tags].join(" ").toLowerCase().includes(appSearch.toLowerCase())) ? <Text className={muted}>No Apps match. Try another name or tag.</Text> : null}
    </SupportDialog> : null}
    {showDetails && selected ? <AppDetails app={selected} tabName={data.tabs.find((tab) => tab.id === selected.tab_id)?.name} streamCount={detail?.streams.length} revision={layout?.revision} onClose={() => setShowDetails(false)} onSettings={() => { setShowDetails(false); setAppForm(selected); }} onRotate={() => { setShowDetails(false); setConfirmationApp(selected); setConfirmation("rotate"); }} /> : null}
    {appForm ? <AppForm key={appForm === "new" ? "new" : appForm.id} app={appForm === "new" ? undefined : appForm} tabs={data.tabs} initialTabId={tabId ?? undefined} apps={data.apps} onClose={() => setAppForm(null)} onSave={saveApp} onDelete={appForm === "new" ? undefined : () => { setConfirmationApp(appForm); setAppForm(null); setConfirmation("delete"); }} /> : null}
    {tabForm ? <TabForm tabs={data.tabs} tab={tabForm === "new" ? undefined : tabForm} onClose={() => setTabForm(null)} onSave={async (name) => { await supportRequest(token, "/tabs" + (tabForm === "new" ? "" : "/" + encodeURIComponent(tabForm.id)), tabForm === "new" ? "POST" : "PUT", { name }); setTabForm(null); data.refresh(); }} onDelete={tabForm === "new" || data.apps.some((app) => app.tab_id === tabForm.id) ? undefined : async () => { await supportRequest(token, "/tabs/" + encodeURIComponent(tabForm.id), "DELETE"); setTabForm(null); setTabId(null); data.refresh(); }} /> : null}
    {confirmation ? <SupportDialog title={confirmation === "delete" ? "Delete App permanently?" : "Replace the ingestion secret?"} onClose={() => { if (!busy) { setConfirmation(null); setConfirmationApp(null); } }} footer={<><Action label="Cancel" disabled={busy} onPress={() => { setConfirmation(null); setConfirmationApp(null); }} /><Action primary label={busy ? "Working…" : confirmation === "delete" ? "Delete App permanently" : "Replace secret"} disabled={busy || (confirmation === "delete" && confirmationName !== confirmationApp?.name)} onPress={() => { void invoke(confirm); }} /></>}><Text className={ink}>{confirmation === "delete" ? `This deletes ${confirmationApp?.name}, all its streams, history and layout. This cannot be undone.` : "Existing senders stop authenticating immediately. Save the new secret and update every sender."}</Text>{confirmation === "delete" ? <Field label={`Type ${confirmationApp?.name} to confirm`} value={confirmationName} onChange={setConfirmationName} /> : null}<Failure message={error} /></SupportDialog> : null}
    {credentials ? <CredentialsDialog credentials={credentials} onSaved={() => setCredentials(null)} /> : null}
    {adding && detail ? <WidgetForm key={widgetForm?.id ?? "new"} widget={widgetForm ?? undefined} streams={detail.streams} onSave={saveWidget} onClose={() => { setAdding(false); setWidgetForm(null); }} /> : null}
  </ScrollView>;
}
