import React from "react";
import { PanResponder, Pressable, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { getSupportHistory, mergeSamples, trendWidgets } from "@/services/support-client";
import type { History, Sample, Severity, SupportStream, Widget } from "@/types/support";
import { Action, Failure, ink, muted, surface } from "./support-ui";
import { SupportDialog } from "./support-dialogs";
import { minimumWidgetHeight } from "./widget-format";
import { WidgetChart } from "./widget-chart";
import { WidgetFeed, WidgetTable } from "./widget-feed";
import { WidgetMetric } from "./widget-metric";
export { sampleText } from "./widget-format";

export function movedWidget(widget: Widget, deltaX: number, deltaY: number, cellWidth: number, resize: boolean, snap = true): Widget {
  const columns = snap ? Math.round(deltaX / cellWidth) : deltaX / cellWidth;
  const rows = snap ? Math.round(deltaY / 60) : deltaY / 60;
  return resize ? { ...widget, w: Math.min(12 - widget.x, Math.max(widget.kind === "text" ? 1 : 2, widget.w + columns)), h: Math.max(minimumWidgetHeight(widget.kind), widget.h + rows) } : { ...widget, x: Math.max(0, Math.min(12 - widget.w, widget.x + columns)), y: Math.max(0, widget.y + rows) };
}
export function availableWidgetPosition(widgets: Widget[], w: number, h: number): { x: number; y: number } {
  const rows = [...new Set([0, ...widgets.map((widget) => widget.y + widget.h)])].sort((a, b) => a - b);
  for (const y of rows) {
    for (let x = 0; x <= 12 - w; x++) {
      if (widgets.every((widget) => x + w <= widget.x || x >= widget.x + widget.w || y + h <= widget.y || y >= widget.y + widget.h)) return { x, y };
    }
  }
  return { x: 0, y: Math.max(0, ...widgets.map((widget) => widget.y + widget.h)) };
}
export function SupportWidget({ widget, stream, page, token, appId, retentionDays, cellWidth, editing, onChange, onEdit, onRemove, onInteraction }: { widget: Widget; stream?: SupportStream; page?: History; token: string; appId: string; retentionDays: number; cellWidth: number; editing: boolean; onChange: (widget: Widget) => void; onEdit?: () => void; onRemove: () => void; onInteraction?: (bottom: number | null) => void }) {
  const [preview, setPreview] = React.useState<Widget | null>(null);
  const [showControls, setShowControls] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [older, setOlder] = React.useState<History | null>(null);
  const [filtered, setFiltered] = React.useState<History | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [clock, setClock] = React.useState(Date.now());
  const filterGeneration = React.useRef(0);
  const latestPage = React.useRef(page); latestPage.current = page;
  const severityKey = widget.kind === "logs" ? [...widget.severity ?? []].sort().join(",") : "";
  const hasHistory = page !== undefined;
  React.useEffect(() => {
    filterGeneration.current++;
    setOlder(null); setFiltered(null); setError(null);
    if (!severityKey || !hasHistory) { setBusy(false); return; }
    const controller = new AbortController();
    const matches = (sample: Sample) => typeof sample.value === "object" && "severity" in sample.value && severityKey.split(",").includes(sample.value.severity);
    setBusy(true);
    void getSupportHistory(token, appId, widget.stream, undefined, controller.signal, { severity: severityKey.split(",") as Severity[] }).then((result) => {
      if (!controller.signal.aborted) {
        const samples = mergeSamples(result.samples, latestPage.current?.samples.filter(matches) ?? []);
        setFiltered({ samples, next_before: result.samples.length && samples[0]?.id > result.samples[0].id ? samples[0].id : result.next_before });
      }
    }).catch((err) => { if (!controller.signal.aborted) setError((err as Error).message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [token, appId, widget.stream, severityKey, hasHistory]);
  React.useEffect(() => {
    if (!severityKey || !page) return;
    const incoming = page.samples.filter((sample) => typeof sample.value === "object" && "severity" in sample.value && severityKey.split(",").includes(sample.value.severity));
    setFiltered((previous) => {
      if (!previous) return previous;
      const samples = mergeSamples(previous.samples, incoming);
      return { samples, next_before: previous.samples.length && samples[0]?.id > previous.samples[0].id ? samples[0].id : previous.next_before };
    });
  }, [page, severityKey]);
  const current = React.useRef({ widget, cellWidth, editing, onChange, onInteraction }); current.current = { widget, cellWidth, editing, onChange, onInteraction };
  const origin = React.useRef<{ widget: Widget; cellWidth: number } | null>(null);
  const handles = React.useMemo(() => {
    const cancel = () => { origin.current = null; setPreview(null); current.current.onInteraction?.(null); };
    const drag = (resize: boolean) => PanResponder.create({
      onStartShouldSetPanResponder: () => current.current.editing,
      onMoveShouldSetPanResponder: () => current.current.editing,
      onPanResponderGrant: () => {
        origin.current = { widget: current.current.widget, cellWidth: current.current.cellWidth };
        setPreview(current.current.widget);
        current.current.onInteraction?.(current.current.widget.y + current.current.widget.h);
      },
      onPanResponderMove: (_event, gesture) => {
        if (!origin.current || !current.current.editing) return;
        const next = movedWidget(origin.current.widget, gesture.dx, gesture.dy, origin.current.cellWidth, resize, false);
        setPreview(next);
        current.current.onInteraction?.(Math.ceil(next.y + next.h));
      },
      onPanResponderRelease: (_event, gesture) => {
        if (origin.current && current.current.editing) {
          const next = movedWidget(origin.current.widget, gesture.dx, gesture.dy, origin.current.cellWidth, resize);
          const previous = current.current.widget;
          if (next.x !== previous.x || next.y !== previous.y || next.w !== previous.w || next.h !== previous.h) current.current.onChange(next);
        }
        cancel();
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: cancel,
    }).panHandlers;
    return { move: drag(false), resize: drag(true) };
  }, []);
  React.useEffect(() => {
    if (!editing) { origin.current = null; setPreview(null); current.current.onInteraction?.(null); }
  }, [editing]);
  React.useEffect(() => () => { if (origin.current) current.current.onInteraction?.(null); }, []);
  const frame = editing && preview ? preview : widget;
  const displayed = older ?? (severityKey ? filtered : page);
  const lifetime = Math.min(retentionDays * 86400000, trendWidgets.includes(widget.kind) ? (widget.window_minutes ?? 60) * 60000 : Infinity);
  React.useEffect(() => {
    const now = Date.now();
    const expiry = (displayed?.samples ?? []).map((sample) => Date.parse(sample.received_at) + lifetime).filter((time) => time > now);
    if (!expiry.length) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.min(86400000, Math.max(1, Math.min(...expiry) - now + 1)));
    return () => clearTimeout(timer);
  }, [displayed, lifetime, clock]);
  let samples = (displayed?.samples ?? []).filter((sample) => Date.parse(sample.received_at) + lifetime > Date.now());
  if (widget.kind === "logs" && widget.severity?.length) samples = samples.filter((sample) => typeof sample.value === "object" && "severity" in sample.value && widget.severity!.includes(sample.value.severity));
  const latest = samples.at(-1);
  const rawValue = latest ? typeof latest.value === "object" ? JSON.stringify(latest.value, null, 2) : String(latest.value) : "";
  const numbers = samples.filter((sample) => typeof sample.value === "number" && Number.isFinite(sample.value));
  const trend = trendWidgets.includes(widget.kind);
  const history = trend || ["logs", "events", "table"].includes(widget.kind);
  const compact = frame.h < 2;
  const loadOlder = async () => {
    if (displayed?.next_before == null) return;
    setBusy(true); setError(null);
    const generation = filterGeneration.current;
    try { const result = await getSupportHistory(token, appId, widget.stream, displayed.next_before, undefined, { severity: severityKey ? severityKey.split(",") as Severity[] : undefined }); if (generation === filterGeneration.current) setOlder(result); }
    catch (err) { if (generation === filterGeneration.current) setError((err as Error).message); }
    finally { if (generation === filterGeneration.current) setBusy(false); }
  };
  return <Box testID={`support-widget-${widget.id}`} className={surface} style={{ position: "absolute", left: frame.x * cellWidth, top: frame.y * 60, width: frame.w * cellWidth - 8, height: frame.h * 60 - 8, padding: compact ? 5 : 8, gap: compact ? 0 : 4, zIndex: preview ? 2 : 0, ...(editing ? { borderColor: preview ? "#22B8A8" : "#147D78", borderWidth: preview ? 2 : 1 } : {}) }}>
    <Box className="flex-row items-center gap-1" style={{ minHeight: compact ? 15 : 20 }}>
      <View {...(editing ? handles.move : {})} accessibilityLabel={editing ? `Drag ${stream?.label || widget.stream} widget to move` : undefined} className={editing ? "web:cursor-grab web:active:cursor-grabbing web:select-none web:touch-none" : ""} style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
        {editing ? <Text size="xs" className={muted} style={{ fontSize: 12 }}>⠿</Text> : null}<Text size="xs" numberOfLines={1} className={ink + " font-semibold flex-1 " + (compact ? "leading-[14px]" : "leading-[18px]")} style={{ fontSize: compact ? 10 : 12 }}>{stream?.label || widget.stream}</Text>
      </View>
      {older ? <Text size="xs" className={muted} style={{ fontSize: 9 }}>History</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Widget controls" onPress={() => { setCopied(false); setShowControls(true); }} className="web:focus-visible:ring-2 web:focus-visible:ring-[#147D78]" style={{ width: 22, height: compact ? 16 : 22, justifyContent: "center", alignItems: "center" }}><Text size="xs" className={muted}>⋯</Text></Pressable>
    </Box>
    <Box style={{ flex: 1, minHeight: 0, paddingRight: editing && compact ? 12 : 0 }}>
      {!stream ? <Text size="xs" className={muted} style={{ fontSize: 11 }}>Waiting for {widget.stream} ({widget.stream_type ?? "data"}). Send matching samples to populate this widget.</Text>
        : !latest ? <Text size="xs" className={muted} style={{ fontSize: 11 }}>No retained data{trend ? " in this time window" : ""}.</Text>
        : trend ? numbers.length ? <WidgetChart samples={numbers} kind={widget.kind} stream={widget.stream} unit={stream.unit} /> : <Text size="xs" className={muted}>No numeric samples.</Text>
        : widget.kind === "logs" || widget.kind === "events" ? <WidgetFeed key={(older ? "history-" + older.samples[0]?.id : "live") + severityKey} samples={samples} kind={widget.kind} retentionMs={lifetime} />
        : widget.kind === "table" ? <WidgetTable samples={samples} />
        : <WidgetMetric widget={widget} samples={samples} unit={stream.unit} compact={compact} />}
    </Box>
    {history && !compact && widget.kind !== "sparkline" ? <Box className="flex-row items-center gap-1"><Text size="xs" className={muted + " flex-1"} numberOfLines={1} style={{ fontSize: 9 }}>{trend ? `${widget.window_minutes ?? 60}m · ` : ""}{samples.length} loaded{displayed?.next_before ? " · more history" : ""}{severityKey ? ` · ${severityKey}` : ""}</Text>{displayed?.next_before != null ? <Action compact label={busy ? "Loading…" : "Older page"} disabled={busy} onPress={() => { void loadOlder(); }} /> : null}{older ? <Action compact label="Return to live" onPress={() => setOlder(null)} /> : null}</Box> : null}
    <Failure message={error} />
    {editing ? <View {...handles.resize} accessibilityLabel={`Drag ${stream?.label || widget.stream} widget to resize`} className="web:cursor-nwse-resize web:select-none web:touch-none" style={{ position: "absolute", right: 0, bottom: 0, width: 20, height: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#147D78", borderTopLeftRadius: 6, borderBottomRightRadius: 10 }}><Text size="xs" className="text-white" style={{ fontSize: 13 }}>↘</Text></View> : null}
    {showControls ? <SupportDialog title={`${stream?.label || widget.stream} widget`} onClose={() => setShowControls(false)} footer={<Action label="Close" onPress={() => setShowControls(false)} />}>
      <Text size="xs" className={muted}>Stream: {widget.stream}{stream?.unit ? ` · ${stream.unit}` : ""}</Text>
      {latest ? <><Text size="xs" selectable className={ink}>{rawValue}</Text><Text size="xs" className={muted}>Received {new Date(latest.received_at).toLocaleString()} · {latest.instance_id ?? "App"}</Text><Action label={copied ? "Copied" : "Copy latest value"} onPress={() => { void Clipboard.setStringAsync(rawValue).then(() => setCopied(true)).catch(() => setError("Unable to copy. Select the value and copy it manually.")); }} /></> : null}
      {trend ? <><Text size="xs" className={muted}>Time window · hover or use arrow keys to inspect samples</Text><Box className="flex-row flex-wrap gap-1">{[15, 60, 1440].map((minutes) => <Action compact key={minutes} label={`${minutes}m${(widget.window_minutes ?? 60) === minutes ? " ✓" : ""}`} onPress={() => onChange({ ...widget, window_minutes: minutes })} />)}</Box></> : null}
      {widget.kind === "logs" ? <><Text size="xs" className={muted}>Severity filters · none selected means all</Text><Box className="flex-row flex-wrap gap-1">{(["debug", "info", "warn", "error", "fatal"] as Severity[]).map((severity) => <Action compact key={severity} label={severity + (widget.severity?.includes(severity) ? " ✓" : "")} onPress={() => onChange({ ...widget, severity: widget.severity?.includes(severity) ? widget.severity.filter((value) => value !== severity) : [...widget.severity ?? [], severity] })} />)}</Box></> : null}
      {history ? <Box className="flex-row flex-wrap gap-2">{displayed?.next_before != null ? <Action label={busy ? "Loading…" : "Older page"} disabled={busy} onPress={() => { void loadOlder(); setShowControls(false); }} /> : null}{older ? <Action label="Return to live" onPress={() => { setOlder(null); setShowControls(false); }} /> : null}</Box> : null}
      <Box className="flex-row flex-wrap gap-2"><Action label="Widget settings" onPress={() => { setShowControls(false); onEdit?.(); }} />{editing ? <Action label="Remove" onPress={onRemove} /> : null}</Box>
      {editing ? <><Text size="xs" className={muted}>Position {widget.x}, {widget.y} · size {widget.w} × {widget.h}</Text><Box className="flex-row flex-wrap gap-1"><Action label="←" onPress={() => onChange(movedWidget(widget, -cellWidth, 0, cellWidth, false))} /><Action label="→" onPress={() => onChange(movedWidget(widget, cellWidth, 0, cellWidth, false))} /><Action label="↑" onPress={() => onChange(movedWidget(widget, 0, -60, cellWidth, false))} /><Action label="↓" onPress={() => onChange(movedWidget(widget, 0, 60, cellWidth, false))} /><Action label="Narrower" onPress={() => onChange(movedWidget(widget, -cellWidth, 0, cellWidth, true))} /><Action label="Wider" onPress={() => onChange(movedWidget(widget, cellWidth, 0, cellWidth, true))} /><Action label="Shorter" onPress={() => onChange(movedWidget(widget, 0, -60, cellWidth, true))} /><Action label="Taller" onPress={() => onChange(movedWidget(widget, 0, 60, cellWidth, true))} /></Box></> : null}
      <Failure message={error} />
    </SupportDialog> : null}
  </Box>;
}
