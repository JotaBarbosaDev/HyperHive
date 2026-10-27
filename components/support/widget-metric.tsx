import React from "react";
import { ScrollView } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import type { Sample, Widget } from "@/types/support";
import { ink, muted } from "./support-ui";
import { sampleText } from "./widget-format";

export function WidgetMetric({ widget, samples, unit, compact }: { widget: Widget; samples: Sample[]; unit?: string; compact: boolean }) {
  const [size, setSize] = React.useState(80);
  const latest = samples.at(-1)!;
  const value = latest.value;
  const previous = samples.at(-2)?.value;
  const caption = <Text size="xs" numberOfLines={1} accessibilityLabel={`Received ${new Date(latest.received_at).toLocaleString()} · ${latest.instance_id ?? "App"}`} className={muted + " leading-[14px]"} style={{ fontSize: 10 }}>Received {new Date(latest.received_at).toLocaleTimeString()}{latest.instance_id ? ` · ${latest.instance_id}` : ""}</Text>;
  if (["gauge", "progress"].includes(widget.kind) && typeof value === "number") {
    const min = widget.min ?? 0; const max = widget.max ?? 100;
    const fraction = (value - min) / (max - min);
    const bounded = Math.max(0, Math.min(1, fraction));
    const outside = value < min || value > max;
    const color = outside ? "#BA4F3D" : "#22B8A8";
    return <Box style={{ flex: 1, minHeight: 0, justifyContent: "center", gap: 5 }}>
      <Box style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: widget.kind === "gauge" ? 1 : undefined }} onLayout={(event) => setSize(Math.max(40, Math.min(140, event.nativeEvent.layout.height - 8, event.nativeEvent.layout.width * 0.4)))}>
        {widget.kind === "gauge" ? <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={`Gauge: ${sampleText(value)}, range ${min} to ${max}`}><Circle cx={50} cy={50} r={40} fill="none" stroke="#8A94A8" strokeOpacity={0.2} strokeWidth={8} /><Circle cx={50} cy={50} r={40} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${bounded * 251.327} 251.327`} rotation={-90} origin="50, 50" /></Svg> : null}
        <Box style={{ flex: 1, minWidth: 0 }}><Text size="xs" selectable className={ink + " font-semibold leading-[28px]"} style={{ fontSize: widget.kind === "progress" ? 18 : 24 }}>{sampleText(value)}{unit ? ` ${unit}` : ""}</Text><Text size="xs" className={muted} style={{ fontSize: 11 }}>{Math.round(fraction * 100)}%{outside ? value < min ? " · below range" : " · above range" : ""}</Text></Box>
      </Box>
      {widget.kind === "progress" ? <Box accessibilityRole="progressbar" accessibilityValue={{ min, max, now: Math.max(min, Math.min(max, value)), text: `${sampleText(value)} ${unit ?? ""}, ${Math.round(fraction * 100)}%` }} style={{ height: 6, borderRadius: 3, backgroundColor: "#8A94A830", overflow: "hidden" }}><Box style={{ width: `${bounded * 100}%`, height: 6, backgroundColor: color }} /></Box> : null}
      <Box className="flex-row justify-between"><Text size="xs" className={muted + " leading-[14px]"} style={{ fontSize: 10 }}>{sampleText(min)}</Text><Text size="xs" className={muted + " leading-[14px]"} style={{ fontSize: 10 }}>{sampleText(max)}</Text></Box>
    </Box>;
  }
  if (widget.kind === "boolean" && typeof value === "boolean") return <Box style={{ flex: 1, justifyContent: "center", gap: 3 }}><Box className="flex-row items-center gap-2"><Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: value ? "#147D78" : "#8A94A8" }} /><Text size="xs" selectable className={ink + " font-semibold leading-[28px]"} style={{ fontSize: compact ? 14 : 22 }}>{value ? "True" : "False"}</Text></Box>{!compact ? caption : null}</Box>;
  return <ScrollView style={{ flex: 1, minHeight: 0 }} nestedScrollEnabled contentContainerStyle={{ flexGrow: 1, justifyContent: widget.kind === "text" ? "flex-start" : "center", gap: 3 }}>
    <Text size="xs" selectable className={ink + (widget.kind === "text" ? "" : " font-semibold") + (compact ? " leading-[18px]" : widget.kind === "text" ? " leading-[20px]" : " leading-[30px]")} style={{ fontSize: compact ? 13 : widget.kind === "text" ? 14 : 26 }}>{sampleText(value)}{typeof value === "number" && unit ? ` ${unit}` : ""}</Text>
    {!compact && widget.kind === "value" && typeof value === "number" && typeof previous === "number" ? <Text size="xs" numberOfLines={1} className={muted + " leading-[14px]"} style={{ fontSize: 10 }}>Δ {value - previous > 0 ? "+" : ""}{sampleText(value - previous)} vs previous</Text> : null}
    {!compact ? caption : null}
  </ScrollView>;
}
