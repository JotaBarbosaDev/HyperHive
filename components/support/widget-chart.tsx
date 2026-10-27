import React from "react";
import { Platform, View } from "react-native";
import Svg, { Circle, Line, Polygon, Polyline, Rect } from "react-native-svg";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import type { Sample, WidgetKind } from "@/types/support";
import { ink, muted } from "./support-ui";
import { measurementText } from "./widget-format";

export function chartGeometry(samples: Sample[], kind: WidgetKind) {
  const values = samples.map((sample) => sample.value as number);
  let min = Math.min(...values); let max = Math.max(...values);
  if (kind === "bar" || kind === "area") { min = Math.min(0, min); max = Math.max(0, max); }
  if (min === max) { const padding = Math.max(1, Math.abs(min) * 0.1); min -= padding; max += padding; }
  const first = Date.parse(samples[0].received_at); const last = Date.parse(samples.at(-1)!.received_at);
  const points = samples.map((sample, index) => ({
    x: kind === "bar" ? (index + 0.5) * 300 / samples.length + 10 : 10 + (last > first ? (Date.parse(sample.received_at) - first) / (last - first) : index / Math.max(1, samples.length - 1)) * 300,
    y: 120 - ((sample.value as number) - min) / (max - min) * 110,
  }));
  return { points, min, max, baseline: 120 - (0 - min) / (max - min) * 110 };
}

export function WidgetChart({ samples, kind, stream, unit }: { samples: Sample[]; kind: WidgetKind; stream: string; unit?: string }) {
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [width, setWidth] = React.useState(1);
  const index = samples.findIndex((sample) => sample.id === selectedId);
  const selected = samples[index];
  const latest = samples.at(-1)!;
  const valueLabel = selected ? String(selected.value) + (unit ? " " + unit : "") : measurementText(latest.value as number, unit);
  const { points, baseline } = chartGeometry(samples, kind);
  const inspect = (fraction: number) => {
    const x = Math.max(0, Math.min(1, fraction)) * 320;
    const nearest = points.reduce((best, point, candidate) => Math.abs(point.x - x) < Math.abs(points[best].x - x) ? candidate : best, 0);
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
  const spark = kind === "sparkline";
  return <Box style={{ flex: 1, minHeight: 0, gap: 3 }}>
    <Box className="flex-row flex-wrap items-baseline justify-between gap-x-2">
      <Text size="xs" selectable numberOfLines={1} className={ink + " font-semibold max-w-full " + (spark ? "leading-[20px]" : "leading-[26px]")} style={{ fontSize: spark ? 16 : 22 }}>{valueLabel}</Text>
      {!spark && !selected ? <Text size="xs" className={muted} style={{ fontSize: 10 }}>min {measurementText(Math.min(...samples.map((s) => s.value as number)), unit)} · max {measurementText(Math.max(...samples.map((s) => s.value as number)), unit)}</Text> : null}
    </Box>
    <View {...keyboard} testID={`chart-${stream}-${kind}`} tabIndex={0} accessibilityRole="adjustable" accessibilityLabel={`${kind} chart of ${stream}, ${samples.length} samples. Hover or use left and right arrows to inspect.`} accessibilityValue={{ min: 1, max: samples.length, now: (index < 0 ? samples.length - 1 : index) + 1, text: valueLabel }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "increment" ? 1 : -1)} onFocus={() => setSelectedId(latest.id)} onBlur={() => setSelectedId(null)} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onPointerMove={(event) => {
        if (Platform.OS !== "web") return;
        const rect = (event.currentTarget as unknown as HTMLElement).getBoundingClientRect();
        if (rect.width) inspect((event.nativeEvent.clientX - rect.left) / rect.width);
      }} onPointerLeave={() => setSelectedId(null)} onTouchEnd={(event) => inspect(event.nativeEvent.locationX / width)}
      className="web:cursor-crosshair web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-[#147D78]" style={{ flex: 1, minHeight: 24 }}>
      <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 320 130" preserveAspectRatio="none">
        {!spark ? [10, 65, 120].map((y) => <Line key={y} x1={10} x2={310} y1={y} y2={y} stroke="#8A94A8" strokeOpacity={0.18} strokeWidth={1} />) : null}
        {kind === "area" ? <Polygon points={`${points[0].x},${baseline} ${points.map((p) => `${p.x},${p.y}`).join(" ")} ${points.at(-1)!.x},${baseline}`} fill="#22B8A8" fillOpacity={0.18} /> : null}
        {kind === "bar" ? points.map((point, i) => <Rect key={samples[i].id} x={point.x - 300 / samples.length * 0.36} y={Math.min(point.y, baseline)} width={Math.max(0.1, 300 / samples.length * 0.72)} height={Math.max(0.5, Math.abs(point.y - baseline))} fill={i === index ? "#147D78" : "#22B8A8"} />) : <Polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#22B8A8" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
        {samples.length === 1 || selected ? <Circle cx={points[index < 0 ? 0 : index].x} cy={points[index < 0 ? 0 : index].y} r={3} fill="#147D78" /> : null}
        {selected ? <Line x1={points[index].x} x2={points[index].x} y1={0} y2={130} stroke="#147D78" strokeWidth={1} strokeDasharray="3 3" /> : null}
      </Svg>
    </View>
    <Text size="xs" accessibilityLiveRegion="polite" className={muted + " leading-[14px]"} numberOfLines={1} style={{ fontSize: 10 }}>
      {selected ? `${new Date(selected.received_at).toLocaleString()} · ${selected.instance_id ?? "App"} · sample ${selected.id}` : spark ? "Hover to inspect" : `${new Date(samples[0].received_at).toLocaleTimeString()} → ${new Date(latest.received_at).toLocaleTimeString()} · ${samples.length} samples`}
    </Text>
  </Box>;
}
