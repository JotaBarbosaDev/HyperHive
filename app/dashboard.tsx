import React from "react";
import { RefreshControl, ScrollView, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Toast, ToastTitle, useToast } from "@/components/ui/toast";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMachines } from "@/hooks/useMachines";
import { useSelectedMachine } from "@/hooks/useSelectedMachine";
import {
  applyTunedAdmProfile,
  getCpuInfo,
  getDiskInfo,
  getMachineUptime,
  getMemInfo,
  getTunedAdmProfiles,
  restartMachine,
  shutdownMachine,
  TunedAdmProfile,
  TunedAdmProfilesResponse,
} from "@/services/hyperhive";
import { CpuInfo, DiskInfo, MemInfo, UptimeInfo } from "@/types/metrics";
import { Machine } from "@/types/machine";
import { MountUsageGauge } from "@/components/mount/MountUsageGauge";
import {
  Activity,
  ChevronRight,
  Clock3,
  Cpu,
  HardDrive,
  Link as LinkIcon,
  MemoryStick,
  Power,
  RefreshCcw,
  RotateCcw,
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

type MachineCpuProfileState = {
  profiles: TunedAdmProfile[];
  currentActiveProfile: string;
  error: string | null;
};

type PendingCpuProfileSelection = {
  machineName: string;
  profile: TunedAdmProfile;
};

const ICON_SIZE_SM = "sm";
const ICON_SIZE_MD = "md";

const resolveActiveCpuProfileName = (
  payload?: Pick<TunedAdmProfilesResponse, "profiles" | "currentActiveProfile"> | null
) => {
  if (!payload) return "";
  const fromField = typeof payload.currentActiveProfile === "string"
    ? payload.currentActiveProfile.trim()
    : "";
  if (fromField) return fromField;
  const active = (payload.profiles ?? []).find((profile) => profile?.active)?.name;
  return typeof active === "string" ? active : "";
};

const normalizeCpuProfilesPayload = (
  payload: TunedAdmProfilesResponse
): Pick<MachineCpuProfileState, "profiles" | "currentActiveProfile"> => {
  const activeProfileName = resolveActiveCpuProfileName(payload);
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
  return {
    profiles: profiles.map((profile) => ({
      ...profile,
      active: activeProfileName ? profile.name === activeProfileName : Boolean(profile.active),
    })),
    currentActiveProfile: activeProfileName,
  };
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

const mbToGb = (value?: number) => {
  if (value == null || !Number.isFinite(value)) return 0;
  return Number((value / 1000).toFixed(2));
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

const IGNORED_DISK_FS_TYPES = new Set([
  "autofs",
  "binfmt_misc",
  "cgroup",
  "cgroup2",
  "configfs",
  "debugfs",
  "devpts",
  "devtmpfs",
  "efivarfs",
  "fusectl",
  "hugetlbfs",
  "mqueue",
  "nsfs",
  "overlay",
  "proc",
  "pstore",
  "ramfs",
  "rpc_pipefs",
  "securityfs",
  "selinuxfs",
  "squashfs",
  "sysfs",
  "tmpfs",
  "tracefs",
]);

const shouldIncludeDiskInTotals = (item: NonNullable<DiskInfo["disks"]>[number]) => {
  const fstype = String(item.fstype ?? "").trim().toLowerCase();
  const device = String(item.device ?? "").trim().toLowerCase();
  const mountPoint = String(item.mountPoint ?? "").trim().toLowerCase();

  if (!fstype || IGNORED_DISK_FS_TYPES.has(fstype)) return false;

  if (
    device.startsWith("/dev/loop") ||
    device.startsWith("/dev/zram") ||
    device === "tmpfs" ||
    device === "devtmpfs" ||
    device === "overlay" ||
    device === "udev"
  ) {
    return false;
  }

  if (
    mountPoint === "/proc" ||
    mountPoint === "/sys" ||
    mountPoint.startsWith("/proc/") ||
    mountPoint.startsWith("/sys/")
  ) {
    return false;
  }

  return true;
};

const computeDiskTotals = (disk?: DiskInfo | null) => {
  if (!disk?.disks?.length) {
    return { total: 0, used: 0 };
  }
  const seenCapacityKeys = new Set<string>();
  let totalSum = 0;
  let usedSum = 0;

  for (const item of disk.disks) {
    if (!shouldIncludeDiskInTotals(item)) {
      continue;
    }

    const total = Number(item.total ?? 0);
    const free = Number(item.free ?? 0);
    const usedFromField = Number(item.used ?? 0);

    if (!Number.isFinite(total) || total <= 0) {
      continue;
    }

    const sourceKey = String(item.device ?? "").trim() || String(item.mountPoint ?? "").trim();
    const dedupeKey = `${sourceKey}|${String(item.fstype ?? "").trim()}|${Math.round(total)}`;
    if (sourceKey && seenCapacityKeys.has(dedupeKey)) {
      continue;
    }
    if (sourceKey) {
      seenCapacityKeys.add(dedupeKey);
    }

    const usedFromMath =
      Number.isFinite(free) && free >= 0 && free <= total
        ? total - free
        : NaN;
    const rawUsed = Number.isFinite(usedFromMath) ? usedFromMath : usedFromField;
    const used = Number.isFinite(rawUsed) ? Math.min(total, Math.max(0, rawUsed)) : 0;

    totalSum += total;
    usedSum += used;
  }

  return { total: totalSum, used: usedSum };
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
  const toast = useToast();
  const { token, isChecking } = useAuthGuard();
  const { machines, isLoading: isLoadingMachines } = useMachines(token);
  const { selectedMachine, setSelectedMachine } = useSelectedMachine();
  const sortedMachines = React.useMemo(
    () =>
      [...machines].sort((a, b) =>
        a.MachineName.localeCompare(b.MachineName, undefined, {
          sensitivity: "base",
          numeric: true,
        })
      ),
    [machines]
  );
  const [snapshots, setSnapshots] = React.useState<MachineSnapshot[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cpuProfilesByMachine, setCpuProfilesByMachine] = React.useState<
    Record<string, MachineCpuProfileState>
  >({});
  const [cpuProfilesLoadingByMachine, setCpuProfilesLoadingByMachine] = React.useState<
    Record<string, boolean>
  >({});
  const [cpuProfilesApplyingByMachine, setCpuProfilesApplyingByMachine] = React.useState<
    Record<string, boolean>
  >({});
  const [cpuProfilePickerMachineName, setCpuProfilePickerMachineName] = React.useState<string | null>(null);
  const [pendingCpuProfileSelection, setPendingCpuProfileSelection] =
    React.useState<PendingCpuProfileSelection | null>(null);
  const [pendingPowerAction, setPendingPowerAction] = React.useState<{
    machineName: string;
    action: "restart" | "shutdown";
  } | null>(null);
  const [pendingPowerNow, setPendingPowerNow] = React.useState<boolean | null>(null);
  const [showPowerNowPrompt, setShowPowerNowPrompt] = React.useState(false);
  const [showPowerConfirmPrompt, setShowPowerConfirmPrompt] = React.useState(false);
  const [powerActioning, setPowerActioning] = React.useState<{
    machineName: string;
    action: "restart" | "shutdown";
  } | null>(null);

  React.useEffect(() => {
    if (!selectedMachine && sortedMachines.length > 0) {
      setSelectedMachine(sortedMachines[0].MachineName);
    }
  }, [sortedMachines, selectedMachine, setSelectedMachine]);

  const loadSnapshots = React.useCallback(
    async (mode: "initial" | "refresh" = "initial", showLoading: boolean = true) => {
      if (!sortedMachines.length) {
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
        const snapshotPromises = sortedMachines.map((machine) =>
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
        const message = err instanceof Error ? err.message : "Unable to load the dashboard.";
        if (showLoading) {
          setError(message);
        }
      } finally {
        if (showLoading) {
          isRefresh ? setIsRefreshing(false) : setIsLoading(false);
        }
      }
    },
    [sortedMachines]
  );

  const loadCpuProfiles = React.useCallback(async (machineNames: string[]) => {
    if (!machineNames.length) {
      setCpuProfilesByMachine({});
      setCpuProfilesLoadingByMachine({});
      setCpuProfilesApplyingByMachine({});
      return;
    }

    console.log("[dashboard][tunedadm] loading profiles for machines:", machineNames);

    const allowedMachines = new Set(machineNames);
    setCpuProfilesLoadingByMachine((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (!allowedMachines.has(key)) {
          delete next[key];
        }
      }
      for (const machineName of machineNames) {
        next[machineName] = true;
      }
      return next;
    });

    const results = await Promise.all(
      machineNames.map(async (machineName) => {
        try {
          console.log(`[dashboard][tunedadm] GET start -> ${machineName}`);
          const response = await getTunedAdmProfiles(machineName);
          console.log(`[dashboard][tunedadm] GET response <- ${machineName}`, response);
          const normalized = normalizeCpuProfilesPayload(response);
          console.log(`[dashboard][tunedadm] normalized <- ${machineName}`, normalized);
          return {
            machineName,
            state: {
              profiles: normalized.profiles,
              currentActiveProfile: normalized.currentActiveProfile,
              error: null,
            } as MachineCpuProfileState,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unable to load CPU profiles.";
          console.log(`[dashboard][tunedadm] GET error <- ${machineName}`, err);
          return {
            machineName,
            state: {
              profiles: [],
              currentActiveProfile: "",
              error: message,
            } as MachineCpuProfileState,
          };
        }
      })
    );

    setCpuProfilesByMachine(() => {
      const next: Record<string, MachineCpuProfileState> = {};
      for (const result of results) {
        next[result.machineName] = result.state;
      }
      console.log("[dashboard][tunedadm] state snapshot (all machines):", next);
      return next;
    });

    setCpuProfilesLoadingByMachine((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (!allowedMachines.has(key)) {
          delete next[key];
        }
      }
      for (const machineName of machineNames) {
        next[machineName] = false;
      }
      return next;
    });
  }, []);

  const refreshDashboardData = React.useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const machineNames = sortedMachines.map((machine) => machine.MachineName);
      await Promise.all([loadSnapshots(mode), loadCpuProfiles(machineNames)]);
    },
    [loadSnapshots, loadCpuProfiles, sortedMachines]
  );

  React.useEffect(() => {
    if (!isChecking && !isLoadingMachines) {
      refreshDashboardData("initial");
    }
  }, [isChecking, isLoadingMachines, refreshDashboardData]);

  // Soft update a cada 5 segundos
  React.useEffect(() => {
    if (!isChecking && !isLoadingMachines && sortedMachines.length > 0) {
      const interval = setInterval(() => {
        loadSnapshots("refresh", false);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isChecking, isLoadingMachines, sortedMachines.length, loadSnapshots]);

  const overallTotals = React.useMemo(() => {
    const cpuSnapshots = snapshots.filter((snap) => (snap.cpu?.cores?.length ?? 0) > 0);
    const tempSnapshots = snapshots.filter((snap) =>
      (snap.cpu?.cores ?? []).some((core) => {
        const temp = Number(core.temp);
        return Number.isFinite(temp);
      })
    );
    const totalCores = snapshots.reduce((acc, snap) => acc + (snap.cpu?.cores?.length ?? 0), 0);
    const totalCpuUsage = cpuSnapshots.reduce((acc, snap) => acc + averageCpuUsage(snap.cpu), 0);
    const avgCpuUsage = cpuSnapshots.length ? totalCpuUsage / cpuSnapshots.length : 0;

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

    const avgTemp = tempSnapshots.reduce((acc, snap) => acc + averageCpuTemp(snap.cpu), 0);
    const temp = tempSnapshots.length ? avgTemp / tempSnapshots.length : 0;

    return { totalCores, avgCpuUsage, totalRamMb, usedRamMb, ramUsagePercent, diskTotals, temp };
  }, [snapshots]);

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={() => refreshDashboardData("refresh")}
      tintColor={colorScheme === "dark" ? "#E8EBF0" : "#0F172A"}
      progressBackgroundColor={colorScheme === "dark" ? "#0E1524" : "#E2E8F0"}
    />
  );

  const showPowerToast = React.useCallback(
    (message: string, action: "success" | "error") => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action={action}
          >
            <ToastTitle size="sm">{message}</ToastTitle>
          </Toast>
        ),
      });
    },
    [toast]
  );

  const handleCpuProfileChange = React.useCallback(
    async (machineName: string, nextProfileName: string) => {
      const profileName = nextProfileName?.trim?.() ?? "";
      if (!profileName) {
        console.log("[dashboard][tunedadm] ignored empty profile change", {
          machineName,
          nextProfileName,
        });
        return;
      }

      const currentState = cpuProfilesByMachine[machineName];
      const currentProfileName =
        currentState?.currentActiveProfile || resolveActiveCpuProfileName(currentState);

      console.log("[dashboard][tunedadm] profile change requested", {
        machineName,
        nextProfileName: profileName,
        currentProfileName,
        currentState,
        isApplying: Boolean(cpuProfilesApplyingByMachine[machineName]),
      });

      if (profileName === currentProfileName || cpuProfilesApplyingByMachine[machineName]) {
        console.log("[dashboard][tunedadm] profile change skipped", {
          machineName,
          profileName,
          reason:
            profileName === currentProfileName ? "same_profile" : "already_applying",
        });
        return;
      }

      setCpuProfilesApplyingByMachine((prev) => ({
        ...prev,
        [machineName]: true,
      }));

      try {
        const response = await applyTunedAdmProfile(machineName, profileName);
        console.log(`[dashboard][tunedadm] POST response <- ${machineName}`, response);
        const appliedProfileName =
          (typeof response.currentActiveProfile === "string"
            ? response.currentActiveProfile.trim()
            : "") || profileName;

        setCpuProfilesByMachine((prev) => {
          const previous = prev[machineName];
          const previousProfiles = previous?.profiles ?? [];
          const profiles = previousProfiles.map((profile) => ({
            ...profile,
            active: profile.name === appliedProfileName,
          }));

          return {
            ...prev,
            [machineName]: {
              profiles,
              currentActiveProfile: appliedProfileName,
              error: null,
            },
          };
        });

        showPowerToast(`CPU profile applied on ${machineName}: ${appliedProfileName}`, "success");
      } catch (err) {
        console.log(`[dashboard][tunedadm] POST error <- ${machineName}`, err);
        const message = err instanceof Error ? err.message : "Unable to apply CPU profile.";
        showPowerToast(message, "error");
      } finally {
        setCpuProfilesApplyingByMachine((prev) => ({
          ...prev,
          [machineName]: false,
        }));
      }
    },
    [cpuProfilesApplyingByMachine, cpuProfilesByMachine, showPowerToast]
  );

  React.useEffect(() => {
    if (!Object.keys(cpuProfilesByMachine).length) return;
    console.log("[dashboard][tunedadm] descriptions by machine", cpuProfilesByMachine);
  }, [cpuProfilesByMachine]);

  const cpuProfilePickerState = cpuProfilePickerMachineName
    ? cpuProfilesByMachine[cpuProfilePickerMachineName]
    : null;
  const cpuProfilePickerProfiles = cpuProfilePickerState?.profiles ?? [];
  const cpuProfilePickerCurrentActive =
    cpuProfilePickerState?.currentActiveProfile ||
    resolveActiveCpuProfileName(cpuProfilePickerState);
  const isCpuProfilePickerLoading = cpuProfilePickerMachineName
    ? Boolean(cpuProfilesLoadingByMachine[cpuProfilePickerMachineName])
    : false;
  const isCpuProfilePickerApplying = cpuProfilePickerMachineName
    ? Boolean(cpuProfilesApplyingByMachine[cpuProfilePickerMachineName])
    : false;
  const pendingCpuProfileIsApplying = pendingCpuProfileSelection
    ? Boolean(cpuProfilesApplyingByMachine[pendingCpuProfileSelection.machineName])
    : false;
  const pendingCpuProfileCurrentActive = pendingCpuProfileSelection
    ? cpuProfilesByMachine[pendingCpuProfileSelection.machineName]?.currentActiveProfile ||
      resolveActiveCpuProfileName(cpuProfilesByMachine[pendingCpuProfileSelection.machineName])
    : "";

  const openCpuProfilePicker = React.useCallback(
    (machineName: string) => {
      console.log("[dashboard][tunedadm] open profile picker", {
        machineName,
        hasState: Boolean(cpuProfilesByMachine[machineName]),
      });
      setCpuProfilePickerMachineName(machineName);
      if (!cpuProfilesByMachine[machineName] && !cpuProfilesLoadingByMachine[machineName]) {
        void loadCpuProfiles([machineName]);
      }
    },
    [cpuProfilesByMachine, cpuProfilesLoadingByMachine, loadCpuProfiles]
  );

  const closeCpuProfilePicker = React.useCallback(() => {
    console.log("[dashboard][tunedadm] close profile picker", {
      machineName: cpuProfilePickerMachineName,
    });
    setCpuProfilePickerMachineName(null);
  }, [cpuProfilePickerMachineName]);

  const closeCpuProfileConfirmPrompt = React.useCallback(() => {
    console.log("[dashboard][tunedadm] close profile confirm", pendingCpuProfileSelection);
    setPendingCpuProfileSelection(null);
  }, [pendingCpuProfileSelection]);

  const handleSelectCpuProfileCandidate = React.useCallback(
    (machineName: string, profile: TunedAdmProfile) => {
      console.log("[dashboard][tunedadm] picker selection", {
        machineName,
        profile,
      });
      setCpuProfilePickerMachineName(null);
      setPendingCpuProfileSelection({ machineName, profile });
    },
    []
  );

  const handleConfirmCpuProfileSelection = React.useCallback(async () => {
    if (!pendingCpuProfileSelection) {
      return;
    }

    console.log("[dashboard][tunedadm] confirm profile apply", pendingCpuProfileSelection);
    await handleCpuProfileChange(
      pendingCpuProfileSelection.machineName,
      pendingCpuProfileSelection.profile.name
    );
    setPendingCpuProfileSelection(null);
  }, [handleCpuProfileChange, pendingCpuProfileSelection]);

  const openPowerPrompt = (machineName: string, action: "restart" | "shutdown") => {
    if (powerActioning) {
      return;
    }
    setPendingPowerAction({ machineName, action });
    setPendingPowerNow(null);
    setShowPowerConfirmPrompt(false);
    setShowPowerNowPrompt(true);
  };

  const closePowerNowPrompt = () => {
    setShowPowerNowPrompt(false);
    setPendingPowerAction(null);
    setPendingPowerNow(null);
  };

  const handlePowerNowChoice = (now: boolean) => {
    setPendingPowerNow(now);
    setShowPowerNowPrompt(false);
    setShowPowerConfirmPrompt(true);
  };

  const closePowerConfirmPrompt = () => {
    setShowPowerConfirmPrompt(false);
    setPendingPowerAction(null);
    setPendingPowerNow(null);
  };

  const handleConfirmPowerAction = async () => {
    if (!pendingPowerAction || pendingPowerNow === null) {
      return;
    }
    const { machineName, action } = pendingPowerAction;
    setShowPowerConfirmPrompt(false);
    setPowerActioning({ machineName, action });
    try {
      if (action === "restart") {
        await restartMachine(machineName, pendingPowerNow);
      } else {
        await shutdownMachine(machineName, pendingPowerNow);
      }
      showPowerToast(
        action === "restart" ? "Restart request sent" : "Shutdown request sent",
        "success"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : `Unable to ${action} machine.`;
      showPowerToast(message, "error");
    } finally {
      setPowerActioning(null);
      setPendingPowerAction(null);
      setPendingPowerNow(null);
    }
  };

  const renderStatCard = (
    title: string,
    value: string,
    icon: React.ComponentType<any>,
    description?: string,
  ) => (
    <Box className="flex-1 min-w-[180px] rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
      <HStack className="items-center justify-between mb-3">
        <Text className="text-xs font-semibold uppercase text-typography-500 dark:text-[#5EEAD4] tracking-[0.08em]">
          {title}
        </Text>
        <Box className="w-9 h-9 rounded-xl bg-primary-50/70 dark:bg-[#12213A] items-center justify-center shrink-0">
          <Icon
            as={(props) =>
              React.createElement(icon, { ...props, strokeWidth: 1.5 })
            }
            size={ICON_SIZE_MD}
            className="text-outline-950 opacity-80 dark:text-[#5EEAD4] dark:opacity-80 flex-none"
          />
        </Box>
      </HStack>
      <Heading
        size="xl"
        className="text-typography-900 dark:text-[#E8EBF0]"
        style={{ fontFamily: "Inter_700Bold" }}
      >
        {value}
      </Heading>
      {description ? (
        <Text className="text-sm text-typography-600 dark:text-[#8A94A8] mt-1">
          {description}
        </Text>
      ) : null}
    </Box>
  );

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Box className="p-4 pt-16 web:p-20 web:max-w-7xl web:mx-auto web:w-full">
          <VStack className="gap-2 mb-6">
            <Heading
              size="2xl"
              className="text-typography-900 dark:text-[#E8EBF0] web:text-4xl"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              Cluster Dashboard
            </Heading>
            <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
              Real-time monitoring of your cluster infrastructure. View CPU, memory, disk usage, and system health across all connected nodes.
            </Text>
            {error ? (
              <Box className="mt-2 p-3 rounded-xl border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/30">
                <Text className="text-error-700 dark:text-error-200 text-sm">
                  {error}
                </Text>
              </Box>
            ) : null}
          </VStack>

          <HStack className="gap-4 flex-wrap">
            {renderStatCard(
              "Total cores",
              overallTotals.totalCores ? `${overallTotals.totalCores}` : "—",
              Cpu,
              `Avg usage ${formatPercent(overallTotals.avgCpuUsage)}`,
            )}
            {renderStatCard(
              "Memory",
              overallTotals.totalRamMb
                ? `${mbToGb(overallTotals.usedRamMb)} / ${mbToGb(overallTotals.totalRamMb)} GB`
                : "—",
              MemoryStick,
              overallTotals.totalRamMb
                ? `${formatPercent(overallTotals.ramUsagePercent)} in use`
                : undefined,
            )}
            {renderStatCard(
              "Temperatures",
              overallTotals.temp ? `${overallTotals.temp.toFixed(1)}ºC` : "—",
              ThermometerSun,
              "Average of core sensors",
            )}
          </HStack>

          <Box className="mt-4 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
            <HStack className="items-center justify-between mb-4">
              <HStack className="items-center gap-3">
                <Box className="w-10 h-10 rounded-xl bg-primary-50/70 dark:bg-[#12213A] items-center justify-center">
                  <Icon
                    as={HardDrive}
                    size={ICON_SIZE_MD}
                    className="text-outline-950 opacity-80 dark:text-[#5EEAD4] dark:opacity-80"
                  />
                </Box>
                <VStack className="gap-1">
                  <Text className="text-xs font-semibold uppercase text-typography-500 dark:text-[#5EEAD4] tracking-[0.08em]">
                    Total disk
                  </Text>
                  <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                    Uses the same NFS calculation to sum mounts of each node.
                  </Text>
                </VStack>
              </HStack>
              <Button
                size="sm"
                variant="outline"
                action="default"
                className="rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
                onPress={() => refreshDashboardData("refresh")}
                isDisabled={isLoading || isRefreshing}
              >
                <ButtonIcon
                  as={RefreshCcw}
                  className="text-typography-900 dark:text-[#E8EBF0]"
                />
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                  Update
                </ButtonText>
              </Button>
            </HStack>
            <HStack className="gap-4 items-center flex-wrap">
              <MountUsageGauge
                usagePercent={
                  overallTotals.diskTotals.total
                    ? (overallTotals.diskTotals.used /
                      overallTotals.diskTotals.total) *
                    100
                    : 0
                }
                usedGB={bytesToGb(overallTotals.diskTotals.used)}
                totalGB={bytesToGb(overallTotals.diskTotals.total)}
                freeGB={bytesToGb(
                  overallTotals.diskTotals.total -
                  overallTotals.diskTotals.used,
                )}
              />
              <VStack className="gap-2 flex-1 min-w-[220px]">
                <Text className="text-sm text-typography-600 dark:text-typography-950">
                  {overallTotals.diskTotals.total
                    ? `${formatGbCompact(overallTotals.diskTotals.used)} used of ${formatGbCompact(overallTotals.diskTotals.total)}`
                    : "No disk data yet."}
                </Text>
                <Box className="h-2 rounded-full bg-background-100 dark:bg-[#132032] overflow-hidden">
                  <Box
                    className="h-2 rounded-full bg-[#5EEAD4]"
                    style={{
                      width: `${overallTotals.diskTotals.total ? (overallTotals.diskTotals.used / overallTotals.diskTotals.total) * 100 : 0}%`,
                    }}
                  />
                </Box>
              </VStack>
            </HStack>
          </Box>

          <Box className="mt-8">
            <HStack className="items-center justify-between mb-3">
              <Heading
                size="lg"
                className="text-typography-900 dark:text-[#E8EBF0]"
              >
                Connected nodes
              </Heading>
              <Badge
                size="md"
                variant="solid"
                action="muted"
                className="rounded-full px-3 bg-background-100 dark:bg-[#1A2436] border border-outline-200 dark:border-[#243247]"
              >
                <BadgeText className="text-sm text-typography-700 dark:text-typography-950">
                  {machines.length} online
                </BadgeText>
              </Badge>
            </HStack>

            <VStack className="gap-4">
              {snapshots.map((snap) => {
                const diskTotals = computeDiskTotals(snap.disk);
                const diskUsage = diskTotals.total
                  ? (diskTotals.used / diskTotals.total) * 100
                  : 0;
                const avgCpu = averageCpuUsage(snap.cpu);
                const ramPercent = snap.mem?.usedPercent ?? 0;
                const lastSeen = (snap.machine as any).LastSeen;
                const entryTime = (snap.machine as any).EntryTime;
                const addr = (snap.machine as any).Addr ?? "";
                const isPowerActioning =
                  powerActioning?.machineName === snap.machine.MachineName;
                const machineName = snap.machine.MachineName;
                const cpuProfileState = cpuProfilesByMachine[machineName];
                const cpuProfiles = cpuProfileState?.profiles ?? [];
                const currentCpuProfileName =
                  cpuProfileState?.currentActiveProfile || resolveActiveCpuProfileName(cpuProfileState);
                const currentCpuProfile =
                  cpuProfiles.find((profile) => profile.name === currentCpuProfileName) ||
                  cpuProfiles.find((profile) => profile.active);
                const isCpuProfilesLoading = Boolean(cpuProfilesLoadingByMachine[machineName]);
                const isCpuProfileApplying = Boolean(cpuProfilesApplyingByMachine[machineName]);
                const cpuProfilePlaceholder =
                  isCpuProfilesLoading && !cpuProfiles.length
                    ? "Loading profiles..."
                    : cpuProfileState?.error
                      ? "Profiles unavailable"
                      : cpuProfiles.length
                        ? "Select profile"
                        : "No profiles";
                const cpuProfileHint = isCpuProfileApplying
                  ? "Applying CPU profile..."
                  : cpuProfileState?.error
                    ? "Unable to load tuned profiles for this machine."
                    : currentCpuProfile?.description ||
                      (currentCpuProfileName
                        ? `Active profile: ${currentCpuProfileName}`
                        : isCpuProfilesLoading
                          ? "Loading tuned profiles..."
                          : "No tuned profiles found.");

                return (
                  <Box
                    key={machineName}
                    className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4"
                  >
                    <HStack className="items-start justify-between gap-3">
                      <HStack className="items-start gap-3 flex-1">
                        <Box className="w-11 h-11 rounded-xl bg-primary-50/70 dark:bg-[#12213A] items-center justify-center">
                          <Icon
                            as={Server}
                            size={ICON_SIZE_MD}
                            className="text-outline-950 opacity-80 dark:text-[#5EEAD4] dark:opacity-80"
                          />
                        </Box>
                        <VStack className="gap-1 flex-1">
                          <HStack className="items-center gap-2 flex-wrap">
                            <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">
                              {snap.machine.MachineName}
                            </Text>
                            <Badge
                              size="sm"
                              variant="outline"
                              className="border-outline-300 dark:border-[#243247] bg-background-50 dark:bg-[#152136]"
                            >
                              <BadgeText className="text-xs text-typography-600 dark:text-typography-950">
                                {formatRelative(lastSeen)} online
                              </BadgeText>
                            </Badge>
                          </HStack>
                          <HStack className="items-center gap-2">
                            <Icon
                              as={LinkIcon}
                              size={ICON_SIZE_SM}
                              className="text-typography-500 dark:text-[#8A94A8]"
                            />
                            <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                              {addr || "—"}
                            </Text>
                          </HStack>
                          <HStack className="items-center gap-2">
                            <Icon
                              as={Clock3}
                              size={ICON_SIZE_SM}
                              className="text-typography-500 dark:text-[#8A94A8]"
                            />
                            <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                              Uptime: {parseUptime(snap.uptime?.uptime)} • Since{" "}
                              {formatRelative(entryTime)}
                            </Text>
                          </HStack>
                        </VStack>
                      </HStack>
                      <HStack className="items-center gap-2 flex-wrap justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          action="secondary"
                          className="rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
                          onPress={() =>
                            openPowerPrompt(snap.machine.MachineName, "restart")
                          }
                          isDisabled={isPowerActioning}
                        >
                          <ButtonIcon
                            as={RotateCcw}
                            className="text-typography-900 dark:text-[#E8EBF0]"
                          />
                          <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                            Restart
                          </ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          action="negative"
                          className="rounded-xl border-error-300 dark:border-error-700 bg-background-0 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                          onPress={() =>
                            openPowerPrompt(
                              snap.machine.MachineName,
                              "shutdown",
                            )
                          }
                          isDisabled={isPowerActioning}
                        >
                          <ButtonIcon
                            as={Power}
                            className="text-error-600 dark:text-error-700"
                          />
                          <ButtonText className="text-error-700 dark:text-error-700">
                            Shutdown
                          </ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          action="default"
                          className="rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
                          onPress={() =>
                            router.push(
                              `/dashboard/${encodeURIComponent(
                                snap.machine.MachineName,
                              )}` as any,
                            )
                          }
                        >
                          <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                            View details
                          </ButtonText>
                        </Button>
                      </HStack>
                    </HStack>

                    <HStack className="mt-4 gap-3 flex-wrap">
                      <Box className="flex-1 min-w-[220px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
                        <HStack className="items-center justify-between mb-2">
                          <Text className="text-xs text-typography-600 dark:text-[#5EEAD4] uppercase font-semibold tracking-[0.08em]">
                            CPU
                          </Text>
                          <Icon
                            as={Activity}
                            size={ICON_SIZE_SM}
                            className="text-outline-950 opacity-80 dark:text-[#5EEAD4] dark:opacity-80"
                          />
                        </HStack>
                        <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">
                          {formatPercent(avgCpu)}
                        </Text>
                        <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                          {snap.cpu?.cores?.length ?? 0} cores
                        </Text>
                        <VStack className="gap-1.5 mt-3">
                          <Text className="text-[10px] uppercase font-semibold tracking-[0.08em] text-typography-500 dark:text-[#8A94A8]">
                            CPU profile
                          </Text>
                          <Pressable
                            onPress={() => openCpuProfilePicker(machineName)}
                            disabled={isCpuProfileApplying}
                            className="rounded-lg"
                          >
                            <HStack className="min-h-10 rounded-lg border border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0A1628] px-2.5 py-2 items-center gap-2">
                              <VStack className="flex-1 gap-0.5">
                                <Text
                                  className="text-xs font-semibold text-typography-900 dark:text-[#E8EBF0]"
                                  numberOfLines={1}
                                >
                                  {currentCpuProfileName || cpuProfilePlaceholder}
                                </Text>
                                <Text
                                  className="text-[10px] text-typography-500 dark:text-[#8A94A8]"
                                  numberOfLines={1}
                                >
                                  {isCpuProfileApplying
                                    ? "Applying..."
                                    : isCpuProfilesLoading
                                      ? "Loading profiles..."
                                      : "Open profiles"}
                                </Text>
                              </VStack>
                              <Box className="h-6 w-6 rounded-md items-center justify-center bg-background-100 dark:bg-[#13243B] border border-outline-200 dark:border-[#2B466B]">
                                {isCpuProfileApplying || isCpuProfilesLoading ? (
                                  <ButtonSpinner className="text-typography-500 dark:text-[#93C5FD]" />
                                ) : (
                                  <ChevronRight
                                    size={14}
                                    className="text-typography-500 dark:text-[#93C5FD]"
                                  />
                                )}
                              </Box>
                            </HStack>
                          </Pressable>
                          <Text
                            className="text-[11px] leading-4 text-typography-500 dark:text-[#8A94A8]"
                          >
                            {cpuProfileHint}
                          </Text>
                        </VStack>
                      </Box>

                      <Box className="flex-1 min-w-[160px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
                        <HStack className="items-center justify-between mb-2">
                          <Text className="text-xs text-typography-600 dark:text-[#5EEAD4] uppercase font-semibold tracking-[0.08em]">
                            RAM
                          </Text>
                          <Icon
                            as={MemoryStick}
                            size={ICON_SIZE_SM}
                            className="text-outline-950 opacity-80 dark:text-[#5EEAD4] dark:opacity-80"
                          />
                        </HStack>
                        <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">
                          {formatPercent(ramPercent)}
                        </Text>
                        <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                          {mbToGb(snap.mem?.usedMb ?? 0)} /{" "}
                          {mbToGb(snap.mem?.totalMb ?? 0)} GB
                        </Text>
                      </Box>

                      <Box className="flex-1 min-w-[160px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
                        <HStack className="items-center justify-between mb-2">
                          <Text className="text-xs text-typography-600 dark:text-[#5EEAD4] uppercase font-semibold tracking-[0.08em]">
                            Disk
                          </Text>
                          <Icon
                            as={HardDrive}
                            size={ICON_SIZE_SM}
                            className="text-outline-950 opacity-80 dark:text-[#5EEAD4] dark:opacity-80"
                          />
                        </HStack>
                        <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">
                          {formatPercent(diskUsage)}
                        </Text>
                        <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                          {formatGbCompact(diskTotals.used)} /{" "}
                          {formatGbCompact(diskTotals.total)}
                        </Text>
                      </Box>

                      <Box className="flex-1 min-w-[160px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
                        <HStack className="items-center justify-between mb-2">
                          <Text className="text-xs text-typography-600 dark:text-[#5EEAD4] uppercase font-semibold tracking-[0.08em]">
                            Temp
                          </Text>
                          <Icon
                            as={ThermometerSun}
                            size={ICON_SIZE_SM}
                            className="text-outline-950 opacity-80 dark:text-[#5EEAD4] dark:opacity-80"
                          />
                        </HStack>
                        <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">
                          {averageCpuTemp(snap.cpu)
                            ? `${averageCpuTemp(snap.cpu).toFixed(
                              1,
                            )}ºC avg / ${maxCpuTemp(snap.cpu).toFixed(
                              1,
                            )}ºC max`
                            : "—"}
                        </Text>
                        <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                          Average and max of core sensors
                        </Text>
                      </Box>
                    </HStack>
                  </Box>
                );
              })}

              {!snapshots.length && !isLoading ? (
                <Box className="rounded-2xl border border-dashed border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-6">
                  <Text className="text-typography-600 dark:text-[#8A94A8]">
                    No nodes found. Add machines and pull to refresh.
                  </Text>
                </Box>
              ) : null}
            </VStack>
          </Box>
        </Box>
      </ScrollView>
      <Modal
        isOpen={Boolean(cpuProfilePickerMachineName)}
        onClose={closeCpuProfilePicker}
        size="lg"
      >
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-5">
          <ModalHeader className="flex-row items-center gap-3 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <Box className="h-10 w-10 rounded-2xl items-center justify-center bg-primary-500/10 dark:bg-[#0F766E]/20">
              <Activity size={18} className="text-[#0F766E] dark:text-[#5EEAD4]" />
            </Box>
            <VStack className="flex-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                CPU Profiles
              </Heading>
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                {cpuProfilePickerMachineName
                  ? `${cpuProfilePickerMachineName} • tuned-adm profiles`
                  : "Select a machine"}
              </Text>
            </VStack>
            <ModalCloseButton onPress={closeCpuProfilePicker} />
          </ModalHeader>
          <ModalBody className="pt-5">
            <VStack className="gap-3">
              <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] p-4">
                <VStack className="gap-1">
                  <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                    Active profile
                  </Text>
                  <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                    {cpuProfilePickerCurrentActive || "—"}
                  </Text>
                </VStack>
              </Box>

              {cpuProfilePickerState?.error ? (
                <Box className="rounded-xl border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/20 p-3">
                  <Text className="text-sm text-error-700 dark:text-error-200">
                    {cpuProfilePickerState.error}
                  </Text>
                </Box>
              ) : null}

              {isCpuProfilePickerLoading && !cpuProfilePickerProfiles.length ? (
                <HStack className="items-center gap-2">
                  <ButtonSpinner />
                  <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                    Loading CPU profiles...
                  </Text>
                </HStack>
              ) : null}

              {cpuProfilePickerProfiles.length ? (
                <ScrollView
                  className="max-h-[360px]"
                  showsVerticalScrollIndicator={false}
                >
                  <VStack className="gap-2 pr-1">
                    {cpuProfilePickerProfiles.map((profile) => {
                      const isActiveProfile =
                        profile.name === cpuProfilePickerCurrentActive || Boolean(profile.active);
                      const isDisabledProfile = isCpuProfilePickerApplying || isActiveProfile;

                      return (
                        <Pressable
                          key={`cpu-profile-picker-${cpuProfilePickerMachineName}-${profile.name}`}
                          onPress={() =>
                            cpuProfilePickerMachineName
                              ? handleSelectCpuProfileCandidate(cpuProfilePickerMachineName, profile)
                              : undefined
                          }
                          disabled={isDisabledProfile}
                          className="rounded-xl"
                        >
                          <Box
                            className={`rounded-xl border p-3 ${
                              isActiveProfile
                                ? "border-primary-300 dark:border-[#2B466B] bg-primary-50/60 dark:bg-[#102338]"
                                : "border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1524]"
                            }`}
                          >
                            <HStack className="items-start justify-between gap-2">
                              <VStack className="flex-1 gap-1">
                                <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                                  {profile.name}
                                </Text>
                                <Text className="text-xs leading-4 text-typography-600 dark:text-[#8A94A8]">
                                  {profile.description?.trim() || "No description provided."}
                                </Text>
                              </VStack>
                              {isActiveProfile ? (
                                <Badge
                                  size="sm"
                                  variant="outline"
                                  className="border-primary-300 dark:border-[#2B466B] bg-primary-50/70 dark:bg-[#13243B]"
                                >
                                  <BadgeText className="text-xs text-typography-700 dark:text-[#93C5FD]">
                                    Active
                                  </BadgeText>
                                </Badge>
                              ) : null}
                            </HStack>
                          </Box>
                        </Pressable>
                      );
                    })}
                  </VStack>
                </ScrollView>
              ) : !isCpuProfilePickerLoading && !cpuProfilePickerState?.error ? (
                <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                  No CPU profiles available for this machine.
                </Text>
              ) : null}

              <Text className="text-[11px] text-typography-500 dark:text-[#8A94A8]">
                Tap a profile to open confirmation before applying. The active profile is shown only for reference.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter className="flex-row gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <Button
              variant="outline"
              action="secondary"
              className="flex-1 rounded-xl"
              onPress={closeCpuProfilePicker}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                Close
              </ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal
        isOpen={Boolean(pendingCpuProfileSelection)}
        onClose={closeCpuProfileConfirmPrompt}
        size="md"
      >
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-5">
          <ModalHeader className="flex-row items-center gap-3 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <Box className="h-10 w-10 rounded-2xl items-center justify-center bg-primary-500/10 dark:bg-[#0F766E]/20">
              <Cpu size={18} className="text-[#0F766E] dark:text-[#5EEAD4]" />
            </Box>
            <VStack className="flex-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                Apply CPU Profile?
              </Heading>
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                This will run `tuned-adm` on the selected machine.
              </Text>
            </VStack>
            <ModalCloseButton onPress={closeCpuProfileConfirmPrompt} />
          </ModalHeader>
          <ModalBody className="pt-5">
            <VStack className="gap-3">
              <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] p-4">
                <VStack className="gap-3">
                  <VStack className="gap-1">
                    <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                      Machine
                    </Text>
                    <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                      {pendingCpuProfileSelection?.machineName ?? "—"}
                    </Text>
                  </VStack>
                  <VStack className="gap-1">
                    <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                      Current profile
                    </Text>
                    <Text className="text-sm text-typography-700 dark:text-[#E8EBF0]">
                      {pendingCpuProfileCurrentActive || "—"}
                    </Text>
                  </VStack>
                  <VStack className="gap-1">
                    <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                      New profile
                    </Text>
                    <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                      {pendingCpuProfileSelection?.profile.name ?? "—"}
                    </Text>
                  </VStack>
                  <VStack className="gap-1">
                    <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                      Description
                    </Text>
                    <Text className="text-sm leading-5 text-typography-700 dark:text-[#8A94A8]">
                      {pendingCpuProfileSelection?.profile.description?.trim() || "No description provided."}
                    </Text>
                  </VStack>
                </VStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter className="flex-row gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <Button
              variant="outline"
              action="secondary"
              className="flex-1 rounded-xl"
              onPress={closeCpuProfileConfirmPrompt}
              isDisabled={pendingCpuProfileIsApplying}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                Cancel
              </ButtonText>
            </Button>
            <Button
              action="primary"
              className="flex-1 rounded-xl"
              onPress={() => {
                void handleConfirmCpuProfileSelection();
              }}
              isDisabled={pendingCpuProfileIsApplying}
            >
              {pendingCpuProfileIsApplying ? <ButtonSpinner /> : null}
              <ButtonText className="text-background-0 dark:text-[#0A1628]">
                Apply
              </ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal
        isOpen={showPowerNowPrompt}
        onClose={closePowerNowPrompt}
        size="md"
      >
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-5">
          <ModalHeader className="flex-row items-center gap-3 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <Box
              className={`h-10 w-10 rounded-2xl items-center justify-center ${pendingPowerAction?.action === "shutdown"
                  ? "bg-error-500/10 dark:bg-error-900/20"
                  : "bg-primary-500/10 dark:bg-[#0F766E]/20"
                }`}
            >
              {pendingPowerAction?.action === "shutdown" ? (
                <Power
                  size={18}
                  className="text-error-600 dark:text-error-400"
                />
              ) : (
                <RotateCcw
                  size={18}
                  className="text-[#0F766E] dark:text-[#5EEAD4]"
                />
              )}
            </Box>
            <VStack className="flex-1">
              <Heading
                size="lg"
                className="text-typography-900 dark:text-[#E8EBF0]"
              >
                {pendingPowerAction?.action === "shutdown"
                  ? "Shutdown now?"
                  : "Restart now?"}
              </Heading>
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                Choose whether this action should run immediately.
              </Text>
            </VStack>
            <ModalCloseButton onPress={closePowerNowPrompt} />
          </ModalHeader>
          <ModalBody className="pt-5">
            <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] p-4">
              <VStack className="gap-2">
                <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                  Machine
                </Text>
                <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                  {pendingPowerAction?.machineName ?? "—"}
                </Text>
              </VStack>
            </Box>
          </ModalBody>
          <ModalFooter className="flex-row gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <Button
              variant="outline"
              action="secondary"
              className="flex-1 rounded-xl"
              onPress={() => handlePowerNowChoice(false)}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                Not now
              </ButtonText>
            </Button>
            <Button
              action={
                pendingPowerAction?.action === "shutdown"
                  ? "negative"
                  : "primary"
              }
              className="flex-1 rounded-xl"
              onPress={() => handlePowerNowChoice(true)}
            >
              <ButtonText className="text-background-0 dark:text-[#0A1628]">
                Now
              </ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal
        isOpen={showPowerConfirmPrompt}
        onClose={closePowerConfirmPrompt}
        size="md"
      >
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-5">
          <ModalHeader className="flex-row items-center gap-3 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <Box
              className={`h-10 w-10 rounded-2xl items-center justify-center ${pendingPowerAction?.action === "shutdown"
                  ? "bg-error-500/10 dark:bg-error-900/20"
                  : "bg-primary-500/10 dark:bg-[#0F766E]/20"
                }`}
            >
              {pendingPowerAction?.action === "shutdown" ? (
                <Power
                  size={18}
                  className="text-error-600 dark:text-error-400"
                />
              ) : (
                <RotateCcw
                  size={18}
                  className="text-[#0F766E] dark:text-[#5EEAD4]"
                />
              )}
            </Box>
            <VStack className="flex-1">
              <Heading
                size="lg"
                className="text-typography-900 dark:text-[#E8EBF0]"
              >
                {pendingPowerAction?.action === "shutdown"
                  ? "Are you sure you want to shut down?"
                  : "Are you sure you want to restart?"}
              </Heading>
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                This will send the request immediately.
              </Text>
            </VStack>
            <ModalCloseButton onPress={closePowerConfirmPrompt} />
          </ModalHeader>
          <ModalBody className="pt-5">
            <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] p-4">
              <VStack className="gap-3">
                <VStack className="gap-1">
                  <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                    Machine
                  </Text>
                  <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                    {pendingPowerAction?.machineName ?? "—"}
                  </Text>
                </VStack>
                <VStack className="gap-1">
                  <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                    Run now
                  </Text>
                  <Text className="text-sm text-typography-700 dark:text-[#8A94A8]">
                    {pendingPowerNow ? "Yes" : "No"}
                  </Text>
                </VStack>
              </VStack>
            </Box>
          </ModalBody>
          <ModalFooter className="flex-row gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <Button
              variant="outline"
              action="secondary"
              className="flex-1 rounded-xl"
              onPress={closePowerConfirmPrompt}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                Cancel
              </ButtonText>
            </Button>
            <Button
              action={
                pendingPowerAction?.action === "shutdown"
                  ? "negative"
                  : "primary"
              }
              className="flex-1 rounded-xl"
              onPress={handleConfirmPowerAction}
            >
              <ButtonText className="text-background-0 dark:text-[#0A1628]">
                {pendingPowerAction?.action === "shutdown"
                  ? "Shutdown"
                  : "Restart"}
              </ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
