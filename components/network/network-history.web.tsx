import React from "react";
import { VictoryAxis, VictoryChart, VictoryLine, VictoryTooltip, VictoryVoronoiContainer } from "victory-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { getNetworkTrafficHistory, NETWORK_HISTORY_RANGES, type NetworkHistory, type NetworkHistoryRange } from "@/services/network-graph";
import { networkBytesText, networkRateText, type NetworkHistorySource } from "@/utils/network-graph";

const CHART_HEIGHT = 240;
const ink = "text-typography-900 dark:text-[#E8EBF0]";
const muted = "text-typography-600 dark:text-[#8A94A8]";
const line = "border-outline-200 dark:border-[#26364A]";
const tabular = { fontVariantNumeric: "tabular-nums" } as const;

const chartColors = (dark: boolean) => ({
  sent: "#0D9488",
  received: dark ? "#EA580C" : "#C2410C",
  tick: dark ? "#9AA4B8" : "#475569",
  grid: dark ? "#1E2F47" : "#E2E8F0",
  flyout: { fill: dark ? "#0A1628" : "#FFFFFF", stroke: dark ? "#2A3B52" : "#CBD5E1" },
  flyoutText: { fill: dark ? "#E8EBF0" : "#0F172A", fontSize: 12 },
});

const timeText = (at: Date, range: NetworkHistoryRange) =>
  at.toLocaleString(undefined, range === "1d" ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" });

const Stat = ({ label, value }: { label: string; value: string }) => <div style={{ minWidth: 0 }}>
  <div className={muted} style={{ fontSize: 12 }}>{label}</div>
  <div className={ink} style={{ fontSize: 14, fontWeight: 600, ...tabular }}>{value}</div>
</div>;

const Key = ({ color, label, faint }: { color: string; label: string; faint?: boolean }) => <span className={muted} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
  <span aria-hidden style={{ width: 16, height: 2, background: color, opacity: faint ? 0.4 : 1 }} />{label}
</span>;

function Chart({ history, width }: { history: NetworkHistory; width: number }) {
  const { resolvedMode } = useAppTheme();
  const colors = chartColors(resolvedMode === "dark");
  const series = (field: "sent" | "received" | "peakSent" | "peakReceived") => history.points.map((point) => ({ x: new Date(point.at), y: point[field], point }));
  const tickLabels = { fill: colors.tick, fontSize: 11, padding: 6, fontFamily: "inherit" };
  const describe = ({ datum }: { datum: { x: Date; point: NetworkHistory["points"][number] } }) => {
    const { point } = datum;
    const when = datum.x.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    return `${when}\nSent ${networkRateText(point.sent ?? 0)}, peak ${networkRateText(point.peakSent ?? 0)}\nReceived ${networkRateText(point.received ?? 0)}, peak ${networkRateText(point.peakReceived ?? 0)}`;
  };
  return <VictoryChart
    width={width}
    height={CHART_HEIGHT}
    scale={{ x: "time" }}
    padding={{ top: 12, bottom: 30, left: 72, right: 16 }}
    domainPadding={{ y: [0, 8] }}
    containerComponent={<VictoryVoronoiContainer
      responsive={false}
      voronoiDimension="x"
      voronoiBlacklist={["peakSent", "peakReceived", "received", "sent"]}
      labels={describe}
      labelComponent={<VictoryTooltip constrainToVisibleArea cornerRadius={8} flyoutPadding={{ top: 6, bottom: 6, left: 10, right: 10 }} flyoutStyle={colors.flyout} style={colors.flyoutText} />}
    />}
  >
    <VictoryAxis tickCount={Math.max(2, Math.min(6, Math.floor(width / 110)))} tickFormat={(at: Date) => timeText(at, history.range)} style={{ tickLabels, axis: { stroke: colors.grid }, ticks: { stroke: "transparent" }, grid: { stroke: "transparent" } }} />
    <VictoryAxis dependentAxis tickCount={4} tickFormat={(rate: number) => networkRateText(rate)} style={{ tickLabels, axis: { stroke: "transparent" }, ticks: { stroke: "transparent" }, grid: { stroke: colors.grid } }} />
    {/* Tooltips read this line: Victory's flyout crashes on the null points that draw a gap. */}
    <VictoryLine name="hover" data={series("sent").filter((item) => item.y !== null)} style={{ data: { stroke: "transparent" } }} />
    <VictoryLine name="peakSent" data={series("peakSent")} style={{ data: { stroke: colors.sent, strokeWidth: 1, opacity: 0.4 } }} />
    <VictoryLine name="peakReceived" data={series("peakReceived")} style={{ data: { stroke: colors.received, strokeWidth: 1, opacity: 0.4 } }} />
    <VictoryLine name="received" data={series("received")} style={{ data: { stroke: colors.received, strokeWidth: 2 } }} />
    <VictoryLine name="sent" data={series("sent")} style={{ data: { stroke: colors.sent, strokeWidth: 2 } }} />
  </VictoryChart>;
}

// Loads on open and on a range change only: live rates already update beside it.
export function NetworkHistoryChart({ sources }: { sources: NetworkHistorySource[] }) {
  const { resolvedMode } = useAppTheme();
  const colors = chartColors(resolvedMode === "dark");
  const [range, setRange] = React.useState<NetworkHistoryRange>("1d");
  const [sourceIndex, setSourceIndex] = React.useState(0);
  const [history, setHistory] = React.useState<NetworkHistory | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [width, setWidth] = React.useState(0);
  const observer = React.useRef<ResizeObserver | null>(null);
  const measure = React.useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!element) return;
    observer.current = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.current.observe(element);
  }, []);
  const keys = sources[sourceIndex]?.keys.join("\n") ?? "";

  React.useEffect(() => {
    if (!keys) return;
    const controller = new AbortController();
    setHistory(null);
    setFailed(false);
    getNetworkTrafficHistory(range, keys.split("\n"), controller.signal).then(setHistory, () => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [range, keys]);

  if (!sources.length) return <p className={muted} style={{ margin: 0, fontSize: 13 }}>No traffic is measured here, so there is no history.</p>;
  const sampled = history?.points.some((point) => point.sent !== null);
  return <section aria-label="Traffic history" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <div role="group" aria-label="History range" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {NETWORK_HISTORY_RANGES.map((item) => <button key={item} aria-pressed={item === range} onClick={() => setRange(item)} className={`rounded-lg border ${line} ${item === range ? "bg-[#147D78] text-white" : ink} focus-visible:ring-2 focus-visible:ring-[#147D78]`} style={{ padding: "4px 10px", fontSize: 12, cursor: "pointer", background: item === range ? undefined : "transparent" }}>{item}</button>)}
      </div>
      {sources.length > 1 ? <select aria-label="Interface" value={sourceIndex} onChange={(event) => setSourceIndex(Number(event.target.value))} className={`rounded-lg border ${line} bg-background-0 dark:bg-[#101B2B] ${ink}`} style={{ padding: "4px 8px", fontSize: 12 }}>
        {sources.map((source, index) => <option key={source.label} value={index}>{source.label}</option>)}
      </select> : null}
    </div>
    {history && sampled ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
      <Stat label="Total sent / received" value={`${networkBytesText(history.sentBytes)} / ${networkBytesText(history.receivedBytes)}`} />
      <Stat label="Average sent / received" value={`${networkRateText(history.averageSent)} / ${networkRateText(history.averageReceived)}`} />
      <Stat label="Peak sent / received" value={`${networkRateText(history.peakSent)} / ${networkRateText(history.peakReceived)}`} />
    </div> : null}
    <div ref={measure} style={{ minHeight: CHART_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {failed ? <p role="alert" className={muted} style={{ margin: 0, fontSize: 13 }}>History could not be loaded.</p>
        : !history ? <p className={muted} style={{ margin: 0, fontSize: 13 }}>Loading history…</p>
        : !sampled ? <p className={muted} style={{ margin: 0, fontSize: 13 }}>No history saved for this range yet.</p>
        : width ? <Chart history={history} width={width} /> : null}
    </div>
    {history && sampled ? <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <Key color={colors.sent} label="Sent" /><Key color={colors.received} label="Received" /><Key color={colors.sent} label="Sent peak" faint /><Key color={colors.received} label="Received peak" faint />
    </div> : null}
  </section>;
}
