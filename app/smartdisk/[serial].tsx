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
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
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
  const [chartWidth, setChartWidth] = React.useState(320);

  const load = React.useCallback(
    async (mode: "full" | "refresh" = "full") => {
      if (!serial || !token) return;
      if (mode === "full") setLoading(true);
      else setRefreshing(true);
      try {
        const days = RANGES.find((r) => r.key === range)?.days ?? 0;
        setHistory(await getDiskHealthHistory(serial, days));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load disk health.");
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

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width - 32);
    if (width > 0) setChartWidth((prev) => (prev === width ? prev : width));
  }, []);

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
  const axisStyle = {
    tickLabels: { fill: isDark ? "#64748B" : "#1F2937", fontSize: 10 },
    axis: { stroke: isDark ? "#1F2937" : "#64748B" },
    ticks: { stroke: isDark ? "#1F2937" : "#64748B" },
    grid: { stroke: "transparent" },
  };

  const chart = (title: string, children: React.ReactNode, options: { yDomain?: [number, number]; xEnd?: Date; legend?: React.ReactNode } = {}) => {
    const xs = points.map((p) => new Date(p.at).getTime());
    if (options.xEnd) xs.push(options.xEnd.getTime());
    const xDomain: [Date, Date] | undefined =
      xs.length > 1 ? [new Date(Math.min(...xs)), new Date(Math.max(...xs))] : undefined;
    return (
      <Box className={cardClass}>
        <HStack className="items-center justify-between flex-wrap gap-2 mb-1">
          <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">{title}</Text>
          {options.legend}
        </HStack>
        {points.length === 0 ? (
          <Text className={`text-sm ${mutedText}`}>No history yet</Text>
        ) : (
          <VictoryChart
            theme={VictoryTheme.material}
            height={220}
            width={chartWidth}
            padding={{ top: 10, bottom: 36, left: 48, right: 18 }}
            scale={{ x: "time" }}
            domain={{ ...(xDomain ? { x: xDomain } : {}), ...(options.yDomain ? { y: options.yDomain } : {}) }}
          >
            <VictoryAxis style={axisStyle} tickFormat={(v: Date | number) => formatTick(v)} />
            <VictoryAxis dependentAxis style={axisStyle} />
            {children}
          </VictoryChart>
        )}
      </Box>
    );
  };

  const xStart = points.length ? new Date(points[0].at) : new Date();
  const xEnd = points.length ? new Date(points[points.length - 1].at) : new Date();
  const counters = counterSeries(points);
  const projection = wearProjection(points, disk?.wearOutAt);
  const flash = isFlashDisk(disk);

  const metric = (label: string, value: string) => (
    <Box key={label} className={`${cardClass} min-w-[140px] flex-1`}>
      <Text className={`text-xs ${mutedText}`}>{label}</Text>
      <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">{value}</Text>
    </Box>
  );

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19]">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
      >
        <VStack className="p-4 web:p-10 gap-4" onLayout={handleLayout}>
          <HStack className="items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" action="default" className="rounded-xl" onPress={() => router.replace("/smartdisk" as any)}>
              <ButtonIcon as={ArrowLeft} size="sm" />
              <ButtonText>SMART disks</ButtonText>
            </Button>
            <Button size="sm" variant="outline" action="default" className="rounded-xl" onPress={() => load("refresh")}>
              <ButtonIcon as={RefreshCcw} size="sm" />
              <ButtonText>Refresh</ButtonText>
            </Button>
          </HStack>

          {loading && !history ? (
            <Text className={mutedText}>Loading disk health…</Text>
          ) : error && !history ? (
            <Box className={cardClass}>
              <Text className="text-error-600">{error}</Text>
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
                className="rounded-2xl p-4 border"
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
                <HStack className="gap-3 flex-wrap">
                  {[
                    metric("Pending sectors", String(latest.pendingSectors)),
                    metric("Reallocated sectors", String(latest.reallocatedSectors)),
                    metric("Temperature", latest.temperatureC ? `${latest.temperatureC}°C` : "—"),
                    metric("Power-on hours", latest.powerOnHours.toLocaleString()),
                    ...(flash
                      ? [metric("Media errors", String(latest.mediaErrors)), metric("Wear", `${latest.percentageUsed}%`)]
                      : []),
                  ]}
                </HStack>
              ) : null}

              <HStack className="gap-2 flex-wrap">
                {RANGES.map((r) => (
                  <Button
                    key={r.key}
                    size="sm"
                    variant={range === r.key ? "solid" : "outline"}
                    action={range === r.key ? "primary" : "default"}
                    className="rounded-xl"
                    onPress={() => setRange(r.key)}
                  >
                    <ButtonText>{r.label}</ButtonText>
                  </Button>
                ))}
              </HStack>

              {chart(
                "Health score",
                [
                  ...BAND_RANGES.map((b) => (
                    <VictoryArea
                      key={b.band}
                      data={[
                        { x: xStart, y: b.to, y0: b.from },
                        { x: xEnd, y: b.to, y0: b.from },
                      ]}
                      style={{ data: { fill: b.color, fillOpacity: 0.12, stroke: "none" } }}
                    />
                  )),
                  <VictoryLine
                    key="score"
                    data={points.filter((p) => p.score !== null).map((p) => ({ x: new Date(p.at), y: p.score as number }))}
                    style={{ data: { stroke: isDark ? "#E8EBF0" : "#0F172A", strokeWidth: 2.5 } }}
                  />,
                ],
                { yDomain: [0, 100] }
              )}

              {chart(
                "Critical counters",
                counters.shown.map((s) => (
                  <VictoryLine key={s.label} data={s.data} style={{ data: { stroke: s.color, strokeWidth: 2.5 } }} />
                )),
                {
                  legend: (
                    <HStack className="gap-3 flex-wrap">
                      {counters.shown.map((s) => (
                        <HStack key={s.label} className="items-center gap-1">
                          <Box className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                          <Text className={`text-xs ${mutedText}`}>{s.label}</Text>
                        </HStack>
                      ))}
                      {counters.zero.length ? (
                        <Text className={`text-xs ${mutedText}`}>Always 0: {counters.zero.join(", ")}</Text>
                      ) : null}
                    </HStack>
                  ),
                }
              )}

              {chart(
                "Temperature (°C)",
                <VictoryLine
                  data={points.map((p) => ({ x: new Date(p.at), y: p.temperatureC }))}
                  style={{ data: { stroke: "#F97316", strokeWidth: 2.5 } }}
                />
              )}

              {flash
                ? chart(
                    "Wear (% of rated endurance)",
                    [
                      <VictoryLine
                        key="wear"
                        data={points.map((p) => ({ x: new Date(p.at), y: p.percentageUsed }))}
                        style={{ data: { stroke: "#8B5CF6", strokeWidth: 2.5 } }}
                      />,
                      ...(projection.length
                        ? [
                            <VictoryLine
                              key="projection"
                              data={projection}
                              style={{ data: { stroke: "#8B5CF6", strokeWidth: 2, strokeDasharray: "6,4" } }}
                            />,
                          ]
                        : []),
                    ],
                    {
                      yDomain: [0, 100],
                      xEnd: projection.length ? projection[1].x : undefined,
                      legend: projection.length ? <Text className={`text-xs ${mutedText}`}>Dashed: projection (estimate)</Text> : undefined,
                    }
                  )
                : null}

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
