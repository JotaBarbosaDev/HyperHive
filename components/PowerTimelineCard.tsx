import React from "react";
import { LayoutChangeEvent, Pressable, useColorScheme } from "react-native";
import { VictoryAxis, VictoryChart, VictoryLine, VictoryTheme } from "victory-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { chartStyles, hoverProps, timeAxis } from "@/components/diskhealth/DiskHealthCharts";
import { ApiError } from "@/services/api-client";
import {
  formatCost,
  formatKWh,
  getEnergySummary,
  getEnergyTimeline,
  projectionText,
  stripSegments,
  wattPoints,
  type EnergyRange,
  type EnergySeriesRef,
  type EnergySummary,
  type EnergyTimeline,
} from "@/services/energy";

const RANGES: { key: EnergyRange; label: string; long: string }[] = [
  { key: "30d", label: "30 d", long: "30 days" },
  { key: "90d", label: "90 d", long: "90 days" },
  { key: "6m", label: "6 m", long: "6 months" },
];
const CHART_HEIGHT = 200;

const muted = "text-xs text-typography-500 dark:text-[#8A94A8]";
const strong = "text-typography-900 dark:text-[#E8EBF0]";

const same = (a: EnergySeriesRef | null, b: EnergySeriesRef) => a?.kind === b.kind && a.name === b.name;

// Running state and watts over time for every host and VM, plus this month's VM
// cost. token comes from useAuthGuard, as in EnergyCard.
export default function PowerTimelineCard({ token }: { token: string | null }) {
  const [range, setRange] = React.useState<EnergyRange>("30d");
  const [overview, setOverview] = React.useState<EnergyTimeline | null>(null);
  const [summary, setSummary] = React.useState<EnergySummary | null>(null);
  const [selected, setSelected] = React.useState<EnergySeriesRef | null>(null);
  const [detail, setDetail] = React.useState<EnergyTimeline | null>(null);
  const [error, setError] = React.useState("");

  const fail = (err: unknown) =>
    setError(
      err instanceof ApiError && err.status === 404
        ? "Update the master to see the power timeline."
        : err instanceof Error ? err.message : "Could not load the power timeline.",
    );

  // Stale data is cleared here, not in the effects, so the old range never shows under the new one.
  const pick = (nextRange: EnergyRange, next: EnergySeriesRef | null) => {
    if (nextRange !== range) setOverview(null);
    setDetail(null);
    setRange(nextRange);
    setSelected(next);
  };

  React.useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getEnergySummary(controller.signal).then((s) => !controller.signal.aborted && setSummary(s)).catch(() => {});
    return () => controller.abort();
  }, [token]);

  React.useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getEnergyTimeline(range, undefined, controller.signal)
      .then((t) => { if (!controller.signal.aborted) { setOverview(t); setError(""); } })
      .catch((err) => !controller.signal.aborted && fail(err));
    return () => controller.abort();
  }, [token, range]);

  React.useEffect(() => {
    if (!token || !selected) return;
    const controller = new AbortController();
    getEnergyTimeline(range, selected, controller.signal)
      .then((t) => !controller.signal.aborted && setDetail(t))
      .catch((err) => !controller.signal.aborted && fail(err));
    return () => controller.abort();
  }, [token, range, selected]);

  const rangeLong = RANGES.find((r) => r.key === range)?.long ?? range;
  const hasPrice = summary?.pricePerKWh != null;

  return <Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4 gap-4">
    <Box style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <Box className="gap-0.5 max-w-full">
        <Heading size="md" className={strong}>Power timeline</Heading>
        <Text className={muted}>Estimates from hardware and CPU load, not measured</Text>
      </Box>
      <Box style={{ flexDirection: "row", gap: 8 }}>
        {RANGES.map((r) => <Button key={r.key} size="sm" variant={r.key === range ? "solid" : "outline"} aria-pressed={r.key === range} aria-label={`Last ${r.long}`} onPress={() => pick(r.key, selected)} className="rounded-xl" style={{ minHeight: 44 }}>
          <ButtonText>{r.label}</ButtonText>
        </Button>)}
      </Box>
    </Box>

    {error ? <Text role="alert" className="text-sm text-error-700 dark:text-error-400">{error}</Text> : null}
    {!overview && !error ? <Text className="text-sm text-typography-500 dark:text-[#8A94A8]">Loading…</Text> : null}
    {overview && !overview.series.length ? <Text className={muted}>No samples yet. The first points appear a few minutes after the master starts.</Text> : null}

    {overview?.series.length ? <>
      <Box className="gap-1">
        {overview.series.map((s) => {
          const hours = Math.round(s.runningS.reduce<number>((sum, v) => sum + (v ?? 0), 0) / 3600);
          const active = same(selected, s);
          return <Pressable
            key={`${s.kind}:${s.name}`}
            role="button"
            aria-pressed={active}
            aria-label={`${s.kind === "host" ? "Host" : "VM"} ${s.name}: ${s.kind === "host" ? "up" : "running"} ${hours} hours in the last ${rangeLong}. Show watts.`}
            onPress={() => pick(range, active ? null : { kind: s.kind, name: s.name })}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32 }}
          >
            <Text numberOfLines={1} className={`text-xs ${active ? `font-semibold ${strong}` : "text-typography-600 dark:text-[#94A3B8]"}`} style={{ width: 96 }}>
              {s.kind === "host" ? "Host · " : ""}{s.name}
            </Text>
            <Box aria-hidden style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", height: 14 }}>
              {stripSegments(s).map((state, i) => <Box
                key={i}
                className={state === "running" ? "bg-primary-500" : state === "stopped" ? "bg-outline-300 dark:bg-[#2A3B52]" : "bg-outline-100 dark:bg-[#141F33]"}
                style={{ flex: 1, height: state === "running" ? 14 : state === "stopped" ? 6 : 2 }}
              />)}
            </Box>
          </Pressable>;
        })}
        <Text className={muted}>Tall: running · short: stopped · thin line: no data (master or host off). Select a row for its watts.</Text>
      </Box>

      {selected ? <WattsChart selected={selected} timeline={detail} rangeLong={rangeLong} /> : null}
    </> : null}

    {summary?.vms.length ? <Box className="gap-1">
      <Text className={`text-sm font-semibold ${strong}`}>VM cost this month</Text>
      {summary.vms.map((vm) => <Box key={vm.name} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 12 }}>
        <Text className={`text-sm ${strong}`}>{vm.name}</Text>
        <Text className="text-sm text-typography-600 dark:text-[#94A3B8]">
          {formatKWh(vm.monthKWh)}{hasPrice ? ` · ${formatCost(vm.monthCost)}` : ""}{projectionText(vm, hasPrice) ? ` · projected ${projectionText(vm, hasPrice)}` : ""}
        </Text>
      </Box>)}
    </Box> : null}
  </Box>;
}

function WattsChart({ selected, timeline, rangeLong }: { selected: EnergySeriesRef; timeline: EnergyTimeline | null; rangeLong: string }) {
  const styles = chartStyles(useColorScheme() === "dark");
  const [width, setWidth] = React.useState(0);
  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next > 0) setWidth((prev) => (prev === next ? prev : next));
  }, []);

  const series = timeline?.series[0];
  const data = timeline && series ? wattPoints(timeline, series) : [];
  const values = data.map((d) => d.y).filter((y): y is number => y != null);
  // Gaps stay gaps in the line, but Victory's flyout crashes on null points, so
  // tooltips read a separate transparent line without them.
  const hoverData = data.filter((d): d is { x: Date; y: number } => d.y != null);
  const average = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  const peak = values.length ? Math.round(Math.max(...values)) : 0;
  const domain: [Date, Date] | undefined = data.length > 1 ? [data[0].x, data[data.length - 1].x] : undefined;
  const title = `${selected.kind === "host" ? "Host" : "VM"} ${selected.name}`;

  return <Box className="gap-1" onLayout={onLayout}>
    <Text className={`text-sm font-semibold ${strong}`}>{title} · average watts</Text>
    {!timeline ? <Text className={muted}>Loading…</Text> : !values.length ? <Text className={muted}>No samples for this range yet.</Text> : <>
      <Text className={muted}>Average ~{average} W · peak ~{peak} W over the last {rangeLong}. Gaps are times with no data.</Text>
      <Box role="img" aria-label={`${title}: average about ${average} watts, peak about ${peak} watts over the last ${rangeLong}.`} style={{ height: CHART_HEIGHT }}>
        {width > 0 ? <VictoryChart
          // Remount on series/range change: the voronoi keeps stale active points from the old data, and the flyout crashes on them.
          key={`${selected.kind}:${selected.name}:${rangeLong}`}
          theme={VictoryTheme.material}
          height={CHART_HEIGHT}
          width={width}
          padding={{ top: 10, bottom: 32, left: 44, right: 14 }}
          scale={{ x: "time" }}
          domain={{ ...(domain ? { x: domain } : {}), y: [0, Math.max(1, peak * 1.1)] }}
          {...hoverProps(styles, (d) => `${d.x.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}\n~${Math.round(d.y)} W`, ["watts"])}
        >
          {timeAxis(styles, width, domain)}
          <VictoryAxis dependentAxis style={styles.yAxis} tickFormat={(v: number) => `${Math.round(v)} W`} />
          <VictoryLine name="hover" data={hoverData} style={{ data: { stroke: "transparent" } }} />
          <VictoryLine name="watts" data={data} style={{ data: { stroke: styles.plotLine, strokeWidth: 2 } }} />
        </VictoryChart> : null}
      </Box>
    </>}
  </Box>;
}
