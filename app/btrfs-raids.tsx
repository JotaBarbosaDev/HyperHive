import React from "react";
import { RefreshControl, ScrollView, Switch } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectItem,
  SelectIcon,
  SelectPortal,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectBackdrop,
} from "@/components/ui/select";
import { ChevronDownIcon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Divider } from "@/components/ui/divider";
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton } from "@/components/ui/modal";
import { AlertDialog, AlertDialogBackdrop, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, AlertDialogCloseButton } from "@/components/ui/alert-dialog";
import { FormControl, FormControlLabel, FormControlLabelText, FormControlHelper, FormControlHelperText } from "@/components/ui/form-control";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { BtrfsDisk, BtrfsRaid, AutomaticMount, BtrfsRaidDevice, ScrubStats, RaidStatus } from "@/types/btrfs";
import { Machine } from "@/types/machine";
import { listMachines } from "@/services/hyperhive";
import {
  addDiskRaid,
  balanceRaid,
  cancelBalance,
  changeRaidLevel,
  createAutomaticMount,
  createRaid,
  defragmentRaid,
  deleteAutomaticMount,
  getRaidStatus,
  getScrubStats,
  listAllDisks,
  listAutomaticMounts,
  listFreeDisks,
  listRaids,
  mountRaid,
  pauseBalance,
  removeDiskRaid,
  removeRaid,
  replaceDiskRaid,
  resumeBalance,
  scrubRaid,
  unmountRaid,
} from "@/services/btrfs";
import { ArrowRight, HardDrive, Plus, Power, RefreshCcw, Trash2 } from "lucide-react-native";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { COMPRESSION_OPTIONS, RAID_LEVEL_OPTIONS } from "@/constants/btrfs";
import { useRouter } from "expo-router";

type FilterTab = "all" | "active" | "inactive";
type RaidTab = "details" | "actions" | "balance" | "scrub";

const DEFAULT_COMPRESSION = "zstd:3";
const DEFAULT_RAID_LEVEL = RAID_LEVEL_OPTIONS.find((opt) => opt.value === "raid1")?.value ?? RAID_LEVEL_OPTIONS[0].value;
const getRaidLevelOption = (level?: string) => RAID_LEVEL_OPTIONS.find((opt) => opt.value === level);
const getRaidMinDisks = (level?: string) => getRaidLevelOption(level)?.minDisks;

const formatSize = (value?: string | number) => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "number") {
    if (value > 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (value > 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    if (value > 1024) return `${(value / 1024).toFixed(2)} KB`;
    return `${value} B`;
  }
  return value;
};

const formatSizeValue = (value?: string | number) => {
  if (typeof value === "string") {
    const num = Number(value);
    return formatSize(Number.isNaN(num) ? value : num);
  }
  return formatSize(value);
};

const formatDeviceDisplay = (device: BtrfsDisk | string): string => {
  if (typeof device === "string") return device;
  const dev = device.device || "";
  const model = device.model || "";
  if (model) return `${dev} - ${model}`;
  return dev;
};

const getRaidDeviceLabel = (dev: BtrfsRaidDevice | BtrfsDisk | string, disks: BtrfsDisk[]) => {
  if (typeof dev !== "string" && "model" in dev && dev.model) return formatDeviceDisplay(dev as BtrfsDisk);
  const path = typeof dev === "string" ? dev : (dev as any).device;
  const found = disks.find((d) => d.device === path);
  if (found) return formatDeviceDisplay(found);
  return typeof dev === "string" ? dev : formatDeviceDisplay(dev as BtrfsDisk);
};

const getCompressionLabel = (value?: string | null) => {
  if (value === null || value === undefined) return "None";
  return COMPRESSION_OPTIONS.find((opt) => opt.value === value)?.label ?? (value || "None");
};

const numberFromInput = (val: string) => {
  if (val === null || val === undefined || val === "") return undefined;
  const num = Number(val);
  return Number.isNaN(num) ? undefined : num;
};

const isRaidActive = (raid: BtrfsRaid) => raid.mounted !== false;

export default function BtrfsRaidsScreen() {
  const toast = useToast();
  const router = useRouter();
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [disks, setDisks] = React.useState<BtrfsDisk[]>([]);
  const [freeDisks, setFreeDisks] = React.useState<BtrfsDisk[]>([]);
  const [raids, setRaids] = React.useState<BtrfsRaid[]>([]);
  const [autoMounts, setAutoMounts] = React.useState<AutomaticMount[]>([]);
  const [filter, setFilter] = React.useState<FilterTab>("all");
  const RAID_TABS: { key: RaidTab; label: string }[] = [
    { key: "details", label: "Details" },
    { key: "actions", label: "Actions" },
    { key: "balance", label: "Balance" },
    { key: "scrub", label: "Scrub" },
  ];
  const [raidTab, setRaidTab] = React.useState<RaidTab>("details");

  const [diskDetail, setDiskDetail] = React.useState<BtrfsDisk | null>(null);
  const [createModal, setCreateModal] = React.useState(false);
  const [raidModal, setRaidModal] = React.useState<BtrfsRaid | null>(null);
  const [raidStatus, setRaidStatus] = React.useState<RaidStatus | null>(null);
  const [scrubStats, setScrubStats] = React.useState<ScrubStats | null>(null);

  // create raid form
  const [raidName, setRaidName] = React.useState("");
  const [raidLevel, setRaidLevel] = React.useState(DEFAULT_RAID_LEVEL);
  const [selectedDisks, setSelectedDisks] = React.useState<Set<string>>(new Set());
  const [creatingRaid, setCreatingRaid] = React.useState(false);

  // raid action forms
  const [mountPoint, setMountPoint] = React.useState("");
  const [compression, setCompression] = React.useState(DEFAULT_COMPRESSION);
  const [forceUnmount, setForceUnmount] = React.useState(false);
  const [addDiskValue, setAddDiskValue] = React.useState("");
  const [removeDiskValue, setRemoveDiskValue] = React.useState("");
  const [replaceOld, setReplaceOld] = React.useState("");
  const [replaceNew, setReplaceNew] = React.useState("");
  const [newRaidLevel, setNewRaidLevel] = React.useState(DEFAULT_RAID_LEVEL);
  const [balanceDataUsage, setBalanceDataUsage] = React.useState("100");
  const [balanceMetadataUsage, setBalanceMetadataUsage] = React.useState("100");
  const [balanceForce, setBalanceForce] = React.useState(false);
  const [balanceConvert, setBalanceConvert] = React.useState(true);
  const [autoMountPoint, setAutoMountPoint] = React.useState("");
  const [autoCompression, setAutoCompression] = React.useState(DEFAULT_COMPRESSION);

  const [savingAction, setSavingAction] = React.useState<string | null>(null);
  const [deleteRaidTarget, setDeleteRaidTarget] = React.useState<BtrfsRaid | null>(null);
  const [actionModal, setActionModal] = React.useState<null | RaidTab | "mount" | "unmount" | "addDisk" | "removeDisk" | "replaceDisk" | "changeLevel" | "autoMount">(null);

  const raidLevelOption = getRaidLevelOption(raidLevel);
  const raidLevelMinDisks = getRaidMinDisks(raidLevel);
  const raidLevelLabel = raidLevelOption?.label ?? raidLevel;
  const newRaidLevelOption = getRaidLevelOption(newRaidLevel);
  const newRaidMinDisks = getRaidMinDisks(newRaidLevel);
  const newRaidLabel = newRaidLevelOption?.label ?? newRaidLevel;
  const raidDeviceCount =
    typeof raidStatus?.totalDevices === "number"
      ? raidStatus.totalDevices
      : Array.isArray(raidModal?.devices)
        ? raidModal.devices.length
        : undefined;
  const balancePollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const scrubPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = React.useCallback(
    (title: string, description: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-start flex-row"
            action={action}
          >
            <ToastTitle size="sm">{title}</ToastTitle>
            {description ? <ToastDescription size="sm">{description}</ToastDescription> : null}
          </Toast>
        ),
      });
    },
    [toast]
  );

  const loadMachines = React.useCallback(async () => {
    try {
      const data = await listMachines();
      const list = Array.isArray(data) ? data : [];
      setMachines(list);
      if (!selectedMachine && list.length > 0) {
        setSelectedMachine(list[0].MachineName);
      }
    } catch (err) {
      console.error("Failed to load machines", err);
      showToast("Error loading machines", "Try again.", "error");
    }
  }, [selectedMachine, showToast]);

  const loadData = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (!selectedMachine) return;
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const [allDisks, free, raidList, auto] = await Promise.all([
          listAllDisks(selectedMachine),
          listFreeDisks(selectedMachine),
          listRaids(selectedMachine),
          listAutomaticMounts(selectedMachine),
        ]);
        setDisks(Array.isArray(allDisks) ? allDisks : []);
        setFreeDisks(Array.isArray(free) ? free : []);
        setRaids(Array.isArray(raidList) ? raidList : []);
        setAutoMounts(Array.isArray(auto) ? auto : []);
      } catch (err) {
        console.error("Failed to load BTRFS data", err);
        showToast("Error loading", "Unable to fetch BTRFS data.", "error");
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [selectedMachine, showToast]
  );

  React.useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  React.useEffect(() => {
    if (selectedMachine) {
      loadData();
    }
  }, [selectedMachine, loadData]);

  const handleCreateRaid = async () => {
    if (!selectedMachine) return;
    if (!raidName.trim()) {
      showToast("Name required", "Provide a name for the RAID.", "error");
      return;
    }
    if (typeof raidLevelMinDisks === "number" && selectedDisks.size < raidLevelMinDisks) {
      const diskLabel = raidLevelMinDisks === 1 ? "disk" : "disks";
      showToast("Select disks", `Select at least ${raidLevelMinDisks} ${diskLabel} for ${raidLevelLabel}.`, "error");
      return;
    }
    setCreatingRaid(true);
    try {
      await createRaid(selectedMachine, {
        name: raidName.trim(),
        raid: raidLevel,
        disks: Array.from(selectedDisks),
      });
      showToast("RAID created", "BTRFS array created successfully.");
      setCreateModal(false);
      setRaidName("");
      setRaidLevel(DEFAULT_RAID_LEVEL);
      setSelectedDisks(new Set());
      await loadData("silent");
    } catch (err) {
      console.error("Failed to create raid", err);
      showToast("Error creating RAID", "Check the data and try again.", "error");
    } finally {
      setCreatingRaid(false);
    }
  };

  const performAction = async (label: string, action: () => Promise<unknown>, reload = true) => {
    setSavingAction(label);
    try {
      await action();
      showToast(`${label} completed`, "Action executed successfully.");
      if (reload) {
        await loadData("silent");
      }
    } catch (err) {
      console.error(`Failed to ${label}`, err);
      showToast(`Error during ${label}`, "Try again.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const triggerLongRunningAction = React.useCallback(
    (label: string, action: () => Promise<unknown>, onAfterSuccess?: () => Promise<void> | void) => {
      const prettyLabel = label.charAt(0).toUpperCase() + label.slice(1);
      showToast(`${prettyLabel} requested`, "Monitor progress in the scrub tab.");
      action()
        .then(async () => {
          if (onAfterSuccess) {
            await onAfterSuccess();
          }
        })
        .catch((err) => {
          console.error(`Failed to start ${label}`, err);
          showToast(`Error starting ${label}`, "Try again.", "error");
        });
    },
    [showToast]
  );

  const openRaidModal = (raid: BtrfsRaid) => {
    setRaidModal(raid);
    setMountPoint(raid.mount_point ?? "");
    setCompression(raid.compression ?? DEFAULT_COMPRESSION);
    setAddDiskValue("");
    setRemoveDiskValue("");
    setReplaceNew("");
    setReplaceOld("");
    setNewRaidLevel(raid.raid_level ?? DEFAULT_RAID_LEVEL);
    setAutoMountPoint(raid.mount_point ?? "");
    setAutoCompression(raid.compression ?? DEFAULT_COMPRESSION);
    setRaidStatus(null);
    setScrubStats(null);
    setRaidTab("details");
    fetchRaidExtras(raid);
  };

  const fetchRaidExtras = async (raid: BtrfsRaid) => {
    if (!selectedMachine || !raid.uuid) return;
    try {
      const [status, scrub] = await Promise.all([
        getRaidStatus(selectedMachine, raid.uuid).catch(() => null),
        getScrubStats(selectedMachine, raid.uuid).catch(() => null),
      ]);
      setRaidStatus(status);
      setScrubStats(scrub);
    } catch (err) {
      console.warn("Failed to load raid extras", err);
    }
  };

  const refreshScrubStats = React.useCallback(
    async (uuid?: string) => {
      const targetUuid = uuid ?? raidModal?.uuid;
      if (!selectedMachine || !targetUuid) return;
      try {
        const stats = await getScrubStats(selectedMachine, targetUuid);
        setScrubStats(stats);
      } catch (err) {
        console.warn("Failed to load scrub stats", err);
      }
    },
    [raidModal?.uuid, selectedMachine]
  );

  const getAutoMountForRaid = (uuid?: string) => {
    if (!uuid) return null;
    return autoMounts.find((a) => a.uuid === uuid || a.raid_uuid === uuid) ?? null;
  };

  const filteredRaids = React.useMemo(() => {
    if (filter === "active") return raids.filter((r) => isRaidActive(r));
    if (filter === "inactive") return raids.filter((r) => !isRaidActive(r));
    return raids;
  }, [filter, raids]);

  const activeCount = raids.filter((r) => isRaidActive(r)).length;
  const inactiveCount = raids.length - activeCount;
  const raidDeviceNames = React.useMemo(
    () =>
      raidModal && Array.isArray(raidModal.devices)
        ? raidModal.devices
          .map((dev) => (typeof dev === "string" ? dev : dev.device))
          .filter((d): d is string => Boolean(d))
        : [],
    [raidModal]
  );
  const freeDiskNames = React.useMemo(
    () => (Array.isArray(freeDisks) ? freeDisks.map((d) => d.device).filter((d): d is string => Boolean(d)) : []),
    [freeDisks]
  );
  const currentAutoMount = raidModal?.uuid ? getAutoMountForRaid(raidModal.uuid) : null;
  const closeActionModal = () => setActionModal(null);
  const stopBalancePolling = () => {
    if (balancePollRef.current) {
      clearInterval(balancePollRef.current);
      balancePollRef.current = null;
    }
  };
  const stopScrubPolling = () => {
    if (scrubPollRef.current) {
      clearInterval(scrubPollRef.current);
      scrubPollRef.current = null;
    }
  };
  const getBalanceStatus = (status?: RaidStatus | null): string => {
    const deviceStatuses = status?.deviceStats?.map((s) => s.balanceStatus).filter(Boolean) ?? [];
    return (deviceStatuses.find(Boolean) ?? status?.balanceStatus ?? "No balance info") as string;
  };
  const isBalanceRunning = (status?: RaidStatus | null) => {
    const text = getBalanceStatus(status) || "";
    return text && !/no balance/i.test(text);
  };

  const scrubCommandPath = React.useMemo(() => scrubStats?.path ?? raidModal?.mount_point ?? "/mnt/raid", [raidModal?.mount_point, scrubStats?.path]);
  const scrubCliCommand = React.useMemo(() =>
    `sudo btrfs scrub status "${scrubCommandPath}"`,
    [scrubCommandPath]
  );

  // Updated: This checks if the process is running and shows the start time and command
  const defragCliCommand = React.useMemo(() =>
    `ps -C "btrfs" -f | grep "filesystem defrag" | grep -v grep || echo "Defrag is NOT running"`,
    [scrubCommandPath]
  );
  React.useEffect(() => {
    stopBalancePolling();
    if (raidModal?.uuid && raidTab === "balance" && selectedMachine) {
      const loadStatus = async () => {
        try {
          const status = await getRaidStatus(selectedMachine, raidModal.uuid);
          setRaidStatus(status);
        } catch (err) {
          console.warn("Failed to poll raid status", err);
        }
      };
      loadStatus();
      const id = setInterval(loadStatus, 2000);
      balancePollRef.current = id;
    }
    return () => stopBalancePolling();
  }, [raidModal?.uuid, raidTab, selectedMachine]);

  React.useEffect(() => {
    stopScrubPolling();
    if (raidModal?.uuid && raidTab === "scrub" && selectedMachine) {
      const loadStats = () => refreshScrubStats(raidModal.uuid);
      loadStats();
      const id = setInterval(loadStats, 20000);
      scrubPollRef.current = id;
    }
    return () => stopScrubPolling();
  }, [raidModal?.uuid, raidTab, selectedMachine, refreshScrubStats]);

  const StatsRow = ({ label, value }: { label: string; value?: React.ReactNode }) => (
    <HStack className="justify-between py-1.5 items-center">
      <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">{label}</Text>
      <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-sm text-right">{value ?? "—"}</Text>
    </HStack>
  );

  const QuickPills = ({ options, onSelect }: { options: string[]; onSelect: (value: string) => void }) => {
    if (!options.length) return null;
    return (
      <HStack className="flex-wrap gap-2 mt-1">
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            className="px-3 py-1 rounded-full border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]"
          >
            <Text className="text-typography-700 dark:text-[#E8EBF0] text-xs">{option}</Text>
          </Pressable>
        ))}
      </HStack>
    );
  };

  const CompressionSelect = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => (
    <Select selectedValue={value} onValueChange={onChange}>
      <SelectTrigger className="min-w-[170px]">
        <SelectInput placeholder="Compression" value={getCompressionLabel(value)} />
        <SelectIcon as={ChevronDownIcon} />
      </SelectTrigger>
      <SelectPortal>
        <SelectBackdrop />
        <SelectContent>
          <SelectDragIndicatorWrapper>
            <SelectDragIndicator />
          </SelectDragIndicatorWrapper>
          {COMPRESSION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value || "none"} label={`${opt.label}${opt.description ? ` • ${opt.description}` : ""}`} value={opt.value} />
          ))}
        </SelectContent>
      </SelectPortal>
    </Select>
  );

  const StatCard = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
    <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] flex-1 min-w-[150px]">
      <Text className="text-typography-700 dark:text-[#9AA4B8] text-xs uppercase tracking-wide">{label}</Text>
      <Text className="text-typography-900 dark:text-[#E8EBF0] text-2xl font-bold mt-1">{value}</Text>
      {hint ? <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs mt-1">{hint}</Text> : null}
    </Box>
  );

  const RaidTabButton = ({ tab }: { tab: RaidTab }) => {
    const active = raidTab === tab;
    const label = RAID_TABS.find((t) => t.key === tab)?.label ?? tab;
    return (
      <Pressable
        onPress={() => setRaidTab(tab)}
        className={`px-4 py-2 rounded-lg border transition-all ${active
          ? "border-typography-900 dark:border-[#2DD4BF] bg-background-50 dark:bg-[#0A1628]"
          : "border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]"
          }`}
      >
        <Text
          className={`text-sm ${active ? "text-typography-900 dark:text-[#E8EBF0]" : "text-typography-600 dark:text-[#8A94A8]"}`}
          style={{ fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderDiskRow = (disk: BtrfsDisk) => (
    <Pressable
      key={disk.device}
      onPress={() => setDiskDetail(disk)}
      className="flex-row items-center justify-between px-3 py-2 border-b border-outline-100 dark:border-[#1E2F47]"
    >
      <VStack className="gap-1">
        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">{formatDeviceDisplay(disk)}</Text>
        <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
          {disk.model || disk.name || "—"} • {formatSize(disk.size)}
        </Text>
      </VStack>
      <HStack className="gap-2">
        {disk.type ? (
          <Badge className="rounded-full px-3 py-1 border-outline-200 dark:border-[#1E2F47]" size="sm" action="muted" variant="outline">
            <BadgeText className="text-xs text-typography-800 dark:text-[#E8EBF0]">{disk.type}</BadgeText>
          </Badge>
        ) : null}
        {disk.status ? (
          <Badge className="rounded-full px-3 py-1 border-outline-200 dark:border-[#1E2F47]" size="sm" action="muted" variant="outline">
            <BadgeText className="text-xs text-typography-800 dark:text-[#E8EBF0]">{disk.status}</BadgeText>
          </Badge>
        ) : null}
        {disk.mounted !== undefined ? (
          <Badge className="rounded-full px-3 py-1 border-outline-200 dark:border-[#1E2F47]" size="sm" action={disk.mounted ? "success" : "muted"} variant="outline">
            <BadgeText className="text-xs text-typography-800 dark:text-[#E8EBF0]">{disk.mounted ? "Mounted" : "Free"}</BadgeText>
          </Badge>
        ) : null}
        {disk.rotational !== undefined ? (
          <Badge className="rounded-full px-3 py-1 border-outline-200 dark:border-[#1E2F47]" size="sm" action="muted" variant="outline">
            <BadgeText className="text-xs text-typography-800 dark:text-[#E8EBF0]">{disk.rotational ? "HDD" : "SSD"}</BadgeText>
          </Badge>
        ) : null}
      </HStack>
    </Pressable>
  );

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#0A1628] web:bg-background-0 dark:web:bg-[#0A1628]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            BTRFS / RAIDs
          </Heading>
          <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm web:text-base max-w-3xl">
            Full BTRFS management: create arrays, balance, scrub, and automate mounts.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <HStack className="gap-3 items-center flex-wrap">
              <Select
                selectedValue={selectedMachine}
                onValueChange={(val) => setSelectedMachine(val)}
              >
                <SelectTrigger className="min-w-[180px] rounded-xl border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] px-3 py-2">
                  <SelectInput placeholder="Machine" value={selectedMachine} />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {(machines ?? []).map((m) => (
                      <SelectItem key={m.MachineName} label={m.MachineName} value={m.MachineName} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
              <Button
                variant="outline"
                action="default"
                size="sm"
                onPress={() => loadData("refresh")}
                className="rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E] h-10"
              >
                <ButtonIcon as={RefreshCcw} size="sm" />
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Refresh</ButtonText>
              </Button>
            </HStack>
            <Button
              action="primary"
              variant="solid"
              size="md"
              onPress={() => setCreateModal(true)}
              className="px-5 rounded-xl dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
            >
              <ButtonIcon as={Plus} size="sm" />
              <ButtonText style={{ fontFamily: "Inter_600SemiBold" }}>Create RAID</ButtonText>
            </Button>
          </HStack>

          <HStack className="mt-4 gap-3 flex-wrap">
            <StatCard label="RAIDs" value={raids.length} hint={`${activeCount} active • ${inactiveCount} inactive`} />
            <StatCard label="Free disks" value={freeDisks.length} hint="Ready to add" />
            <StatCard label="Auto-mount" value={autoMounts.length} hint="Configured rules" />
            <StatCard label="Machines" value={machines.length} hint="Available targets" />
          </HStack>

          {loading ? (
            <VStack className="mt-6 gap-4">
              {[1, 2].map((idx) => (
                <Box key={idx} className="p-4 rounded-2xl bg-background-0 dark:bg-[#0F1A2E] border border-outline-100 dark:border-[#1E2F47]">
                  <Skeleton className="h-5 w-1/2 mb-2" />
                  <SkeletonText className="w-1/3" />
                </Box>
              ))}
            </VStack>
          ) : (
            <>
              <Box className="mt-6 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] web:shadow-md dark:web:shadow-none">
                <HStack className="items-center justify-between px-4 py-3">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base">Free Disks</Text>
                  <HStack className="items-center gap-2">
                    <HardDrive size={18} className="text-typography-900 dark:text-[#E8EBF0]" />
                    <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">{(Array.isArray(freeDisks) ? freeDisks.length : 0)} disks</Text>
                  </HStack>
                </HStack>
                <Divider className="opacity-60 dark:border-[#1E2F47]" />
                {(!Array.isArray(freeDisks) || freeDisks.length === 0) ? (
                  <Box className="p-4">
                    <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">No free disks found.</Text>
                  </Box>
                ) : (
                  freeDisks.map(renderDiskRow)
                )}
              </Box>

              <Box className="mt-6 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] web:shadow-md dark:web:shadow-none">
                <HStack className="items-center justify-between px-4 py-3 flex-wrap gap-3">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base">Arrays BTRFS</Text>
                  <HStack className="gap-2 flex-wrap">
                    {[
                      { key: "all" as FilterTab, label: `All (${raids.length})` },
                      { key: "active" as FilterTab, label: `Active (${raids.filter(isRaidActive).length})` },
                      { key: "inactive" as FilterTab, label: `Inactive (${raids.filter((r) => !isRaidActive(r)).length})` },
                    ].map((tab) => {
                      const active = filter === tab.key;
                      return (
                        <Pressable
                          key={tab.key}
                          onPress={() => setFilter(tab.key)}
                          className={`px-4 py-2 rounded-full border transition-all ${active
                            ? "border-typography-900 dark:border-[#2DD4BF] bg-background-50 dark:bg-[#0A1628]"
                            : "border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]"
                            }`}
                        >
                          <Text
                            className={`text-sm ${active ? "text-typography-900 dark:text-[#E8EBF0]" : "text-typography-700 dark:text-[#9AA4B8]"}`}
                            style={{ fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" }}
                          >
                            {tab.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </HStack>
                </HStack>
                <Divider className="opacity-60 dark:border-[#1E2F47]" />
                {filteredRaids.length === 0 ? (
                  <Box className="p-4">
                    <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">No RAID found.</Text>
                  </Box>
                ) : (
                  <VStack className="p-4 gap-3">
                    {filteredRaids.map((raid) => {
                      const active = isRaidActive(raid);
                      const auto = getAutoMountForRaid(raid.uuid);
                      return (
                        <Pressable
                          key={raid.uuid}
                          onPress={() => openRaidModal(raid)}
                          className={`rounded-xl border border-outline-100 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] p-4 web:hover:border-[#2DD4BF] dark:web:hover:border-[#2DD4BF] active:scale-[0.99] transition-all ${active ? "" : "opacity-90"}`}
                        >
                          <HStack className="items-start justify-between gap-4 flex-wrap">
                            <VStack className="gap-2 flex-1">
                              <HStack className="items-center gap-2 flex-wrap">
                                <Box className={`h-2.5 w-2.5 rounded-full ${active ? "bg-[#2DD4BF] dark:bg-[#2DD4BF]" : "bg-[#94A3B8] dark:bg-[#64748B]"}`} />
                                <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">{raid.mount_point || raid.name || raid.uuid}</Text>
                                {raid.raid_level ? (
                                  <Badge className="rounded-full px-3 py-1 border-outline-200 dark:border-[#1E2F47]" size="sm" action="muted" variant="outline">
                                    <BadgeText className="text-xs text-typography-800 dark:text-[#E8EBF0]">{(raid.raid_level || "").toUpperCase()}</BadgeText>
                                  </Badge>
                                ) : null}
                                {raid.compression ? (
                                  <Badge className="rounded-full px-3 py-1 border-outline-200 dark:border-[#1E2F47]" size="sm" action="muted" variant="outline">
                                    <BadgeText className="text-xs text-typography-800 dark:text-[#E8EBF0]">Compression: {getCompressionLabel(raid.compression)}</BadgeText>
                                  </Badge>
                                ) : null}
                                {auto ? (
                                  <Badge className="rounded-full px-3 py-1 border-outline-200 dark:border-[#1E2F47]" size="sm" action="muted" variant="outline">
                                    <BadgeText className="text-xs text-typography-800 dark:text-[#E8EBF0]">Auto-mount</BadgeText>
                                  </Badge>
                                ) : null}
                              </HStack>
                              <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">UUID: {raid.uuid}</Text>
                              {raid.status ? <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">Status: {raid.status}</Text> : null}
                              <HStack className="gap-4 flex-wrap">
                                <Text className="text-typography-800 dark:text-[#E8EBF0] text-sm">Used: {formatSize(raid.used)}</Text>
                                <Text className="text-typography-800 dark:text-[#E8EBF0] text-sm">Total: {formatSize(raid.total)}</Text>
                                <Text className="text-typography-800 dark:text-[#E8EBF0] text-sm">Free: {formatSize(raid.free)}</Text>
                              </HStack>
                              <HStack className="gap-2 flex-wrap">
                                {(Array.isArray(raid.devices) ? raid.devices : []).map((dev) => {
                                  const devDisplay = getRaidDeviceLabel(dev, disks);
                                  return (
                                    <Badge key={typeof dev === "string" ? dev : (dev as any).device} className="rounded-full px-3 py-1 border-outline-200 dark:border-[#1E2F47]" size="sm" action="muted" variant="outline">
                                      <BadgeText className="text-xs text-typography-800 dark:text-[#E8EBF0]">
                                        {devDisplay}
                                      </BadgeText>
                                    </Badge>
                                  );
                                })}
                              </HStack>
                            </VStack>
                            <ArrowRight size={18} className="text-typography-500 dark:text-[#9AA4B8]" />
                          </HStack>
                        </Pressable>
                      );
                    })}
                  </VStack>
                )}
              </Box>
            </>
          )}
        </Box>
      </ScrollView>

      <Modal isOpen={diskDetail !== null} onClose={() => setDiskDetail(null)} size="lg">
        <ModalBackdrop />
        <ModalContent className="max-w-3xl">
          <ModalHeader className="flex-row items-start justify-between">
            <Heading size="md" className="text-typography-900">
              Disk Details
            </Heading>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-3 max-h-[70vh] overflow-y-auto">
            <Text className="text-typography-700">{diskDetail ? formatDeviceDisplay(diskDetail) : ""}</Text>
            <Divider />
            <StatsRow label="Name" value={diskDetail?.name} />
            <StatsRow label="Model" value={diskDetail?.model} />
            <StatsRow label="Vendor" value={diskDetail?.vendor} />
            <StatsRow label="Serial" value={diskDetail?.serial} />
            <StatsRow label="Size" value={formatSize(diskDetail?.size)} />
            <StatsRow label="Type" value={diskDetail?.type} />
            <StatsRow label="Transport" value={diskDetail?.transport} />
            <StatsRow label="Status" value={diskDetail?.status} />
            <StatsRow label="By ID" value={diskDetail?.byId} />
            <StatsRow label="PCI Path" value={diskDetail?.pciPath} />
          </ModalBody>
          <ModalFooter>
            <Button action="primary" onPress={() => setDiskDetail(null)}>
              <ButtonText>Close</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} size="lg">
        <ModalBackdrop />
        <ModalContent className="max-w-2xl">
          <ModalHeader className="flex-row items-start justify-between">
            <Heading size="md" className="text-typography-900">
              Create RAID
            </Heading>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4">
            <FormControl isRequired>
              <FormControlLabel>
                <FormControlLabelText>RAID Name</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  value={raidName}
                  onChangeText={setRaidName}
                  placeholder="ex: storage-raid1"
                />
              </Input>
            </FormControl>

            <FormControl isRequired>
              <FormControlLabel>
                <FormControlLabelText>RAID Level</FormControlLabelText>
              </FormControlLabel>
              <Select selectedValue={raidLevel} onValueChange={setRaidLevel}>
                <SelectTrigger>
                  <SelectInput
                    placeholder="Select"
                    value={RAID_LEVEL_OPTIONS.find((opt) => opt.value === raidLevel)?.label ?? raidLevel}
                  />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {RAID_LEVEL_OPTIONS.map((level) => (
                      <SelectItem key={level.value} value={level.value} label={level.label} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Disks</FormControlLabelText>
              </FormControlLabel>
              <VStack className="gap-3 max-h-60 overflow-y-auto">
                {(Array.isArray(freeDisks) ? freeDisks : []).length === 0 ? (
                  <Text className="text-typography-600 text-sm">
                    No free disk available on this machine.
                  </Text>
                ) : (
                  freeDisks.map((disk) => {
                    const checked = selectedDisks.has(disk.device);
                    return (
                      <Pressable
                        key={disk.device}
                        onPress={() => {
                          setSelectedDisks((prev) => {
                            const next = new Set(prev);
                            if (next.has(disk.device)) {
                              next.delete(disk.device);
                            } else {
                              next.add(disk.device);
                            }
                            return next;
                          });
                        }}
                        className={`flex-row items-center gap-3 p-3 rounded-xl border ${checked ? "border-typography-900 dark:border-[#2DD4BF] bg-background-50 dark:bg-[#132038]" : "border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]"}`}
                      >
                        <Box className={`h-4 w-4 rounded border ${checked ? "bg-typography-900 dark:bg-[#2DD4BF] border-typography-900 dark:border-[#2DD4BF]" : "border-outline-400 dark:border-[#1E2F47]"}`} />
                        <VStack className="flex-1">
                          <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">{formatDeviceDisplay(disk)}</Text>
                          <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                            {formatSize(disk.size)} • {disk.type || "—"}
                          </Text>
                        </VStack>
                      </Pressable>
                    );
                  })
                )}
              </VStack>
              <FormControlHelper>
                <FormControlHelperText>
                  {typeof raidLevelMinDisks === "number"
                    ? `Requires at least ${raidLevelMinDisks} disk${raidLevelMinDisks === 1 ? "" : "s"} for ${raidLevelLabel}.`
                    : "Select disks for the RAID."}
                </FormControlHelperText>
              </FormControlHelper>
            </FormControl>
          </ModalBody>
          <ModalFooter className="gap-3">
            <Button className="border-outline-200 rounded-xl dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] hover:bg-background-50 dark:hover:bg-[#0A1628]" variant="outline" action="default" onPress={() => setCreateModal(false)} isDisabled={creatingRaid}>
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>
            <Button action="primary" onPress={handleCreateRaid} isDisabled={creatingRaid} className="rounded-xl">
              {creatingRaid ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
              <ButtonText>Create RAID</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={raidModal !== null} onClose={() => setRaidModal(null)} size="lg">
        <ModalBackdrop />
        <ModalContent className="max-w-4xl max-h-[90vh]">
          <ModalHeader className="flex-row items-start justify-between">
            <VStack>
              <Heading size="md" className="text-typography-900">
                RAID {raidModal?.raid_level?.toUpperCase() || ""} {raidModal?.name || ""}
              </Heading>
              <Text className="text-typography-600">{raidModal?.mount_point || raidModal?.uuid}</Text>
            </VStack>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4 max-h-[60vh] overflow-y-auto">
            <HStack className="gap-2 flex-wrap">
              {RAID_TABS.map((tab) => (
                <RaidTabButton key={tab.key} tab={tab.key} />
              ))}
            </HStack>

            {raidTab === "details" ? (
              <VStack className="gap-4">
                {/* Storage Overview */}
                <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mb-4">Storage Overview</Text>
                  <HStack className="gap-3 flex-wrap mb-4">
                    <Box className="flex-1 min-w-[140px] p-3 rounded-xl bg-background-50 dark:bg-[#132038] border border-outline-100 dark:border-[#1E2F47]">
                      <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs uppercase tracking-wide mb-1">Used</Text>
                      <Text className="text-typography-900 dark:text-[#E8EBF0] text-xl font-bold">{formatSize(raidModal?.used)}</Text>
                    </Box>
                    <Box className="flex-1 min-w-[140px] p-3 rounded-xl bg-background-50 dark:bg-[#132038] border border-outline-100 dark:border-[#1E2F47]">
                      <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs uppercase tracking-wide mb-1">Total</Text>
                      <Text className="text-typography-900 dark:text-[#E8EBF0] text-xl font-bold">{formatSize(raidModal?.total)}</Text>
                    </Box>
                    <Box className="flex-1 min-w-[140px] p-3 rounded-xl bg-background-50 dark:bg-[#132038] border border-outline-100 dark:border-[#1E2F47]">
                      <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs uppercase tracking-wide mb-1">Free</Text>
                      <Text className="text-typography-900 dark:text-[#E8EBF0] text-xl font-bold">{formatSize(raidModal?.free)}</Text>
                    </Box>
                  </HStack>
                  {raidModal?.total && raidModal?.used ? (
                    <VStack className="gap-2">
                      <HStack className="justify-between">
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">Usage</Text>
                        <Text className="text-typography-900 dark:text-[#E8EBF0] text-sm font-semibold">
                          {((Number(raidModal.used) / Number(raidModal.total)) * 100).toFixed(1)}%
                        </Text>
                      </HStack>
                      <Progress value={(Number(raidModal.used) / Number(raidModal.total)) * 100} className="bg-background-200 dark:bg-background-300 h-2.5">
                        <ProgressFilledTrack className="bg-primary-500 dark:bg-primary-400" />
                      </Progress>
                    </VStack>
                  ) : null}
                </Box>

                {/* Configuration */}
                <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mb-3">Configuration</Text>
                  <VStack className="gap-2.5">
                    <StatsRow label="UUID" value={raidModal?.uuid} />
                    <StatsRow label="Label" value={raidModal?.label} />
                    <StatsRow label="Compression" value={raidModal ? getCompressionLabel(raidModal.compression) : undefined} />
                    <StatsRow label="Mount Point" value={raidModal?.mount_point} />
                    <StatsRow label="Source" value={raidModal?.source} />
                  </VStack>
                </Box>

                {/* Status */}
                <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mb-3">Status</Text>
                  <VStack className="gap-2.5">
                    <HStack className="justify-between items-center">
                      <Text className="text-typography-700 dark:text-typography-300">State</Text>
                      <HStack className="items-center gap-2">
                        <Box className={`h-2 w-2 rounded-full ${raidModal?.mounted ? "bg-success-500" : "bg-outline-400"}`} />
                        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">
                          {raidModal?.mounted === undefined ? "—" : raidModal?.mounted ? "Mounted" : "Unmounted"}
                        </Text>
                      </HStack>
                    </HStack>
                    <StatsRow label="Health" value={raidModal?.status || "—"} />
                  </VStack>
                </Box>

                {raidStatus ? (
                  <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
                    <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mb-3">Advanced Status</Text>
                    <VStack className="gap-2.5 mb-4">
                      <StatsRow label="Filesystem Label" value={raidStatus.fsLabel} />
                      <StatsRow label="Filesystem UUID" value={raidStatus.fsUuid} />
                      <StatsRow
                        label="Total Devices"
                        value={raidStatus.totalDevices ?? raidStatus.deviceStats?.length ?? "—"}
                      />
                    </VStack>
                    {Array.isArray(raidStatus.deviceStats) && raidStatus.deviceStats.length > 0 ? (
                      <VStack className="gap-3">
                        <Text className="text-typography-800 dark:text-[#E8EBF0] font-medium text-sm">Devices Health</Text>
                        {raidStatus.deviceStats.map((dev) => {
                          const hasErrors = (dev.writeIoErrs && Number(dev.writeIoErrs) > 0) || (dev.readIoErrs && Number(dev.readIoErrs) > 0);
                          return (
                            <Box key={dev.device ?? `${dev.devId}`} className="p-3 rounded-xl border border-outline-100 dark:border-[#1E2F47] bg-background-50 dark:bg-[#132038]">
                              <HStack className="items-center justify-between flex-wrap gap-2 mb-2">
                                <HStack className="items-center gap-2">
                                  <Box className={`h-2 w-2 rounded-full ${dev.deviceMissing ? "bg-error-500" : hasErrors ? "bg-warning-500" : "bg-success-500"}`} />
                                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">{dev.device || `Device ${dev.devId}`}</Text>
                                </HStack>
                                <HStack className="gap-2 flex-wrap">
                                  <Badge className="rounded-full px-2.5 py-1 border-outline-200 dark:border-[#1E2F47]" size="sm" action="muted" variant="outline">
                                    <BadgeText className="text-xs text-typography-800 dark:text-[#E8EBF0]">ID {dev.devId ?? "—"}</BadgeText>
                                  </Badge>
                                  {dev.deviceMissing ? (
                                    <Badge className="rounded-full px-2.5 py-1" size="sm" action="error" variant="solid">
                                      <BadgeText className="text-xs text-typography-0">Missing</BadgeText>
                                    </Badge>
                                  ) : null}
                                </HStack>
                              </HStack>
                              <VStack className="gap-2">
                                <HStack className="justify-between">
                                  <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">Storage</Text>
                                  <Text className="text-typography-900 dark:text-[#E8EBF0] text-sm font-medium">
                                    {formatSizeValue(dev.deviceUsedBytes)} / {formatSizeValue(dev.deviceSizeBytes)}
                                  </Text>
                                </HStack>
                                {dev.deviceSizeBytes && dev.deviceUsedBytes ? (
                                  <Progress value={(Number(dev.deviceUsedBytes) / Number(dev.deviceSizeBytes)) * 100} className="bg-background-200 dark:bg-background-300 h-1.5">
                                    <ProgressFilledTrack className="bg-primary-500 dark:bg-primary-400" />
                                  </Progress>
                                ) : null}
                              </VStack>
                              <HStack className="gap-2 flex-wrap mt-2">
                                <Badge className="rounded-full px-2.5 py-1" size="sm" action={Number(dev.writeIoErrs) > 0 ? "error" : "muted"} variant="outline">
                                  <BadgeText className="text-xs">Write Errors: {dev.writeIoErrs ?? "0"}</BadgeText>
                                </Badge>
                                <Badge className="rounded-full px-2.5 py-1" size="sm" action={Number(dev.readIoErrs) > 0 ? "error" : "muted"} variant="outline">
                                  <BadgeText className="text-xs">Read Errors: {dev.readIoErrs ?? "0"}</BadgeText>
                                </Badge>
                                {dev.balanceStatus ? (
                                  <Badge className="rounded-full px-2.5 py-1" size="sm" action="info" variant="outline">
                                    <BadgeText className="text-xs">{dev.balanceStatus}</BadgeText>
                                  </Badge>
                                ) : null}
                              </HStack>
                            </Box>
                          );
                        })}
                      </VStack>
                    ) : null}
                  </Box>
                ) : null}

                {/* Devices */}
                <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mb-3">Physical Devices</Text>
                  <VStack className="gap-2.5">
                    {(Array.isArray(raidModal?.devices) && raidModal.devices.length > 0 ? raidModal.devices : []).map((dev) => {
                      const devDisplay = getRaidDeviceLabel(dev, disks);
                      return (
                        <Box
                          key={typeof dev === "string" ? dev : dev.device}
                          className="p-3 rounded-xl border border-outline-100 dark:border-[#1E2F47] bg-background-50 dark:bg-[#132038]"
                        >
                          <HStack className="items-center gap-2 mb-1">
                            <Box className="h-2 w-2 rounded-full bg-success-500" />
                            <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">{devDisplay}</Text>
                          </HStack>
                          {typeof dev !== "string" ? (
                            <HStack className="items-center gap-3 ml-4">
                              <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                                {formatSize(dev.size)}
                              </Text>
                              {dev.status ? (
                                <Badge className="rounded-full px-2.5 py-1 border-outline-200 dark:border-[#1E2F47]" size="sm" action="muted" variant="outline">
                                  <BadgeText className="text-xs text-typography-800 dark:text-[#E8EBF0]">{dev.status}</BadgeText>
                                </Badge>
                              ) : null}
                            </HStack>
                          ) : null}
                        </Box>
                      );
                    })}
                    {(!Array.isArray(raidModal?.devices) || raidModal.devices.length === 0) ? (
                      <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">No devices found</Text>
                    ) : null}
                  </VStack>
                </Box>
              </VStack>
            ) : null}

            {raidTab === "actions" ? (
              <VStack className="gap-4">
                <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mb-2">Available Actions</Text>
                  <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm mb-4">Select an action to manage your RAID configuration</Text>

                  {/* Mount Operations */}
                  <VStack className="gap-3 mb-4">
                    <Text className="text-typography-800 dark:text-[#E8EBF0] font-medium text-sm uppercase tracking-wide">Mount Operations</Text>
                    <HStack className="gap-2 flex-wrap">
                      <Pressable
                        onPress={() => setActionModal("mount")}
                        className="flex-1 min-w-[160px] p-4 rounded-xl border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] web:hover:border-[#2DD4BF] dark:web:hover:border-[#2DD4BF] active:scale-95 transition-transform"
                      >
                        <HStack className="items-center gap-3 mb-2">
                          <Box className="h-10 w-10 rounded-lg bg-background-100 dark:bg-[#132038] items-center justify-center flex">
                            <Power size={20} className="text-typography-900 dark:text-[#E8EBF0]" />
                          </Box>
                        </HStack>
                        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold mb-1">Mount / Unmount</Text>
                        <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">Control RAID mount state</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setActionModal("autoMount")}
                        className="flex-1 min-w-[160px] p-4 rounded-xl border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] web:hover:border-[#2DD4BF] dark:web:hover:border-[#2DD4BF] active:scale-95 transition-transform"
                      >
                        <HStack className="items-center gap-3 mb-2">
                          <Box className="h-10 w-10 rounded-lg bg-background-100 dark:bg-[#132038] items-center justify-center flex">
                            <Plus size={20} className="text-typography-900 dark:text-[#E8EBF0]" />
                          </Box>
                        </HStack>
                        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold mb-1">Auto-mount</Text>
                        <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">Configure automatic mounting</Text>
                      </Pressable>
                    </HStack>
                  </VStack>

                  {/* Disk Management */}
                  <VStack className="gap-3 mb-4">
                    <Text className="text-typography-800 dark:text-[#E8EBF0] font-medium text-sm uppercase tracking-wide">Disk Management</Text>
                    <HStack className="gap-2 flex-wrap">
                      <Pressable
                        onPress={() => setActionModal("addDisk")}
                        className="flex-1 min-w-[160px] p-4 rounded-xl border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] web:hover:border-[#2DD4BF] dark:web:hover:border-[#2DD4BF] active:scale-95 transition-transform"
                      >
                        <HStack className="items-center gap-3 mb-2">
                          <Box className="h-10 w-10 rounded-lg bg-background-100 dark:bg-[#132038] items-center justify-center flex">
                            <Plus size={20} className="text-typography-900 dark:text-[#E8EBF0]" />
                          </Box>
                        </HStack>
                        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold mb-1">Add Disk</Text>
                        <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">Expand RAID capacity</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setActionModal("removeDisk")}
                        className="flex-1 min-w-[160px] p-4 rounded-xl border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] web:hover:border-[#2DD4BF] dark:web:hover:border-[#2DD4BF] active:scale-95 transition-transform"
                      >
                        <HStack className="items-center gap-3 mb-2">
                          <Box className="h-10 w-10 rounded-lg bg-background-100 dark:bg-[#132038] items-center justify-center flex">
                            <Trash2 size={20} className="text-typography-900 dark:text-[#E8EBF0]" />
                          </Box>
                        </HStack>
                        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold mb-1">Remove Disk</Text>
                        <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">Remove a device from RAID</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setActionModal("replaceDisk")}
                        className="flex-1 min-w-[160px] p-4 rounded-xl border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] web:hover:border-[#2DD4BF] dark:web:hover:border-[#2DD4BF] active:scale-95 transition-transform"
                      >
                        <HStack className="items-center gap-3 mb-2">
                          <Box className="h-10 w-10 rounded-lg bg-background-100 dark:bg-[#132038] items-center justify-center flex">
                            <RefreshCcw size={20} className="text-typography-900 dark:text-[#E8EBF0]" />
                          </Box>
                        </HStack>
                        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold mb-1">Replace Disk</Text>
                        <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">Swap a faulty device</Text>
                      </Pressable>
                    </HStack>
                  </VStack>

                  {/* RAID Configuration */}
                  <VStack className="gap-3">
                    <Text className="text-typography-800 dark:text-[#E8EBF0] font-medium text-sm uppercase tracking-wide">RAID Configuration</Text>
                    <HStack className="gap-2 flex-wrap">
                      <Pressable
                        onPress={() => setActionModal("changeLevel")}
                        className="flex-1 min-w-[160px] p-4 rounded-xl border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] web:hover:border-[#2DD4BF] dark:web:hover:border-[#2DD4BF] active:scale-95 transition-transform"
                      >
                        <HStack className="items-center gap-3 mb-2">
                          <Box className="h-10 w-10 rounded-lg bg-background-100 dark:bg-[#132038] items-center justify-center flex">
                            <RefreshCcw size={20} className="text-typography-900 dark:text-[#E8EBF0]" />
                          </Box>
                        </HStack>
                        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold mb-1">Change Level</Text>
                        <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">Modify RAID configuration</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => router.push("/btrfs-automatic-mounts")}
                        className="flex-1 min-w-[160px] p-4 rounded-xl border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] web:hover:border-[#2DD4BF] dark:web:hover:border-[#2DD4BF] active:scale-95 transition-transform"
                      >
                        <HStack className="items-center gap-3 mb-2">
                          <Box className="h-10 w-10 rounded-lg bg-background-100 dark:bg-[#132038] items-center justify-center flex">
                            <ArrowRight size={20} className="text-typography-900 dark:text-[#E8EBF0]" />
                          </Box>
                        </HStack>
                        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold mb-1">Auto-Mounts Page</Text>
                        <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">Manage all auto-mounts</Text>
                      </Pressable>
                    </HStack>
                  </VStack>
                </Box>
              </VStack>
            ) : null}

            {raidTab === "balance" ? (
              <VStack className="gap-4">
                {/* Status Card */}
                <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mb-3">Balance Status</Text>
                  <Box className="p-4 rounded-xl bg-background-50 dark:bg-[#132038] border border-outline-100 dark:border-[#1E2F47]">
                    <HStack className="items-center gap-3">
                      <Box className={`h-3 w-3 rounded-full ${isBalanceRunning(raidStatus) ? "bg-warning-500 animate-pulse" : "bg-success-500"}`} />
                      <VStack className="flex-1">
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-xs uppercase tracking-wide">Current State</Text>
                        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mt-0.5">
                          {getBalanceStatus(raidStatus)}
                        </Text>
                      </VStack>
                    </HStack>
                  </Box>
                </Box>

                {/* Balance Configuration */}
                <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mb-3">Balance Configuration</Text>
                  <VStack className="gap-4">
                    <HStack className="gap-3 flex-wrap">
                      <VStack className="flex-1 min-w-[140px] gap-2">
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm font-medium">Data Usage (%)</Text>
                        <Input className="bg-background-0 dark:bg-[#0F1A2E] border border-outline-200 dark:border-[#1E2F47]">
                          <InputField
                            value={balanceDataUsage}
                            onChangeText={setBalanceDataUsage}
                            keyboardType="numeric"
                            placeholder="100"
                            className="text-typography-900 dark:text-[#E8EBF0]"
                          />
                        </Input>
                      </VStack>
                      <VStack className="flex-1 min-w-[140px] gap-2">
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm font-medium">Metadata Usage (%)</Text>
                        <Input className="bg-background-0 dark:bg-[#0F1A2E] border border-outline-200 dark:border-[#1E2F47]">
                          <InputField
                            value={balanceMetadataUsage}
                            onChangeText={setBalanceMetadataUsage}
                            keyboardType="numeric"
                            placeholder="100"
                            className="text-typography-900 dark:text-[#E8EBF0]"
                          />
                        </Input>
                      </VStack>
                    </HStack>

                    <VStack className="gap-3">
                      <Pressable
                        onPress={() => setBalanceForce(!balanceForce)}
                        className="flex-row items-center justify-between p-3 rounded-xl border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]"
                      >
                        <VStack className="flex-1">
                          <Text className="text-typography-900 dark:text-[#E8EBF0] font-medium">Force Balance</Text>
                          <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">Override safety checks</Text>
                        </VStack>
                        <Switch value={balanceForce} onValueChange={setBalanceForce} />
                      </Pressable>
                      <Pressable
                        onPress={() => setBalanceConvert(!balanceConvert)}
                        className="flex-row items-center justify-between p-3 rounded-xl border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]"
                      >
                        <VStack className="flex-1">
                          <Text className="text-typography-900 dark:text-[#E8EBF0] font-medium">Convert to Current RAID</Text>
                          <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">Apply current RAID level during balance</Text>
                        </VStack>
                        <Switch value={balanceConvert} onValueChange={setBalanceConvert} />
                      </Pressable>
                    </VStack>

                    <Button
                      action="primary"
                      size="lg"
                      className="rounded-xl"
                      onPress={() =>
                        raidModal?.uuid &&
                        performAction("balance", () =>
                          balanceRaid(selectedMachine, {
                            uuid: raidModal.uuid,
                            filters: {
                              dataUsageMax: numberFromInput(balanceDataUsage),
                              metadataUsageMax: numberFromInput(balanceMetadataUsage),
                            },
                            force: balanceForce,
                            convertToCurrentRaid: balanceConvert,
                          })
                        )
                      }
                      isDisabled={savingAction !== null}
                    >
                      {savingAction === "balance" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                      <ButtonText>Start Balance</ButtonText>
                    </Button>
                  </VStack>
                </Box>

                {/* Balance Controls */}
                <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mb-3">Controls</Text>
                  <HStack className="gap-2 flex-wrap">
                    <Button
                      action="default"
                      variant="outline"
                      className="flex-1 min-w-[100px] rounded-xl"
                      onPress={() => raidModal?.uuid && performAction("pause balance", () => pauseBalance(selectedMachine, raidModal.uuid))}
                      isDisabled={savingAction !== null}
                    >
                      {savingAction === "pause balance" ? <ButtonSpinner /> : null}
                      <ButtonText>Pause</ButtonText>
                    </Button>
                    <Button
                      action="default"
                      variant="outline"
                      className="flex-1 min-w-[100px] rounded-xl"
                      onPress={() => raidModal?.uuid && performAction("resume balance", () => resumeBalance(selectedMachine, raidModal.uuid))}
                      isDisabled={savingAction !== null}
                    >
                      {savingAction === "resume balance" ? <ButtonSpinner /> : null}
                      <ButtonText>Resume</ButtonText>
                    </Button>
                    <Button
                      action="negative"
                      className="flex-1 min-w-[100px] rounded-xl bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
                      onPress={() => raidModal?.uuid && performAction("cancel balance", () => cancelBalance(selectedMachine, raidModal.uuid))}
                      isDisabled={savingAction !== null || !isBalanceRunning(raidStatus)}
                    >
                      {savingAction === "cancel balance" ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
                      <ButtonText className="text-background-0 dark:text-[#0A1628]">Cancel</ButtonText>
                    </Button>
                  </HStack>
                </Box>
              </VStack>
            ) : null}

            {raidTab === "scrub" ? (
              <VStack className="gap-4">
                {/* Scrub Status */}
                <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mb-4">Scrub & Health Check</Text>
                  {scrubStats ? (
                    <VStack className="gap-4">
                      {/* Progress Overview */}
                      {scrubStats.percentDone !== undefined ? (
                        <Box className="p-4 rounded-xl bg-background-50 dark:bg-[#132038] border border-outline-100 dark:border-[#1E2F47]">
                          <HStack className="justify-between items-center mb-3">
                            <VStack>
                              <Text className="text-typography-700 dark:text-[#9AA4B8] text-xs uppercase tracking-wide">Progress</Text>
                              <Text className="text-typography-900 dark:text-[#E8EBF0] text-2xl font-bold mt-0.5">
                                {typeof scrubStats.percentDone === "number"
                                  ? `${scrubStats.percentDone.toFixed(1)}%`
                                  : `${scrubStats.percentDone || 0}%`}
                              </Text>
                            </VStack>
                            <Box className={`h-12 w-12 rounded-full ${Number(scrubStats.percentDone) === 100 ? "bg-success-500" : "bg-primary-500"} items-center justify-center flex`}>
                              <Text className="text-white font-bold text-sm">{Number(scrubStats.percentDone).toFixed(0)}%</Text>
                            </Box>
                          </HStack>
                          <Progress value={Number(scrubStats.percentDone) || 0} className="bg-background-200 dark:bg-background-300 h-3 rounded-full">
                            <ProgressFilledTrack className="bg-primary-500 dark:bg-primary-400 rounded-full" />
                          </Progress>
                          <HStack className="justify-between mt-2">
                            <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">{scrubStats.bytesScrubbed ?? "—"}</Text>
                            <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">{scrubStats.totalToScrub ?? "—"}</Text>
                          </HStack>
                        </Box>
                      ) : null}

                      {/* Stats Grid */}
                      <Box className="grid grid-cols-2 gap-3">
                        <Box className="p-3 rounded-xl bg-background-50 dark:bg-[#132038] border border-outline-100 dark:border-[#1E2F47]">
                          <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs uppercase tracking-wide mb-1">Status</Text>
                          <HStack className="items-center gap-2">
                            <Box className={`h-2 w-2 rounded-full ${scrubStats.status?.toLowerCase().includes("running") ? "bg-warning-500 animate-pulse" : "bg-success-500"}`} />
                            <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">{scrubStats.status || "—"}</Text>
                          </HStack>
                        </Box>
                        <Box className="p-3 rounded-xl bg-background-50 dark:bg-[#132038] border border-outline-100 dark:border-[#1E2F47]">
                          <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs uppercase tracking-wide mb-1">Duration</Text>
                          <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">{scrubStats.duration || "—"}</Text>
                        </Box>
                        <Box className="p-3 rounded-xl bg-background-50 dark:bg-[#132038] border border-outline-100 dark:border-[#1E2F47]">
                          <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs uppercase tracking-wide mb-1">Rate</Text>
                          <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">{scrubStats.rate || "—"}</Text>
                        </Box>
                        <Box className="p-3 rounded-xl bg-background-50 dark:bg-[#132038] border border-outline-100 dark:border-[#1E2F47]">
                          <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs uppercase tracking-wide mb-1">Errors</Text>
                          <HStack className="items-center gap-2">
                            {scrubStats.errorSummary && scrubStats.errorSummary !== "0" && scrubStats.errorSummary !== "No errors" ? (
                              <Box className="h-2 w-2 rounded-full bg-error-500" />
                            ) : null}
                            <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">{scrubStats.errorSummary || "None"}</Text>
                          </HStack>
                        </Box>
                      </Box>

                      {/* Details */}
                      <Box className="p-3 rounded-xl border border-outline-100 dark:border-[#1E2F47] bg-background-50 dark:bg-[#132038]">
                        <VStack className="gap-2">
                          <StatsRow label="Path" value={scrubStats.path} />
                          <StatsRow label="Started At" value={scrubStats.startedAt} />
                        </VStack>
                      </Box>
                    </VStack>
                  ) : (
                    <Box className="p-6 rounded-xl bg-background-50 dark:bg-[#132038] border border-outline-100 dark:border-[#1E2F47] text-center">
                      <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">No scrub data available</Text>
                      <Text className="text-typography-500 dark:text-[#9AA4B8] text-xs mt-1">Run a scrub to check RAID health</Text>
                    </Box>
                  )}
                </Box>

                {/* Actions */}
                <Box className="p-4 rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base mb-3">Maintenance Actions</Text>
                  <HStack className="gap-3 flex-wrap">
                    <Button
                      action="primary"
                      size="lg"
                      className="flex-1 min-w-[140px] rounded-xl"
                      onPress={() =>
                        raidModal?.uuid &&
                        triggerLongRunningAction("scrub", () => scrubRaid(selectedMachine, raidModal.uuid), () =>
                          refreshScrubStats(raidModal.uuid)
                        )
                      }
                      isDisabled={savingAction !== null}
                    >
                      <ButtonIcon as={RefreshCcw} size="sm" />
                      <ButtonText>Start Scrub</ButtonText>
                    </Button>
                    <Button
                      action="default"
                      variant="outline"
                      size="lg"
                      className="flex-1 min-w-[140px] rounded-xl"
                      onPress={() =>
                        raidModal?.uuid &&
                        triggerLongRunningAction("defragmentation", () => defragmentRaid(selectedMachine, raidModal.uuid))
                      }
                      isDisabled={savingAction !== null}
                    >
                      <ButtonIcon as={RefreshCcw} size="sm" />
                      <ButtonText>Defragment</ButtonText>
                    </Button>
                  </HStack>
                  <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs mt-3">Scrub checks data integrity, while defragmentation optimizes file layout for better performance</Text>
                  <VStack className="mt-2 gap-1">
                    <Text className="text-typography-500 dark:text-[#9AA4B8] text-[11px] font-mono">Scrub %: {scrubCliCommand}</Text>
                    <Text className="text-typography-500 dark:text-[#9AA4B8] text-[11px] font-mono">Defrag %: {defragCliCommand}</Text>
                  </VStack>
                </Box>
              </VStack>
            ) : null}
          </ModalBody>
          <ModalFooter className="gap-3 flex-wrap">
            <Button
              action="negative"
              className="rounded-xl bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
              onPress={() => setDeleteRaidTarget(raidModal)}
            >
              <ButtonIcon as={Trash2} size="sm" />
              <ButtonText className="text-background-0 dark:text-[#0A1628]">Remove RAID</ButtonText>
            </Button>
            <Button action="primary" onPress={() => setRaidModal(null)}>
              <ButtonText>Close</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={actionModal !== null} onClose={closeActionModal} size="lg">
        <ModalBackdrop />
        <ModalContent className="max-w-2xl">
          <ModalHeader className="flex-row items-start justify-between">
            <Heading size="md" className="text-typography-900">
              {actionModal === "mount" ? "Mount / Unmount" : null}
              {actionModal === "addDisk" ? "Add Disk" : null}
              {actionModal === "removeDisk" ? "Remove Disk" : null}
              {actionModal === "replaceDisk" ? "Replace Disk" : null}
              {actionModal === "changeLevel" ? "Change RAID Level" : null}
              {actionModal === "autoMount" ? "Auto-mount" : null}
            </Heading>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-3">
            {actionModal === "mount" ? (
              <VStack className="gap-3">
                <HStack className="gap-3 flex-wrap">
                  <Input className="flex-1">
                    <InputField
                      value={mountPoint}
                      onChangeText={setMountPoint}
                      placeholder="Mount point"
                    />
                  </Input>
                  <CompressionSelect value={compression} onChange={setCompression} />
                </HStack>
                <HStack className="gap-3">
                  <Button
                    action="primary"
                    onPress={() => {
                      if (!raidModal?.uuid) return;
                      if (!mountPoint.trim()) {
                        showToast("Mount point required", "Informe onde montar o volume.", "error");
                        return;
                      }
                      performAction("mount", () => mountRaid(selectedMachine, { uuid: raidModal.uuid, mount_point: mountPoint, compression }), false).finally(closeActionModal);
                    }}
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "mount" ? <ButtonSpinner /> : <ButtonIcon as={Power} size="sm" />}
                    <ButtonText>Mount</ButtonText>
                  </Button>
                  <HStack className="gap-2 items-center">
                    <Switch value={forceUnmount} onValueChange={setForceUnmount} />
                    <Text className="text-typography-800">Force</Text>
                  </HStack>
                  <Button
                    action="default"
                    variant="outline"
                    onPress={() =>
                      raidModal?.uuid &&
                      performAction("unmount", () => unmountRaid(selectedMachine, { uuid: raidModal.uuid, force: forceUnmount }), false).finally(closeActionModal)
                    }
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "unmount" ? <ButtonSpinner /> : <ButtonIcon as={Power} size="sm" />}
                    <ButtonText>Unmount</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            ) : null}

            {actionModal === "addDisk" ? (
              <VStack className="gap-3">
                <Input>
                  <InputField value={addDiskValue} onChangeText={setAddDiskValue} placeholder="/dev/sdx" />
                </Input>
                <QuickPills options={freeDiskNames.slice(0, 8)} onSelect={setAddDiskValue} />
                <Button
                  action="primary"
                  onPress={() =>
                    raidModal?.uuid &&
                    performAction("add disk", () => addDiskRaid(selectedMachine, { uuid: raidModal.uuid, disk: addDiskValue }), false).finally(closeActionModal)
                  }
                  isDisabled={savingAction !== null}
                >
                  {savingAction === "add disk" ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
                  <ButtonText>Add Disk</ButtonText>
                </Button>
              </VStack>
            ) : null}

            {actionModal === "removeDisk" ? (
              <VStack className="gap-3">
                <Input>
                  <InputField value={removeDiskValue} onChangeText={setRemoveDiskValue} placeholder="/dev/sdx" />
                </Input>
                <QuickPills options={raidDeviceNames} onSelect={setRemoveDiskValue} />
                <Button
                  action="negative"
                  className="rounded-xl bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
                  onPress={() =>
                    raidModal?.uuid &&
                    performAction("remove disk", () => removeDiskRaid(selectedMachine, { uuid: raidModal.uuid, disk: removeDiskValue }), false).finally(closeActionModal)
                  }
                  isDisabled={savingAction !== null}
                >
                  {savingAction === "remove disk" ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
                  <ButtonText className="text-background-0 dark:text-[#0A1628]">Remove Disk</ButtonText>
                </Button>
              </VStack>
            ) : null}

            {actionModal === "replaceDisk" ? (
              <VStack className="gap-3">
                <HStack className="gap-3 flex-wrap">
                  <Input className="flex-1">
                    <InputField value={replaceOld} onChangeText={setReplaceOld} placeholder="Old disk" />
                  </Input>
                  <Input className="flex-1">
                    <InputField value={replaceNew} onChangeText={setReplaceNew} placeholder="New disk" />
                  </Input>
                </HStack>
                <QuickPills options={raidDeviceNames} onSelect={setReplaceOld} />
                <QuickPills options={freeDiskNames.slice(0, 8)} onSelect={setReplaceNew} />
                <Button
                  action="primary"
                  onPress={() =>
                    raidModal?.uuid &&
                    performAction("replace disk", () => replaceDiskRaid(selectedMachine, { uuid: raidModal.uuid, old_disk: replaceOld, new_disk: replaceNew }), false).finally(closeActionModal)
                  }
                  isDisabled={savingAction !== null}
                >
                  {savingAction === "replace disk" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                  <ButtonText>Replace Disk</ButtonText>
                </Button>
              </VStack>
            ) : null}

            {actionModal === "changeLevel" ? (
              <VStack className="gap-3">
                <Select selectedValue={newRaidLevel} onValueChange={setNewRaidLevel}>
                  <SelectTrigger>
                    <SelectInput
                      placeholder="raid1"
                      value={RAID_LEVEL_OPTIONS.find((opt) => opt.value === newRaidLevel)?.label ?? newRaidLevel}
                    />
                    <SelectIcon as={ChevronDownIcon} />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {RAID_LEVEL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} label={opt.label} />
                      ))}
                    </SelectContent>
                  </SelectPortal>
                </Select>
                {typeof newRaidMinDisks === "number" ? (
                  <Text className="text-typography-600 text-xs">
                    {`Min disks for ${newRaidLabel}: ${newRaidMinDisks}. Current: ${raidDeviceCount ?? "n/a"}.`}
                  </Text>
                ) : null}
                <Button
                  action="primary"
                  onPress={() => {
                    if (!raidModal?.uuid) return;
                    if (typeof newRaidMinDisks === "number" && typeof raidDeviceCount === "number" && raidDeviceCount < newRaidMinDisks) {
                      const diskLabel = newRaidMinDisks === 1 ? "disk" : "disks";
                      showToast("Not enough disks", `Requires at least ${newRaidMinDisks} ${diskLabel} for ${newRaidLabel}. Current: ${raidDeviceCount}.`, "error");
                      return;
                    }
                    performAction("change level", () => changeRaidLevel(selectedMachine, { uuid: raidModal.uuid, new_raid_level: newRaidLevel }), false).finally(closeActionModal);
                  }}
                  isDisabled={savingAction !== null}
                >
                  {savingAction === "change level" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                  <ButtonText>Change Level</ButtonText>
                </Button>
              </VStack>
            ) : null}

            {actionModal === "autoMount" ? (
              <VStack className="gap-3">
                <Text className="text-typography-700 text-sm">Quick auto-mount setup (full control on the dedicated page).</Text>
                <HStack className="gap-3 flex-wrap">
                  <Input className="flex-1">
                    <InputField value={autoMountPoint} onChangeText={setAutoMountPoint} placeholder="/mnt/raid" />
                  </Input>
                  <CompressionSelect value={autoCompression} onChange={setAutoCompression} />
                </HStack>
                <HStack className="gap-2 flex-wrap">
                  <Button
                    action="primary"
                    onPress={() => {
                      if (!raidModal?.uuid) return;
                      if (!autoMountPoint.trim()) {
                        showToast("Mount point required", "Defina o caminho para auto-mount.", "error");
                        return;
                      }
                      performAction("auto-mount", () => createAutomaticMount(selectedMachine, { uuid: raidModal.uuid, mount_point: autoMountPoint, compression: autoCompression }), false).finally(closeActionModal);
                    }}
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "auto-mount" ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
                    <ButtonText>Enable Auto-mount</ButtonText>
                  </Button>
                  {currentAutoMount?.id ? (
                    <Button
                      action="negative"
                      className="rounded-xl bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
                      onPress={() =>
                        performAction("remove auto-mount", () => deleteAutomaticMount(currentAutoMount.id), false).finally(closeActionModal)
                      }
                      isDisabled={savingAction !== null}
                    >
                      {savingAction === "remove auto-mount" ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
                      <ButtonText className="text-background-0 dark:text-[#0A1628]">Remove Auto-mount</ButtonText>
                    </Button>
                  ) : null}
                  <Button variant="outline" action="default" onPress={() => { closeActionModal(); router.push("/btrfs-automatic-mounts"); }}>
                    <ButtonText>Open Auto-Mounts page</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" action="default" onPress={closeActionModal}>
              <ButtonText>Fechar</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={Boolean(deleteRaidTarget)} onClose={() => setDeleteRaidTarget(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="md" className="text-typography-900">
              Remove RAID?
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-typography-700">
              This action will delete RAID{" "}
              <Text className="font-semibold">{deleteRaidTarget?.uuid}</Text>. Do you want to continue?
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setDeleteRaidTarget(null)} isDisabled={savingAction !== null}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button
              action="negative"
              className="rounded-xl bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
              onPress={() =>
                deleteRaidTarget?.uuid &&
                performAction("remove RAID", () => removeRaid(selectedMachine, deleteRaidTarget.uuid)).then(() => {
                  setDeleteRaidTarget(null);
                  setRaidModal(null);
                })
              }
              isDisabled={savingAction !== null}
            >
              {savingAction === "remove RAID" ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
              <ButtonText className="text-background-0 dark:text-[#0A1628]">Remove</ButtonText>
            </Button>
          </AlertDialogFooter>
          <AlertDialogCloseButton />
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
