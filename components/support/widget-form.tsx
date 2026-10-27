import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { compatibleWidgets, trendWidgets, widgetLabels } from "@/services/support-client";
import type { Severity, StreamType, SupportStream, Widget, WidgetKind } from "@/types/support";
import { SupportDialog } from "./support-dialogs";
import { Action, Failure, Field, muted } from "./support-ui";
import { defaultWidgetSize } from "./widget-format";

const descriptions: Record<WidgetKind, string> = {
  value: "A compact latest value with its change since the previous measurement. Select the value or copy it from the widget menu.",
  text: "A small, selectable text tile for versions, labels or notes. Long text wraps and scrolls; this tile can shrink to one row.",
  boolean: "A compact True / False indicator. False stays neutral because its meaning depends on your stream.",
  line: "Inspect trends over receipt time. Hover, tap or use arrow keys for the exact value, time and sender.",
  area: "See the magnitude above or below zero over receipt time. Hover, tap or use arrow keys to inspect measurements.",
  bar: "Compare individual measurements, including negative values. Hover, tap or use arrow keys to inspect each bar.",
  sparkline: "A small trend with the latest value. Hover or tap for details without a full chart taking up space.",
  gauge: "Read the latest measurement against a fixed range. Values outside the range remain visible and are flagged.",
  progress: "A thin progress meter with its actual value and percentage. The bar stops at the range edges while out-of-range values stay explicit.",
  logs: "A compact terminal stream, oldest to newest. Follow live, scroll back, pause the view or search loaded lines. Severity filters search retained history.",
  events: "A dense chronological event feed. Expand a row to inspect structured fields; pause or search loaded events.",
  table: "Compare received times, senders and values in columns. Change row order, search loaded samples and scroll horizontally when narrow.",
};

export function WidgetForm({ widget, streams, onSave, onClose }: { widget?: Widget; streams: SupportStream[]; onSave: (settings: Pick<Widget, "stream" | "stream_type" | "kind" | "min" | "max" | "window_minutes" | "severity">) => void; onClose: () => void }) {
  const [name, setName] = React.useState(widget?.stream ?? "");
  const [type, setType] = React.useState<StreamType>(streams.find((stream) => stream.name === widget?.stream)?.type ?? widget?.stream_type ?? streams[0]?.type ?? "number");
  const [kind, setKind] = React.useState<WidgetKind>(widget?.kind ?? compatibleWidgets[type][0]);
  const [minimum, setMinimum] = React.useState(String(widget?.min ?? 0));
  const [maximum, setMaximum] = React.useState(String(widget?.max ?? 100));
  const [minutes, setMinutes] = React.useState(String(widget?.window_minutes ?? 60));
  const [severity, setSeverity] = React.useState<Severity[]>(widget?.severity ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const stream = streams.find((entry) => entry.name === name.trim());
  const streamType = stream?.type ?? type;
  const options = compatibleWidgets[streamType];
  const display = options.includes(kind) ? kind : options[0];
  const changeType = (next: StreamType) => { setType(next); if (!compatibleWidgets[next].includes(kind)) setKind(compatibleWidgets[next][0]); };
  const range = display === "gauge" || display === "progress";
  const trend = trendWidgets.includes(display);
  const save = () => {
    if (!name.trim() || name.trim().length > 128 || (range && (!minimum.trim() || !maximum.trim() || !Number.isFinite(Number(minimum)) || !Number.isFinite(Number(maximum)) || Number(maximum) <= Number(minimum))) || (trend && (!Number.isInteger(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 525600))) {
      setError("Enter a stream name (up to 128 characters), a maximum above the minimum, and a whole time window from 1 to 525600 minutes."); return;
    }
    onSave({ stream: name.trim(), stream_type: streamType, kind: display, ...(range ? { min: Number(minimum), max: Number(maximum) } : {}), ...(trend ? { window_minutes: Number(minutes) } : {}), ...(display === "logs" ? { severity } : {}) });
  };
  return <SupportDialog title={widget ? "Edit telemetry widget" : "Add a telemetry widget"} onClose={onClose} footer={<><Action label="Cancel" onPress={onClose} /><Action primary label={widget ? "Save widget" : "Add to dashboard"} onPress={save} /></>}>
    <Field label="Incoming stream name" value={name} onChange={setName} />
    <Text className={muted}>For example: number_cpu. Choose a received stream below or type the exact name your sender will emit.</Text>
    <Box className="flex-row flex-wrap gap-2">{streams.filter((entry) => [entry.name, entry.label].join(" ").toLowerCase().includes(name.toLowerCase())).map((entry) => <Action key={entry.name} label={`${entry.label || entry.name} · ${entry.name} · ${entry.type}`} selected={name === entry.name} onPress={() => { setName(entry.name); changeType(entry.type); }} />)}</Box>
    {!stream ? <><Text className={muted}>Expected incoming data type · this widget waits for matching samples</Text><Box className="flex-row flex-wrap gap-2">{(["number", "text", "boolean", "log", "event"] as StreamType[]).map((option) => <Action key={option} label={option} selected={type === option} onPress={() => changeType(option)} />)}</Box></> : <Text className={muted}>Received data type: {stream.type}{stream.unit ? " · " + stream.unit : ""}</Text>}
    <Text className={muted}>Display this {streamType} stream as</Text><Box className="flex-row flex-wrap gap-2">{options.map((option) => <Action key={option} label={widgetLabels[option]} selected={display === option} onPress={() => setKind(option)} />)}</Box>
    <Text className={muted}>{descriptions[display]}</Text>
    {!widget ? <Text className={muted}>Starts at {defaultWidgetSize(display).w} columns × {defaultWidgetSize(display).h} rows. Drag the corner to resize.</Text> : null}
    {range ? <Box className="flex-row gap-2"><Field label="Minimum" value={minimum} onChange={setMinimum} /><Field label="Maximum" value={maximum} onChange={setMaximum} /></Box> : null}
    {trend ? <Field label="Time window (minutes)" value={minutes} onChange={setMinutes} /> : null}
    {display === "logs" ? <><Text className={muted}>Severity · none selected means all</Text><Box className="flex-row flex-wrap gap-2">{(["debug", "info", "warn", "error", "fatal"] as Severity[]).map((level) => <Action key={level} label={level} selected={severity.includes(level)} onPress={() => setSeverity(severity.includes(level) ? severity.filter((value) => value !== level) : [...severity, level])} />)}</Box></> : null}
    <Failure message={error} />
  </SupportDialog>;
}
