import React from "react";
import { RefreshControl, ScrollView, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMachines } from "@/hooks/useMachines";
import { useSelectedMachine } from "@/hooks/useSelectedMachine";
import {
  getCpuInfo,
  getDiskInfo,
  getMachineUptime,
  getMemInfo,
} from "@/services/hyperhive";
import { CpuInfo, DiskInfo, MemInfo, UptimeInfo } from "@/types/metrics";
import { Machine } from "@/types/machine";
import { MountUsageGauge } from "@/components/mount/MountUsageGauge";
import {
  Activity,
  Clock3,
  Cpu,
  HardDrive,
  Link as LinkIcon,
  MemoryStick,
  RefreshCcw,
  Server,
  ThermometerSun,
} from "lucide-react-native";

type MachineSnapshot = {
  machine: Machine;
  uptime?: UptimeInfo | null;
  cpu?: CpuInfo | null;
  mem?: MemInfo | null;
  disk?: DiskInfo | null;
};

const formatBytes = (value?: number) => {
  if (value == null || !Number.isFinite(value)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let result = value;
  let unitIndex = 0;
  while (result >= 1024 && unitIndex < units.length - 1) {
    result /= 1024;
    unitIndex += 1;
  }
  const formatted = result >= 10 ? result.toFixed(1) : result.toFixed(2);
  return `${formatted} ${units[unitIndex]}`;
};

const formatGbCompact = (value?: number) => {
  if (value == null || !Number.isFinite(value)) return "—";
  const gb = value / 1024 ** 3;
  if (gb >= 1000) return `${(gb / 1024).toFixed(2)} TB`;
  return `${gb.toFixed(2)} GB`;
};

const bytesToGb = (value?: number) => {
  if (value == null || !Number.isFinite(value)) return 0;
  return Number((value / 1024 ** 3).toFixed(2));
};

const formatPercent = (value?: number) => {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
};

const formatRelative = (timestamp?: string | number | Date) => {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 48) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const parseUptime = (uptime?: string) => {
  if (!uptime) return "—";
  const matches = uptime.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!matches) return uptime;
  const [, h, m, s] = matches;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s.replace(/\.\d+$/, "")}s`);
  return parts.length ? parts.join(" ") : uptime;
};

const computeDiskTotals = (disk?: DiskInfo | null) => {
  if (!disk?.disks?.length) {
    return { total: 0, used: 0 };
  }
  return disk.disks.reduce(
    (acc, item) => {
      const total = Number(item.total ?? 0);
      const free = Number(item.free ?? 0);
      const usedFromField = Number(item.used ?? 0);
      const used = Number.isFinite(total - free) && total && free ? total - free : usedFromField;
      if (Number.isFinite(total)) acc.total += total;
      if (Number.isFinite(used)) acc.used += used;
      return acc;
    },
    { total: 0, used: 0 }
  );
};

const averageCpuUsage = (cpu?: CpuInfo | null) => {
  if (!cpu?.cores?.length) return 0;
  const total = cpu.cores.reduce((acc, core) => acc + (Number(core.usage) || 0), 0);
  return total / cpu.cores.length;
};

const averageCpuTemp = (cpu?: CpuInfo | null) => {
  if (!cpu?.cores?.length) return 0;
  const temps = cpu.cores.map((core) => Number(core.temp ?? 0)).filter((t) => Number.isFinite(t));
  if (!temps.length) return 0;
  return temps.reduce((acc, t) => acc + t, 0) / temps.length;
};

const maxCpuTemp = (cpu?: CpuInfo | null) => {
  if (!cpu?.cores?.length) return 0;
  const temps = cpu.cores.map((core) => Number(core.temp ?? 0)).filter((t) => Number.isFinite(t));
  if (!temps.length) return 0;
  return Math.max(...temps);
};

export default function DashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { token, isChecking } = useAuthGuard();
  const { machines, isLoading: isLoadingMachines } = useMachines(token);
  const { selectedMachine, setSelectedMachine } = useSelectedMachine();
  const [snapshots, setSnapshots] = React.useState<MachineSnapshot[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedMachine && machines.length > 0) {
      setSelectedMachine(machines[0].MachineName);
    }
  }, [machines, selectedMachine, setSelectedMachine]);

  const loadSnapshots = React.useCallback(
    async (mode: "initial" | "refresh" = "initial", showLoading: boolean = true) => {
      if (!machines.length) {
        setSnapshots([]);
        return;
      }
      const isRefresh = mode === "refresh";
      if (!showLoading) {
        setError(null);
      } else {
        setError(null);
        isRefresh ? setIsRefreshing(true) : setIsLoading(true);
      }
      try {
        const snapshotPromises = machines.map((machine) =>
          Promise.all([
            getMachineUptime(machine.MachineName),
            getCpuInfo(machine.MachineName),
            getMemInfo(machine.MachineName),
            getDiskInfo(machine.MachineName),
          ])
            .then(([uptime, cpu, mem, disk]) => ({ machine, uptime, cpu, mem, disk } as MachineSnapshot))
            .catch((err) => {
              console.warn("Failed to load snapshot", err);
              return { machine, uptime: null, cpu: null, mem: null, disk: null } as MachineSnapshot;
            })
        );

        const results = await Promise.all(snapshotPromises);
        setSnapshots(results);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Não foi possível carregar o dashboard.";
        if (showLoading) {
          setError(message);
        }
      } finally {
        if (showLoading) {
          isRefresh ? setIsRefreshing(false) : setIsLoading(false);
        }
      }
    },
    [machines]
  );

  React.useEffect(() => {
    if (!isChecking && !isLoadingMachines) {
      loadSnapshots("initial");
    }
  }, [isChecking, isLoadingMachines, loadSnapshots]);

  // Soft update a cada 5 segundos
  React.useEffect(() => {
    if (!isChecking && !isLoadingMachines && machines.length > 0) {
      const interval = setInterval(() => {
        loadSnapshots("refresh", false);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isChecking, isLoadingMachines, machines.length, loadSnapshots]);

  const overallTotals = React.useMemo(() => {
    const totalCores = snapshots.reduce((acc, snap) => acc + (snap.cpu?.cores?.length ?? 0), 0);
    const totalCpuUsage = snapshots.reduce((acc, snap) => acc + averageCpuUsage(snap.cpu), 0);
    const avgCpuUsage = snapshots.length ? totalCpuUsage / snapshots.length : 0;

    const totalRamMb = snapshots.reduce((acc, snap) => acc + (snap.mem?.totalMb ?? 0), 0);
    const usedRamMb = snapshots.reduce((acc, snap) => acc + (snap.mem?.usedMb ?? 0), 0);
    const ramUsagePercent = totalRamMb ? (usedRamMb / totalRamMb) * 100 : 0;

    const diskTotals = snapshots.reduce(
      (acc, snap) => {
        const totals = computeDiskTotals(snap.disk);
        acc.total += totals.total;
        acc.used += totals.used;
        return acc;
      },
      { total: 0, used: 0 }
    );

    const avgTemp = snapshots.reduce((acc, snap) => acc + averageCpuTemp(snap.cpu), 0);
    const temp = snapshots.length ? avgTemp / snapshots.length : 0;

    return { totalCores, avgCpuUsage, totalRamMb, usedRamMb, ramUsagePercent, diskTotals, temp };
  }, [snapshots]);

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={() => loadSnapshots("refresh")}
      tintColor={colorScheme === "dark" ? "#E8EBF0" : "#0F172A"}
      progressBackgroundColor={colorScheme === "dark" ? "#0E1524" : "#E2E8F0"}
    />
  );

  const renderStatCard = (
    title: string,
    value: string,
    icon: React.ComponentType<any>,
    description?: string
  ) => (
    <Box className="flex-1 min-w-[180px] rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
      <HStack className="items-center justify-between mb-3">
        <Text className="text-xs font-semibold uppercase text-typography-500 dark:text-typography-300 tracking-[0.08em]">
          {title}
        </Text>
        <Box className="w-9 h-9 rounded-xl bg-primary-50/70 dark:bg-[#12213A] items-center justify-center shrink-0">
          <Icon
            as={icon}
            size={20}
            strokeWidth={1.5}
            className="text-[#2DD4BF] opacity-80 dark:text-[#5EEAD4] dark:opacity-80 flex-none"
          />
        </Box>
      </HStack>
      <Heading size="xl" className="text-typography-900 dark:text-[#E8EBF0]" style={{ fontFamily: "Inter_700Bold" }}>
        {value}
      </Heading>
      {description ? (
        <Text className="text-sm text-typography-600 dark:text-typography-400 mt-1">{description}</Text>
      ) : null}
    </Box>
  );

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-7xl web:mx-auto web:w-full">
          <VStack className="gap-2 mb-6">
            <Heading
              size="2xl"
              className="text-typography-900 dark:text-[#E8EBF0] web:text-4xl"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              Cluster Dashboard
            </Heading>
            <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
              Overview of all nodes with CPU, RAM, disk, and recent activity. Tap "View details" to open per-machine charts.
            </Text>
            {error ? (
              <Box className="mt-2 p-3 rounded-xl border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/30">
                <Text className="text-error-700 dark:text-error-200 text-sm">{error}</Text>
              </Box>
            ) : null}
          </VStack>

          <HStack className="gap-4 flex-wrap">
            {renderStatCard(
              "Total cores",
              overallTotals.totalCores ? `${overallTotals.totalCores}` : "—",
              Cpu,
              `Avg usage ${formatPercent(overallTotals.avgCpuUsage)}`
            )}
            {renderStatCard(
              "Memory",
              overallTotals.totalRamMb
                ? `${bytesToGb(overallTotals.usedRamMb * 1024 ** 2)} / ${bytesToGb(overallTotals.totalRamMb * 1024 ** 2)} GB`
                : "—",
              MemoryStick,
              overallTotals.totalRamMb ? `${formatPercent(overallTotals.ramUsagePercent)} in use` : undefined
            )}
            {renderStatCard(
              "Temperatures",
              overallTotals.temp ? `${overallTotals.temp.toFixed(1)}ºC` : "—",
              ThermometerSun,
              "Average of core sensors"
            )}
          </HStack>

          <Box className="mt-4 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
            <HStack className="items-center justify-between mb-4">
              <HStack className="items-center gap-3">
                <Box className="w-10 h-10 rounded-xl bg-primary-50/70 dark:bg-[#12213A] items-center justify-center">
                  <Icon as={HardDrive} size="md" className="text-[#2DD4BF] opacity-80 dark:text-[#5EEAD4] dark:opacity-80" />
                </Box>
                <VStack className="gap-1">
                  <Text className="text-xs font-semibold uppercase text-typography-500 dark:text-typography-300 tracking-[0.08em]">
                    Total disk
                  </Text>
                  <Text className="text-sm text-typography-600 dark:text-typography-400">
                    Uses the same NFS calculation to sum mounts of each node.
                  </Text>
                </VStack>
              </HStack>
              <Button
                size="sm"
                variant="outline"
                action="default"
                className="rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
                onPress={() => loadSnapshots("refresh")}
                isDisabled={isLoading || isRefreshing}
              >
                <ButtonIcon as={RefreshCcw} />
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Update</ButtonText>
              </Button>
            </HStack>
            <HStack className="gap-4 items-center flex-wrap">
              <MountUsageGauge
                usagePercent={overallTotals.diskTotals.total ? (overallTotals.diskTotals.used / overallTotals.diskTotals.total) * 100 : 0}
                usedGB={bytesToGb(overallTotals.diskTotals.used)}
                totalGB={bytesToGb(overallTotals.diskTotals.total)}
                freeGB={bytesToGb(overallTotals.diskTotals.total - overallTotals.diskTotals.used)}
              />
              <VStack className="gap-2 flex-1 min-w-[220px]">
                <Text className="text-sm text-typography-600 dark:text-typography-400">
                  {overallTotals.diskTotals.total
                    ? `${formatGbCompact(overallTotals.diskTotals.used)} used of ${formatGbCompact(overallTotals.diskTotals.total)}`
                    : "Sem dados de disco ainda."}
                </Text>
                <Box className="h-2 rounded-full bg-background-100 dark:bg-[#132032] overflow-hidden">
                  <Box
                    className="h-2 rounded-full bg-primary-500"
                    style={{ width: `${overallTotals.diskTotals.total ? (overallTotals.diskTotals.used / overallTotals.diskTotals.total) * 100 : 0}%` }}
                  />
                </Box>
              </VStack>
            </HStack>
          </Box>

          <Box className="mt-8">
            <HStack className="items-center justify-between mb-3">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                Connected nodes
              </Heading>
              <Badge size="md" variant="solid" action="muted" className="rounded-full px-3">
                <BadgeText className="text-sm text-typography-800 dark:text-typography-100">
                  {machines.length} online
                </BadgeText>
              </Badge>
            </HStack>

            <VStack className="gap-4">
              {snapshots.map((snap) => {
                const diskTotals = computeDiskTotals(snap.disk);
                const diskUsage = diskTotals.total ? (diskTotals.used / diskTotals.total) * 100 : 0;
                const avgCpu = averageCpuUsage(snap.cpu);
                const ramPercent = snap.mem?.usedPercent ?? 0;
                const lastSeen = (snap.machine as any).LastSeen;
                const entryTime = (snap.machine as any).EntryTime;
                const addr = (snap.machine as any).Addr ?? "";

                return (
                  <Box
                    key={snap.machine.MachineName}
                    className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4"
                  >
                    <HStack className="items-start justify-between gap-3">
                      <HStack className="items-start gap-3 flex-1">
                        <Box className="w-11 h-11 rounded-xl bg-primary-50/70 dark:bg-[#12213A] items-center justify-center">
                          <Icon as={Server} size="md" className="text-[#2DD4BF] opacity-80 dark:text-[#5EEAD4] dark:opacity-80" />
                        </Box>
                        <VStack className="gap-1 flex-1">
                          <HStack className="items-center gap-2 flex-wrap">
                            <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">
                              {snap.machine.MachineName}
                            </Text>
                            <Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
                              <BadgeText className="text-xs text-typography-600 dark:text-typography-300">
                                {formatRelative(lastSeen)} online
                              </BadgeText>
                            </Badge>
                          </HStack>
                          <HStack className="items-center gap-2">
                            <Icon as={LinkIcon} size="sm" className="text-typography-500 dark:text-typography-400" />
                            <Text className="text-sm text-typography-600 dark:text-typography-400">{addr || "—"}</Text>
                          </HStack>
                          <HStack className="items-center gap-2">
                            <Icon as={Clock3} size="sm" className="text-typography-500 dark:text-typography-400" />
                            <Text className="text-sm text-typography-600 dark:text-typography-400">
                              Uptime: {parseUptime(snap.uptime?.uptime)} • Since {formatRelative(entryTime)}
                            </Text>
                          </HStack>
                        </VStack>
                      </HStack>
                      <Button
                        size="sm"
                        variant="outline"
                        action="default"
                        className="rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
                        onPress={() => router.push(`/dashboard/${encodeURIComponent(snap.machine.MachineName)}` as any)}
                      >
                        <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">View details</ButtonText>
                      </Button>
                    </HStack>

                    <HStack className="mt-4 gap-3 flex-wrap">
                      <Box className="flex-1 min-w-[160px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
                        <HStack className="items-center justify-between mb-2">
                          <Text className="text-xs text-typography-600 dark:text-typography-400 uppercase font-semibold tracking-[0.08em]">CPU</Text>
                          <Icon as={Activity} size="sm" className="text-[#2DD4BF] opacity-80 dark:text-[#5EEAD4] dark:opacity-80" />
                        </HStack>
                        <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">{formatPercent(avgCpu)}</Text>
                        <Text className="text-xs text-typography-500 dark:text-typography-400">{snap.cpu?.cores?.length ?? 0} cores</Text>
                      </Box>

                      <Box className="flex-1 min-w-[160px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
                        <HStack className="items-center justify-between mb-2">
                          <Text className="text-xs text-typography-600 dark:text-typography-400 uppercase font-semibold tracking-[0.08em]">RAM</Text>
                          <Icon as={MemoryStick} size="sm" className="text-[#2DD4BF] opacity-80 dark:text-[#5EEAD4] dark:opacity-80" />
                        </HStack>
                        <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">{formatPercent(ramPercent)}</Text>
                        <Text className="text-xs text-typography-500 dark:text-typography-400">
                          {bytesToGb((snap.mem?.usedMb ?? 0) * 1024 ** 2)} / {bytesToGb((snap.mem?.totalMb ?? 0) * 1024 ** 2)} GB
                        </Text>
                      </Box>

                      <Box className="flex-1 min-w-[160px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
                        <HStack className="items-center justify-between mb-2">
                          <Text className="text-xs text-typography-600 dark:text-typography-400 uppercase font-semibold tracking-[0.08em]">Disk</Text>
                          <Icon as={HardDrive} size="sm" className="text-[#2DD4BF] opacity-80 dark:text-[#5EEAD4] dark:opacity-80" />
                        </HStack>
                        <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">{formatPercent(diskUsage)}</Text>
                        <Text className="text-xs text-typography-500 dark:text-typography-400">
                          {formatGbCompact(diskTotals.used)} / {formatGbCompact(diskTotals.total)}
                        </Text>
                      </Box>

                      <Box className="flex-1 min-w-[160px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
                        <HStack className="items-center justify-between mb-2">
                          <Text className="text-xs text-typography-600 dark:text-typography-400 uppercase font-semibold tracking-[0.08em]">Temp</Text>
                          <Icon as={ThermometerSun} size="sm" className="text-[#2DD4BF] opacity-80 dark:text-[#5EEAD4] dark:opacity-80" />
                        </HStack>
                        <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">
                          {averageCpuTemp(snap.cpu) ? `${averageCpuTemp(snap.cpu).toFixed(1)}ºC avg / ${maxCpuTemp(snap.cpu).toFixed(1)}ºC max` : "—"}
                        </Text>
                        <Text className="text-xs text-typography-500 dark:text-typography-400">Average and max of core sensors</Text>
                      </Box>
                    </HStack>
                  </Box>
                );
              })}

              {!snapshots.length && !isLoading ? (
                <Box className="rounded-2xl border border-dashed border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-6">
                  <Text className="text-typography-600 dark:text-typography-400">
                    No nodes found. Add machines and pull to refresh.
                  </Text>
                </Box>
              ) : null}
            </VStack>
          </Box>
        </Box>
      </ScrollView>
    </Box>
  );
}
