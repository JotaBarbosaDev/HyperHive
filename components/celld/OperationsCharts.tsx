import React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import type { CelldObservation } from "@/types/celld";
import { timestamp, unavailable } from "./observability";
import {
  Empty,
  OpsButton,
  OpsText,
  Panel,
  useOperationsTheme,
} from "./OperationsUI";
import {
  chartCeiling,
  nearestPoint,
  resourceSeries,
  sampleSegments,
  type ResourceMetric,
} from "./operations-chart";

export function ResourceChart({
  rows,
  metric,
  label,
  format,
  from,
  to,
}: {
  rows: CelldObservation[];
  metric: ResourceMetric;
  label: string;
  format: (value?: number) => string;
  from: number;
  to: number;
}) {
  const { ops, s } = useOperationsTheme();
  const [hidden, setHidden] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [width, setWidth] = React.useState(600);
  React.useEffect(() => {
    setSelected(null);
  }, [from, to, metric]);
  const groups = React.useMemo(
    () => resourceSeries(rows, metric, from, to),
    [rows, metric, from, to],
  );
  const visible = React.useMemo(
    () => groups.filter((group) => !hidden.includes(group.node)),
    [groups, hidden],
  );
  const points = React.useMemo(
    () =>
      visible.flatMap((group) => group.points).sort((a, b) => a.time - b.time),
    [visible],
  );
  const budget = Math.max(
    32,
    Math.min(
      1000,
      Math.floor(((width - 96) * 1.5) / Math.max(1, visible.length)),
    ),
  );
  const rendered = React.useMemo(
    () =>
      new Map(
        visible.map((group) => [
          group.node,
          sampleSegments(group.segments, budget),
        ]),
      ),
    [visible, budget],
  );
  const renderedCount = [...rendered.values()].reduce(
    (sum, segments) =>
      sum + segments.reduce((n, segment) => n + segment.length, 0),
    0,
  );
  const peak = chartCeiling(
    points.reduce((max, point) => Math.max(max, point.value), 0),
    metric,
  );
  const left = 76,
    right = Math.max(left + 1, width - 20),
    top = 20,
    bottom = 178;
  const x = (time: number) =>
    left + ((time - from) / Math.max(1, to - from)) * (right - left);
  const y = (value: number) => bottom - (value / peak) * (bottom - top);
  const selectedTime =
    selected !== null && points.length
      ? nearestPoint(points, selected)?.time
      : null;
  const inspect = (position: number) => {
    if (!Number.isFinite(position) || !points.length) return;
    const time =
      from +
      Math.max(0, Math.min(1, (position - left) / (right - left))) *
        (to - from);
    setSelected(nearestPoint(points, time)!.time);
  };
  const timeLabel = (time: number) =>
    new Date(time).toLocaleString(
      "en-GB",
      to - from >= 86400000
        ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
        : { hour: "2-digit", minute: "2-digit", second: "2-digit" },
    );
  return (
    <Panel
      title={label}
      aside={
        <OpsText muted>
          {metric === "cpu_percent_x100"
            ? "100% = one core"
            : "Process resident memory"}
        </OpsText>
      }
    >
      <View
        onLayout={(event) =>
          setWidth(Math.max(260, event.nativeEvent.layout.width))
        }
      >
        {points.length ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Inspect ${label} samples`}
              onPress={(event) => inspect(event.nativeEvent.locationX)}
              style={{ height: 220 }}
            >
              <Svg
                pointerEvents="none"
                width="100%"
                height={220}
                viewBox={`0 0 ${width} 220`}
                role="img"
                accessibilityLabel={`${label}, from ${timestamp(from)} to ${timestamp(to)}. Per-node latest and peak values below.`}
              >
                {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                  <React.Fragment key={fraction}>
                    <Line
                      x1={left}
                      x2={right}
                      y1={y(peak * fraction)}
                      y2={y(peak * fraction)}
                      stroke={ops.line}
                      strokeDasharray="3 5"
                    />
                    <SvgText
                      x={left - 10}
                      y={y(peak * fraction) + 4}
                      textAnchor="end"
                      fill={ops.muted}
                      fontSize={10}
                    >
                      {format(peak * fraction)}
                    </SvgText>
                  </React.Fragment>
                ))}
                {(width < 520 ? [0, 1] : [0, 0.5, 1]).map((fraction) => (
                  <SvgText
                    key={fraction}
                    x={left + fraction * (right - left)}
                    y={205}
                    textAnchor={
                      fraction === 0
                        ? "start"
                        : fraction === 1
                          ? "end"
                          : "middle"
                    }
                    fill={ops.muted}
                    fontSize={10}
                  >
                    {timeLabel(from + fraction * (to - from))}
                  </SvgText>
                ))}
                {groups.map((group, index) =>
                  hidden.includes(group.node) ? null : (
                    <React.Fragment key={group.node}>
                      <Path
                        d={(rendered.get(group.node) ?? [])
                          .map((segment) =>
                            segment
                              .map(
                                (point, i) =>
                                  `${i === 0 ? "M" : "L"}${x(point.time).toFixed(2)},${y(point.value).toFixed(2)}${segment.length === 1 ? "l0.01,0" : ""}`,
                              )
                              .join(" "),
                          )
                          .join(" ")}
                        fill="none"
                        stroke={ops.chart[index % ops.chart.length]}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {group.points
                        .filter(
                          (point, i) =>
                            group.points.length <= 60 ||
                            i === group.points.length - 1 ||
                            point.time === selectedTime,
                        )
                        .map((point) => (
                          <Circle
                            key={point.time}
                            cx={x(point.time)}
                            cy={y(point.value)}
                            r={3}
                            fill={ops.chart[index % ops.chart.length]}
                          />
                        ))}
                    </React.Fragment>
                  ),
                )}
                {selectedTime !== null && selectedTime !== undefined ? (
                  <Line
                    x1={x(selectedTime)}
                    x2={x(selectedTime)}
                    y1={top}
                    y2={bottom}
                    stroke={ops.text}
                    strokeDasharray="4 4"
                  />
                ) : null}
              </Svg>
            </Pressable>
            {selectedTime !== null && selectedTime !== undefined ? (
              <View style={{ padding: 14, paddingTop: 0, gap: 6 }}>
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <OpsText muted>
                    Nearest samples · {timestamp(selectedTime)}
                  </OpsText>
                  <OpsButton
                    label="Clear sample"
                    onPress={() => setSelected(null)}
                  />
                </View>
                {groups.map((group, i) => {
                  if (hidden.includes(group.node)) return null;
                  const point = nearestPoint(group.points, selectedTime);
                  return (
                    <OpsText
                      key={group.node}
                      mono
                      style={{ color: ops.chart[i % ops.chart.length] }}
                    >
                      {group.node} · {format(point?.value)}
                      {point ? ` · ${timestamp(point.time)}` : ""}
                    </OpsText>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : (
          <Empty
            title={
              groups.length &&
              groups.every((group) => hidden.includes(group.node))
                ? "All nodes hidden"
                : "No resource samples"
            }
            detail={
              groups.length &&
              groups.every((group) => hidden.includes(group.node))
                ? "Select a node below to show its history."
                : "Choose another interval or load the next page of observations."
            }
          />
        )}
      </View>
      <View
        style={{
          padding: 12,
          gap: 9,
          borderTopWidth: 1,
          borderColor: ops.line,
        }}
      >
        {groups.map((group, i) => (
          <Pressable
            key={group.node}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !hidden.includes(group.node) }}
            accessibilityLabel={`Show ${group.node} in ${label}`}
            onPress={() =>
              setHidden((old) =>
                old.includes(group.node)
                  ? old.filter((node) => node !== group.node)
                  : [...old, group.node],
              )
            }
            style={[
              s.row,
              {
                opacity: hidden.includes(group.node) ? 0.5 : 1,
                justifyContent: "space-between",
                minHeight: 30,
              },
            ]}
          >
            <View style={s.row}>
              <View
                style={{
                  width: 9,
                  height: 9,
                  backgroundColor: ops.chart[i % ops.chart.length],
                  borderRadius: 2,
                }}
              />
              <Text style={s.mono}>{group.node}</Text>
            </View>
            <OpsText muted mono>
              Latest {format(group.points.at(-1)?.value)} · Peak{" "}
              {group.points.length
                ? format(
                    group.points.reduce(
                      (max, point) => Math.max(max, point.value),
                      0,
                    ),
                  )
                : unavailable}
            </OpsText>
          </Pressable>
        ))}
        <OpsText muted>
          {points.length > renderedCount
            ? `${points.length.toLocaleString()} samples · display reduced to ${renderedCount.toLocaleString()} points with peaks preserved. `
            : `${points.length.toLocaleString()} samples. `}
          Inspect original samples by clicking the chart. Missing data stays as
          gaps. Times are local.
        </OpsText>
      </View>
    </Panel>
  );
}
