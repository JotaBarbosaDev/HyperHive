import React from "react";
import { RefreshControl, ScrollView } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Pressable } from "@/components/ui/pressable";
import { Divider } from "@/components/ui/divider";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogCloseButton,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@/components/ui/select";
import {
  FormControl,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Switch } from "@/components/ui/switch";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Machine } from "@/types/machine";
import { SmartDiskDevice, SmartDiskReallocStatus, SmartDiskSchedule, SmartDiskSelfTestProgress } from "@/types/smartdisk";
import { listMachines } from "@/services/hyperhive";
import { listAllDisks } from "@/services/btrfs";
import {
  cancelSelfTest,
  createSchedule,
  deleteSchedule,
  enableSchedule,
  getRealloc,
  getReallocStatus,
  getSelfTestProgress,
  listSchedules,
  listSmartDisks,
  reallocCancel,
  reallocFullWipe,
  reallocNonDestructive,
  startSelfTest,
  updateSchedule,
} from "@/services/smartdisk";
import { Activity, CalendarClock, ChevronDown, HardDrive, Info, Play, RefreshCcw, ShieldCheck, Trash2, XCircle } from "lucide-react-native";

type DetailTab = "info" | "selftest" | "realloc";

const TEST_TYPES = [
  { value: "short", label: "Short Self-Test (~2 min)" },
  { value: "extended", label: "Extended Self-Test (longer)" },
];

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }).map((_, i) => ({ value: i, label: `${String(i).padStart(2, "0")}:00` }));
const STATUS_ACTION: Record<string, "success" | "warning" | "error"> = {
  ok: "success",
  healthy: "success",
  pass: "success",
  passed: "success",
  attention: "warning",
  atencao: "warning",
  warning: "warning",
  warn: "warning",
  critical: "error",
  error: "error",
  failed: "error",
  fail: "error",
};
const POLL_INTERVAL = 10_000;

const normalizeDevicePath = (dev?: string | null): string | null => {
  if (!dev) return null;
  if (dev.startsWith("/dev/")) return dev;
  if (/^(sd|nvme|vd|hd|xvd|loop)/.test(dev)) return `/dev/${dev}`;
  return null;
};

const isAllowedDevice = (dev?: string | null) => {
  const normalized = normalizeDevicePath(dev);
  if (!normalized) return false;
  return /^\/dev\/(sd|nvme|vd|hd|xvd|loop)/.test(normalized);
};

const buildDeviceMeta = (rawDevices: any[]): Record<string, string> => {
  const meta: Record<string, string> = {};
  rawDevices.forEach((d) => {
    const device = normalizeDevicePath(d?.device ?? d?.path ?? d?.name ?? d) ?? "";
    if (!device) return;
    const model = d?.model ?? "";
    if (model) meta[device] = model;
  });
  return meta;
};

const formatTemp = (temp?: string | number) => {
  if (temp === null || temp === undefined || temp === "") return "—";
  const num = typeof temp === "number" ? temp : Number(temp);
  if (Number.isNaN(num)) return String(temp);
  return `${num}°C`;
};

const formatCapacity = (value?: string | number) => {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  const tb = 1024 ** 4;
  const gb = 1024 ** 3;
  if (num >= tb) return `${(num / tb).toFixed(2)} TB`;
  if (num >= gb) return `${(num / gb).toFixed(2)} GB`;
  return `${num}`;
};

const getDeviceLabel = (dev: string, disks: SmartDiskDevice[], meta: Record<string, string>) => {
  const found = disks.find((d) => d.device === dev);
  if (found) {
    const model = found.model || meta[dev];
    return model ? `${dev} - ${model}` : dev;
  }
  if (meta[dev]) return `${dev} - ${meta[dev]}`;
  return dev;
};

const badgeStatus = (status?: string) => {
  if (!status) return null;
  const key = status.toLowerCase();
  const normalizedKey = key.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const action: "success" | "warning" | "error" | "muted" =
    STATUS_ACTION[normalizedKey] ?? STATUS_ACTION[key] ?? "muted";
  return (
    <Badge className="rounded-full px-3 py-1" size="sm" action={action} variant="solid">
      <BadgeText className="text-xs font-semibold">{status}</BadgeText>
    </Badge>
  );
};

export default function SmartDiskScreen() {
  const toast = useToast();
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = React.useState<string>("");
  const [disks, setDisks] = React.useState<SmartDiskDevice[]>([]);
  const [deviceOptions, setDeviceOptions] = React.useState<string[]>([]);
  const deviceListRef = React.useRef<string[]>([]);
  const [deviceMeta, setDeviceMeta] = React.useState<Record<string, string>>({});
  const [schedules, setSchedules] = React.useState<SmartDiskSchedule[]>([]);
  const [selfProgress, setSelfProgress] = React.useState<Record<string, SmartDiskSelfTestProgress>>({});
  const [reallocStatuses, setReallocStatuses] = React.useState<Record<string, SmartDiskReallocStatus>>({});
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [savingAction, setSavingAction] = React.useState<string | null>(null);

  const [detailDevice, setDetailDevice] = React.useState<string | null>(null);
  const [detailTab, setDetailTab] = React.useState<DetailTab>("info");
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [selfTestType, setSelfTestType] = React.useState<string>("short");
  const [rawDetailsOpen, setRawDetailsOpen] = React.useState(false);
  const [confirmState, setConfirmState] = React.useState<{
    id: string;
    message: string;
    remaining: number;
    run: () => Promise<void> | void;
  } | null>(null);

  const [scheduleModal, setScheduleModal] = React.useState(false);
  const [editingSchedule, setEditingSchedule] = React.useState<SmartDiskSchedule | null>(null);
  const defaultSchedule = React.useMemo(
    () => ({ device: "", type: "short", week_day: 0, hour: 0, active: true }),
    []
  );
  const [scheduleForm, setScheduleForm] = React.useState<{ device: string; type: string; week_day: number; hour: number; active: boolean }>(
    defaultSchedule
  );

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const modalBackdropClass = "bg-background-950/60 dark:bg-black/70";
  const modalShellClass = "w-full rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]";
  const modalHeaderClass = "flex-row items-start justify-between px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#1E2F47]";
  const modalBodyScrollClass = "px-6 pt-5 pb-6 max-h-[70vh] overflow-y-auto";
  const modalFooterClass = "gap-3 px-6 pt-4 pb-6 border-t border-outline-100 dark:border-[#1E2F47]";
  const modalTabsClass = "rounded-2xl border border-outline-100 dark:border-[#1E2F47] bg-background-50 dark:bg-[#132038] p-1";
  const cardShellClass = "rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] shadow-soft-1";
  const softCardShellClass = "rounded-xl border border-outline-100 bg-background-50 dark:border-[#1E2F47] dark:bg-[#132038]";
  const outlineButtonClass = "border-outline-200 rounded-xl dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] hover:bg-background-50 dark:hover:bg-[#0A1628]";
  const outlineButtonTextClass = "text-typography-900 dark:text-[#E8EBF0]";
  const outlineButtonIconClass = "text-typography-900 dark:text-[#E8EBF0]";
  const dangerOutlineTextClass = "text-error-600 dark:text-error-400";
  const dangerOutlineIconClass = "text-error-600 dark:text-error-400";
  const neutralBadgeClass = "rounded-full px-3 py-1 border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]";
  const neutralBadgeTextClass = "text-xs text-typography-800 dark:text-[#E8EBF0]";
  const iconMutedClass = "text-typography-700 dark:text-[#9AA4B8]";
  const iconPrimaryClass = "text-typography-900 dark:text-[#E8EBF0]";
  const dividerClass = "opacity-60 border-outline-100 dark:border-[#1E2F47]";
  const selectTriggerClass = "rounded-xl border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]";
  const selectInputClass = "text-typography-900 dark:text-[#E8EBF0] placeholder:text-typography-500 dark:placeholder:text-[#9AA4B8]";
  const selectIconClass = "text-typography-700 dark:text-[#9AA4B8]";
  const formLabelTextClass = "text-typography-800 dark:text-[#E8EBF0]";
  const formHelperTextClass = "text-typography-600 dark:text-[#9AA4B8]";

  const showToast = React.useCallback(
    (title: string, description: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1 items-start flex-row" action={action}>
            <ToastTitle size="sm">{title}</ToastTitle>
            {description ? <ToastDescription size="sm">{description}</ToastDescription> : null}
          </Toast>
        ),
      });
    },
    [toast]
  );

  const refreshStatuses = React.useCallback(
    async (devices?: string[]) => {
      if (!selectedMachine) return;
      const list = devices && devices.length > 0 ? devices : deviceListRef.current;
      if (!list.length) {
        setSelfProgress({});
        setReallocStatuses({});
        return;
      }
      try {
        const progressResults = await Promise.all(
          list.map(async (dev) => {
            try {
              const resp = await getSelfTestProgress(selectedMachine, dev);
              return resp;
            } catch (err) {
              console.warn("self-test progress failed for", dev, err);
              return null;
            }
          })
        );
        const progressMap: Record<string, SmartDiskSelfTestProgress> = {};
        progressResults.forEach((item, idx) => {
          if (!item) return;
          const key = item.device || list[idx];
          progressMap[key] = item;
        });
        setSelfProgress((prev) => ({ ...prev, ...progressMap }));
      } catch (err) {
        console.warn("self-test polling error", err);
      }
      try {
        const reallocList = await getRealloc(selectedMachine);
        const reallocMap: Record<string, SmartDiskReallocStatus> = {};
        (Array.isArray(reallocList) ? reallocList : []).forEach((r) => {
          if (r?.device) reallocMap[r.device] = r;
        });
        setReallocStatuses((prev) => ({ ...prev, ...reallocMap }));
      } catch (err) {
        console.warn("realloc polling error", err);
      }
    },
    [selectedMachine]
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
      showToast("Failed to load machines", "Try again.", "error");
    }
  }, [showToast]);

  const loadData = React.useCallback(
    async (mode: "full" | "refresh" = "full") => {
      if (!selectedMachine) return;
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const [rawDevices, schedResp] = await Promise.all([listAllDisks(selectedMachine).catch(() => []), listSchedules(selectedMachine)]);
        const meta = buildDeviceMeta(Array.isArray(rawDevices) ? rawDevices : []);
        setDeviceMeta(meta);
        const deviceList = Array.from(
          new Set(
            (Array.isArray(rawDevices) ? rawDevices : [])
              .map((d) => (d as any).device || (d as any).path || (d as any).name)
              .map(normalizeDevicePath)
              .filter(Boolean) as string[]
          )
        ).filter(isAllowedDevice);
        deviceListRef.current = deviceList;
        setDeviceOptions(deviceList);

        const smartResults = await Promise.allSettled(
          deviceList.map(async (dev) => {
            const result = await listSmartDisks(selectedMachine, dev);
            if (Array.isArray(result) && result.length > 0) return result[0];
            return { device: dev } as SmartDiskDevice;
          })
        );
        const parsedDisks = deviceList.map((dev, idx) => {
          const item = smartResults[idx];
          const base = { device: dev, model: meta[dev] } as SmartDiskDevice;
          if (item.status === "fulfilled" && item.value) {
            return { ...base, ...item.value };
          }
          return base;
        });
        setDisks(parsedDisks);
        setSchedules(Array.isArray(schedResp) ? schedResp : []);
        setScheduleForm((prev) => {
          if (prev.device || !deviceList[0]) return prev;
          return { ...prev, device: deviceList[0] };
        });
        await refreshStatuses(deviceList);
      } catch (err) {
        console.error("Failed to load smart tests data", err);
        showToast("Error loading", "Unable to fetch disks.", "error");
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [selectedMachine, showToast, refreshStatuses]
  );

  React.useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  React.useEffect(() => {
    if (selectedMachine) {
      loadData();
    }
  }, [selectedMachine, loadData]);

  React.useEffect(() => {
    if (!selectedMachine) return;
    refreshStatuses();
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    pollRef.current = setInterval(() => {
      refreshStatuses();
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedMachine, refreshStatuses]);

  React.useEffect(() => {
    if (!detailDevice) return;
    if (detailTab === "selftest" || detailTab === "realloc") {
      refreshStatuses([detailDevice]);
    }
    if (detailTab === "realloc") {
      getReallocStatus(selectedMachine, detailDevice)
        .then((status) => {
          setReallocStatuses((prev) => ({ ...prev, [detailDevice]: status as SmartDiskReallocStatus }));
        })
        .catch((err) => console.warn("Failed to fetch realloc status", err));
    }
  }, [detailDevice, detailTab, refreshStatuses, selectedMachine]);

  const openDetail = async (device: string, tab: DetailTab = "info") => {
    if (!device) return;
    setDetailTab(tab);
    setDetailDevice(device);
    setDetailLoading(true);
    try {
      const resp = await listSmartDisks(selectedMachine, device);
      if (Array.isArray(resp) && resp.length > 0) {
        const detail = resp[0];
        setDisks((prev) => {
          const exists = prev.some((d) => d.device === device);
          if (!exists) return prev.concat(detail);
          return prev.map((d) => (d.device === device ? { ...d, ...detail } : d));
        });
      }
    } catch (err) {
      console.warn("Failed to refresh disk detail", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStartSelfTest = async () => {
    if (!detailDevice) return;
    setSavingAction("selftest-start");
    try {
      await startSelfTest(selectedMachine, { device: detailDevice, type: selfTestType });
      showToast("Self-test started", `${detailDevice} running ${selfTestType}.`);
      await refreshStatuses();
    } catch (err) {
      console.error("Failed to start self-test", err);
      showToast("Error starting", "Try again.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const requestStartSelfTest = () => {
    if (!detailDevice) return;
    const confirmations = selfTestType === "extended" ? 2 : 1;
    const message =
      selfTestType === "extended"
        ? `Run EXTENDED self-test on ${detailDevice}? This may take longer.`
        : `Run short self-test on ${detailDevice}?`;
    confirmAndRun(`selftest-${detailDevice}-${selfTestType}`, message, confirmations, handleStartSelfTest);
  };

  const handleCancelSelfTest = async () => {
    if (!detailDevice) return;
    setSavingAction("selftest-cancel");
    try {
      await cancelSelfTest(selectedMachine, detailDevice);
      showToast("Self-test cancelled", `${detailDevice} stopped.`);
      await refreshStatuses();
    } catch (err) {
      console.error("Failed to cancel self-test", err);
      showToast("Error cancelling", "Try again.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const handleReallocAction = async (action: "full" | "non" | "cancel") => {
    if (!detailDevice) return;
    const actionKey = `realloc-${action}`;
    setSavingAction(actionKey);
    try {
      if (action === "full") await reallocFullWipe(selectedMachine, detailDevice);
      if (action === "non") await reallocNonDestructive(selectedMachine, detailDevice);
      if (action === "cancel") await reallocCancel(selectedMachine, detailDevice);
      showToast("Realloc sent", `${detailDevice} ${action === "cancel" ? "cancelled" : "updated"}.`);
      await refreshStatuses();
    } catch (err) {
      console.error("Failed realloc action", err);
      showToast("Realloc error", "Check the endpoint.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const requestReallocAction = (action: "full" | "non" | "cancel") => {
    if (!detailDevice) return;
    const confirmations = action === "full" ? 2 : action === "non" ? 1 : 0;
    const message =
      action === "full"
        ? `Run FULL WIPE realloc on ${detailDevice}? This is destructive.`
        : action === "non"
        ? `Run non-destructive realloc on ${detailDevice}?`
        : `Cancel realloc on ${detailDevice}?`;
    if (confirmations > 0) {
      confirmAndRun(`realloc-${action}-${detailDevice}`, message, confirmations, () => handleReallocAction(action));
    } else {
      void handleReallocAction(action);
    }
  };

  const openSchedule = (sched?: SmartDiskSchedule) => {
    if (sched) {
      setEditingSchedule(sched);
      setScheduleForm({
        device: sched.device,
        type: sched.type,
        week_day: sched.week_day,
        hour: sched.hour,
        active: sched.active,
      });
    } else {
      setEditingSchedule(null);
      setScheduleForm((prev) => ({
        ...defaultSchedule,
        device: deviceOptions[0] ?? prev.device,
        type: prev.type,
      }));
    }
    setScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleForm.device) {
      showToast("Select a disk", "Device is required.", "error");
      return;
    }
    const payload = { ...scheduleForm };
    const actionKey = editingSchedule ? "schedule-update" : "schedule-create";
    setSavingAction(actionKey);
    try {
      if (editingSchedule) {
        await updateSchedule(selectedMachine, editingSchedule.id, payload as any);
        showToast("Schedule updated", "Schedule changed.");
      } else {
        await createSchedule(selectedMachine, payload as any);
        showToast("Schedule created", "Test scheduled.");
      }
      setScheduleModal(false);
      await loadData("refresh");
    } catch (err) {
      console.error("Failed to save schedule", err);
      showToast("Schedule error", "Try again.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const toggleSchedule = async (sched: SmartDiskSchedule) => {
    setSavingAction(`sched-toggle-${sched.id}`);
    try {
      await enableSchedule(selectedMachine, sched.id, !sched.active);
      showToast("Schedule updated", !sched.active ? "Enabled" : "Disabled");
      await loadData("refresh");
    } catch (err) {
      console.error("toggle schedule failed", err);
      showToast("Error updating", "Unable to toggle.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const handleDeleteSchedule = async (sched: SmartDiskSchedule) => {
    setSavingAction(`sched-del-${sched.id}`);
    try {
      await deleteSchedule(selectedMachine, sched.id);
      showToast("Schedule removed", "Schedule deleted.");
      setScheduleModal(false);
      setEditingSchedule(null);
      await loadData("refresh");
    } catch (err) {
      console.error("Failed to delete schedule", err);
      showToast("Error removing", "Try again.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const renderSelfTestBar = (device: string) => {
    const progress = selfProgress[device];
    const status = progress?.status?.toLowerCase?.();
    if (!progress || status === "idle") return null;
    const value = progress.progressPercent ?? 0;
    return (
      <Box className={`mt-2 p-2 ${softCardShellClass}`}>
        <HStack className="justify-between items-center mb-1">
          <HStack className="items-center gap-2">
            <Activity size={14} className={iconMutedClass} />
            <Text className="text-typography-800 dark:text-[#E8EBF0] text-sm">Self-test {progress.type || ""}</Text>
          </HStack>
          <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">{value}%</Text>
        </HStack>
        <Progress value={value}>
          <ProgressFilledTrack />
        </Progress>
        <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs mt-1">{progress.status || "Running"}</Text>
      </Box>
    );
  };

  const renderReallocBar = (device: string) => {
    const realloc = reallocStatuses[device];
    if (!realloc || realloc.completed) return null;
    const value = realloc.percent ?? 0;
    return (
      <Box className={`mt-2 p-2 ${softCardShellClass}`}>
        <HStack className="justify-between items-center mb-1">
          <HStack className="items-center gap-2">
            <RefreshCcw size={14} className={iconMutedClass} />
            <Text className="text-typography-800 dark:text-[#E8EBF0] text-sm">{realloc.mode || "Realloc"}</Text>
          </HStack>
          <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">{value}%</Text>
        </HStack>
        <Progress value={value}>
          <ProgressFilledTrack />
        </Progress>
        {realloc.lastLine ? <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs mt-1">{realloc.lastLine}</Text> : null}
      </Box>
    );
  };

  const detailDisk = disks.find((d) => d.device === detailDevice);
  const detailProgress = detailDevice ? selfProgress[detailDevice] : undefined;
  const detailRealloc = detailDevice ? reallocStatuses[detailDevice] : undefined;
  const rawEntries = React.useMemo(() => {
    if (!detailDisk) return [];
    const source = (detailDisk as any).raw ?? (detailDisk as any);
    const { testsHistory, selfTests, smartTests, ...rest } = source;
    const flat: Record<string, any> = { ...rest };
    if (rest?.metrics && typeof rest.metrics === "object") {
      Object.entries(rest.metrics).forEach(([k, v]) => {
        flat[`metrics.${k}`] = v;
      });
      delete flat.metrics;
    }
    return Object.entries(flat).filter(([, v]) => v !== undefined && v !== null && v !== "");
  }, [detailDisk]);

  const confirmAndRun = React.useCallback(
    (id: string, message: string, confirmations: number, run: () => Promise<void> | void) => {
      const count = confirmations <= 0 ? 0 : confirmations;
      if (count === 0) {
        void Promise.resolve(run());
        return;
      }
      if (count === 1) {
        setConfirmState({ id, message, remaining: 1, run });
        return;
      }
      setConfirmState({ id, message, remaining: count, run });
    },
    []
  );

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 32}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData("refresh")}
          />
        }
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            SMART Tests
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Monitor disks, run self-tests, and track reallocation in real time.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <HStack className="gap-3 items-center flex-wrap">
              <Select
                selectedValue={selectedMachine}
                onValueChange={(val) => setSelectedMachine(val)}
              >
                <SelectTrigger className={`${selectTriggerClass} min-w-[200px] pr-2`}>
                  <SelectInput placeholder="Machine" value={selectedMachine} className={selectInputClass} />
                  <SelectIcon as={ChevronDown} className={selectIconClass} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {(machines ?? []).map((m) => (
                      <SelectItem
                        key={m.MachineName}
                        value={m.MachineName}
                        label={m.MachineName}
                      />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
              <Button
                variant="outline"
                action="default"
                size="sm"
                onPress={() => loadData("refresh")}
                className={`${outlineButtonClass} h-10`}
              >
                <ButtonIcon as={RefreshCcw} size="sm" className={outlineButtonIconClass} />
                <ButtonText className={outlineButtonTextClass}>Refresh</ButtonText>
              </Button>
            </HStack>
            <Button
              action="primary"
              variant="solid"
              size="md"
              onPress={() => openSchedule()}
              className="rounded-xl"
            >
              <ButtonIcon as={CalendarClock} size="sm" />
              <ButtonText>New Schedule</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            <VStack className="mt-6 gap-4">
              {[1, 2, 3].map((idx) => (
                <Box
                  key={idx}
                  className={`p-4 ${cardShellClass}`}
                >
                  <Skeleton className="h-5 w-1/3 mb-2" />
                  <SkeletonText className="w-3/4" />
                </Box>
              ))}
            </VStack>
          ) : (
            <>
              <VStack className="mt-6 gap-3">
                {(disks ?? []).length === 0 ? (
                  <Box className={`p-4 ${cardShellClass}`}>
                    <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                      No eligible disks found.
                    </Text>
                  </Box>
                ) : (
                  (disks ?? []).map((disk) => (
                    <Pressable
                      key={disk.device}
                      onPress={() => openDetail(disk.device)}
                      className={`p-4 ${cardShellClass}`}
                    >
                      <HStack className="items-center justify-between flex-wrap gap-2">
                        <HStack className="items-center gap-2 flex-1">
                          <HardDrive size={18} className={iconPrimaryClass} />
                          <VStack>
                            <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">
                              {getDeviceLabel(disk.device, disks, deviceMeta)}
                            </Text>
                            <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs">
                              {disk.serial ? `Serial ${disk.serial}` : ""}
                            </Text>
                          </VStack>
                        </HStack>
                        <HStack className="items-center gap-2">
                          {badgeStatus(disk.healthStatus || disk.status)}
                          <Badge
                            className={neutralBadgeClass}
                            size="sm"
                            action="muted"
                            variant="outline"
                          >
                            <BadgeText className={neutralBadgeTextClass}>
                              Temp {formatTemp(disk.temp)}
                            </BadgeText>
                          </Badge>
                        </HStack>
                      </HStack>

                      <HStack className="mt-3 items-center flex-wrap gap-3">
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                          Model: {disk.model || deviceMeta[disk.device] || "—"}
                        </Text>
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                          Capacity: {formatCapacity(disk.capacity)}
                        </Text>
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                          Reallocated: {disk.reallocated ?? 0}
                        </Text>
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                          Pending: {disk.pending ?? 0}
                        </Text>
                      </HStack>

                      {renderSelfTestBar(disk.device)}
                      {renderReallocBar(disk.device)}

                      <HStack className="mt-3 gap-2">
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => openDetail(disk.device, "selftest")}
                          className={outlineButtonClass}
                        >
                          <ButtonIcon as={Activity} size="sm" className={outlineButtonIconClass} />
                          <ButtonText className={outlineButtonTextClass}>
                            Self-test
                          </ButtonText>
                        </Button>
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => openDetail(disk.device, "realloc")}
                          className={outlineButtonClass}
                        >
                          <ButtonIcon as={RefreshCcw} size="sm" className={outlineButtonIconClass} />
                          <ButtonText className={outlineButtonTextClass}>
                            Realloc
                          </ButtonText>
                        </Button>
                        <Button
                          action="primary"
                          variant="solid"
                          size="sm"
                          onPress={() => openDetail(disk.device, "info")}
                          className="rounded-xl"
                        >
                          <ButtonIcon as={Info} size="sm" />
                          <ButtonText>Details</ButtonText>
                        </Button>
                      </HStack>
                    </Pressable>
                  ))
                )}
              </VStack>

              <Box className={`mt-8 ${cardShellClass}`}>
                <HStack className="px-4 py-3 items-center justify-between">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base">
                    Schedules
                  </Text>
                  <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                    {schedules.length} items
                  </Text>
                </HStack>
                <Divider className={dividerClass} />
                {schedules.length === 0 ? (
                  <Box className="p-4">
                    <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                      No schedules configured.
                    </Text>
                  </Box>
                ) : (
                  <VStack className="divide-y divide-outline-100 dark:divide-[#1E2F47]">
                    {schedules.map((sched) => (
                      <Box key={sched.id} className="px-4 py-3">
                        <HStack className="items-center gap-2 flex-wrap">
                          <CalendarClock size={16} className={iconMutedClass} />
                          <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold flex-1">
                            {getDeviceLabel(sched.device, disks, deviceMeta)}
                          </Text>
                          <Badge
                            className={neutralBadgeClass}
                            size="sm"
                            action="muted"
                            variant="outline"
                          >
                            <BadgeText className={neutralBadgeTextClass}>
                              {sched.type}
                            </BadgeText>
                          </Badge>
                          <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                            {WEEK_DAYS[sched.week_day] ?? sched.week_day}
                          </Text>
                          <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">{`${String(
                            sched.hour
                          ).padStart(2, "0")}:00`}</Text>
                          <Badge
                            className="rounded-full px-3 py-1"
                            size="sm"
                            action={sched.active ? "success" : "muted"}
                            variant="solid"
                          >
                            <BadgeText className="text-xs font-semibold">
                              {sched.active ? "Active" : "Inactive"}
                            </BadgeText>
                          </Badge>
                        </HStack>
                        <HStack className="mt-2 gap-2">
                          <Button
                            action="default"
                            variant="outline"
                            size="sm"
                            onPress={() => openSchedule(sched)}
                            className={outlineButtonClass}
                          >
                            <ButtonIcon as={Info} size="sm" className={outlineButtonIconClass} />
                            <ButtonText className={outlineButtonTextClass}>Edit</ButtonText>
                          </Button>
                          <Button
                            action="default"
                            variant="outline"
                            size="sm"
                            onPress={() => toggleSchedule(sched)}
                            isDisabled={
                              savingAction === `sched-toggle-${sched.id}`
                            }
                            className={outlineButtonClass}
                          >
                            {savingAction === `sched-toggle-${sched.id}` ? (
                              <ButtonSpinner />
                            ) : (
                              <ButtonIcon as={RefreshCcw} size="sm" className={outlineButtonIconClass} />
                            )}
                          </Button>
                          <Button
                            action="negative"
                            variant="outline"
                            size="sm"
                            onPress={() => handleDeleteSchedule(sched)}
                            isDisabled={
                              savingAction === `sched-del-${sched.id}`
                            }
                            className={outlineButtonClass}
                          >
                            {savingAction === `sched-del-${sched.id}` ? (
                              <ButtonSpinner />
                            ) : (
                              <ButtonIcon as={Trash2} size="sm" className={dangerOutlineIconClass} />
                            )}
                          </Button>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                )}
              </Box>
            </>
          )}
        </Box>
      </ScrollView>

      <Modal
        isOpen={detailDevice !== null}
        onClose={() => setDetailDevice(null)}
        size="lg"
      >
        <ModalBackdrop className={modalBackdropClass} />
        <ModalContent className={`max-w-3xl max-h-[90vh] ${modalShellClass}`}>
          <ModalHeader className={modalHeaderClass}>
            <VStack className="flex-1">
              <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
                {detailDevice}
              </Heading>
              <HStack className="gap-2 items-center flex-wrap">
                {badgeStatus(detailDisk?.healthStatus || detailDisk?.status)}
                <Badge
                  className={neutralBadgeClass}
                  size="sm"
                  action="muted"
                  variant="outline"
                >
                  <BadgeText className={neutralBadgeTextClass}>
                    Temp {formatTemp(detailDisk?.temp)}
                  </BadgeText>
                </Badge>
              </HStack>
            </VStack>
            <ModalCloseButton className="text-typography-500 dark:text-[#9AA4B8]" />
          </ModalHeader>
          <ModalBody className={modalBodyScrollClass}>
            <Box className={modalTabsClass}>
              <HStack className="gap-2 flex-wrap">
              {(["info", "selftest", "realloc"] as DetailTab[]).map((tab) => {
                const active = detailTab === tab;
                return (
                <Pressable
                  key={tab}
                  onPress={() => setDetailTab(tab)}
                  className={`px-4 py-2 rounded-full border transition-all ${active
                    ? "border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]"
                    : "border-transparent"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${active
                      ? "text-typography-900 dark:text-[#E8EBF0]"
                      : "text-typography-600 dark:text-[#9AA4B8]"
                    }`}
                  >
                    {tab === "info"
                      ? "Information"
                      : tab === "selftest"
                      ? "Self-test"
                      : "Realloc"}
                  </Text>
                </Pressable>
              );
            })}
            </HStack>
            </Box>

            {detailLoading ? (
              <VStack className="gap-3 mt-4">
                <Skeleton className="h-5 w-1/2" />
                <SkeletonText className="w-full" />
              </VStack>
            ) : detailTab === "info" ? (
              <VStack className="mt-4">
                <Box className={`p-3 ${softCardShellClass}`}>
                  <Text className="text-typography-800 dark:text-[#E8EBF0] font-semibold mb-2">
                    General
                  </Text>
                  <VStack className="gap-1">
                    <Text className="text-typography-700 dark:text-[#9AA4B8]">
                      Model: {detailDisk?.model || "—"}
                    </Text>
                    <Text className="text-typography-700 dark:text-[#9AA4B8]">
                      Serial: {detailDisk?.serial || "—"}
                    </Text>
                    <Text className="text-typography-700 dark:text-[#9AA4B8]">
                      Firmware: {detailDisk?.firmware || "—"}
                    </Text>
                    <Text className="text-typography-700 dark:text-[#9AA4B8]">
                      Capacity: {formatCapacity(detailDisk?.capacity)}
                    </Text>
                    <Text className="text-typography-700 dark:text-[#9AA4B8]">
                      Power On Hours: {detailDisk?.powerOnHours ?? "—"}
                    </Text>
                    <Text className="text-typography-700 dark:text-[#9AA4B8]">
                      Power Cycles:{" "}
                      {detailDisk?.powerCycles ??
                        detailDisk?.powerCycleCount ??
                        "—"}
                    </Text>
                  </VStack>
                  <Button
                    variant="outline"
                    action="default"
                    size="sm"
                    onPress={() => setRawDetailsOpen(true)}
                    className={`${outlineButtonClass} mt-3 self-start`}
                  >
                    <ButtonIcon as={Info} size="sm" className={outlineButtonIconClass} />
                    <ButtonText className={outlineButtonTextClass}>See full details</ButtonText>
                  </Button>
                </Box>
                <Box className={`p-3 ${softCardShellClass} mt-4`}>
                  <Text className="text-typography-800 dark:text-[#E8EBF0] font-semibold mb-2">
                    SMART
                  </Text>
                  <HStack className="gap-3 flex-wrap">
                    <Text className="text-typography-700 dark:text-[#9AA4B8]">
                      Reallocated Sectors:{" "}
                      {detailDisk?.metrics?.reallocatedSectors ?? "—"}
                    </Text>
                    <Text className="text-typography-700 dark:text-[#9AA4B8]">
                      Pending Sectors:{" "}
                      {detailDisk?.metrics?.pendingSectors ?? "—"}
                    </Text>
                    <Text className="text-typography-700 dark:text-[#9AA4B8]">
                      Offline Uncorrectable:{" "}
                      {detailDisk?.metrics?.offlineUncorrectable ?? "—"}
                    </Text>
                  </HStack>
                  {detailDisk?.recommendedAction ? (
                    <Badge
                      className={`mt-2 ${neutralBadgeClass}`}
                      size="sm"
                      action="muted"
                      variant="outline"
                    >
                      <BadgeText className={neutralBadgeTextClass}>
                        {detailDisk.recommendedAction}
                      </BadgeText>
                    </Badge>
                  ) : null}
                </Box>
                <Box className={`p-3 ${softCardShellClass} mt-4`}>
                  <Text className="text-typography-800 dark:text-[#E8EBF0] font-semibold mb-2">
                    Self-test History
                  </Text>
                  {detailDisk?.testsHistory &&
                  detailDisk.testsHistory.length > 0 ? (
                    <VStack className="gap-2">
                      {detailDisk.testsHistory.map((t, idx) => (
                        <Box
                          key={idx}
                          className={`p-2 ${softCardShellClass}`}
                        >
                          <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">
                            {t.type || "Test"}
                          </Text>
                          <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                            Status: {t.status || "—"}
                          </Text>
                          <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                            Lifetime Hours: {t.lifetimeHours ?? "—"}
                          </Text>
                        </Box>
                      ))}
                    </VStack>
                  ) : (
                    <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                      No history.
                    </Text>
                  )}
                </Box>
              </VStack>
            ) : detailTab === "selftest" ? (
              <VStack className="mt-4">
                <Box className={`p-3 ${softCardShellClass}`}>
                  <Text className="text-typography-800 dark:text-[#E8EBF0] font-semibold mb-2">
                    Progress
                  </Text>
                  {detailProgress &&
                  detailProgress.status?.toLowerCase?.() !== "idle" ? (
                    <>
                      <HStack className="justify-between items-center mb-1">
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                          {detailProgress.status}
                        </Text>
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                          {detailProgress.progressPercent ?? 0}%
                        </Text>
                      </HStack>
                      <Progress value={detailProgress.progressPercent ?? 0}>
                        <ProgressFilledTrack />
                      </Progress>
                    </>
                  ) : (
                    <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                      No self-test running.
                    </Text>
                  )}
                </Box>
                <FormControl className="mt-4">
                  <FormControlLabel>
                    <FormControlLabelText className={formLabelTextClass}>Test type</FormControlLabelText>
                  </FormControlLabel>
                  <Select
                    selectedValue={selfTestType}
                    onValueChange={(val) => setSelfTestType(val)}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectInput placeholder="Type" value={selfTestType} className={selectInputClass} />
                      <SelectIcon as={ChevronDown} className={selectIconClass} />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        {TEST_TYPES.map((t) => (
                          <SelectItem
                            key={t.value}
                            value={t.value}
                            label={t.label}
                          />
                        ))}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                  <FormControlHelper>
                    <FormControlHelperText className={formHelperTextClass}>
                      Self-test runs in background; we refresh progress every
                      minute.
                    </FormControlHelperText>
                  </FormControlHelper>
                </FormControl>
                <HStack className="gap-3 mt-4">
                  <Button
                    action="primary"
                    onPress={requestStartSelfTest}
                    isDisabled={savingAction === "selftest-start"}
                    className="rounded-xl"
                  >
                    {savingAction === "selftest-start" ? (
                      <ButtonSpinner />
                    ) : (
                      <ButtonIcon as={Play} size="sm" />
                    )}
                    <ButtonText>Start</ButtonText>
                  </Button>
                  <Button
                    action="negative"
                    variant="outline"
                    onPress={handleCancelSelfTest}
                    isDisabled={savingAction === "selftest-cancel"}
                    className={outlineButtonClass}
                  >
                    {savingAction === "selftest-cancel" ? (
                      <ButtonSpinner />
                    ) : (
                      <ButtonIcon as={XCircle} size="sm" className={dangerOutlineIconClass} />
                    )}
                    <ButtonText className={dangerOutlineTextClass}>Cancel</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            ) : (
              <VStack className="mt-4">
                <Box className={`p-3 ${softCardShellClass}`}>
                  <Text className="text-typography-800 dark:text-[#E8EBF0] font-semibold mb-2">
                    Realloc Status
                  </Text>
                  {detailRealloc && !detailRealloc.completed ? (
                    <>
                      <HStack className="justify-between items-center mb-1">
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                          {detailRealloc.mode || "Running"}
                        </Text>
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                          {detailRealloc.percent ?? 0}%
                        </Text>
                      </HStack>
                      <Progress value={detailRealloc.percent ?? 0}>
                        <ProgressFilledTrack />
                      </Progress>
                      {detailRealloc.lastLine ? (
                        <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs mt-1">
                          {detailRealloc.lastLine}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                      No operation in progress.
                    </Text>
                  )}
                </Box>
                <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm mt-4">
                  Choose a realloc mode for this disk:
                </Text>
                <HStack className="gap-2 flex-wrap mt-4">
                  <Button
                    action="primary"
                    variant="outline"
                    onPress={() => requestReallocAction("full")}
                    isDisabled={savingAction === "realloc-full"}
                    className="rounded-xl"
                  >
                    {savingAction === "realloc-full" ? (
                      <ButtonSpinner />
                    ) : (
                      <ButtonIcon as={RefreshCcw} size="sm" />
                    )}
                    <ButtonText>Full wipe</ButtonText>
                  </Button>
                  <Button
                    action="default"
                    variant="outline"
                    onPress={() => requestReallocAction("non")}
                    isDisabled={savingAction === "realloc-non"}
                    className={outlineButtonClass}
                  >
                    {savingAction === "realloc-non" ? (
                      <ButtonSpinner />
                    ) : (
                      <ButtonIcon as={ShieldCheck} size="sm" className={outlineButtonIconClass} />
                    )}
                    <ButtonText className={outlineButtonTextClass}>Non-destructive</ButtonText>
                  </Button>
                  <Button
                    action="negative"
                    variant="outline"
                    onPress={() => requestReallocAction("cancel")}
                    isDisabled={savingAction === "realloc-cancel"}
                    className={outlineButtonClass}
                  >
                    {savingAction === "realloc-cancel" ? (
                      <ButtonSpinner />
                    ) : (
                      <ButtonIcon as={Trash2} size="sm" className={dangerOutlineIconClass} />
                    )}
                    <ButtonText className={dangerOutlineTextClass}>Cancel</ButtonText>
                  </Button>
                </HStack>
                {detailRealloc?.error ? (
                  <Text className="text-error-600 dark:text-error-400 text-sm mt-3">
                    Error: {detailRealloc.error}
                  </Text>
                ) : null}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter className={modalFooterClass}>
            <Button
              action="default"
              variant="outline"
              onPress={() => setDetailDevice(null)}
              className={outlineButtonClass}
            >
              <ButtonText className={outlineButtonTextClass}>Close</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={scheduleModal}
        onClose={() => setScheduleModal(false)}
        size="lg"
      >
        <ModalBackdrop className={modalBackdropClass} />
        <ModalContent className={`max-w-2xl max-h-[90vh] ${modalShellClass}`}>
          <ModalHeader className={modalHeaderClass}>
            <VStack>
              <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
                {editingSchedule ? "Edit schedule" : "New schedule"}
              </Heading>
              <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                Configure recurring tests
              </Text>
            </VStack>
            <ModalCloseButton className="text-typography-500 dark:text-[#9AA4B8]" />
          </ModalHeader>
          <ModalBody className={modalBodyScrollClass}>
            <FormControl isRequired>
              <FormControlLabel>
                <FormControlLabelText className={formLabelTextClass}>Device</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={scheduleForm.device}
                onValueChange={(val) =>
                  setScheduleForm((prev) => ({...prev, device: val}))
                }
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectInput
                    placeholder="Select disk"
                    value={getDeviceLabel(
                      scheduleForm.device,
                      disks,
                      deviceMeta
                    )}
                    className={selectInputClass}
                  />
                  <SelectIcon as={ChevronDown} className={selectIconClass} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {(Array.isArray(deviceOptions) ? deviceOptions : []).map(
                      (dev) => {
                        const label = getDeviceLabel(dev, disks, deviceMeta);
                        return (
                          <SelectItem key={dev} value={dev} label={label} />
                        );
                      }
                    )}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

            <FormControl className="mt-4">
              <FormControlLabel>
                <FormControlLabelText className={formLabelTextClass}>Type</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={scheduleForm.type}
                onValueChange={(val) =>
                  setScheduleForm((prev) => ({...prev, type: val}))
                }
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectInput placeholder="Type" value={scheduleForm.type} className={selectInputClass} />
                  <SelectIcon as={ChevronDown} className={selectIconClass} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {TEST_TYPES.map((t) => (
                      <SelectItem
                        key={t.value}
                        value={t.value}
                        label={t.label}
                      />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

            <FormControl className="mt-4">
              <FormControlLabel>
                <FormControlLabelText className={formLabelTextClass}>Day of week</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={String(scheduleForm.week_day)}
                onValueChange={(val) =>
                  setScheduleForm((prev) => ({...prev, week_day: Number(val)}))
                }
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectInput
                    placeholder="Day"
                    value={String(scheduleForm.week_day)}
                    className={selectInputClass}
                  />
                  <SelectIcon as={ChevronDown} className={selectIconClass} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {WEEK_DAYS.map((day, idx) => (
                      <SelectItem key={idx} value={String(idx)} label={day} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

            <FormControl className="mt-4">
              <FormControlLabel>
                <FormControlLabelText className={formLabelTextClass}>Hour</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={String(scheduleForm.hour)}
                onValueChange={(val) =>
                  setScheduleForm((prev) => ({...prev, hour: Number(val)}))
                }
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectInput
                    placeholder="Hour"
                    value={String(scheduleForm.hour)}
                    className={selectInputClass}
                  />
                  <SelectIcon as={ChevronDown} className={selectIconClass} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {HOURS.map((h) => (
                      <SelectItem
                        key={h.value}
                        value={String(h.value)}
                        label={h.label}
                      />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

            <HStack className="items-center gap-2 mt-4">
              <Switch
                value={scheduleForm.active}
                onValueChange={(val) =>
                  setScheduleForm((prev) => ({...prev, active: val}))
                }
              />
              <Text className="text-typography-800 dark:text-[#E8EBF0]">Active</Text>
            </HStack>

            {editingSchedule?.last_run ? (
              <Text className="text-typography-600 dark:text-[#9AA4B8] text-xs mt-4">
                Last run: {editingSchedule.last_run}
              </Text>
            ) : null}
          </ModalBody>
          <ModalFooter className={modalFooterClass}>
            {editingSchedule ? (
              <Button
                action="negative"
                variant="outline"
                onPress={() =>
                  editingSchedule && handleDeleteSchedule(editingSchedule)
                }
                isDisabled={savingAction?.startsWith("sched-del-")}
                className={outlineButtonClass}
              >
                {savingAction?.startsWith("sched-del-") ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonIcon as={Trash2} size="sm" className={dangerOutlineIconClass} />
                )}
                <ButtonText className={dangerOutlineTextClass}>Delete</ButtonText>
              </Button>
            ) : null}
            <Button
              variant="outline"
              action="default"
              onPress={() => setScheduleModal(false)}
              isDisabled={savingAction?.startsWith("schedule")}
              className={outlineButtonClass}
            >
              <ButtonText className={outlineButtonTextClass}>Cancel</ButtonText>
            </Button>
            <Button
              action="primary"
              onPress={handleSaveSchedule}
              isDisabled={savingAction?.startsWith("schedule")}
              className="rounded-xl"
            >
              {savingAction?.startsWith("schedule") ? (
                <ButtonSpinner />
              ) : (
                <ButtonIcon as={CalendarClock} size="sm" />
              )}
              <ButtonText>Save</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog
        isOpen={confirmState !== null}
        onClose={() => setConfirmState(null)}
      >
        <AlertDialogBackdrop className={modalBackdropClass} />
        <AlertDialogContent className={`max-w-lg ${modalShellClass}`}>
          <AlertDialogHeader className={modalHeaderClass}>
            <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
              Confirm action
            </Heading>
            <AlertDialogCloseButton className="text-typography-500 dark:text-[#9AA4B8]" />
          </AlertDialogHeader>
          <AlertDialogBody className="px-6 pt-4 pb-6 gap-2">
            <Text className="text-typography-800 dark:text-[#E8EBF0]">{confirmState?.message}</Text>
            {confirmState && confirmState.remaining > 1 ? (
              <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                This action needs multiple confirmations. Confirm{" "}
                {confirmState.remaining} time(s) to proceed.
              </Text>
            ) : null}
          </AlertDialogBody>
          <AlertDialogFooter className="gap-2 px-6 pt-4 pb-6 border-t border-outline-100 dark:border-[#1E2F47]">
            <Button
              variant="outline"
              action="default"
              onPress={() => setConfirmState(null)}
              className={outlineButtonClass}
            >
              <ButtonText className={outlineButtonTextClass}>Cancel</ButtonText>
            </Button>
            <Button
              action="primary"
              className="rounded-xl"
              onPress={async () => {
                if (!confirmState) return;
                if (confirmState.remaining > 1) {
                  setConfirmState((prev) =>
                    prev ? {...prev, remaining: prev.remaining - 1} : prev
                  );
                  return;
                }
                const run = confirmState.run;
                setConfirmState(null);
                await Promise.resolve(run());
              }}
            >
              <ButtonText>Confirm</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal
        isOpen={rawDetailsOpen}
        onClose={() => setRawDetailsOpen(false)}
        size="lg"
      >
        <ModalBackdrop className={modalBackdropClass} />
        <ModalContent className={`max-w-3xl max-h-[90vh] ${modalShellClass}`}>
          <ModalHeader className={modalHeaderClass}>
            <VStack>
              <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
                Full Disk Details
              </Heading>
              <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                {detailDevice}
              </Text>
            </VStack>
            <ModalCloseButton className="text-typography-500 dark:text-[#9AA4B8]" />
          </ModalHeader>
          <ModalBody className={modalBodyScrollClass}>
            {rawEntries.length === 0 ? (
              <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                No details available.
              </Text>
            ) : (
              <VStack className="gap-2">
                {rawEntries.map(([key, value]) => (
                  <HStack key={key} className="justify-between gap-3">
                    <Text className="text-typography-700 dark:text-[#9AA4B8] flex-1">{key}</Text>
                    <Text className="text-typography-900 dark:text-[#E8EBF0] flex-1 text-right">
                      {Array.isArray(value)
                        ? JSON.stringify(value)
                        : String(value)}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter className={modalFooterClass}>
            <Button action="primary" className="rounded-xl" onPress={() => setRawDetailsOpen(false)}>
              <ButtonText>Close</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
