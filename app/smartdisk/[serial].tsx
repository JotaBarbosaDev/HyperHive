import React from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
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
import { CounterPanel, RangeControl, ScoreChart, TemperatureChart, WearChart } from "@/components/diskhealth/DiskHealthCharts";
import { DiskHealthSkeleton, ReadingTiles, ScoreHero } from "@/components/diskhealth/DiskHealthOverview";
import { cardClass, formatBytes, formatDateTime, mutedText, RANGES, RangeKey, rangeText, sampleCountText, strongText } from "@/components/diskhealth/shared";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { getDiskHealthHistory, purgeDiskHealth } from "@/services/diskhealth";
import { DiskHealthHistory } from "@/types/diskhealth";
import { isFlashDisk } from "@/utils/diskhealth";
import { ArrowLeft, CircleAlert, RefreshCcw, Trash2 } from "lucide-react-native";

const outlineButtonClass =
  "border-outline-200 rounded-xl dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] hover:bg-background-50 dark:hover:bg-[#0A1628]";
const outlineButtonTextClass = "text-typography-900 dark:text-[#E8EBF0]";
const outlineButtonIconClass = "text-typography-900 dark:text-[#E8EBF0]";

const rangeDays = (key: RangeKey) => RANGES.find((r) => r.key === key)?.days ?? 0;

export default function DiskHealthScreen() {
  const router = useRouter();
  const toast = useToast();
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
  // The range the visible history was loaded for; `range` can run ahead of it
  // while a reload is pending or after one fails.
  const [loadedDays, setLoadedDays] = React.useState(rangeDays("30d"));
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [confirmPurge, setConfirmPurge] = React.useState(false);
  const [purging, setPurging] = React.useState(false);
  // Tracks whether stored history is already on screen, so a failed reload can
  // surface as a toast instead of replacing the page with an error card.
  const historyRef = React.useRef<DiskHealthHistory | null>(null);
  // Only the newest request may update the page, so a slow 90d response cannot
  // overwrite the 7d range the user switched to afterwards.
  const requestRef = React.useRef(0);

  const load = React.useCallback(
    async (mode: "full" | "refresh" = "full") => {
      if (!serial || !token) return;
      const request = ++requestRef.current;
      if (mode === "full") setLoading(true);
      else setRefreshing(true);
      try {
        const days = rangeDays(range);
        const next = await getDiskHealthHistory(serial, days);
        if (request !== requestRef.current) return;
        historyRef.current = next;
        setHistory(next);
        setLoadedDays(days);
        setError(null);
      } catch (err) {
        if (request !== requestRef.current) return;
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
        if (request === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
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
  const busy = !!history && (loading || refreshing);
  const noHistory = !!disk && !disk.smartAvailable && points.length === 0;

  const emptyHistory = () => {
    if (!disk?.smartAvailable) {
      return (
        <>
          <Text className={`font-semibold mb-1 ${strongText}`}>No SMART data</Text>
          <Text className={`text-sm ${mutedText}`}>This disk does not report SMART health, so no history is collected for it.</Text>
        </>
      );
    }
    const olderHistory = points.length === 0 && !!latest && loadedDays > 0;
    return (
      <>
        <Text className={`font-semibold mb-1 ${strongText}`}>{olderHistory ? `No samples in the ${rangeText(loadedDays)}` : "History is building"}</Text>
        <Text className={`text-sm ${mutedText}`}>
          {olderHistory
            ? `The last sample is from ${formatDateTime(latest?.capturedAt)}.`
            : points.length === 0
              ? "No samples stored yet. The first one is collected by the next poll (up to 6 hours)."
              : `First sample recorded ${formatDateTime(points[0]?.at)}${loadedDays ? `, and only ${sampleCountText(points.length)} in the ${rangeText(loadedDays)}` : ""}. Trends and wear projections appear after the next poll (up to 6 hours).`}
        </Text>
        {range !== "all" ? (
          <Pressable
            onPress={() => setRange("all")}
            role="button"
            className="mt-3 self-start min-h-[44px] web:min-h-[36px] justify-center rounded-xl bg-primary-500 px-4 dark:bg-[#2DD4BF] web:cursor-pointer"
          >
            <Text className="text-sm font-semibold text-white dark:text-[#062A28]">Show all history</Text>
          </Pressable>
        ) : null}
      </>
    );
  };

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19]">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
      >
        <VStack className="p-4 pt-16 gap-5 web:px-4 web:md:px-10 web:pb-10 web:pt-20 web:max-w-7xl web:mx-auto web:w-full">
          <HStack className="items-center justify-between gap-2 flex-wrap">
            <Button size="sm" variant="outline" action="default" className={outlineButtonClass} onPress={() => router.replace("/smartdisk" as any)}>
              <ButtonIcon as={ArrowLeft} size="sm" className={outlineButtonIconClass} />
              <ButtonText className={outlineButtonTextClass}>SMART disks</ButtonText>
            </Button>
            <Button
              size="sm"
              variant="outline"
              action="default"
              className={outlineButtonClass}
              isDisabled={refreshing}
              onPress={() => load("refresh")}
            >
              {refreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" className={outlineButtonIconClass} />}
              <ButtonText className={outlineButtonTextClass}>Reload</ButtonText>
            </Button>
          </HStack>

          {loading && !history ? (
            <DiskHealthSkeleton />
          ) : error && !history ? (
            <Box className={cardClass}>
              <HStack className="items-center gap-2 mb-1">
                <CircleAlert size={18} className="text-error-600" />
                <Text className={`font-semibold ${strongText}`}>Disk health could not be loaded</Text>
              </HStack>
              <Text className={`text-sm mb-3 ${mutedText}`}>{error}</Text>
              <Button size="sm" variant="outline" action="default" className={`${outlineButtonClass} self-start`} onPress={() => load()}>
                <ButtonText className={outlineButtonTextClass}>Try again</ButtonText>
              </Button>
            </Box>
          ) : disk ? (
            <>
              <VStack className="gap-1 min-w-0">
                <Heading size="xl" className={strongText}>
                  {disk.model || "Unknown model"}
                </Heading>
                <Text className={`text-sm ${mutedText}`}>
                  {disk.machineName || "unknown host"} · {disk.device || "—"} · {flash ? "SSD/NVMe" : "HDD"}
                  {disk.transport ? ` (${disk.transport})` : ""} · {formatBytes(disk.capacityBytes)}
                </Text>
                <Text selectable className={`text-sm font-mono break-all ${mutedText}`}>
                  Serial {disk.serial}
                </Text>
                {disk.retiredAt ? (
                  <Text className={`text-sm ${mutedText}`}>Retired {new Date(disk.retiredAt).toLocaleDateString()} (not seen for 90 days)</Text>
                ) : null}
              </VStack>

              <ScoreHero disk={disk} />

              {latest ? <ReadingTiles disk={disk} latest={latest} flash={flash} /> : null}

              {noHistory ? null : (
                <Box className="mt-2" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                  <VStack style={{ flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 }}>
                    <Heading size="md" className={strongText}>
                      History
                    </Heading>
                    <Text className={`text-xs ${mutedText}`}>
                      {sampleCountText(points.length)} in the {rangeText(loadedDays)}
                      {latest ? ` · last sample ${formatDateTime(latest.capturedAt)}` : ""} · polled every 6 hours
                    </Text>
                  </VStack>
                  <RangeControl value={range} onChange={setRange} busy={busy} />
                </Box>
              )}

              {/* Old data stays readable but dimmed while the next range loads. */}
              <VStack className={`gap-4 ${busy ? "opacity-60" : ""}`}>
                {hasTrend ? <ScoreChart points={points} days={loadedDays} /> : <Box className={cardClass}>{emptyHistory()}</Box>}

                {latest ? <CounterPanel points={points} latest={latest} flash={flash} days={loadedDays} /> : null}

                {hasTrend ? (
                  <Box style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 }}>
                      <TemperatureChart points={points} days={loadedDays} />
                    </Box>
                    {flash ? (
                      <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 }}>
                        <WearChart disk={disk} points={points} days={loadedDays} />
                      </Box>
                    ) : null}
                  </Box>
                ) : null}
              </VStack>

              {disk.retiredAt ? (
                <Box className={`${cardClass} mt-2`}>
                  <Text className={`font-semibold ${strongText}`}>Purge history</Text>
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
