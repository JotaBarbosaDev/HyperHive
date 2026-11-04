import React from "react";
import { LayoutChangeEvent, Platform, useColorScheme } from "react-native";
import { VictoryArea, VictoryAxis, VictoryChart, VictoryLine, VictoryScatter, VictoryTheme, VictoryTooltip, VictoryVoronoiContainer } from "victory-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { DiskHealthDisk, DiskHealthPoint, DiskHealthSample } from "@/types/diskhealth";
import {
  BAND_RANGES,
  bandTextColor,
  changeText,
  chartTickText,
  counterRows,
  counterSeries,
  seriesStats,
  temperatureDomain,
  temperatureSeries,
  wearProjection,
} from "@/utils/diskhealth";
import { CircleCheck, TrendingUp } from "lucide-react-native";
import { cardClass, formatDateTime, imageLabel, mutedText, RANGES, RangeKey, rangeText, shortRangeText, strongText, tabularNumbers } from "./shared";

// Below this many samples a line alone hides how little data there is, so dots are drawn too.
const DOT_LIMIT = 12;

type TimeDomain = [Date, Date];

export const timeDomain = (points: DiskHealthPoint[]): TimeDomain | undefined => {
  if (points.length < 2) return undefined;
  const start = new Date(points[0].at);
  const end = new Date(points[points.length - 1].at);
  return [start, end.getTime() > start.getTime() ? end : new Date(start.getTime() + 6 * 3600_000)];
};

const chartStyles = (isDark: boolean) => {
  const tick = isDark ? "#9AA4B8" : "#475569";
  const line = isDark ? "#1E2F47" : "#E2E8F0";
  const tickLabels = { fill: tick, fontSize: 11, padding: 6, ...(Platform.OS === "web" ? { fontFamily: "inherit" } : {}) };
  return {
    xAxis: { tickLabels, axis: { stroke: line }, ticks: { stroke: "transparent" }, grid: { stroke: "transparent" } },
    yAxis: { tickLabels, axis: { stroke: "transparent" }, ticks: { stroke: "transparent" }, grid: { stroke: line, strokeDasharray: "none" } },
    plotLine: isDark ? "#E8EBF0" : "#0F172A",
    temperature: isDark ? "#FB923C" : "#C2410C",
    wear: isDark ? "#A78BFA" : "#7C3AED",
    flyout: { fill: isDark ? "#0A1628" : "#FFFFFF", stroke: isDark ? "#2A3B52" : "#CBD5E1" },
    flyoutText: { fill: isDark ? "#E8EBF0" : "#0F172A", fontSize: 12 },
  };
};

type ChartStyles = ReturnType<typeof chartStyles>;

// Hover read-out on web only: the voronoi container captures touches on native,
// which would stop the page scrolling when a finger lands on a chart.
const hoverProps = (styles: ChartStyles, text: (datum: any) => string, blacklist?: string[]) =>
  Platform.OS === "web"
    ? {
        containerComponent: (
          <VictoryVoronoiContainer
            voronoiDimension="x"
            voronoiBlacklist={blacklist}
            labels={({ datum }: { datum: any }) => text(datum)}
            labelComponent={
              <VictoryTooltip
                constrainToVisibleArea
                cornerRadius={8}
                flyoutPadding={{ top: 6, bottom: 6, left: 10, right: 10 }}
                flyoutStyle={styles.flyout}
                style={styles.flyoutText}
              />
            }
          />
        ),
      }
    : {};

// Evenly spaced ticks inset from both edges: Victory's "nice" time ticks can
// collapse to one label on a narrow chart, and edge labels would be clipped.
const timeTicks = (domain: TimeDomain | undefined, width: number) => {
  if (!domain) return undefined;
  const count = Math.max(2, Math.min(6, Math.floor(width / 110)));
  const start = domain[0].getTime();
  const span = domain[1].getTime() - start;
  return Array.from({ length: count }, (_, index) => new Date(start + (span * (index + 0.5)) / count));
};

const timeAxis = (styles: ChartStyles, width: number, domain?: TimeDomain) => {
  const span = domain ? domain[1].getTime() - domain[0].getTime() : 0;
  return <VictoryAxis style={styles.xAxis} tickValues={timeTicks(domain, width)} tickFormat={(v: Date | number) => chartTickText(v, span)} />;
};

export function RangeControl({ value, onChange, busy }: { value: RangeKey; onChange: (next: RangeKey) => void; busy: boolean }) {
  return (
    <HStack className="items-center gap-2 shrink-0">
      <Box className="w-5 h-5 items-center justify-center">{busy ? <Spinner size="small" aria-label="Loading history" /> : null}</Box>
      <HStack
        role="group"
        aria-label="History range"
        className="gap-1 rounded-xl border border-outline-100 bg-background-50 p-1 dark:border-[#1E2F47] dark:bg-[#0A1628]"
      >
        {RANGES.map((option) => {
          const active = value === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.key)}
              role="button"
              aria-pressed={active}
              accessibilityState={{ selected: active }}
              aria-label={option.days ? `Last ${option.days} days` : "All history"}
              className={`min-h-[44px] min-w-[52px] web:md:min-h-[32px] items-center justify-center rounded-lg px-3 web:cursor-pointer ${
                active ? "bg-primary-500 dark:bg-[#2DD4BF]" : "active:opacity-70 hover:bg-background-100 dark:hover:bg-[#0F1A2E]"
              }`}
            >
              <Text className={active ? "text-sm font-semibold text-white dark:text-[#062A28]" : `text-sm ${strongText}`} style={tabularNumbers}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>
    </HStack>
  );
}

type ChartStat = { label: string; value: string };

// A chart card measures itself, so the chart width always matches the card on
// web (where the page is wider than the chart's default 320 px canvas). Key
// values are printed above the plot: they need no hover and work on touch.
function ChartCard({
  title,
  value,
  stats,
  note,
  height = 200,
  summary,
  render,
}: {
  title: string;
  value?: string;
  stats?: ChartStat[];
  note?: string;
  height?: number;
  summary: string;
  render: (width: number) => React.ReactNode;
}) {
  const [width, setWidth] = React.useState(0);

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width - 34);
    if (next > 0) setWidth((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <Box className={cardClass} style={{ flexGrow: 1 }} onLayout={handleLayout} {...imageLabel(summary)}>
      <Box className="mb-2" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", columnGap: 16, rowGap: 4 }}>
        <VStack>
          <Text className={`text-sm font-semibold ${strongText}`}>{title}</Text>
          {value ? (
            <Text className={`text-2xl font-semibold ${strongText}`} style={tabularNumbers}>
              {value}
            </Text>
          ) : null}
        </VStack>
        {stats?.length ? (
          <HStack className="gap-4 flex-wrap">
            {stats.map((stat) => (
              <VStack key={stat.label}>
                <Text className={`text-xs ${mutedText}`}>{stat.label}</Text>
                <Text className={`text-sm font-medium ${strongText}`} style={tabularNumbers}>
                  {stat.value}
                </Text>
              </VStack>
            ))}
          </HStack>
        ) : null}
      </Box>
      {width > 0 ? render(width) : <Box style={{ height }} />}
      {note ? <Text className={`text-xs mt-1 ${mutedText}`}>{note}</Text> : null}
    </Box>
  );
}

export function ScoreChart({ points, days }: { points: DiskHealthPoint[]; days: number }) {
  const isDark = useColorScheme() === "dark";
  const styles = chartStyles(isDark);
  const domain = timeDomain(points);
  const data = points.filter((p) => p.score !== null).map((p) => ({ x: new Date(p.at), y: p.score as number }));
  const stats = seriesStats(data.map((d) => d.y));
  const period = rangeText(days);

  return (
    <ChartCard
      title="Health score"
      stats={stats ? [{ label: "Lowest", value: String(stats.low) }, { label: "Highest", value: String(stats.high) }, { label: "Change", value: changeText(stats.change) }] : undefined}
      height={220}
      summary={stats ? `Health score chart for the ${period}: latest ${stats.latest}, lowest ${stats.low}, highest ${stats.high}.` : "Health score chart"}
      render={(width) => (
        <VictoryChart
          theme={VictoryTheme.material}
          height={220}
          width={width}
          padding={{ top: 10, bottom: 32, left: 36, right: 14 }}
          scale={{ x: "time" }}
          domain={{ x: domain, y: [0, 100] }}
          {...hoverProps(styles, (d) => `${formatDateTime(d.x)}\nScore ${d.y}`, BAND_RANGES.map((b) => b.band))}
        >
          {timeAxis(styles, width, domain)}
          <VictoryAxis dependentAxis style={styles.yAxis} tickValues={[0, 30, 60, 80, 100]} />
          {domain
            ? BAND_RANGES.map((b) => (
                <VictoryArea
                  key={b.band}
                  name={b.band}
                  data={[
                    { x: domain[0], y: b.to, y0: b.from },
                    { x: domain[1], y: b.to, y0: b.from },
                  ]}
                  style={{ data: { fill: b.color, fillOpacity: isDark ? 0.1 : 0.12, stroke: "none" } }}
                />
              ))
            : null}
          <VictoryLine data={data} interpolation="monotoneX" style={{ data: { stroke: styles.plotLine, strokeWidth: 2.5 } }} />
          {data.length <= DOT_LIMIT ? <VictoryScatter data={data} size={3.5} style={{ data: { fill: styles.plotLine } }} /> : null}
        </VictoryChart>
      )}
    />
  );
}

function LineSwatch({ color, dash }: { color: string; dash?: string }) {
  const segments = dash ? 3 : 1;
  return (
    <HStack aria-hidden style={{ width: 20, gap: 2 }}>
      {Array.from({ length: segments }, (_, index) => (
        <Box key={index} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: color }} />
      ))}
    </HStack>
  );
}

// Current values are always listed, so a healthy disk gets a clear "all zero"
// answer and a failing one shows numbers next to the chart's legend.
export function CounterPanel({
  points,
  latest,
  flash,
  days,
}: {
  points: DiskHealthPoint[];
  latest?: DiskHealthSample;
  flash: boolean;
  days: number;
}) {
  const isDark = useColorScheme() === "dark";
  const styles = chartStyles(isDark);
  const [width, setWidth] = React.useState(0);
  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next > 0) setWidth((prev) => (prev === next ? prev : next));
  }, []);

  const rows = counterRows(points, latest, flash);
  const series = counterSeries(points).shown;
  const domain = timeDomain(points);
  const clean = rows.every((row) => row.value === 0);
  const rising = bandTextColor("critical", isDark);
  const top = Math.max(...series.flatMap((s) => s.data.map((d) => d.y)), 1);

  return (
    <Box className={cardClass} role="group" aria-label="Critical counters">
      <HStack className="items-center justify-between gap-2 flex-wrap mb-2">
        <Text className={`text-sm font-semibold ${strongText}`}>Critical counters</Text>
        {clean ? (
          <HStack className="items-center gap-1.5">
            <CircleCheck size={14} color={bandTextColor("good", isDark)} />
            <Text className="text-xs font-medium" style={{ color: bandTextColor("good", isDark) }}>
              All at zero
            </Text>
          </HStack>
        ) : null}
      </HStack>
      <Box style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
        <Box style={{ flexDirection: clean ? "row" : "column", flexWrap: "wrap", columnGap: 24, flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0 }}>
          {rows.map((row) => (
            <HStack
              key={row.label}
              className="items-center gap-2 min-h-[36px] border-b border-outline-50 dark:border-[#16243A]"
              style={clean ? { flexGrow: 1, flexShrink: 1, flexBasis: 220 } : undefined}
            >
              {row.charted ? <LineSwatch color={row.color} dash={row.dash} /> : null}
              <Text className={`text-sm flex-1 ${row.value > 0 ? strongText : mutedText}`}>{row.label}</Text>
              {row.change !== null && row.change > 0 ? (
                <HStack className="items-center gap-1">
                  <TrendingUp size={12} color={rising} />
                  <Text className="text-xs font-medium" style={{ color: rising, ...tabularNumbers }}>
                    {changeText(row.change)} in {shortRangeText(days)}
                  </Text>
                </HStack>
              ) : null}
              <Text
                className={`text-sm text-right ${row.value > 0 ? `font-semibold ${strongText}` : mutedText}`}
                style={{ minWidth: 40, ...tabularNumbers }}
              >
                {row.value.toLocaleString()}
              </Text>
            </HStack>
          ))}
        </Box>
        {series.length && domain ? (
          <Box style={{ flexGrow: 2, flexShrink: 1, flexBasis: 320, minWidth: 0 }} onLayout={handleLayout}>
            {width > 0 ? (
              <VictoryChart
                theme={VictoryTheme.material}
                height={220}
                width={width}
                padding={{ top: 10, bottom: 32, left: 40, right: 14 }}
                scale={{ x: "time" }}
                domain={{ x: domain, y: [0, Math.ceil(top * 1.1)] }}
                {...hoverProps(styles, (d) => `${d.series}: ${d.y.toLocaleString()}`)}
              >
                {timeAxis(styles, width, domain)}
                <VictoryAxis dependentAxis style={styles.yAxis} tickFormat={(v: number) => (Number.isInteger(v) ? v.toLocaleString() : "")} />
                {series.map((s) => (
                  <VictoryLine
                    key={s.label}
                    data={s.data}
                    interpolation="stepAfter"
                    style={{ data: { stroke: s.color, strokeWidth: 2.5, strokeDasharray: s.dash } }}
                  />
                ))}
              </VictoryChart>
            ) : (
              <Box style={{ height: 220 }} />
            )}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

export function TemperatureChart({ points, days }: { points: DiskHealthPoint[]; days: number }) {
  const isDark = useColorScheme() === "dark";
  const styles = chartStyles(isDark);
  const domain = timeDomain(points);
  const data = temperatureSeries(points);
  const stats = seriesStats(data.map((d) => d.y));
  if (!stats) {
    return (
      <Box className={cardClass}>
        <Text className={`text-sm font-semibold mb-1 ${strongText}`}>Temperature</Text>
        <Text className={`text-sm ${mutedText}`}>No temperature reported.</Text>
      </Box>
    );
  }

  return (
    <ChartCard
      title="Temperature"
      value={`${stats.latest} °C`}
      stats={[{ label: "Lowest", value: `${stats.low} °C` }, { label: "Highest", value: `${stats.high} °C` }]}
      summary={`Temperature chart for the ${rangeText(days)}: latest ${stats.latest} °C, lowest ${stats.low}, highest ${stats.high}.`}
      render={(width) => (
        <VictoryChart
          theme={VictoryTheme.material}
          height={200}
          width={width}
          padding={{ top: 10, bottom: 32, left: 36, right: 14 }}
          scale={{ x: "time" }}
          domain={{ x: domain, y: temperatureDomain(data.map((d) => d.y)) }}
          {...hoverProps(styles, (d) => `${formatDateTime(d.x)}\n${d.y} °C`)}
        >
          {timeAxis(styles, width, domain)}
          <VictoryAxis dependentAxis style={styles.yAxis} tickFormat={(v: number) => v.toFixed(0)} />
          <VictoryLine data={data} interpolation="monotoneX" style={{ data: { stroke: styles.temperature, strokeWidth: 2.5 } }} />
          {data.length <= DOT_LIMIT ? <VictoryScatter data={data} size={3.5} style={{ data: { fill: styles.temperature } }} /> : null}
        </VictoryChart>
      )}
    />
  );
}

export function WearChart({ disk, points, days }: { disk: DiskHealthDisk; points: DiskHealthPoint[]; days: number }) {
  const isDark = useColorScheme() === "dark";
  const styles = chartStyles(isDark);
  const base = timeDomain(points);
  const projection = wearProjection(points, disk.wearOutAt);
  const domain: TimeDomain | undefined = base && projection.length ? [base[0], projection[1].x] : base;
  const data = points.map((p) => ({ x: new Date(p.at), y: p.percentageUsed }));
  const stats = seriesStats(data.map((d) => d.y));
  const top = Math.max(100, stats?.high ?? 0);

  return (
    <ChartCard
      title="Wear (% of rated endurance)"
      value={stats ? `${stats.latest}%` : undefined}
      stats={stats ? [{ label: "Change", value: changeText(stats.change) }] : undefined}
      note={projection.length ? `Dashed: projected to reach 100% around ${projection[1].x.toLocaleDateString()} (estimate from the last 90 days).` : undefined}
      summary={stats ? `Wear chart for the ${rangeText(days)}: latest ${stats.latest}%.` : "Wear chart"}
      render={(width) => (
        <VictoryChart
          theme={VictoryTheme.material}
          height={200}
          width={width}
          padding={{ top: 10, bottom: 32, left: 40, right: 14 }}
          scale={{ x: "time" }}
          domain={{ x: domain, y: [0, top] }}
          {...hoverProps(styles, (d) => `${formatDateTime(d.x)}\n${d.y}%`, ["projection"])}
        >
          {timeAxis(styles, width, domain)}
          <VictoryAxis dependentAxis style={styles.yAxis} tickFormat={(v: number) => `${v}%`} />
          <VictoryLine data={data} interpolation="monotoneX" style={{ data: { stroke: styles.wear, strokeWidth: 2.5 } }} />
          {data.length <= DOT_LIMIT ? <VictoryScatter data={data} size={3.5} style={{ data: { fill: styles.wear } }} /> : null}
          {projection.length ? (
            <VictoryLine name="projection" data={projection} style={{ data: { stroke: styles.wear, strokeWidth: 2, strokeDasharray: "6,4" } }} />
          ) : null}
        </VictoryChart>
      )}
    />
  );
}
