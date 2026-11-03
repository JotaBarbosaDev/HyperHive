import React from "react";
import { LayoutChangeEvent, RefreshControl, ScrollView, useColorScheme } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { VictoryArea, VictoryAxis, VictoryChart, VictoryLine, VictoryTheme } from "victory-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogCloseButton,
} from "@/components/ui/alert-dialog";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { getDiskHealthHistory, purgeDiskHealth } from "@/services/diskhealth";
import { DiskHealthHistory } from "@/types/diskhealth";
import {
  BAND_RANGES,
  bandBadgeAction,
  bandBadgeLabel,
  bandColor,
  counterSeries,
  hasScore,
  isFlashDisk,
  wearProjection,
} from "@/utils/diskhealth";
import { ArrowLeft, HardDrive, RefreshCcw, Trash2 } from "lucide-react-native";

const RANGES = [
  { key: "7d", label: "7 d", days: 7 },
  { key: "30d", label: "30 d", days: 30 },
  { key: "90d", label: "90 d", days: 90 },
  { key: "all", label: "All", days: 0 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const cardClass = "rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] p-4";
const mutedText = "text-typography-600 dark:text-[#9AA4B8]";
const outlineButtonClass =
  "border-outline-200 rounded-xl dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] hover:bg-background-50 dark:hover:bg-[#0A1628]";
const outlineButtonTextClass = "text-typography-900 dark:text-[#E8EBF0]";
const outlineButtonIconClass = "text-typography-900 dark:text-[#E8EBF0]";

const formatBytes = (bytes: number) => {
  if (!bytes) return "—";
  const tb = 1e12;
  const gb = 1e9;
  return bytes >= tb ? `${(bytes / tb).toFixed(2)} TB` : `${(bytes / gb).toFixed(0)} GB`;
};

const formatTick = (value: Date | number) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getDate()}/${date.getMonth() + 1}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown time";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

const sampleCountText = (count: number) => `${count} sample${count === 1 ? "" : "s"}`;

// A chart card measures itself, so the chart width always matches the card on
// web (where the page is wider than the chart's default 320 px canvas).
function ChartCard({
  title,
  legend,
  height = 200,
  render,
  empty,
  accessibilityLabel,
}: {
  title: string;
  legend?: React.ReactNode;
  height?: number;
  render: (width: number) => React.ReactNode;
  empty?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const [width, setWidth] = React.useState(0);

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width - 34);
    if (next > 0) setWidth((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <Box
      className={cardClass}
      onLayout={handleLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <HStack className="items-center justify-between flex-wrap gap-2 mb-1">
        <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">{title}</Text>
        {legend}
      </HStack>
      {empty ? empty : width > 0 ? render(width) : <Box style={{ height }} />}
    </Box>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <Box className={cardClass} style={{ flexGrow: 1, flexBasis: 150, minWidth: 150 }}>
      <Text className={`text-xs ${mutedText}`}>{label}</Text>
      <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">{value}</Text>
    </Box>
  );
}

export default function DiskHealthScreen() {
  const router = useRouter();
  const toast = useToast();
  const isDark = useColorScheme() === "dark";
  const params = useLocalSearchParams<{ serial?: string }>();
  const serial = React.useMemo(() => {
    if (!params.serial) return "";
    try {
      return decodeURIComponent(String(params.serial));
    } catch {
      return String(params.serial);
    }
  }, [params.serial]);
  const { token, isChecking } = useAuthGuard();

  const [range, setRange] = React.useState<RangeKey>("30d");
  const [history, setHistory] = React.useState<DiskHealthHistory | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [confirmPurge, setConfirmPurge] = React.useState(false);
  const [purging, setPurging] = React.useState(false);
  // Tracks whether stored history is already on screen, so a failed reload can
  // surface as a toast instead of replacing the page with an error card.
  const historyRef = React.useRef<DiskHealthHistory | null>(null);

  const load = React.useCallback(
    async (mode: "full" | "refresh" = "full") => {
      if (!serial || !token) return;
      if (mode === "full") setLoading(true);
      else setRefreshing(true);
      try {
        const days = RANGES.find((r) => r.key === range)?.days ?? 0;
        const next = await getDiskHealthHistory(serial, days);
        historyRef.current = next;
        setHistory(next);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load disk health.";
        if (historyRef.current) {
          setError(null);
          toast.show({
            placement: "top",
            render: ({ id }) => (
              <Toast nativeID={`toast-${id}`} action="error">
                <ToastTitle>Reload failed</ToastTitle>
                <ToastDescription>{message}</ToastDescription>
              </Toast>
            ),
          });
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [serial, token, range]
  );

  React.useEffect(() => {
    if (!serial) router.replace("/smartdisk" as any);
  }, [serial, router]);

  React.useEffect(() => {
    if (!isChecking) load();
  }, [isChecking, load]);

  const purge = async () => {
    setPurging(true);
    try {
      await purgeDiskHealth(serial);
      setConfirmPurge(false);
      router.replace("/smartdisk" as any);
    } catch (err) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={`toast-${id}`} action="error">
            <ToastTitle>Purge failed</ToastTitle>
            <ToastDescription>{err instanceof Error ? err.message : "Try again."}</ToastDescription>
          </Toast>
        ),
      });
    } finally {
      setPurging(false);
    }
  };

  const disk = history?.disk;
  const points = history?.points ?? [];
  const latest = disk?.latest;
  const flash = isFlashDisk(disk);
  const hasTrend = points.length >= 2;
  const days = RANGES.find((r) => r.key === range)?.days ?? 0;

  const axisStyle = {
    tickLabels: { fill: isDark ? "#64748B" : "#1F2937", fontSize: 10 },
    axis: { stroke: isDark ? "#1F2937" : "#64748B" },
    ticks: { stroke: isDark ? "#1F2937" : "#64748B" },
    grid: { stroke: "transparent" },
  };

  const scoreData = points.filter((p) => p.score !== null).map((p) => ({ x: new Date(p.at), y: p.score as number }));
  const xStart = points.length ? new Date(points[0].at) : new Date();
  const xEnd = points.length ? new Date(points[points.length - 1].at) : new Date();
  const xDomain: [Date, Date] | undefined = hasTrend ? [xStart, xEnd.getTime() > xStart.getTime() ? xEnd : new Date(xStart.getTime() + 6 * 3600_000)] : undefined;

  const temperatures = points.map((p) => p.temperatureC).filter((v) => v > 0);
  let tempDomain: [number, number] | undefined;
  if (temperatures.length) {
    const low = Math.min(...temperatures);
    const high = Math.max(...temperatures);
    const pad = Math.max(2, (high - low) * 0.15);
    let from = Math.max(0, Math.floor(low - pad));
    let to = Math.ceil(high + pad);
    if (to - from < 5) {
      const mid = (from + to) / 2;
      from = Math.max(0, Math.floor(mid - 2.5));
      to = Math.ceil(mid + 2.5);
    }
    tempDomain = [from, to];
  }

  const counters = counterSeries(points);
  const projection = wearProjection(points, disk?.wearOutAt);
  const lastPoint = points[points.length - 1];
  const latestScore = scoreData.length ? Math.round(scoreData[scoreData.length - 1].y) : null;
  const scoreLabel = latestScore !== null ? `Health score chart, latest score ${latestScore}` : "Health score chart";
  const countersLabel = counters.shown.length
    ? `Critical counters chart, ${counters.shown.length} counter${counters.shown.length === 1 ? "" : "s"} with errors`
    : "Critical counters chart, no errors";
  const temperatureLabel = lastPoint ? `Temperature chart, latest ${lastPoint.temperatureC} °C` : "Temperature chart";
  const wearLabel = lastPoint ? `Wear chart, latest ${lastPoint.percentageUsed}%` : "Wear chart";

  const rangeButton = (option: (typeof RANGES)[number]) => {
    const active = range === option.key;
    return (
      <Pressable
        key={option.key}
        onPress={() => setRange(option.key)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        className={
          active
            ? "rounded-xl bg-primary-500 px-3 py-1.5 dark:bg-[#2DD4BF]"
            : "rounded-xl border border-outline-200 bg-background-0 px-3 py-1.5 active:opacity-70 hover:bg-background-50 dark:border-[#1E2F47] dark:bg-[#0F1A2E] dark:hover:bg-[#0A1628]"
        }
      >
        <Text className={active ? "text-sm font-semibold text-white dark:text-[#062A28]" : `text-sm ${outlineButtonTextClass}`}>
          {option.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19]">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
      >
        <VStack className="p-4 web:p-10 gap-4">
          <HStack className="items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" action="default" className={outlineButtonClass} onPress={() => router.replace("/smartdisk" as any)}>
              <ButtonIcon as={ArrowLeft} size="sm" className={outlineButtonIconClass} />
              <ButtonText className={outlineButtonTextClass}>SMART disks</ButtonText>
            </Button>
            <Button size="sm" variant="outline" action="default" className={outlineButtonClass} onPress={() => load("refresh")}>
              <ButtonIcon as={RefreshCcw} size="sm" className={outlineButtonIconClass} />
              <ButtonText className={outlineButtonTextClass}>Reload</ButtonText>
            </Button>
          </HStack>
          <Text className={`text-xs -mt-2 ${mutedText}`}>Reloads stored history; the master polls every 6 hours.</Text>

          {loading && !history ? (
            <Text className={mutedText}>Loading disk health…</Text>
          ) : error && !history ? (
            <Box className={cardClass}>
              <Text className="text-error-600 mb-2">{error}</Text>
              <Button size="sm" variant="outline" action="default" className={`${outlineButtonClass} self-start`} onPress={() => load()}>
                <ButtonText className={outlineButtonTextClass}>Try again</ButtonText>
              </Button>
            </Box>
          ) : disk ? (
            <>
              <HStack className="items-start justify-between flex-wrap gap-3">
                <HStack className="items-center gap-3 flex-1 min-w-0">
                  <HardDrive size={28} className="text-typography-900 dark:text-[#E8EBF0]" />
                  <VStack className="flex-1 min-w-0">
                    <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                      {disk.model || "Unknown model"}
                    </Heading>
                    <Text selectable className={`text-sm font-mono break-all ${mutedText}`}>
                      Serial {disk.serial}
                    </Text>
                    <Text className={`text-sm ${mutedText}`}>
                      {disk.machineName || "unknown host"} · {disk.device || "—"} · {flash ? "SSD/NVMe" : "HDD"}
                      {disk.transport ? ` (${disk.transport})` : ""} · {formatBytes(disk.capacityBytes)}
                    </Text>
                    {disk.retiredAt ? (
                      <Text className={`text-sm ${mutedText}`}>
                        Retired {new Date(disk.retiredAt).toLocaleDateString()} (not seen for 90 days)
                      </Text>
                    ) : null}
                  </VStack>
                </HStack>
                <Badge className="rounded-full px-4 py-2" size="lg" action={bandBadgeAction(disk)} variant="solid">
                  <BadgeText className="text-base font-bold">{bandBadgeLabel(disk)}</BadgeText>
                </Badge>
              </HStack>

              <Box
                className="rounded-2xl p-3 border"
                style={{ borderColor: bandColor(disk.band), backgroundColor: `${bandColor(disk.band)}1A` }}
              >
                <Text className="font-semibold text-typography-900 dark:text-[#E8EBF0] mb-1">Why:</Text>
                {(disk.reasons.length ? disk.reasons : ["No SMART data"]).map((reason) => (
                  <Text key={reason} className="text-sm text-typography-800 dark:text-[#E8EBF0]">
                    • {reason}
                  </Text>
                ))}
                {disk.wearOutAt && hasScore(disk) ? (
                  <Text className={`text-xs mt-2 ${mutedText}`}>
                    Rated wear projected for {new Date(disk.wearOutAt).toLocaleDateString()} (estimate from the last 90 days).
                  </Text>
                ) : null}
              </Box>

              {latest ? (
                <>
                  {!disk.smartAvailable ? (
                    <Text className={`text-xs ${mutedText}`}>Last known values — this disk does not report SMART.</Text>
                  ) : null}
                  <Box
                    className={!disk.smartAvailable ? "opacity-60" : undefined}
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
                  >
                    <MetricTile label="Pending sectors" value={String(latest.pendingSectors)} />
                    <MetricTile label="Reallocated sectors" value={String(latest.reallocatedSectors)} />
                    <MetricTile label="Temperature" value={latest.temperatureC ? `${latest.temperatureC}°C` : "—"} />
                    <MetricTile label="Power-on hours" value={latest.powerOnHours.toLocaleString()} />
                    {flash ? <MetricTile label="Media errors" value={String(latest.mediaErrors)} /> : null}
                    {flash ? <MetricTile label="Wear" value={`${latest.percentageUsed}%`} /> : null}
                  </Box>
                </>
              ) : null}

              {latest ? (
                <Text className={`text-xs ${mutedText}`}>
                  Last sample {formatDateTime(latest.capturedAt)} · {sampleCountText(points.length)} in the{" "}
                  {days ? `last ${days} days` : "full history"}
                </Text>
              ) : null}

              <HStack className="gap-2 flex-wrap items-center">
                {RANGES.map(rangeButton)}
                {history && (loading || refreshing) ? <Text className={`text-xs ${mutedText}`}>Loading…</Text> : null}
              </HStack>

              {!hasTrend ? (
                <Box className={cardClass}>
                  {!disk.smartAvailable ? (
                    <>
                      <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold mb-1">No SMART data</Text>
                      <Text className={`text-sm ${mutedText}`}>
                        This disk does not report SMART health, so no history is collected for it.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold mb-1">History is building</Text>
                      <Text className={`text-sm ${mutedText}`}>
                        {points.length === 0
                          ? "No samples stored yet. The first one is collected by the next poll (up to 6 hours)."
                          : `First sample recorded ${formatDateTime(points[0]?.at)}${range !== "all" ? `, and only ${sampleCountText(points.length)} in the last ${days} days` : ""}. Trends and wear projections appear after the next poll (up to 6 hours).`}
                      </Text>
                      {range !== "all" ? (
                        <Pressable
                          onPress={() => setRange("all")}
                          accessibilityRole="button"
                          className="mt-2 self-start rounded-xl bg-primary-500 px-3 py-1.5 dark:bg-[#2DD4BF]"
                        >
                          <Text className="text-sm font-semibold text-white dark:text-[#062A28]">Show all history</Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </Box>
              ) : (
                <>
                  <ChartCard
                    title="Health score"
                    height={220}
                    accessibilityLabel={scoreLabel}
                    render={(width) => (
                      <VictoryChart
                        theme={VictoryTheme.material}
                        height={220}
                        width={width}
                        padding={{ top: 10, bottom: 36, left: 40, right: 12 }}
                        scale={{ x: "time" }}
                        domain={{ x: xDomain, y: [0, 100] }}
                      >
                        <VictoryAxis style={axisStyle} tickFormat={(v: Date | number) => formatTick(v)} />
                        <VictoryAxis dependentAxis style={axisStyle} />
                        {BAND_RANGES.map((b) => (
                          <VictoryArea
                            key={b.band}
                            data={[
                              { x: xStart, y: b.to, y0: b.from },
                              { x: xEnd, y: b.to, y0: b.from },
                            ]}
                            style={{ data: { fill: b.color, fillOpacity: 0.08, stroke: "none" } }}
                          />
                        ))}
                        <VictoryLine
                          data={scoreData}
                          interpolation="monotoneX"
                          style={{ data: { stroke: isDark ? "#E8EBF0" : "#0F172A", strokeWidth: 2.5 } }}
                        />
                      </VictoryChart>
                    )}
                  />

                  <ChartCard
                    title="Critical counters"
                    accessibilityLabel={countersLabel}
                    render={(width) =>
                      counters.shown.length ? (
                        <VictoryChart
                          theme={VictoryTheme.material}
                          height={200}
                          width={width}
                          padding={{ top: 10, bottom: 36, left: 48, right: 12 }}
                          scale={{ x: "time" }}
                          domain={{ x: xDomain }}
                        >
                          <VictoryAxis style={axisStyle} tickFormat={(v: Date | number) => formatTick(v)} />
                          <VictoryAxis dependentAxis style={axisStyle} />
                          {counters.shown.map((s) => (
                            <VictoryLine key={s.label} data={s.data} interpolation="monotoneX" style={{ data: { stroke: s.color, strokeWidth: 2.5 } }} />
                          ))}
                        </VictoryChart>
                      ) : (
                        <Box style={{ height: 60, justifyContent: "center" }}>
                          <Text className={`text-sm ${mutedText}`}>
                            No pending, reallocated, offline/uncorrectable or media errors in this period.
                          </Text>
                        </Box>
                      )
                    }
                    legend={
                      counters.shown.length ? (
                        <HStack className="gap-3 flex-wrap">
                          {counters.shown.map((s) => (
                            <HStack key={s.label} className="items-center gap-1">
                              <Box className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                              <Text className={`text-xs ${mutedText}`}>{s.label}</Text>
                            </HStack>
                          ))}
                        </HStack>
                      ) : undefined
                    }
                  />

                  <Box style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    <Box style={{ flexGrow: 1, flexBasis: 280, minWidth: 280 }}>
                      <ChartCard
                        title="Temperature (°C)"
                        accessibilityLabel={temperatureLabel}
                        render={(width) =>
                          temperatures.length ? (
                            <VictoryChart
                              theme={VictoryTheme.material}
                              height={200}
                              width={width}
                              padding={{ top: 10, bottom: 36, left: 44, right: 12 }}
                              scale={{ x: "time" }}
                              domain={{ x: xDomain, ...(tempDomain ? { y: tempDomain } : {}) }}
                            >
                              <VictoryAxis style={axisStyle} tickFormat={(v: Date | number) => formatTick(v)} />
                              <VictoryAxis dependentAxis style={axisStyle} tickFormat={(v: number) => v.toFixed(0)} />
                              <VictoryLine
                                data={points.map((p) => ({ x: new Date(p.at), y: p.temperatureC }))}
                                interpolation="monotoneX"
                                style={{ data: { stroke: "#F97316", strokeWidth: 2.5 } }}
                              />
                            </VictoryChart>
                          ) : (
                            <Box style={{ height: 60, justifyContent: "center" }}>
                              <Text className={`text-sm ${mutedText}`}>No temperature reported.</Text>
                            </Box>
                          )
                        }
                      />
                    </Box>

                    {flash ? (
                      <Box style={{ flexGrow: 1, flexBasis: 280, minWidth: 280 }}>
                        <ChartCard
                          title="Wear (% of rated endurance)"
                          accessibilityLabel={wearLabel}
                          legend={projection.length ? <Text className={`text-xs ${mutedText}`}>Dashed: projection (estimate)</Text> : undefined}
                          render={(width) => (
                            <VictoryChart
                              theme={VictoryTheme.material}
                              height={200}
                              width={width}
                              padding={{ top: 10, bottom: 36, left: 44, right: 12 }}
                              scale={{ x: "time" }}
                              domain={{ x: projection.length ? [xStart, projection[1].x] : xDomain, y: [0, 100] }}
                            >
                              <VictoryAxis style={axisStyle} tickFormat={(v: Date | number) => formatTick(v)} />
                              <VictoryAxis dependentAxis style={axisStyle} />
                              <VictoryLine
                                data={points.map((p) => ({ x: new Date(p.at), y: p.percentageUsed }))}
                                interpolation="monotoneX"
                                style={{ data: { stroke: "#8B5CF6", strokeWidth: 2.5 } }}
                              />
                              {projection.length ? (
                                <VictoryLine
                                  data={projection}
                                  style={{ data: { stroke: "#8B5CF6", strokeWidth: 2, strokeDasharray: "6,4" } }}
                                />
                              ) : null}
                            </VictoryChart>
                          )}
                        />
                      </Box>
                    ) : null}
                  </Box>
                </>
              )}

              {disk.retiredAt ? (
                <Box className={cardClass}>
                  <Text className="font-semibold text-typography-900 dark:text-[#E8EBF0]">Purge history</Text>
                  <Text className={`text-sm mb-3 ${mutedText}`}>
                    Deletes this retired disk and all its stored health history. This cannot be undone.
                  </Text>
                  <Button action="negative" className="rounded-xl self-start" onPress={() => setConfirmPurge(true)}>
                    <ButtonIcon as={Trash2} size="sm" />
                    <ButtonText>Purge disk history</ButtonText>
                  </Button>
                </Box>
              ) : null}
            </>
          ) : null}
        </VStack>
      </ScrollView>

      <AlertDialog isOpen={confirmPurge} onClose={() => setConfirmPurge(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent className="max-w-lg rounded-2xl">
          <AlertDialogHeader>
            <Heading size="md">Purge disk history?</Heading>
            <AlertDialogCloseButton />
          </AlertDialogHeader>
          <AlertDialogBody className="py-3">
            <Text>
              All samples and daily history for {disk?.model || "this disk"} ({serial}) will be deleted. If the disk is seen again, history starts over.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-2">
            <Button variant="outline" action="default" onPress={() => setConfirmPurge(false)}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button action="negative" isDisabled={purging} onPress={purge}>
              <ButtonText>{purging ? "Purging…" : "Purge"}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
