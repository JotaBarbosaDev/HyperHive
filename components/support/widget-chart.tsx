import React from "react";
import { Platform, ScrollView, View } from "react-native";
import Svg, { Circle, Line, Polygon, Polyline, Rect } from "react-native-svg";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import type { Sample, WidgetKind } from "@/types/support";
import { ink, muted } from "./support-ui";
import { measurementText } from "./widget-format";

// Keep extrema in each visual bucket so dense charts retain short spikes.
export function chartSamples(samples: Sample[], buckets = 60): Sample[] {
  if (samples.length <= buckets * 2) return samples;
  const selected = new Set([samples[0], samples.at(-1)!]);
  const start = Date.parse(samples[0].received_at), duration = Date.parse(samples.at(-1)!.received_at) - start;
  const groups = new Map<number, Sample[]>();
  samples.forEach((sample, index) => {
    const bucket = Math.min(buckets - 1, Math.floor((duration > 0 ? (Date.parse(sample.received_at) - start) / duration : index / samples.length) * buckets));
    const group = groups.get(bucket) ?? []; group.push(sample); groups.set(bucket, group);
  });
  groups.forEach((group) => {
    selected.add(group.reduce((a, b) => (a.value as number) <= (b.value as number) ? a : b));
    selected.add(group.reduce((a, b) => (a.value as number) >= (b.value as number) ? a : b));
  });
  return samples.filter((sample) => selected.has(sample));
}

export function chartGeometry(samples: Sample[], kind: WidgetKind, width = 320, height = 130) {
  const plotWidth = Math.max(1, width - 20), plotHeight = Math.max(1, height - 20);
  const values = samples.map((sample) => sample.value as number);
  let min = Math.min(...values); let max = Math.max(...values);
  if (kind === "bar" || kind === "area") { min = Math.min(0, min); max = Math.max(0, max); }
  if (min === max) { const padding = Math.max(1, Math.abs(min) * 0.1); min -= padding; max += padding; }
  const first = Date.parse(samples[0].received_at); const last = Date.parse(samples.at(-1)!.received_at);
  const points = samples.map((sample, index) => ({
    x: kind === "bar" ? (index + 0.5) * plotWidth / samples.length + 10 : 10 + (last > first ? (Date.parse(sample.received_at) - first) / (last - first) : index / Math.max(1, samples.length - 1)) * plotWidth,
    y: height - 10 - ((sample.value as number) - min) / (max - min) * plotHeight,
  }));
  return { points, min, max, baseline: height - 10 - (0 - min) / (max - min) * plotHeight };
}

export function WidgetChart({ samples, kind, stream, unit, detailed = false }: { samples: Sample[]; kind: WidgetKind; stream: string; unit?: string; detailed?: boolean }) {
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [{ width, height }, setSize] = React.useState({ width: 320, height: 130 });
  const index = samples.findIndex((sample) => sample.id === selectedId);
  const selected = samples[index];
  const latest = samples.at(-1)!;
  const valueLabel = selected ? String(selected.value) + (unit ? " " + unit : "") : measurementText(latest.value as number, unit);
  const plotted = chartSamples(samples);
  const { points: fullPoints, baseline, min, max } = chartGeometry(samples, kind, width, height);
  const visibleIds = new Set(plotted.map((sample) => sample.id));
  const points = fullPoints.filter((_, index) => visibleIds.has(samples[index].id));
  const selectedPoint = index >= 0 ? fullPoints[index] : fullPoints.at(-1)!;
  const inspect = (fraction: number) => {
    const x = Math.max(0, Math.min(1, fraction)) * width;
    const nearest = fullPoints.reduce((best, point, candidate) => Math.abs(point.x - x) < Math.abs(fullPoints[best].x - x) ? candidate : best, 0);
    setSelectedId(samples[nearest].id);
  };
  const step = (delta: number) => setSelectedId(samples[Math.max(0, Math.min(samples.length - 1, (index < 0 ? samples.length - 1 : index) + delta))].id);
  const keyboard = Platform.OS === "web" ? { onKeyDown: (event: React.KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Escape") setSelectedId(null);
      else if (event.key === "Home") setSelectedId(samples[0].id);
      else if (event.key === "End") setSelectedId(latest.id);
      else step(event.key === "ArrowLeft" ? -1 : 1);
    }
  } } : {};
  const spark = kind === "sparkline" && !detailed;
  const minimum = Math.min(...samples.map((sample) => sample.value as number));
  const maximum = Math.max(...samples.map((sample) => sample.value as number));
  const firstTime = Date.parse(samples[0].received_at), lastTime = Date.parse(latest.received_at);
  const multipleDays = new Date(firstTime).toDateString() !== new Date(lastTime).toDateString();
  const timeLabel = (time: number) => new Date(time).toLocaleString(undefined, { ...(multipleDays ? { month: "short", day: "numeric" } as const : {}), hour: "2-digit", minute: "2-digit", ...(lastTime - firstTime < 60000 ? { second: "2-digit" } as const : {}), hour12: false });
  const ticks = Array.from({ length: detailed ? 5 : 3 }, (_, i) => max - i * (max - min) / (detailed ? 4 : 2));
  const focused = selected ?? latest;
  const content = <Box style={{ flex: detailed ? undefined : 1, minHeight: 0, gap: detailed ? 16 : 4 }}>
    <Box className="flex-row flex-wrap items-baseline justify-between gap-x-2">
      <Box>{detailed ? <Text size="xs" className={muted}>{selected ? "Selected value" : "Latest value"}</Text> : null}<Text size="xs" selectable className={ink + " font-semibold max-w-full " + (spark ? "leading-[20px]" : detailed ? "leading-[36px]" : "leading-[26px]")} style={{ fontSize: spark ? 16 : detailed ? 30 : 22 }}>{valueLabel}</Text></Box>
      {!spark && !selected && !detailed ? <Text size="xs" className={muted} style={{ fontSize: 10 }}>min {measurementText(minimum, unit)} · max {measurementText(maximum, unit)}</Text> : null}
    </Box>
    {detailed ? <Box className="flex-row flex-wrap gap-3">{[["Minimum", measurementText(minimum, unit)], ["Maximum", measurementText(maximum, unit)], ["Samples", String(samples.length)]].map(([label, value]) => <Box key={label} className="flex-1 min-w-[80px] p-3 rounded-lg bg-background-50 dark:bg-[#152334]"><Text size="xs" className={muted}>{label}</Text><Text selectable className={ink + " font-semibold"}>{value}</Text></Box>)}</Box> : null}
    {!spark && detailed ? <Text size="xs" className={muted} style={{ fontSize: 10 }}>Value{unit ? ` (${unit})` : ""}</Text> : null}
    <Box style={{ flexDirection: "row", flex: detailed ? undefined : 1, height: detailed ? Math.max(200, Math.min(340, width * 0.55)) : undefined, minHeight: spark ? 24 : detailed ? 64 : 42 }}>
      {!spark ? <Box testID="chart-y-axis" style={{ width: detailed ? 84 : 68, paddingTop: 3, paddingBottom: 3, paddingRight: 8, justifyContent: "space-between" }}>{ticks.map((value, i) => <Text key={i} size="xs" className={muted + " leading-[14px]"} numberOfLines={1} style={{ fontSize: 10, textAlign: "right" }}>{measurementText(value, unit)}</Text>)}</Box> : null}
      <View {...keyboard} testID={`chart-${stream}-${kind}`} tabIndex={0} accessibilityRole="adjustable" accessibilityLabel={`${kind} chart of ${stream}, ${samples.length} samples. Hover or use left and right arrows to inspect.`} accessibilityValue={{ min: 1, max: samples.length, now: (index < 0 ? samples.length - 1 : index) + 1, text: valueLabel }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "increment" ? 1 : -1)} onFocus={() => setSelectedId(latest.id)} onBlur={() => setSelectedId(null)} onLayout={(event) => { const { width, height } = event.nativeEvent.layout; if (width > 0 && height > 0) setSize({ width, height }); }}
        onPointerMove={(event) => {
          if (Platform.OS !== "web") return;
          const rect = (event.currentTarget as unknown as HTMLElement).getBoundingClientRect();
          if (rect.width) inspect((event.nativeEvent.clientX - rect.left) / rect.width);
        }} onPointerLeave={() => setSelectedId(null)} onTouchEnd={(event) => inspect(event.nativeEvent.locationX / width)}
        className="web:cursor-crosshair web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#147D78]" style={{ flex: 1, minWidth: 0, minHeight: 24 }}>
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          {!spark ? ticks.map((_, i) => <Line key={i} x1={10} x2={width - 10} y1={10 + i * (height - 20) / (ticks.length - 1)} y2={10 + i * (height - 20) / (ticks.length - 1)} stroke="#8A94A8" strokeOpacity={0.2} strokeWidth={1} />) : null}
          {!spark ? <><Line x1={10} x2={10} y1={10} y2={height - 10} stroke="#8A94A8" strokeOpacity={0.5} /><Line x1={10} x2={width - 10} y1={height - 10} y2={height - 10} stroke="#8A94A8" strokeOpacity={0.5} /></> : null}
          {kind === "area" ? <Polygon points={`${points[0].x},${baseline} ${points.map((p) => `${p.x},${p.y}`).join(" ")} ${points.at(-1)!.x},${baseline}`} fill="#22B8A8" fillOpacity={0.18} /> : null}
          {kind === "bar" ? points.map((point, i) => <Rect key={plotted[i].id} x={point.x - (width - 20) / samples.length * 0.36} y={Math.min(point.y, baseline)} width={Math.max(0.1, (width - 20) / samples.length * 0.72)} height={Math.max(0.5, Math.abs(point.y - baseline))} fill={plotted[i].id === selectedId ? "#147D78" : "#22B8A8"} />) : <Polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#22B8A8" strokeWidth={2} />}
          {selected ? <Line x1={selectedPoint.x} x2={selectedPoint.x} y1={10} y2={height - 10} stroke="#147D78" strokeWidth={1} strokeDasharray="3 3" /> : null}
          {samples.length === 1 || selected ? <Circle testID="chart-marker" cx={selectedPoint.x} cy={selectedPoint.y} r={4} fill="#6ED5C4" stroke="#147D78" strokeWidth={2} /> : null}
        </Svg>
        {selected ? <Box pointerEvents="none" testID="chart-value-tooltip" className="rounded-lg border border-outline-200 dark:border-[#355268] bg-background-0 dark:bg-[#152334]" style={{ position: "absolute", left: Math.max(0, Math.min(width - 170, selectedPoint.x - 85)), top: Math.max(0, Math.min(height - 54, selectedPoint.y < 70 ? selectedPoint.y + 12 : selectedPoint.y - 60)), maxWidth: Math.min(170, width), padding: 8, gap: 2 }}><Text size="xs" selectable className={ink + " font-semibold"} style={{ fontSize: 12 }}>{String(selected.value)}{unit ? " " + unit : ""}</Text><Text size="xs" className={muted} style={{ fontSize: 10 }}>{timeLabel(Date.parse(selected.received_at))}</Text></Box> : null}
      </View>
    </Box>
    {!spark ? <Box testID="chart-x-axis" accessibilityLabel="Receipt time" style={{ paddingLeft: detailed ? 94 : 78, paddingRight: 10, gap: 3 }}><Box className="flex-row justify-between gap-1">{(width < 200 ? [0, 1] : [0, 0.5, 1]).map((fraction) => <Text key={fraction} size="xs" numberOfLines={1} className={muted + " leading-[14px]"} style={{ fontSize: 10, flexShrink: 1, textAlign: fraction === 0 ? "left" : fraction === 1 ? "right" : "center" }}>{timeLabel(kind === "bar" ? Date.parse(samples[Math.round(fraction * (samples.length - 1))].received_at) : firstTime + fraction * (lastTime - firstTime))}</Text>)}</Box>{detailed ? <Text size="xs" className={muted} style={{ fontSize: 10, textAlign: "center" }}>Receipt time</Text> : null}</Box> : null}
    <Text size="xs" accessibilityLiveRegion="polite" className={muted + " leading-[14px]"} numberOfLines={detailed ? undefined : 1} style={{ fontSize: 10 }}>
      {selected ? `${new Date(selected.received_at).toLocaleString()} · ${selected.instance_id ?? "App"} · sample ${selected.id}` : spark ? "Hover to inspect" : `${samples.length} samples${plotted.length < samples.length ? " · simplified view" : ""}`}
    </Text>
    {detailed ? <Box testID="chart-sample-details" className="p-4 rounded-xl border border-outline-200 dark:border-[#26364A]" style={{ gap: 12 }}><Text className={ink + " font-semibold"}>{selected ? "Selected sample" : "Latest sample"}</Text><Box className="flex-row flex-wrap gap-4">{[["Value", String(focused.value) + (unit ? " " + unit : "")], ["Sender", focused.instance_id ?? "App"], ["Received", new Date(focused.received_at).toLocaleString()], ["Sample", String(focused.id)]].map(([label, value]) => <Box key={label} style={{ minWidth: 120, flex: 1, gap: 3 }}><Text size="xs" className={muted}>{label}</Text><Text size="xs" selectable className={ink}>{value}</Text></Box>)}</Box><Text size="xs" className={muted}>Hover or tap the chart to inspect a sample. Use arrow keys, Home or End when focused.</Text></Box> : null}
  </Box>;
  return detailed ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>{content}</ScrollView> : content;
}
