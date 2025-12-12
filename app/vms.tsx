import React from "react";
import { ScrollView, RefreshControl, useColorScheme } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Pressable } from "@/components/ui/pressable";
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton } from "@/components/ui/modal";
import { Divider } from "@/components/ui/divider";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Platform } from "react-native";
import { Heading } from '@/components/ui/heading';
import CreateVmModal from "@/components/modals/CreateVmModal";
import ImportVmModal from "@/components/modals/ImportVmModal";
import { ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket } from "@/services/websocket-client";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetIcon,
} from "@/components/ui/actionsheet";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { AlertDialog, AlertDialogBackdrop, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, AlertDialogCloseButton } from "@/components/ui/alert-dialog";
import { Input, InputField } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectItem,
  SelectIcon,
  SelectPortal,
  SelectContent,
  SelectBackdrop,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
} from "@/components/ui/select";
import {
  FormControl,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Switch } from "@/components/ui/switch";
import {
  getAllVMs,
  VirtualMachine,
  VmState,
  pauseVM,
  resumeVM,
  restartVM,
  shutdownVM,
  forceShutdownVM,
  startVM,
  migrateVM,
  coldMigrateVM,
  moveDisk,
  deleteVM,
  cloneVm as cloneVmApi,
  listSlaves,
  Slave,
  editVmResources,
  changeVmNetwork,
  changeVncPassword,
  removeAllIsos,
  getCpuDisableFeatures,
  updateCpuXml,
  getVmExportUrl,
} from "@/services/vms-client";
import { listMounts } from "@/services/hyperhive";
import { Mount } from "@/types/mount";
import { ApiError } from "@/services/api-client";
import { apiFetch } from "@/services/api-client";
import { getApiBaseUrl } from "@/config/apiConfig";
let Haptics: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Haptics = require("expo-haptics");
} catch (e) {
  Haptics = {
    impactAsync: async () => { },
    selectionAsync: async () => { },
    notificationAsync: async () => { },
    ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
    NotificationFeedbackType: { Success: "success", Warning: "warning" },
  };
}
import {
  Cpu,
  MemoryStick,
  Server,
  Square,
  RefreshCw,
  Plus,
  Play,
  Pause,
  Monitor,
  Zap,
  MoreVertical,
  Settings,
  Copy,
  GitBranch,
  HardDrive,
  Trash2,
  Check,
  RefreshCcw,
  AlertCircle,
  Disc3,
  Download,
  Upload,
  Lock,
} from "lucide-react-native";

// Interfaces TypeScript
interface VM {
  name: string;
  machineName: string;
  state: VmState;
  DefinedCPUS: number;
  DefinedRam: number;
  memoryMB: number;
  diskSizeGB: number;
  AllocatedGb: number;
  network: string;
  autoStart: boolean;
  diskPath: string;
  ip: string[];
  novnclink: string;
  novncPort: string;
  currentCpuUsage: number;
  currentMemoryUsageMB: number;
  cpuCount: number;
  isLive: boolean;
  realHostMemUsageMB: number;
}

interface VMState {
  label: string;
  color: string;
  badgeVariant: "solid" | "outline";
}

// Estados das VMs
const VM_STATES: Record<VmState, VMState> = {
  [VmState.UNKNOWN]: { label: "Unknown", color: "bg-gray-400", badgeVariant: "outline" },
  [VmState.RUNNING]: { label: "Running", color: "bg-green-500", badgeVariant: "solid" },
  [VmState.BLOCKED]: { label: "Blocked", color: "bg-red-500", badgeVariant: "solid" },
  [VmState.PAUSED]: { label: "Paused", color: "bg-yellow-500", badgeVariant: "solid" },
  [VmState.SHUTDOWN]: { label: "Shutdown", color: "bg-orange-500", badgeVariant: "solid" },
  [VmState.SHUTOFF]: { label: "Shutoff", color: "bg-gray-400", badgeVariant: "outline" },
  [VmState.CRASHED]: { label: "Crashed", color: "bg-red-600", badgeVariant: "solid" },
  [VmState.PMSUSPENDED]: { label: "PM Suspended", color: "bg-blue-400", badgeVariant: "solid" },
  [VmState.NOSTATE]: { label: "No State", color: "bg-gray-300", badgeVariant: "outline" },
};

// Função para mapear VirtualMachine para VM
const mapVirtualMachineToVM = (vm: VirtualMachine): VM => ({
  name: vm.name,
  machineName: vm.machineName,
  state: vm.state,
  DefinedCPUS: vm.DefinedCPUS,
  DefinedRam: vm.DefinedRam,
  memoryMB: vm.memoryMB,
  diskSizeGB: vm.diskSizeGB,
  AllocatedGb: vm.AllocatedGb,
  network: vm.network,
  autoStart: vm.autoStart,
  diskPath: vm.diskPath,
  ip: vm.ip,
  novnclink: vm.novnclink,
  novncPort: vm.novncPort,
  currentCpuUsage: vm.currentCpuUsage,
  currentMemoryUsageMB: vm.currentMemoryUsageMB,
  cpuCount: vm.cpuCount,
  isLive: vm.isLive,
  realHostMemUsageMB: (() => {
    const raw = (vm as any).RealHostMemUsage ?? (vm as any).realHostMemUsageMB;
    return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  })(),
});

export default function VirtualMachinesScreen() {
  const colorScheme = useColorScheme();
  const [vms, setVms] = React.useState<VM[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingVm, setLoadingVm] = React.useState<string | null>(null);
  const [openMenuFor, setOpenMenuFor] = React.useState<string | null>(null);
  const [detailsVm, setDetailsVm] = React.useState<VM | null>(null);
  const [showActionsheet, setShowActionsheet] = React.useState(false);
  const [selectedVm, setSelectedVm] = React.useState<VM | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<null | { type: "delete" | "force-shutdown"; vm: VM }>(null);
  const [openCreate, setOpenCreate] = React.useState(false);
  const [openImport, setOpenImport] = React.useState(false);
  const [editVm, setEditVm] = React.useState<VM | null>(null);
  const [cloneVm, setCloneVm] = React.useState<VM | null>(null);
  const [migrateVm, setMigrateVm] = React.useState<VM | null>(null);
  const [moveDiskVm, setMoveDiskVm] = React.useState<VM | null>(null);
  const [updateCpuVm, setUpdateCpuVm] = React.useState<VM | null>(null);
  const [restoreVm, setRestoreVm] = React.useState<VM | null>(null);
  const [changeVncVm, setChangeVncVm] = React.useState<VM | null>(null);
  const [pendingVmNames, setPendingVmNames] = React.useState<Set<string>>(new Set());
  const [mountOptions, setMountOptions] = React.useState<Mount[]>([]);
  const [slaveOptions, setSlaveOptions] = React.useState<Slave[]>([]);
  const [cloneOptionsLoading, setCloneOptionsLoading] = React.useState(false);
  const [deletingVm, setDeletingVm] = React.useState<string | null>(null);
  const [migratingVm, setMigratingVm] = React.useState<string | null>(null);
  const [exportingVm, setExportingVm] = React.useState<string | null>(null);
  const toast = useToast();
  const [showConsoleOptions, setShowConsoleOptions] = React.useState(false);
  const [consoleOptionsVm, setConsoleOptionsVm] = React.useState<VM | null>(null);
  const mountLookup = React.useMemo(() => {
    return mountOptions.map((mount) => {
      const { NfsShare } = mount;
      const label =
        NfsShare.Name?.trim() && NfsShare.Name.trim().length > 0
          ? NfsShare.Name.trim()
          : `${NfsShare.MachineName} • ${NfsShare.FolderPath}`;
      return {
        label,
        folderPath: (NfsShare.FolderPath ?? "").toLowerCase(),
        target: (NfsShare.Target ?? "").toLowerCase(),
        source: (NfsShare.Source ?? "").toLowerCase(),
      };
    });
  }, [mountOptions]);
  const getNfsNameByDiskPath = React.useCallback(
    (diskPath?: string) => {
      if (!diskPath) return null;
      const normalized = diskPath.toLowerCase();
      const match = mountLookup.find(({ folderPath, target, source }) => {
        if (target && normalized.startsWith(target)) {
          return true;
        }
        if (folderPath && normalized.includes(folderPath)) {
          return true;
        }
        if (source && normalized.includes(source)) {
          return true;
        }
        return false;
      });
      return match?.label ?? null;
    },
    [mountLookup]
  );
  const detailsVmNfsName = detailsVm ? getNfsNameByDiskPath(detailsVm.diskPath) : null;
  const isExportingSelectedVm = selectedVm ? exportingVm === selectedVm.name : false;

  const showToastMessage = React.useCallback(
    (
      title: string,
      description: string = "",
      actionType: "success" | "error" = "success"
    ) => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action={actionType}
          >
            <ToastTitle size="sm">{title}</ToastTitle>
            {description ? (
              <ToastDescription size="sm">{description}</ToastDescription>
            ) : null}
          </Toast>
        ),
      });
    },
    [toast]
  );

  const downloadTextFile = React.useCallback(
    async (content: string, fileName: string) => {
      if (Platform.OS === "web") {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        return fileName;
      }

      const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!baseDir) {
        throw new Error("Unable to access the storage directory.");
      }
      const fileUri = `${baseDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/plain",
          dialogTitle: fileName,
          UTI: "public.plain-text",
        });
      }
      return fileUri;
    },
    []
  );

  const handleExportVm = React.useCallback(
    async (vmToExport: VM) => {
      if (Platform.OS !== "web") {
        showToastMessage(
          "Export unavailable",
          "Export VM is only supported on the web version.",
          "error"
        );
        return;
      }
      setExportingVm(vmToExport.name);
      try {
        const { url, token } = await getVmExportUrl(vmToExport.name);
        const targetUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
        const opened = globalThis.window?.open(targetUrl, "_blank", "noopener,noreferrer");
        if (!opened) {
          throw new Error("Browser blocked the export tab. Allow popups for this site.");
        }
        showToastMessage("Export started", "The VM disk download opened in a new tab.");
      } catch (error) {
        console.error("Error exporting VM:", error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Unable to export VM disk.";
        showToastMessage("Error exporting VM", message, "error");
      } finally {
        setExportingVm(null);
      }
    },
    [showToastMessage]
  );

  const handleConsoleAction = React.useCallback(
    async (action: "browser" | "sprite" | "guest") => {
      const vm = consoleOptionsVm;
      if (!vm) return;
      setShowConsoleOptions(false);
      setConsoleOptionsVm(null);

      const apiBase = getApiBaseUrl();
      if (!apiBase) {
        showToastMessage(
          "Domain not configured",
          "Update the base URL before accessing the console.",
          "error"
        );
        return;
      }

      const normalizedBase = apiBase.replace(/\/+$/, "");

      try {
        if (action === "browser") {
          const target = `${normalizedBase}/novnc/vnc.html?path=${encodeURIComponent(
            `/novnc/ws?vm=${vm.name}`
          )}`;
          if (Platform.OS === "web") {
            const webWindow = globalThis.window;
            if (webWindow) {
              const opened = webWindow.open(target, "_blank", "noopener,noreferrer");
              if (!opened) {
                showToastMessage(
                  "Error",
                  "Could not open the new console tab.",
                  "error"
                );
              }
            } else {
              showToastMessage("Error", "Could not open the console in the browser.", "error");
            }
          } else {
            await WebBrowser.openBrowserAsync(target);
          }
          return;
        }

        if (action === "sprite") {
          const spriteText = await apiFetch<string>(
            `/novnc/sprite/${encodeURIComponent(vm.name)}`,
            {
              headers: {
                Accept: "text/plain",
              },
            }
          );
          const fileName = `${vm.name}.vv`;
          await downloadTextFile(spriteText, fileName);
          showToastMessage("Sprite saved", "The .vv file was generated.");
          return;
        }

        if (action === "guest") {
          const guestUrl = `${normalizedBase}/guest_api/guest_page/${encodeURIComponent(
            vm.name
          )}`;
          await Clipboard.setStringAsync(guestUrl);
          showToastMessage("Link copied", "Guest URL copied to the clipboard.");
          return;
        }
      } catch (error) {
        console.error("Error executing console action:", error);
        const message =
          error instanceof Error && error.message ? error.message : "Failed to perform the action.";
        showToastMessage("Error", message, "error");
      }
    },
    [consoleOptionsVm, showToastMessage]
  );

  const fetchAndSetVms = React.useCallback(async () => {
    const data = await getAllVMs();
    const vmArray = Array.isArray(data) ? data : [];
    setVms(vmArray.map(mapVirtualMachineToVM));
    setPendingVmNames((prev) => {
      const next = new Set(prev);
      vmArray.forEach((vm) => next.delete(vm.name));
      return new Set(next);
    });
    return data;
  }, []);

  const handleVmWsMessage = React.useCallback(
    (payload: any) => {
      const toFiniteNumber = (value: any): number | undefined => {
        const num =
          typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : value;
        return typeof num === "number" && Number.isFinite(num) ? num : undefined;
      };

      let parsed = payload;
      try {
        if (typeof payload === "string") {
          parsed = JSON.parse(payload);
        }
      } catch (err) {
        console.warn("WS parse error:", err);
        return;
      }
      if (!parsed || parsed.type !== "VMInfo") {
        return;
      }

      let vmArray = parsed.data;
      try {
        if (typeof vmArray === "string") {
          vmArray = JSON.parse(vmArray);
        }
      } catch (err) {
        console.warn("WS VMInfo data parse error:", err);
        return;
      }
      if (!Array.isArray(vmArray)) {
        return;
      }

      setVms((prev) => {
        const updates = new Map<string, Partial<VM>>();

        vmArray.forEach((info: any) => {
          if (!info || !info.name) return;
          const patch: Partial<VM> = {};
          const setIfDefined = <K extends keyof VM>(key: K, value: VM[K] | undefined) => {
            if (value !== undefined) {
              patch[key] = value;
            }
          };

          setIfDefined("machineName", info.machineName ?? info.MachineName);
          setIfDefined("state", info.state);
          setIfDefined("novncPort", info.novncPort);
          setIfDefined("cpuCount", toFiniteNumber(info.cpuCount) as any);
          setIfDefined("memoryMB", toFiniteNumber(info.memoryMB) as any);
          setIfDefined("currentCpuUsage", toFiniteNumber(info.currentCpuUsage) as any);
          setIfDefined("currentMemoryUsageMB", toFiniteNumber(info.currentMemoryUsageMB) as any);
          setIfDefined("diskSizeGB", toFiniteNumber(info.diskSizeGB) as any);
          setIfDefined("diskPath", info.diskPath);
          setIfDefined("ip", info.ip);
          setIfDefined("network", info.network);
          setIfDefined("DefinedCPUS", toFiniteNumber(info.DefinedCPUS) as any);
          setIfDefined("DefinedRam", toFiniteNumber(info.DefinedRam) as any);
          setIfDefined("AllocatedGb", toFiniteNumber(info.AllocatedGb) as any);
          setIfDefined("isLive", info.IsLive ?? info.isLive);
          setIfDefined(
            "realHostMemUsageMB",
            toFiniteNumber(info.RealHostMemUsage ?? info.realHostMemUsageMB) as any
          );

          if (Object.keys(patch).length > 0) {
            updates.set(info.name, patch);
          }
        });

        if (updates.size === 0) {
          return prev;
        }

        const nextList: VM[] = [];

        // Update existing VMs
        prev.forEach((vm) => {
          const patch = updates.get(vm.name);
          if (patch) {
            nextList.push({ ...vm, ...patch });
            updates.delete(vm.name);
          } else {
            nextList.push(vm);
          }
        });

        // Add new VMs from websocket (fallback defaults for missing fields)
        updates.forEach((patch, name) => {
          const base: VM = {
            name,
            machineName: (patch.machineName as string) ?? "",
            state: (patch.state as VmState) ?? VmState.UNKNOWN,
            DefinedCPUS: (patch.DefinedCPUS as number) ?? 0,
            DefinedRam: (patch.DefinedRam as number) ?? 0,
            memoryMB: (patch.memoryMB as number) ?? 0,
            diskSizeGB: (patch.diskSizeGB as number) ?? 0,
            AllocatedGb: (patch.AllocatedGb as number) ?? 0,
            network: (patch.network as string) ?? "",
            autoStart: false,
            diskPath: (patch.diskPath as string) ?? "",
            ip: (patch.ip as string[]) ?? [],
            novnclink: "",
            novncPort: (patch.novncPort as string) ?? "",
            currentCpuUsage: (patch.currentCpuUsage as number) ?? 0,
            currentMemoryUsageMB: (patch.currentMemoryUsageMB as number) ?? 0,
            cpuCount: (patch.cpuCount as number) ?? 0,
            isLive: (patch.isLive as boolean) ?? false,
            realHostMemUsageMB: (patch.realHostMemUsageMB as number) ?? 0,
          };
          nextList.push({ ...base, ...patch });
        });

        return nextList;
      });
    },
    []
  );

  // Initial fetch of VMs
  React.useEffect(() => {
    const fetchVMs = async () => {
      try {
        await fetchAndSetVms();
      } catch (error) {
        console.error("Error loading VMs:", error);
        toast.show({
          placement: "top",
          render: ({ id }) => (
            <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="error">
              <ToastTitle size="sm">Error loading VMs</ToastTitle>
            </Toast>
          )
        });
      } finally {
        setLoading(false);
      }
    };
    fetchVMs();
  }, [fetchAndSetVms, toast]);

  React.useEffect(() => {
    const fetchCloneOptions = async () => {
      setCloneOptionsLoading(true);
      try {
        const [mountsResp, slavesResp] = await Promise.all([listMounts(), listSlaves()]);
        const mounts = Array.isArray(mountsResp) ? mountsResp : [];
        const slaves = Array.isArray(slavesResp) ? slavesResp : [];
        setMountOptions(mounts);
        setSlaveOptions(slaves);
      } catch (error) {
        console.error("Error loading NFS/Slaves:", error);
        toast.show({
          placement: "top",
          render: ({ id }) => (
            <Toast
              nativeID={"toast-" + id}
              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
              action="error"
            >
              <ToastTitle size="sm">Failed to list NFS/Slaves</ToastTitle>
            </Toast>
          ),
        });
      } finally {
        setCloneOptionsLoading(false);
      }
    };
    fetchCloneOptions();
  }, [toast]);

  // Agrupar VMs por slave
  const vmsBySlave = React.useMemo(() => {
    const grouped: Record<string, VM[]> = {};
    vms.forEach((vm) => {
      if (!grouped[vm.machineName]) {
        grouped[vm.machineName] = [];
      }
      grouped[vm.machineName].push(vm);
    });
    return grouped;
  }, [vms]);

  const formatMemory = (mb: number) => {
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
  };

  const formatDiskSize = (gb: number) => {
    if (!Number.isFinite(gb)) {
      return "0 GB";
    }
    const normalized = gb >= 100 ? gb.toFixed(0) : gb.toFixed(1);
    return `${Number(normalized)} GB`;
  };

  const formatPercentUsage = (value: number) => {
    if (!Number.isFinite(value)) {
      return "0%";
    }
    const clamped = Math.min(100, Math.max(0, value));
    return `${Math.round(clamped)}%`;
  };

  const stats = React.useMemo(() => {
    const total = vms.length;
    const running = vms.filter((vm) => vm.state === VmState.RUNNING).length;
    const stopped = vms.filter((vm) => vm.state === VmState.SHUTOFF).length;
    const paused = vms.filter((vm) => vm.state === VmState.PAUSED).length;
    const totalVcpu = vms.reduce((sum, vm) => sum + vm.DefinedCPUS, 0);
    const totalMemoryGB = (vms.reduce((sum, vm) => sum + vm.DefinedRam, 0) / 1024).toFixed(1);
    return { total, running, stopped, paused, totalVcpu, totalMemoryGB };
  }, [vms]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      Haptics.selectionAsync();
      await fetchAndSetVms();
      toast.show({
        placement: "top", render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="success">
            <ToastTitle size="sm">Updated</ToastTitle>
          </Toast>
        )
      });
    } catch (error) {
      console.error("Error updating VMs:", error);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="error">
            <ToastTitle size="sm">Error updating</ToastTitle>
          </Toast>
        )
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewVM = () => {
    setOpenCreate(true);
  };

  const processWsPayload = React.useCallback(
    async (payload: any) => {
      let message: any = payload;

      if (payload instanceof Blob) {
        try {
          message = await payload.text();
        } catch (err) {
          console.warn("WS Blob read error:", err);
          return;
        }
      } else if (payload instanceof ArrayBuffer) {
        try {
          const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
          message = decoder ? decoder.decode(payload) : payload;
        } catch (err) {
          console.warn("WS ArrayBuffer decode error:", err);
          return;
        }
      } else if (ArrayBuffer.isView(payload)) {
        try {
          const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
          message = decoder ? decoder.decode(payload.buffer) : payload;
        } catch (err) {
          console.warn("WS BufferView decode error:", err);
          return;
        }
      }

      handleVmWsMessage(message);
    },
    [handleVmWsMessage]
  );

  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const setup = async () => {
      try {
        await ensureHyperHiveWebsocket();
        unsubscribe = subscribeToHyperHiveWebsocket((msg) => {
          void processWsPayload(msg);
        });
      } catch (err) {
        console.error("Error starting WebSocket:", err);
      }
    };
    setup();
    return () => {
      unsubscribe?.();
    };
  }, [handleVmWsMessage, processWsPayload]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchAndSetVms().catch((err) => {
        console.warn("Error updating VMs (interval):", err);
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchAndSetVms]);

  const handleVmAction = async (vmName: string, action: string) => {
    setLoadingVm(vmName);
    Haptics.selectionAsync();
    try {
      if (action === "pause") {
        await pauseVM(vmName);
      } else if (action === "resume") {
        await resumeVM(vmName);
      } else if (action === "restart") {
        await restartVM(vmName);
      } else if (action === "shutdown") {
        await shutdownVM(vmName);
      } else if (action === "force-shutdown") {
        await forceShutdownVM(vmName);
      } else if (action === "start") {
        await startVM(vmName);
      }

      await fetchAndSetVms();
      toast.show({
        placement: "top", render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="success">
            <ToastTitle size="sm">{action} executed</ToastTitle>
          </Toast>
        )
      });
    } catch (error) {
      console.error("Error performing action on VM:", error);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="error">
            <ToastTitle size="sm">Error performing action</ToastTitle>
          </Toast>
        )
      });
    } finally {
      setLoadingVm(null);
    }
  };

  const handleToggleAutostart = (vm: VM, checked: boolean) => {
    setVms((prev) => prev.map((v) => v.name === vm.name ? { ...v, autoStart: checked } : v));
    Haptics.selectionAsync();
    toast.show({
      placement: "top", render: ({ id }) => (
        <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="success">
          <ToastTitle size="sm">Auto-start {checked ? "enabled" : "disabled"}</ToastTitle>
        </Toast>
      )
    });
  };

  const handleDelete = (vm: VM) => {
    setConfirmAction({ type: "delete", vm });
  };

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 64 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={refreshControlTint}
            colors={[refreshControlTint]}
            progressBackgroundColor={refreshControlBackground}
          />
        }
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-7xl web:mx-auto web:w-full">
          <HStack className="justify-between items-start mb-3">
            <VStack className="flex-1">
              <Heading
                size="2xl"
                className="text-typography-900 dark:text-[#E8EBF0] web:text-4xl"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                Virtual Machines
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl mt-2">
                Complete management of virtual machines distributed across slaves with resource controls and monitoring.
              </Text>
            </VStack>
            <HStack className="gap-2">
              <Button
                variant="outline"
                size="md"
                onPress={handleRefresh}
                disabled={loading}
                className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]"
              >
                {loading ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonIcon
                    as={RefreshCw}
                    className="text-typography-700 dark:text-[#E8EBF0]"
                  />
                )}
              </Button>
              <Button
                variant="outline"
                size="md"
                onPress={() => setOpenImport(true)}
                className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]"
              >
                <ButtonIcon
                  as={Upload}
                  className="text-typography-700 dark:text-[#E8EBF0]"
                />
                <ButtonText className="web:inline hidden text-typography-900 dark:text-[#E8EBF0]">
                  Importar VM
                </ButtonText>
              </Button>
              <Button
                size="md"
                onPress={handleNewVM}
                className="rounded-lg bg-typography-900 dark:bg-[#E8EBF0]"
              >
                <ButtonIcon
                  as={Plus}
                  className="text-background-0 dark:text-typography-900"
                />
                <ButtonText className="web:inline hidden text-background-0 dark:text-typography-900">
                  Nova VM
                </ButtonText>
              </Button>
            </HStack>
          </HStack>

          {/* Stats Overview */}
          <HStack className="mb-6 mt-6 gap-4 flex-wrap web:grid web:grid-cols-6">
            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Server size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Total VMs
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {loading ? "..." : stats.total}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Play size={16} className="text-[#2DD4BF] dark:text-[#5EEAD4]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Running
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {loading ? "..." : stats.running}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Square size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Stopped
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {loading ? "..." : stats.stopped}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Pause size={16} className="text-[#FBBF24] dark:text-[#FCD34D]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Paused
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {loading ? "..." : stats.paused}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Cpu size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Total vCPUs
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {loading ? "..." : stats.totalVcpu}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <MemoryStick size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Total RAM
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {loading ? "..." : stats.totalMemoryGB} GB
              </Text>
            </Box>
          </HStack>

          {/* Linha separadora removida - stats inline antigos */}
          <HStack className="mb-6 gap-4 flex-wrap hidden">
            <HStack className="gap-2 items-center">
              <Text
                className="text-typography-600 dark:text-typography-400 text-sm"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                Total:
              </Text>
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] font-semibold"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                {loading ? "..." : stats.total}
              </Text>
            </HStack>
            <HStack className="gap-2 items-center">
              <Box className="w-2 h-2 rounded-full bg-[#2DD4BF] dark:bg-[#5EEAD4]" />
              <Text
                className="text-typography-600 dark:text-typography-400 text-sm"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                Running:
              </Text>
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] font-semibold"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                {loading ? "..." : stats.running}
              </Text>
            </HStack>
            <HStack className="gap-2 items-center">
              <Box className="w-2 h-2 rounded-full bg-[#94A3B8] dark:bg-[#64748B]" />
              <Text
                className="text-typography-600 dark:text-typography-400 text-sm"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                Stopped:
              </Text>
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] font-semibold"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                {loading ? "..." : stats.stopped}
              </Text>
            </HStack>
            <HStack className="gap-2 items-center">
              <Text
                className="text-typography-600 dark:text-typography-400 text-sm"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                vCPU:
              </Text>
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] font-semibold"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                {loading ? "..." : stats.totalVcpu}
              </Text>
            </HStack>
            <HStack className="gap-2 items-center">
              <Text
                className="text-typography-600 dark:text-typography-400 text-sm"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                RAM:
              </Text>
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] font-semibold"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                {loading ? "..." : `${stats.totalMemoryGB} GB`}
              </Text>
            </HStack>
          </HStack>

          {/* VMs agrupadas por Slave */}
          {loading ? (
            <VStack className="gap-4">
              <VmSkeletonGrid count={6} />
            </VStack>
          ) : vms.length === 0 && pendingVmNames.size > 0 ? (
            <VStack className="gap-4">
              <VmSkeletonGrid count={Math.min(6, Math.max(1, pendingVmNames.size))} />
            </VStack>
          ) : vms.length === 0 ? (
            <Box className="p-8 web:rounded-2xl web:bg-background-0/80 dark:web:bg-[#151F30]/80">
              <VStack className="items-center gap-4">
                <Server
                  size={48}
                  className="text-[#9AA4B8] dark:text-[#8A94A8]"
                />
                <Text
                  className="text-typography-900 dark:text-[#E8EBF0] text-lg text-center"
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  No VMs found
                </Text>
                <Text
                  className="text-[#9AA4B8] dark:text-[#8A94A8] text-center"
                  style={{ fontFamily: "Inter_400Regular" }}
                >
                  Start by creating your first virtual machine
                </Text>
                <Button
                  onPress={handleNewVM}
                  className="rounded-lg bg-typography-900 dark:bg-[#E8EBF0]"
                >
                  <ButtonIcon
                    as={Plus}
                    className="text-background-0 dark:text-typography-900"
                  />
                  <ButtonText className="text-background-0 dark:text-typography-900">
                    Create First VM
                  </ButtonText>
                </Button>
              </VStack>
            </Box>
          ) : (
            <VStack className="gap-6">
              {pendingVmNames.size > 0 && (
                <VmSkeletonGrid count={Math.min(6, Math.max(1, pendingVmNames.size))} />
              )}
              {Object.entries(vmsBySlave).map(([slaveName, slaveVms]) => {
                const slaveRunning = slaveVms.filter(
                  (vm) => vm.state === VmState.RUNNING
                ).length;
                const slaveVcpu = slaveVms.reduce(
                  (sum, vm) => sum + vm.DefinedCPUS,
                  0
                );
                const slaveMemoryMB = slaveVms.reduce(
                  (sum, vm) => sum + vm.DefinedRam,
                  0
                );
                const slaveMemoryGB = (slaveMemoryMB / 1024).toFixed(1);

                return (
                  <Box
                    key={slaveName}
                    className="rounded-2xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] overflow-hidden web:shadow-md dark:web:shadow-none"
                  >
                    {/* Slave Header */}
                    <Box className="border-b border-outline-100 dark:border-[#2A3B52] p-4 web:p-6">
                      <Heading
                        size="lg"
                        className="text-typography-900 dark:text-[#E8EBF0] mb-2"
                        style={{ fontFamily: "Inter_700Bold" }}
                      >
                        {slaveName}
                      </Heading>
                      <Text
                        className="text-sm text-[#9AA4B8] dark:text-[#8A94A8]"
                        style={{ fontFamily: "Inter_400Regular" }}
                      >
                        {slaveVms.length} VMs • {slaveRunning} running •{" "}
                        {slaveVcpu} vCPU • {slaveMemoryGB} GB RAM
                      </Text>
                    </Box>

                    {/* VMs Grid */}
                    <Box className="bg-background-50 dark:bg-[#0A1628] p-4">
                      <VStack className="gap-4 web:grid web:grid-cols-1 web:gap-4 web:sm:grid-cols-2 web:lg:grid-cols-3">
                        {slaveVms.map((vm) => {
                          const vmState = VM_STATES[vm.state];
                          const isRunning = vm.state === VmState.RUNNING;
                          const isPaused = vm.state === VmState.PAUSED;
                          const isStopped = vm.state === VmState.SHUTOFF;
                          const isLoading = loadingVm === vm.name;
                          const vmNfsName = getNfsNameByDiskPath(vm.diskPath);

                          return (
                            <Box
                              key={vm.name}
                              className={`rounded-xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] p-4 web:hover:shadow-lg transition-all duration-200 ${isRunning
                                ? "hover:border-[#2DD4BF] dark:border-[#5EEAD4] border"
                                : isPaused
                                  ? "hover:border-[#FBBF24] dark:border-[#FCD34D] border"
                                  : "hover:border-[#94A3B8] dark:border-[#64748B] border"
                                }`}
                            >
                              {/* VM Header */}
                              <HStack className="justify-between items-start mb-3">
                                <HStack className="items-center gap-2 flex-1 min-w-0">
                                  <Box
                                    className={`w-2 h-2 rounded-full shrink-0 ${isRunning
                                      ? "bg-[#2DD4BF] dark:bg-[#5EEAD4]"
                                      : isPaused
                                        ? "bg-[#FBBF24] dark:bg-[#FCD34D]"
                                        : "bg-[#94A3B8] dark:bg-[#64748B]"
                                      } ${isRunning ? "animate-pulse" : ""}`}
                                  />
                                  <Pressable
                                    onPress={() => setDetailsVm(vm)}
                                    className="flex-1 min-w-0"
                                  >
                                    <Text
                                      className="text-typography-900 dark:text-[#E8EBF0] truncate"
                                      style={{ fontFamily: "Inter_600SemiBold" }}
                                    >
                                      {vm.name}
                                    </Text>
                                  </Pressable>
                                </HStack>
                                <HStack className="items-center gap-2 shrink-0">
                                  <Badge
                                    size="sm"
                                    variant="outline"
                                    className={`rounded-full border px-2.5 py-1 ${isRunning
                                      ? "bg-[#2dd4be19] border-[#2DD4BF] dark:bg-[#2DD4BF25] dark:border-[#5EEAD4]"
                                      : isPaused
                                        ? "bg-[#fbbf2419] border-[#FBBF24] dark:bg-[#FBBF2425] dark:border-[#FCD34D]"
                                        : "bg-[#94a3b819] border-[#94A3B8] dark:bg-[#94A3B825] dark:border-[#CBD5E1]"
                                      }`}
                                  >
                                    <BadgeText
                                      className={`text-xs ${isRunning
                                        ? "text-[#2DD4BF] dark:text-[#5EEAD4]"
                                        : isPaused
                                          ? "text-[#FBBF24] dark:text-[#FCD34D]"
                                          : "text-[#64748B] dark:text-[#94A3B8]"
                                        }`}
                                      style={{ fontFamily: "Inter_500Medium" }}
                                    >
                                      {vmState.label}
                                    </BadgeText>
                                  </Badge>
                                  <Pressable
                                    onPress={() => {
                                      setSelectedVm(vm);
                                      setShowActionsheet(true);
                                    }}
                                    className="p-1"
                                  >
                                    <MoreVertical
                                      size={16}
                                      className="text-[#9AA4B8] dark:text-[#8A94A8]"
                                    />
                                  </Pressable>
                                </HStack>
                              </HStack>

                              {/* Recursos */}
                              <Box className="border-b border-outline-100 dark:border-[#1E2F47] pb-6">
                                <HStack className="flex flex-col">
                                  <Box className="flex flex-row justify-between">
                                    <Text
                                      className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                                      style={{ fontFamily: "Inter_400Regular" }}
                                    >
                                      CPU ({vm.DefinedCPUS} vCPU)
                                    </Text>
                                    <Text
                                      className="text-xs text-typography-900 dark:text-[#E8EBF0]"
                                      style={{ fontFamily: "Inter_500Medium" }}
                                    >
                                      {`${formatPercentUsage(vm.currentCpuUsage)} / 100%`}
                                    </Text>
                                  </Box>
                                  <Progress
                                    value={vm.currentCpuUsage}
                                    size="xs"
                                    orientation="horizontal"
                                    className="mb-5 mt-2"
                                  >
                                    <ProgressFilledTrack
                                      className={
                                        vm.currentCpuUsage >= 75
                                          ? "bg-red-500"
                                          : vm.currentCpuUsage >= 50
                                            ? "bg-amber-500"
                                            : ""
                                      }
                                    />
                                  </Progress>
                                </HStack>
                                <HStack className="flex flex-col">
                                  <Box className="flex flex-row justify-between">
                                    <Text
                                      className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                                      style={{ fontFamily: "Inter_400Regular" }}
                                    >
                                      RAM
                                    </Text>
                                    <Text
                                      className="text-xs text-typography-900 dark:text-[#E8EBF0]"
                                      style={{ fontFamily: "Inter_500Medium" }}
                                    >
                                      {`${formatMemory(vm.currentMemoryUsageMB)} / ${formatMemory(vm.DefinedRam)}`}
                                    </Text>
                                  </Box>
                                  <Progress
                                    value={
                                      (vm.currentMemoryUsageMB * 100) /
                                      vm.DefinedRam
                                    }
                                    size="xs"
                                    orientation="horizontal"
                                    className="mb-5 mt-2"
                                  >
                                    <ProgressFilledTrack
                                      className={
                                        vm.currentMemoryUsageMB >=
                                          vm.DefinedRam * 0.75
                                          ? "bg-red-500"
                                          : vm.currentMemoryUsageMB >=
                                            vm.DefinedRam * 0.5
                                            ? "bg-amber-500"
                                            : ""
                                      }
                                    />
                                  </Progress>
                                </HStack>
                                <HStack className="flex flex-col">
                                  <Box className="flex flex-row justify-between">
                                    <Text
                                      className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                                      style={{ fontFamily: "Inter_400Regular" }}
                                    >
                                      Host RAM (real)
                                    </Text>
                                    <Text
                                      className="text-xs text-typography-900 dark:text-[#E8EBF0]"
                                      style={{ fontFamily: "Inter_500Medium" }}
                                    >
                                      {`${formatMemory(vm.realHostMemUsageMB)} / ${formatMemory(vm.DefinedRam)}`}
                                    </Text>
                                  </Box>
                                  <Progress
                                    value={
                                      vm.DefinedRam > 0
                                        ? (vm.realHostMemUsageMB * 100) / vm.DefinedRam
                                        : 0
                                    }
                                    size="xs"
                                    orientation="horizontal"
                                    className="mb-5 mt-2"
                                  >
                                    <ProgressFilledTrack
                                      className={
                                        vm.realHostMemUsageMB >=
                                          vm.DefinedRam * 0.75
                                          ? "bg-red-500"
                                          : vm.realHostMemUsageMB >=
                                            vm.DefinedRam * 0.5
                                            ? "bg-amber-500"
                                            : ""
                                      }
                                    />
                                  </Progress>
                                </HStack>
                                <HStack className="flex flex-col">
                                  <Box className="flex flex-row justify-between">
                                    <Text
                                      className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                                      style={{ fontFamily: "Inter_400Regular" }}
                                    >
                                      Disco
                                    </Text>
                                    <Text
                                      className="text-xs text-typography-900 dark:text-[#E8EBF0]"
                                      style={{ fontFamily: "Inter_500Medium" }}
                                    >
                                      {`${formatDiskSize(vm.AllocatedGb)} / ${formatDiskSize(vm.diskSizeGB)}`}
                                    </Text>
                                  </Box>
                                  <Progress
                                    value={
                                      (vm.AllocatedGb * 100) / vm.diskSizeGB
                                    }
                                    size="xs"
                                    orientation="horizontal"
                                    className="mb-5 mt-2"
                                  >
                                    <ProgressFilledTrack
                                      className={
                                        vm.AllocatedGb >= vm.diskSizeGB * 0.75
                                          ? "bg-red-500"
                                          : vm.AllocatedGb >=
                                            vm.diskSizeGB * 0.5
                                            ? "bg-amber-500"
                                            : ""
                                      }
                                    />
                                  </Progress>
                                </HStack>
                                <HStack className="justify-between">
                                  <Text
                                    className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                                    style={{ fontFamily: "Inter_400Regular" }}
                                  >
                                    Network
                                  </Text>
                                  <Text
                                    className="text-xs text-typography-900 dark:text-[#E8EBF0]"
                                    style={{ fontFamily: "Inter_500Medium" }}
                                  >
                                    {vm.network}
                                  </Text>
                                </HStack>
                                {vmNfsName ? (
                                  <HStack className="justify-between mt-3">
                                    <Text
                                      className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                                      style={{ fontFamily: "Inter_400Regular" }}
                                    >
                                      NFS
                                    </Text>
                                    <Text
                                      className="text-xs text-typography-900 dark:text-[#E8EBF0] truncate max-w-[60%]"
                                      style={{ fontFamily: "Inter_500Medium" }}
                                    >
                                      {vmNfsName}
                                    </Text>
                                  </HStack>
                                ) : null}
                              </Box>

                              {/* Botões de Ação */}
                              <HStack className="gap-12 flex-wrap justify-center pt-8">
                                {isStopped && (
                                  <Button
                                    size="sm"
                                    className="flex-1 rounded-lg bg-typography-900 dark:bg-[#E8EBF0] web:hover:brightness-95 web:transition-all web:duration-150"
                                    onPress={() =>
                                      handleVmAction(vm.name, "start")
                                    }
                                    disabled={isLoading}
                                  >
                                    {isLoading ? (
                                      <ButtonSpinner />
                                    ) : (
                                      <>
                                        <ButtonIcon
                                          as={Play}
                                          className="text-background-0 dark:text-typography-900"
                                        />
                                        <ButtonText
                                          className="text-background-0 dark:text-typography-900"
                                          style={{
                                            fontFamily: "Inter_500Medium",
                                          }}
                                        >
                                          Start
                                        </ButtonText>
                                      </>
                                    )}
                                  </Button>
                                )}
                                {isRunning && (
                                  <>
                                    <Pressable
                                      className="p-3 rounded-lg border border-outline-200 bg-background-0 dark:bg-[#0F1A2E] web:hover:border-primary-500 web:hover:bg-primary-50 web:transition-all web:duration-150 disabled:opacity-50"
                                      onPress={() => handleVmAction(vm.name, "pause")}
                                      disabled={isLoading}
                                    >
                                      <Pause className="text-typography-900 dark:text-[#E8EBF0]" />
                                    </Pressable>
                                    <Pressable
                                      className="p-3 rounded-lg border border-outline-200 bg-background-0 dark:bg-[#0F1A2E] web:hover:border-primary-500 web:hover:bg-primary-50 web:transition-all web:duration-150 disabled:opacity-50"
                                      onPress={() => handleVmAction(vm.name, "restart")}
                                      disabled={isLoading}
                                    >
                                      <RefreshCcw className="text-typography-900 dark:text-[#E8EBF0]" />
                                    </Pressable>
                                    <Pressable
                                      className="p-3 rounded-lg border border-outline-200 bg-background-0 dark:bg-[#0F1A2E] web:hover:border-red-500 web:hover:bg-red-50 web:transition-all web:duration-150 disabled:opacity-50"
                                      onPress={() => handleVmAction(vm.name, "shutdown")}
                                      disabled={isLoading}
                                    >
                                      <Square className="text-red-600" />
                                    </Pressable>
                                  </>
                                )}
                                {isPaused && (
                                  <Button
                                    size="sm"
                                    className="flex-1 rounded-lg bg-typography-900 dark:bg-[#E8EBF0] web:hover:brightness-95 web:transition-all web:duration-150"
                                    onPress={() =>
                                      handleVmAction(vm.name, "resume")
                                    }
                                    disabled={isLoading}
                                  >
                                    {isLoading ? (
                                      <ButtonSpinner />
                                    ) : (
                                      <>
                                        <ButtonIcon
                                          as={Play}
                                          className="text-background-0 dark:text-typography-900"
                                        />
                                        <ButtonText
                                          className="text-background-0 dark:text-typography-900"
                                          style={{
                                            fontFamily: "Inter_500Medium",
                                          }}
                                        >
                                          Resume
                                        </ButtonText>
                                      </>
                                    )}
                                  </Button>
                                )}
                                <Pressable
                                  className="p-3 rounded-lg border border-outline-200 bg-background-0 dark:bg-[#0F1A2E] web:hover:border-primary-500 web:hover:bg-primary-50 web:transition-all web:duration-150"
                                  onPress={() => setDetailsVm(vm)}
                                >
                                  <Monitor className="text-typography-900 dark:text-[#E8EBF0]" />
                                </Pressable>
                              </HStack>
                            </Box>
                          );
                        })}
                      </VStack>
                    </Box>
                  </Box>
                );
              })}
            </VStack>
          )}

          {/* Modals e Actionsheet */}
          <Modal isOpen={!!detailsVm} onClose={() => setDetailsVm(null)}>
            <ModalBackdrop />
            <ModalContent className="rounded-lg shadow-lg max-w-[720px] w-full">
              <ModalHeader className="flex justify-between">
                <Heading size="md" className="text-gray-900">
                  VM Details
                </Heading>
                <VStack className="gap-2">
                  <HStack className="">
                    <Button
                      className="rounded-md px-4 py-2"
                      onPress={() => {
                        if (!detailsVm) return;
                        setConsoleOptionsVm(detailsVm);
                        setShowConsoleOptions(true);
                      }}
                    >
                      <ButtonText>Open</ButtonText>
                    </Button>
                  </HStack>
                </VStack>
              </ModalHeader>
              <ModalBody className="p-0">
                {detailsVm && (
                  <ScrollView
                    className="max-h-[70vh]"
                    showsVerticalScrollIndicator
                    contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
                  >
                    <VStack className="gap-6">
                      <Divider className="my-2" />
                      <VStack className="gap-3 web:grid web:grid-cols-2 web:gap-4">
                        <HStack className="justify-between">
                          <Text className="text-sm text-gray-600">State</Text>
                          <Badge
                            variant={VM_STATES[detailsVm.state].badgeVariant}
                            className="rounded-full"
                          >
                            <BadgeText>
                              {VM_STATES[detailsVm.state].label}
                            </BadgeText>
                          </Badge>
                        </HStack>
                        <HStack className="justify-between">
                          <Text className="text-sm text-gray-600">vCPU</Text>
                          <Text className="text-sm text-gray-900">
                            {detailsVm.DefinedCPUS} cores
                          </Text>
                        </HStack>
                        <HStack className="justify-between">
                          <Text className="text-sm text-gray-600">RAM</Text>
                          <Text className="text-sm text-gray-900">
                            {formatMemory(detailsVm.DefinedRam)}
                          </Text>
                        </HStack>
                        <HStack className="justify-between">
                          <Text className="text-sm text-gray-600">Disk</Text>
                          <Text className="text-sm text-gray-900">
                            {detailsVm.diskSizeGB} GB (Allocated: {detailsVm.AllocatedGb} GB)
                          </Text>
                        </HStack>
                        <HStack className="justify-between">
                          <Text className="text-sm text-gray-600">Network</Text>
                          <Text className="text-sm text-gray-900">
                            {detailsVm.network}
                          </Text>
                        </HStack>
                        <HStack className="justify-between">
                          <Text className="text-sm text-gray-600">Disk Path</Text>
                          <Text className="text-sm text-gray-900 truncate max-w-[200px]">
                            {detailsVm.diskPath}
                          </Text>
                        </HStack>
                        {detailsVmNfsName ? (
                          <HStack className="justify-between">
                            <Text className="text-sm text-gray-600">NFS</Text>
                            <Text className="text-sm text-gray-900">
                              {detailsVmNfsName}
                            </Text>
                          </HStack>
                        ) : null}
                        {detailsVm.ip.length > 0 && (
                          <HStack className="justify-between col-span-2">
                            <Text className="text-sm text-gray-600">IP</Text>
                            <Text className="text-sm text-gray-900">
                              {detailsVm.ip.join(", ")}
                            </Text>
                          </HStack>
                        )}
                        <HStack className="justify-between col-span-2">
                          <Text className="text-sm text-gray-600">
                            Auto-start
                          </Text>
                          <Text className="text-sm text-gray-900">
                            {detailsVm.autoStart ? "Yes" : "No"}
                          </Text>
                        </HStack>
                        <HStack className="justify-between col-span-2">
                          <Text className="text-sm text-gray-600">Live VM</Text>
                          <Text className="text-sm text-typography-900">
                            {detailsVm.isLive ? "Yes" : "No"}
                          </Text>
                        </HStack>
                      </VStack>
                      <Divider className="my-2" />
                      <HStack className="gap-2 flex-wrap web:justify-start">
                        <Button
                          variant="outline"
                          className="rounded-md px-4 py-2"
                          onPress={() => setEditVm(detailsVm)}
                        >
                          <ButtonIcon as={Settings} />
                          <ButtonText>Edit Resources</ButtonText>
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-md px-4 py-2"
                          onPress={() => setCloneVm(detailsVm)}
                        >
                          <ButtonIcon as={Copy} />
                          <ButtonText>Clone VM</ButtonText>
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-md px-4 py-2"
                          onPress={() => setMigrateVm(detailsVm)}
                        >
                          <ButtonIcon as={GitBranch} />
                          <ButtonText>Migrate VM</ButtonText>
                        </Button>
                      </HStack>
                    </VStack>
                  </ScrollView>
                )}
              </ModalBody>
              <ModalFooter>
                <HStack className="justify-end gap-2">
                  <Button
                    variant="outline"
                    className="rounded-md px-4 py-2"
                    onPress={() => setDetailsVm(null)}
                  >
                    <ButtonText>Close</ButtonText>
                  </Button>
                </HStack>
              </ModalFooter>
            </ModalContent>
          </Modal>
          {/* Confirmation AlertDialog */}
          <AlertDialog
            isOpen={!!confirmAction}
            onClose={() => setConfirmAction(null)}
          >
            <AlertDialogBackdrop />
            <AlertDialogContent>
              <AlertDialogHeader>
                <Heading size="md" className="text-gray-900">
                  Confirmation
                </Heading>
                <AlertDialogCloseButton />
              </AlertDialogHeader>
              <AlertDialogBody>
                <Text className="text-gray-700">
                  {confirmAction?.type === "delete"
                    ? `Are you sure you want to delete VM ${confirmAction?.vm.name}?`
                    : `Force shutdown of ${confirmAction?.vm.name}?`}
                </Text>
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button
                  variant="outline"
                  onPress={() => setConfirmAction(null)}
                  className="rounded-md px-4 py-2"
                >
                  <ButtonText>Cancel</ButtonText>
                </Button>
                <Button
                  onPress={async () => {
                    if (!confirmAction) return;
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Warning
                    );
                    if (confirmAction.type === "delete") {
                      try {
                        setDeletingVm(confirmAction.vm.name);
                        await deleteVM(confirmAction.vm.name);
                        await fetchAndSetVms();
                        setConfirmAction(null);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="success"
                            >
                              <ToastTitle size="sm">VM deleted</ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Error deleting VM:", error);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">Error deleting VM</ToastTitle>
                            </Toast>
                          ),
                        });
                      } finally {
                        setDeletingVm(null);
                      }
                    } else {
                      await handleVmAction(confirmAction.vm.name, "force-shutdown");
                      setConfirmAction(null);
                    }
                  }}
                  className="rounded-md px-4 py-2"
                  disabled={Boolean(deletingVm)}
                >
                  {deletingVm ? <ButtonSpinner className="mr-2" /> : null}
                  <ButtonText>Confirmar</ButtonText>
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Modal: Importar VM */}
          <ImportVmModal
            showModal={openImport}
            setShowModal={setOpenImport}
            onSuccess={(importedName) => {
              if (importedName) {
                setPendingVmNames((prev) => {
                  const next = new Set(prev);
                  next.add(importedName);
                  return new Set(next);
                });
              }
              handleRefresh();
            }}
          />

          {/* Modal: Criar VM */}
          <CreateVmModal
            showModal={openCreate}
            setShowModal={setOpenCreate}
            onSuccess={(createdName) => {
              if (createdName) {
                setPendingVmNames((prev) => {
                  const next = new Set(prev);
                  next.add(createdName);
                  return new Set(next);
                });
              }
              // Refresh lista de VMs
              handleRefresh();
            }}
          />

          {/* Modal: Editar Recursos */}
          <Modal isOpen={!!editVm} onClose={() => setEditVm(null)} size="lg">
            <ModalBackdrop />
            <ModalContent className="rounded-2xl border border-outline-100 shadow-soft-1 web:max-w-2xl w-[90%] max-h-[85vh] web:max-h-[90vh]">
              <ModalHeader className="border-b border-outline-100 dark:border-[#2A3B52]">
                <Heading size="md" className="text-gray-900 dark:text-[#E8EBF0]">
                  Edit Resources
                </Heading>
                <ModalCloseButton />
              </ModalHeader>
              <ModalBody className="overflow-y-auto max-h-[calc(85vh-140px)] web:max-h-[calc(90vh-140px)]">
                {editVm && (
                  <EditVmForm
                    vm={editVm}
                    onCancel={() => setEditVm(null)}
                    onSave={async ({ vcpu, memory, disk, network }) => {
                      try {
                        // Atualizar recursos (CPU, RAM, Disco)
                        await editVmResources(editVm.name, {
                          memory,
                          vcpu,
                          disk_sizeGB: disk,
                        });

                        // Atualizar rede se foi alterada
                        if (network !== editVm.network) {
                          await changeVmNetwork(editVm.name, network);
                        }

                        await fetchAndSetVms();
                        setEditVm(null);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="success"
                            >
                              <ToastTitle size="sm">
                                Resources updated
                              </ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Error editing VM:", error);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">
                                Error editing VM
                              </ToastTitle>
                            </Toast>
                          ),
                        });
                        throw error instanceof Error
                          ? error
                          : new Error("Error editing VM");
                      }
                    }}
                  />
                )}
              </ModalBody>
            </ModalContent>
          </Modal>

          {/* Modal: Clonar VM */}
          <Modal isOpen={!!cloneVm} onClose={() => setCloneVm(null)}>
            <ModalBackdrop />
            <ModalContent className="rounded-lg shadow-lg">
              <ModalHeader>
                <Heading size="md" className="text-gray-900">
                  Clone VM
                </Heading>
                <ModalCloseButton />
              </ModalHeader>
              <ModalBody>
                {cloneVm && (
                  <CloneVmForm
                    vm={cloneVm}
                    mountOptions={mountOptions}
                    slaveOptions={slaveOptions}
                    loadingOptions={cloneOptionsLoading}
                    onCancel={() => setCloneVm(null)}
                    onClone={async ({ newName, destMachine, destNfs }) => {
                      try {
                        await cloneVmApi(cloneVm.name, destNfs, destMachine, newName);
                        setCloneVm(null);
                        await fetchAndSetVms();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="success"
                            >
                              <ToastTitle size="sm">VM cloned</ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Error cloning VM:", error);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">Error cloning VM</ToastTitle>
                              <ToastDescription size="sm">
                                {error instanceof ApiError && typeof error.data === "string"
                                  ? error.data
                                  : "Check the name, NFS, and slave and try again."}
                              </ToastDescription>
                            </Toast>
                          ),
                        });
                        if (error instanceof ApiError) {
                          const message =
                            typeof error.data === "string"
                              ? error.data
                              : (error.data as any)?.message ?? error.message;
                          throw new Error(message);
                        }
                        throw error instanceof Error ? error : new Error("Error cloning VM");
                      }
                    }}
                  />
                )}
              </ModalBody>
              <ModalFooter>
                <HStack className="justify-end gap-2">
                  <Button
                    variant="outline"
                    className="rounded-md px-4 py-2"
                    onPress={() => setCloneVm(null)}
                  >
                    <ButtonText>Close</ButtonText>
                  </Button>
                </HStack>
              </ModalFooter>
            </ModalContent>
          </Modal>

          {/* Modal: Migrar VM */}
          <Modal isOpen={!!migrateVm} onClose={() => setMigrateVm(null)}>
            <ModalBackdrop />
            <ModalContent className="rounded-lg shadow-lg">
              <ModalHeader>
                <Heading size="md" className="text-gray-900">
                  Migrate VM
                </Heading>
                <ModalCloseButton />
              </ModalHeader>
              <ModalBody>
                {migrateVm && (
                  <MigrateVmForm
                    vm={migrateVm}
                    slaveChoices={
                      slaveOptions.length > 0
                        ? slaveOptions.map((s) => s.MachineName)
                        : Object.keys(vmsBySlave)
                    }
                    onCancel={() => setMigrateVm(null)}
                    loading={migratingVm === migrateVm.name}
                    onMigrate={async ({ targetSlave, mode, live, timeout }) => {
                      setMigratingVm(migrateVm.name);
                      try {
                        if (mode === "hot") {
                          const isLive = live ?? true;
                          const timeoutToSend = isLive ? timeout ?? 500 : undefined;
                          await migrateVM(migrateVm.name, {
                            targetMachineName: targetSlave,
                            originMachine: migrateVm.machineName,
                            live: isLive,
                            timeout: timeoutToSend,
                          });
                        } else {
                          await coldMigrateVM(migrateVm.name, targetSlave);
                        }
                        await fetchAndSetVms();
                        setMigrateVm(null);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="success"
                            >
                              <ToastTitle size="sm">VM migrated</ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Error migrating VM:", error);
                        const description =
                          error instanceof ApiError && typeof error.data === "string"
                            ? error.data
                            : error instanceof Error
                              ? error.message
                              : "Check the VM name, state, and destination.";
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">Error migrating VM</ToastTitle>
                              <ToastDescription size="sm">{description}</ToastDescription>
                            </Toast>
                          ),
                        });
                        if (error instanceof ApiError) {
                          throw new Error(description);
                        }
                        throw error instanceof Error ? error : new Error("Error migrating VM");
                      } finally {
                        setMigratingVm(null);
                      }
                    }}
                  />
                )}
              </ModalBody>
              <ModalFooter>
                <HStack className="justify-end gap-2">
                  <Button
                    variant="outline"
                    className="rounded-md px-4 py-2"
                    onPress={() => setMigrateVm(null)}
                  >
                    <ButtonText>Close</ButtonText>
                  </Button>
                </HStack>
              </ModalFooter>
            </ModalContent>
          </Modal>

          {/* Modal: Mover Disco */}
          <Modal isOpen={!!moveDiskVm} onClose={() => setMoveDiskVm(null)}>
            <ModalBackdrop />
            <ModalContent className="rounded-lg shadow-lg">
              <ModalHeader>
                <Heading size="md" className="text-gray-900">
                  Move Disk
                </Heading>
                <ModalCloseButton />
              </ModalHeader>
              <ModalBody>
                {moveDiskVm && (
                  <MoveDiskForm
                    vm={moveDiskVm}
                    mountOptions={mountOptions}
                    loadingOptions={cloneOptionsLoading}
                    onCancel={() => setMoveDiskVm(null)}
                    onMove={async ({ destNfsId, newName }) => {
                      try {
                        await moveDisk(moveDiskVm.name, destNfsId, newName);
                        await fetchAndSetVms();
                        setMoveDiskVm(null);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="success"
                            >
                              <ToastTitle size="sm">Disk moved</ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Error moving disk:", error);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">Error moving disk</ToastTitle>
                            </Toast>
                          ),
                        });
                        throw error instanceof Error ? error : new Error("Error moving disk");
                      }
                    }}
                  />
                )}
              </ModalBody>
              <ModalFooter>
                <HStack className="justify-end gap-2">
                  <Button
                    variant="outline"
                    className="rounded-md px-4 py-2"
                    onPress={() => setMoveDiskVm(null)}
                  >
                    <ButtonText>Close</ButtonText>
                  </Button>
                </HStack>
              </ModalFooter>
            </ModalContent>
          </Modal>

          {/* Modal: Change VNC Password */}
          <Modal isOpen={!!changeVncVm} onClose={() => setChangeVncVm(null)}>
            <ModalBackdrop />
            <ModalContent className="rounded-lg shadow-lg">
              <ModalHeader>
                <Heading size="md" className="text-gray-900">
                  Change VNC Password
                </Heading>
                <ModalCloseButton />
              </ModalHeader>
              <ModalBody>
                {changeVncVm && (
                  <ChangeVncPasswordForm
                    vm={changeVncVm}
                    onCancel={() => setChangeVncVm(null)}
                    onSubmit={async (password) => {
                      try {
                        await changeVncPassword(changeVncVm.name, password);
                        await fetchAndSetVms();
                        setChangeVncVm(null);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="success"
                            >
                              <ToastTitle size="sm">VNC password updated</ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Error changing VNC password:", error);
                        const description =
                          error instanceof ApiError && error.data
                            ? String(error.data)
                            : error instanceof Error
                              ? error.message
                              : "Unable to change VNC password.";
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">Error changing VNC password</ToastTitle>
                              <ToastDescription size="sm">{description}</ToastDescription>
                            </Toast>
                          ),
                        });
                        throw new Error(description);
                      }
                    }}
                  />
                )}
              </ModalBody>
            </ModalContent>
          </Modal>

          {/* Modal: Update CPU XML */}
          <Modal isOpen={!!updateCpuVm} onClose={() => setUpdateCpuVm(null)}>
            <ModalBackdrop />
            <ModalContent className="rounded-lg shadow-lg">
              <ModalHeader>
                <Heading size="md" className="text-gray-900">
                  Update CPU XML
                </Heading>
                <ModalCloseButton />
              </ModalHeader>
              <ModalBody>
                {updateCpuVm && (
                  <UpdateCpuXmlForm
                    vm={updateCpuVm}
                    slaveOptions={slaveOptions}
                    onCancel={() => setUpdateCpuVm(null)}
                    onUpdate={async ({ machineName, cpuXml }) => {
                      try {
                        await updateCpuXml(updateCpuVm.name, {
                          machine_name: machineName,
                          cpu_xml: cpuXml,
                        });
                        await fetchAndSetVms();
                        setUpdateCpuVm(null);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="success"
                            >
                              <ToastTitle size="sm">CPU XML updated</ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Error updating CPU XML:", error);
                        const description =
                          error instanceof ApiError && typeof error.data === "string"
                            ? error.data
                            : error instanceof Error
                              ? error.message
                              : "Unable to update CPU XML.";
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">Error updating CPU XML</ToastTitle>
                              <ToastDescription size="sm">{description}</ToastDescription>
                            </Toast>
                          ),
                        });
                        throw error instanceof Error ? error : new Error(description);
                      }
                    }}
                  />
                )}
              </ModalBody>
            </ModalContent>
          </Modal>

          {/* Modal: Restore Backup */}
          <Modal isOpen={!!restoreVm} onClose={() => setRestoreVm(null)}>
            <ModalBackdrop />
            <ModalContent className="rounded-lg shadow-lg">
              <ModalHeader>
                <Heading size="md" className="text-gray-900">
                  Restore Backup
                </Heading>
                <ModalCloseButton />
              </ModalHeader>
              <ModalBody>
                {restoreVm && (
                  <VStack className="gap-3">
                    <Text className="text-gray-700">
                      Confirm backup restore for {restoreVm.name}?
                    </Text>
                    <HStack className="justify-end gap-2">
                      <Button
                        variant="outline"
                        className="rounded-md px-4 py-2"
                        onPress={() => setRestoreVm(null)}
                      >
                        <ButtonText>Cancel</ButtonText>
                      </Button>
                      <Button
                        className="rounded-md px-4 py-2"
                        onPress={() => {
                          Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Success
                          );
                          toast.show({
                            placement: "top",
                            render: ({ id }) => (
                              <Toast
                                nativeID={"toast-" + id}
                                className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                                action="success"
                              >
                                <ToastTitle size="sm">
                                  Restore started
                                </ToastTitle>
                              </Toast>
                            ),
                          });
                          setRestoreVm(null);
                        }}
                      >
                        <ButtonText>Restore</ButtonText>
                      </Button>
                    </HStack>
                  </VStack>
                )}
              </ModalBody>
            </ModalContent>
          </Modal>
          <Modal
            isOpen={showConsoleOptions}
            onClose={() => {
              setShowConsoleOptions(false);
              setConsoleOptionsVm(null);
            }}
          >
            <ModalBackdrop />
            <ModalContent className="rounded-lg shadow-lg max-h-[90vh]">
              <ModalHeader className="flex justify-between">
                <Heading size="md" className="text-gray-900">
                  Console · {consoleOptionsVm?.name ?? ""}
                </Heading>
                <ModalCloseButton />
              </ModalHeader>
              <ModalBody>
                <VStack className="gap-3">
                  <Button
                    className="w-full rounded-md px-4 py-3 bg-typography-900 dark:bg-[#E8EBF0]"
                    onPress={() => {
                      void handleConsoleAction("browser");
                    }}
                  >
                    <ButtonText className="text-background-0 dark:text-typography-900">
                      Abrir no Browser
                    </ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full rounded-md px-4 py-3 border-typography-900 dark:border-[#E8EBF0]"
                    onPress={() => {
                      void handleConsoleAction("sprite");
                    }}
                  >
                    <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                      Download Sprite (.vv)
                    </ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full rounded-md px-4 py-3"
                    onPress={() => {
                      void handleConsoleAction("guest");
                    }}
                  >
                    <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                      Share Guest
                    </ButtonText>
                  </Button>
                </VStack>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="outline"
                  className="rounded-md px-4 py-2"
                  onPress={() => {
                    setShowConsoleOptions(false);
                    setConsoleOptionsVm(null);
                  }}
                >
                  <ButtonText>Cancel</ButtonText>
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </Box>
      </ScrollView>
      {/* Actionsheet de opções da VM (Mobile) / Modal (Web) */}
      {Platform.OS === "web" ? (
        <Modal
          isOpen={showActionsheet}
          onClose={() => {
            setShowActionsheet(false);
            setSelectedVm(null);
          }}
          size="lg"
        >
          <ModalBackdrop />
          <ModalContent className="rounded-lg shadow-lg max-h-[85vh] web:max-h-[90vh]">
            <ModalHeader>
              <Heading size="md" className="text-gray-900 dark:text-[#E8EBF0]">
                {selectedVm?.name}
              </Heading>
              <ModalCloseButton />
            </ModalHeader>
            <ModalBody className="overflow-y-auto max-h-[calc(85vh-140px)] web:max-h-[calc(90vh-140px)]">
              <VStack className="gap-1">
                {/* Configurações */}
                <Text className="text-xs text-typography-500 px-3 py-2 font-semibold">
                  SETTINGS
                </Text>
                <Pressable
                  onPress={() => {
                    if (!selectedVm) return;
                    handleToggleAutostart(selectedVm, !selectedVm.autoStart);
                    setShowActionsheet(false);
                  }}
                  className="px-3 py-3 hover:bg-background-50 rounded-md"
                >
                  <HStack className="items-center gap-2">
                    {selectedVm?.autoStart && (
                      <Check size={16} className="text-typography-900" />
                    )}
                    <Text className="text-typography-900">
                      Auto-start on boot
                    </Text>
                  </HStack>
                </Pressable>

                <Divider className="my-2" />

                {/* Operações */}
                <Text className="text-xs text-typography-500 px-3 py-2 font-semibold">
                  OPERATIONS
                </Text>
                <Pressable
                  onPress={() => {
                    if (!selectedVm) return;
                    setEditVm(selectedVm);
                    setShowActionsheet(false);
                  }}
                  className="px-3 py-3 hover:bg-background-50 rounded-md"
                >
                  <HStack className="items-center gap-3">
                    <Settings size={18} className="text-typography-700" />
                    <Text className="text-typography-900">Edit Resources</Text>
                  </HStack>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!selectedVm) return;
                    setUpdateCpuVm(selectedVm);
                    setShowActionsheet(false);
                  }}
                  className="px-3 py-3 hover:bg-background-50 rounded-md"
                >
                  <HStack className="items-center gap-3">
                    <Cpu size={18} className="text-typography-700" />
                    <Text className="text-typography-900">Update CPU XML</Text>
                  </HStack>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!selectedVm) return;
                    setChangeVncVm(selectedVm);
                    setShowActionsheet(false);
                  }}
                  className="px-3 py-3 hover:bg-background-50 rounded-md"
                >
                  <HStack className="items-center gap-3">
                    <Lock size={18} className="text-typography-700" />
                    <Text className="text-typography-900">Change VNC Password</Text>
                  </HStack>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!selectedVm) return;
                    setCloneVm(selectedVm);
                    setShowActionsheet(false);
                  }}
                  className="px-3 py-3 hover:bg-background-50 rounded-md"
                >
                  <HStack className="items-center gap-3">
                    <Copy size={18} className="text-typography-700" />
                    <Text className="text-typography-900">Clone VM</Text>
                  </HStack>
                </Pressable>

                <Divider className="my-2" />

                {/* Migração & Disco */}
                <Text className="text-xs text-typography-500 px-3 py-2 font-semibold">
                  MIGRATION & DISK
                </Text>
                <Pressable
                  onPress={() => {
                    if (!selectedVm) return;
                    setMigrateVm(selectedVm);
                    setShowActionsheet(false);
                  }}
                  className="px-3 py-3 hover:bg-background-50 rounded-md"
                >
                  <HStack className="items-center gap-3">
                    <GitBranch size={18} className="text-typography-700" />
                    <Text className="text-typography-900">Migrate VM</Text>
                  </HStack>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!selectedVm || isExportingSelectedVm) return;
                    setMoveDiskVm(selectedVm);
                    setShowActionsheet(false);
                  }}
                  className="px-3 py-3 hover:bg-background-50 rounded-md"
                >
                  <HStack className="items-center gap-3">
                    <HardDrive size={18} className="text-typography-700" />
                    <Text className="text-typography-900">Move Disk</Text>
                  </HStack>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!selectedVm || isExportingSelectedVm) return;
                    void handleExportVm(selectedVm);
                    setShowActionsheet(false);
                  }}
                  className={`px-3 py-3 rounded-md ${isExportingSelectedVm ? "opacity-60" : "hover:bg-background-50"}`}
                >
                  <HStack className="items-center gap-3">
                    <Download size={18} className="text-typography-700" />
                    <Text className="text-typography-900">
                      {isExportingSelectedVm ? "Exporting..." : "Export VM"}
                    </Text>
                  </HStack>
                </Pressable>

                {/* Remove All ISOs */}
                <Pressable
                  onPress={async () => {
                    if (!selectedVm) return;
                    try {
                      await removeAllIsos(selectedVm.name);
                      toast.show({
                        placement: "top",
                        render: ({ id }) => (
                          <Toast
                            nativeID={"toast-" + id}
                            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                            action="success"
                          >
                            <ToastTitle size="sm">ISOs removed</ToastTitle>
                          </Toast>
                        ),
                      });
                    } catch (error) {
                      console.error("Error removing ISOs:", error);
                      toast.show({
                        placement: "top",
                        render: ({ id }) => (
                          <Toast
                            nativeID={"toast-" + id}
                            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                            action="error"
                          >
                            <ToastTitle size="sm">Error removing ISOs</ToastTitle>
                          </Toast>
                        ),
                      });
                    }
                    setShowActionsheet(false);
                  }}
                  className="px-3 py-3 hover:bg-background-50 rounded-md"
                >
                  <HStack className="items-center gap-3">
                    <Disc3 size={18} className="text-typography-700 dark:text-[#E8EBF0]" />
                    <Text className="text-typography-700 dark:text-[#E8EBF0]">Remove All ISOs</Text>
                  </HStack>
                </Pressable>

                {/* Force Shutdown */}
                {selectedVm?.state === VmState.RUNNING && (
                  <Pressable
                    onPress={() => {
                      if (!selectedVm) return;
                      handleVmAction(selectedVm.name, "force-shutdown");
                      setShowActionsheet(false);
                    }}
                    className="px-3 py-3 hover:bg-orange-50 rounded-md"
                  >
                    <HStack className="items-center gap-3">
                      <Zap size={18} className="text-orange-600" />
                      <Text className="text-orange-600">Force Shutdown</Text>
                    </HStack>
                  </Pressable>
                )}

                {/* Apagar VM */}
                <Pressable
                  onPress={() => {
                    if (!selectedVm) return;
                    setConfirmAction({ type: "delete", vm: selectedVm });
                    setShowActionsheet(false);
                  }}
                  className="px-3 py-3 hover:bg-red-50 rounded-md"
                >
                  <HStack className="items-center gap-3">
                    <Trash2 size={18} className="text-red-600" />
                    <Text className="text-red-600">Delete VM</Text>
                  </HStack>
                </Pressable>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="outline"
                className="rounded-md px-4 py-2"
                onPress={() => setShowActionsheet(false)}
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      ) : (
        <Actionsheet
          isOpen={showActionsheet}
          onClose={() => {
            setShowActionsheet(false);
            setSelectedVm(null);
          }}
        >
          <ActionsheetBackdrop />
          <ActionsheetContent className="max-h-[90vh]">
            <ScrollView className="w-full" showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 20 }}>
              <ActionsheetDragIndicatorWrapper>
                <ActionsheetDragIndicator />
              </ActionsheetDragIndicatorWrapper>

              {/* Header */}
              <Box className="p-4 border-b border-outline-100 w-full">
                <Text className="text-lg font-semibold">{selectedVm?.name}</Text>
              </Box>

              {/* Configurações label */}
              <ActionsheetItem isDisabled>
                <ActionsheetItemText className="text-xs text-typography-500">
                  SETTINGS
                </ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem
                onPress={() => {
                  if (!selectedVm) return;
                  handleToggleAutostart(selectedVm, !selectedVm.autoStart);
                  setShowActionsheet(false);
                }}
              >
                <ActionsheetItemText>
                  {(selectedVm?.autoStart ? "✓ " : "") +
                    "Auto-start on boot"}
                </ActionsheetItemText>
              </ActionsheetItem>

              {/* Operações label */}
              <Box className="h-[1px] bg-outline-100 w-full" />
              <ActionsheetItem isDisabled>
                <ActionsheetItemText className="text-xs text-typography-500">
                  OPERATIONS
                </ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem
                onPress={() => {
                  if (!selectedVm) return;
                  setEditVm(selectedVm);
                  setShowActionsheet(false);
                }}
              >
                <ActionsheetIcon as={Settings} className="mr-2" />
                <ActionsheetItemText>Edit Resources</ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem
                onPress={() => {
                  if (!selectedVm) return;
                  setUpdateCpuVm(selectedVm);
                  setShowActionsheet(false);
                }}
              >
                <ActionsheetIcon as={Cpu} className="mr-2" />
                <ActionsheetItemText>Update CPU XML</ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem
                onPress={() => {
                  if (!selectedVm) return;
                  setChangeVncVm(selectedVm);
                  setShowActionsheet(false);
                }}
              >
                <ActionsheetIcon as={Lock} className="mr-2" />
                <ActionsheetItemText>Change VNC Password</ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem
                onPress={() => {
                  if (!selectedVm) return;
                  setCloneVm(selectedVm);
                  setShowActionsheet(false);
                }}
              >
                <ActionsheetIcon as={Copy} className="mr-2" />
                <ActionsheetItemText>Clone VM</ActionsheetItemText>
              </ActionsheetItem>

              {/* Migração & Disco */}
              <Box className="h-[1px] bg-outline-100 w-full" />
              <ActionsheetItem isDisabled>
                <ActionsheetItemText className="text-xs text-typography-500">
                  MIGRATION & DISK
                </ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem
                onPress={() => {
                  if (!selectedVm) return;
                  setMigrateVm(selectedVm);
                  setShowActionsheet(false);
                }}
              >
                <ActionsheetIcon as={GitBranch} className="mr-2" />
                <ActionsheetItemText>Migrate VM</ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem
                onPress={() => {
                  if (!selectedVm || isExportingSelectedVm) return;
                  setMoveDiskVm(selectedVm);
                  setShowActionsheet(false);
                }}
              >
                <ActionsheetIcon as={HardDrive} className="mr-2" />
                <ActionsheetItemText>Move Disk</ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem
                onPress={() => {
                  if (!selectedVm || isExportingSelectedVm) return;
                  setShowActionsheet(false);
                  void handleExportVm(selectedVm);
                }}
                isDisabled={!selectedVm || isExportingSelectedVm}
              >
                <ActionsheetIcon as={Download} className="mr-2" />
                <ActionsheetItemText>
                  {isExportingSelectedVm ? "Exporting..." : "Export VM"}
                </ActionsheetItemText>
              </ActionsheetItem>

              {/* Remove All ISOs */}
              <ActionsheetItem
                onPress={async () => {
                  if (!selectedVm) return;
                  try {
                    await removeAllIsos(selectedVm.name);
                    toast.show({
                      placement: "top",
                      render: ({ id }) => (
                        <Toast
                          nativeID={"toast-" + id}
                          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                          action="success"
                        >
                          <ToastTitle size="sm">ISOs removed</ToastTitle>
                        </Toast>
                      ),
                    });
                  } catch (error) {
                    console.error("Error removing ISOs:", error);
                    toast.show({
                      placement: "top",
                      render: ({ id }) => (
                        <Toast
                          nativeID={"toast-" + id}
                          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                          action="error"
                        >
                          <ToastTitle size="sm">Error removing ISOs</ToastTitle>
                        </Toast>
                      ),
                    });
                  }
                  setShowActionsheet(false);
                }}
              >
                <ActionsheetIcon as={Disc3} className="mr-2" />
                <ActionsheetItemText>Remove All ISOs</ActionsheetItemText>
              </ActionsheetItem>

              {/* Force Shutdown */}
              {selectedVm?.state === VmState.RUNNING && (
                <ActionsheetItem
                  onPress={() => {
                    if (!selectedVm) return;
                    handleVmAction(selectedVm.name, "force-shutdown");
                    setShowActionsheet(false);
                  }}
                >
                  <ActionsheetIcon as={Zap} className="mr-2 text-orange-600" />
                  <ActionsheetItemText className="text-orange-600">
                    Force Shutdown
                  </ActionsheetItemText>
                </ActionsheetItem>
              )}

              {/* Apagar VM */}
              <ActionsheetItem
                onPress={() => {
                  if (!selectedVm) return;
                  setConfirmAction({ type: "delete", vm: selectedVm });
                  setShowActionsheet(false);
                }}
              >
                <ActionsheetIcon as={Trash2} className="mr-2 text-red-600" />
                <ActionsheetItemText className="text-red-600">
                  Delete VM
                </ActionsheetItemText>
              </ActionsheetItem>

              {/* Cancelar */}
              <ActionsheetItem
                onPress={() => setShowActionsheet(false)}
                className="bg-background-100 mt-2"
              >
                <ActionsheetItemText className="font-semibold">
                  Cancel
                </ActionsheetItemText>
              </ActionsheetItem>
            </ScrollView>
          </ActionsheetContent>
        </Actionsheet>
      )}
    </Box>
  );
}

// Forms Components
function VmSkeletonCard() {
  return (
    <Box className="rounded-xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] p-4">
      <HStack className="justify-between items-center mb-3">
        <HStack className="items-center gap-2">
          <Skeleton variant="circular" className="h-3 w-3" />
          <SkeletonText _lines={1} className="w-24 h-4" />
        </HStack>
        <Skeleton className="h-6 w-20 rounded-full" />
      </HStack>
      <VStack className="gap-2">
        <SkeletonText _lines={1} className="w-32 h-4" />
        <SkeletonText _lines={1} className="w-28 h-4" />
        <HStack className="gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </HStack>
      </VStack>
    </Box>
  );
}

function VmSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <VStack className="gap-4 web:grid web:grid-cols-1 web:gap-4 web:sm:grid-cols-2 web:lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <VmSkeletonCard key={`vm-skeleton-${index}`} />
      ))}
    </VStack>
  );
}

function EditVmForm({
  vm,
  onCancel,
  onSave,
}: {
  vm: VM;
  onCancel: () => void;
  onSave: (values: { vcpu: number; memory: number; disk: number; network: string }) => Promise<void>;
}) {
  const [vcpu, setVcpu] = React.useState(vm.DefinedCPUS);
  const [memory, setMemory] = React.useState(vm.DefinedRam);
  const [disk, setDisk] = React.useState(vm.diskSizeGB);
  const [network, setNetwork] = React.useState(vm.network);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const quickMemoriesGb = [2, 4, 8, 16, 32, 64];
  const quickDisksGb = [20, 50, 100, 200, 500];
  const isValid = vcpu > 0 && memory > 0 && disk > 0;
  const formatMemoryLabel = (mb: number) =>
    mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;

  const handleNumericChange = (value: string, setter: (val: number) => void) => {
    const parsed = parseInt(value.replace(/[^\d]/g, ""), 10);
    setter(Number.isFinite(parsed) ? parsed : 0);
  };

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ vcpu, memory, disk, network });
    } catch (err) {
      const message =
        err instanceof TypeError
          ? "Network/CORS failure contacting the API. Check the API URL and whether the backend allows browser calls."
          : err instanceof Error
            ? err.message
            : "Unable to save the changes.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack className="gap-4">
      <Box className="rounded-xl border border-outline-100 bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-emerald-500/10 p-4">
        <HStack className="justify-between items-start">
          <VStack className="gap-1">
            <Text className="text-xs uppercase tracking-wide text-typography-500">
              Selected VM
            </Text>
            <Heading size="md" className="text-typography-900">
              {vm.name}
            </Heading>
            <Text className="text-sm text-typography-600">
              Slave: {vm.machineName}
            </Text>
          </VStack>
          <Badge variant={VM_STATES[vm.state].badgeVariant} className="rounded-full">
            <BadgeText>{VM_STATES[vm.state].label}</BadgeText>
          </Badge>
        </HStack>
        <HStack className="mt-4 gap-3 flex-wrap">
          {[
            { label: "vCPU", value: `${vcpu} cores`, previous: `${vm.DefinedCPUS} current` },
            { label: "RAM", value: formatMemoryLabel(memory), previous: formatMemoryLabel(vm.DefinedRam) },
            { label: "Disk", value: `${disk} GB`, previous: `${vm.diskSizeGB} GB` },
            { label: "Network", value: network, previous: vm.network },
          ].map((item) => (
            <Box
              key={item.label}
              className="rounded-lg bg-white/70 dark:bg-[#0A1020] px-3 py-2 border border-white/50 dark:border-outline-100"
            >
              <Text className="text-[11px] uppercase tracking-wide text-typography-500">
                {item.label}
              </Text>
              <HStack className="items-center gap-2 mt-1">
                <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                  {item.value}
                </Text>
                <Badge variant="outline" className="rounded-full border-outline-200">
                  <BadgeText className="text-[11px] text-typography-600">
                    {item.previous}
                  </BadgeText>
                </Badge>
              </HStack>
            </Box>
          ))}
        </HStack>
      </Box>

      <VStack className="rounded-xl border border-outline-100 bg-background-50 dark:bg-[#0E1524] p-4 gap-4">
        <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
          Adjust resources
        </Text>

        <FormControl>
          <FormControlLabel>
            <FormControlLabelText className="text-sm font-semibold text-typography-800">
              vCPU
            </FormControlLabelText>
          </FormControlLabel>
          <Select
            selectedValue={String(vcpu)}
            onValueChange={(value) => setVcpu(Number(value) || vcpu)}
          >
            <SelectTrigger>
              <SelectInput value={`${vcpu} vCPU`} />
              <SelectIcon />
            </SelectTrigger>
            <SelectPortal>
              <SelectBackdrop />
              <SelectContent>
                <SelectDragIndicatorWrapper>
                  <SelectDragIndicator />
                </SelectDragIndicatorWrapper>
                {[1, 2, 4, 8, 16, 32].map((n) => (
                  <SelectItem
                    key={n}
                    label={`${n} vCPU`}
                    value={String(n)}
                    onPress={() => setVcpu(n)}
                  />
                ))}
              </SelectContent>
            </SelectPortal>
          </Select>
          <FormControlHelper>
            <FormControlHelperText className="text-xs text-typography-500">
              Select the total virtual CPUs available to this VM.
            </FormControlHelperText>
          </FormControlHelper>
        </FormControl>

        <FormControl>
          <FormControlLabel>
            <FormControlLabelText className="text-sm font-semibold text-typography-800">
              Memory (MB)
            </FormControlLabelText>
          </FormControlLabel>
          <Input variant="outline" className="rounded-md">
            <InputField
              placeholder="E.g.: 8192"
              keyboardType="numeric"
              value={memory ? String(memory) : ""}
              onChangeText={(value) => handleNumericChange(value, setMemory)}
            />
          </Input>
          <FormControlHelper>
            <FormControlHelperText className="text-xs text-typography-500">
              Enter the value in MB (8192 MB = 8 GB).
            </FormControlHelperText>
          </FormControlHelper>
          <HStack className="mt-2 gap-2 flex-wrap">
            {quickMemoriesGb.map((gb) => {
              const mb = gb * 1024;
              return (
                <Pressable
                  key={gb}
                  onPress={() => setMemory(mb)}
                  className={`px-3 py-2 rounded-full border ${memory === mb
                    ? "border-primary-500 bg-primary-50"
                    : "border-outline-200 bg-background-0"
                    }`}
                >
                  <Text className="text-xs font-medium text-typography-700">
                    {gb} GB
                  </Text>
                </Pressable>
              );
            })}
          </HStack>
        </FormControl>

        <FormControl>
          <FormControlLabel>
            <FormControlLabelText className="text-sm font-semibold text-typography-800">
              Disk (GB)
            </FormControlLabelText>
          </FormControlLabel>
          <Input variant="outline" className="rounded-md">
            <InputField
              placeholder="E.g.: 60"
              keyboardType="numeric"
              value={disk ? String(disk) : ""}
              onChangeText={(value) => handleNumericChange(value, setDisk)}
            />
          </Input>
          <FormControlHelper>
            <FormControlHelperText className="text-xs text-typography-500">
              Total disk capacity in GB.
            </FormControlHelperText>
          </FormControlHelper>
          <HStack className="mt-2 gap-2 flex-wrap">
            {quickDisksGb.map((gb) => (
              <Pressable
                key={gb}
                onPress={() => setDisk(gb)}
                className={`px-3 py-2 rounded-full border ${disk === gb
                  ? "border-primary-500 bg-primary-50"
                  : "border-outline-200 bg-background-0"
                  }`}
              >
                <Text className="text-xs font-medium text-typography-700">
                  {gb} GB
                </Text>
              </Pressable>
            ))}
          </HStack>
        </FormControl>

        <FormControl>
          <FormControlLabel>
            <FormControlLabelText className="text-sm font-semibold text-typography-800">
              Network
            </FormControlLabelText>
          </FormControlLabel>
          <Select
            selectedValue={network === "default" || network === "512rede" ? network : "other"}
            onValueChange={(value) => {
              if (value === "other") {
                setNetwork("");
              } else {
                setNetwork(value);
              }
            }}
          >
            <SelectTrigger className="rounded-md">
              <SelectInput
                placeholder="Select the network"
                className="text-typography-900 dark:text-[#E8EBF0]"
              />
              <SelectIcon />
            </SelectTrigger>
            <SelectPortal>
              <SelectBackdrop />
              <SelectContent className="bg-background-0 dark:bg-[#151F30]">
                <SelectDragIndicatorWrapper>
                  <SelectDragIndicator />
                </SelectDragIndicatorWrapper>
                <SelectItem
                  label="default"
                  value="default"
                  className="text-typography-900 dark:text-[#E8EBF0]"
                />
                <SelectItem
                  label="512rede"
                  value="512rede"
                  className="text-typography-900 dark:text-[#E8EBF0]"
                />
                <SelectItem
                  label="other..."
                  value="other"
                  className="text-typography-900 dark:text-[#E8EBF0]"
                />
              </SelectContent>
            </SelectPortal>
          </Select>
          {(network !== "default" && network !== "512rede") && (
            <Input
              variant="outline"
              className="rounded-md mt-2"
            >
              <InputField
                value={network}
                onChangeText={setNetwork}
                placeholder="Enter the network name"
                className="text-typography-900 dark:text-[#E8EBF0]"
              />
            </Input>
          )}
          <FormControlHelper>
            <FormControlHelperText className="text-xs text-typography-500">
              Select the network for this VM.
            </FormControlHelperText>
          </FormControlHelper>
        </FormControl>
      </VStack>

      {error && (
        <HStack className="items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
          <AlertCircle size={16} className="text-red-600 mt-0.5" />
          <Text className="text-sm text-red-700 flex-1">{error}</Text>
        </HStack>
      )}

      <HStack className="justify-end gap-3 pt-2">
        <Button
          variant="outline"
          className="rounded-md px-4 py-2"
          onPress={onCancel}
          disabled={saving}
        >
          <ButtonText>Cancel</ButtonText>
        </Button>
        <Button
          className="rounded-md px-4 py-2"
          disabled={!isValid || saving}
          onPress={handleSubmit}
        >
          {saving ? <ButtonSpinner className="mr-2" /> : null}
          <ButtonText>Save changes</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}

function CloneVmForm({
  vm,
  mountOptions,
  slaveOptions,
  loadingOptions,
  onCancel,
  onClone,
}: {
  vm: VM;
  mountOptions: Mount[];
  slaveOptions: Slave[];
  loadingOptions: boolean;
  onCancel: () => void;
  onClone: (payload: { newName: string; destNfs: string; destMachine: string }) => Promise<void>;
}) {
  const [newName, setNewName] = React.useState(vm.name + "-clone");
  const [destMachine, setDestMachine] = React.useState(vm.machineName);
  const [destNfs, setDestNfs] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!destMachine && slaveOptions.length > 0) {
      setDestMachine(slaveOptions[0].MachineName);
    }
  }, [destMachine, slaveOptions]);

  React.useEffect(() => {
    if (!destNfs && mountOptions.length > 0) {
      setDestNfs(String(mountOptions[0].NfsShare.Id));
    }
  }, [destNfs, mountOptions]);
  const selectedNfsLabel = React.useMemo(() => {
    const selected = mountOptions.find((m) => String(m.NfsShare.Id) === destNfs);
    if (!selected) {
      return undefined;
    }
    const { Name, MachineName } = selected.NfsShare;
    return Name?.trim() && Name.trim().length > 0
      ? `${Name.trim()} (${MachineName})`
      : `${MachineName} (${selected.NfsShare.Id})`;
  }, [destNfs, mountOptions]);

  const sanitizedName = newName.trim();
  const nameError =
    sanitizedName.length === 0
      ? "Name is required"
      : !/^[a-zA-Z0-9-]+$/.test(sanitizedName)
        ? "Use only letters, numbers, or hyphens (no spaces)"
        : null;

  const isValid = !nameError && destMachine && destNfs;

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onClone({ newName: sanitizedName, destNfs, destMachine });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cloning VM.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack className="gap-4">
      <Input variant="outline" className="rounded-md">
        <InputField placeholder="New VM name" value={newName} onChangeText={setNewName} />
      </Input>
      {nameError && (
        <Text className="text-xs text-red-600">{nameError}</Text>
      )}

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            Destination (Slave)
          </FormControlLabelText>
        </FormControlLabel>
        <Select
          selectedValue={destMachine}
          onValueChange={setDestMachine}
          isDisabled={loadingOptions || slaveOptions.length === 0}
        >
          <SelectTrigger>
            <SelectInput placeholder={loadingOptions ? "Loading..." : "Select"} />
            <SelectIcon />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              {slaveOptions.length === 0 ? (
                <SelectItem
                  label={loadingOptions ? "Loading..." : "No slave found"}
                  value=""
                  isDisabled
                />
              ) : (
                slaveOptions.map((s) => (
                  <SelectItem
                    key={s.MachineName}
                    label={s.MachineName}
                    value={s.MachineName}
                  />
                ))
              )}
            </SelectContent>
          </SelectPortal>
        </Select>
      </FormControl>

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            Destination NFS
          </FormControlLabelText>
        </FormControlLabel>
        <Select
          selectedValue={destNfs}
          onValueChange={setDestNfs}
          isDisabled={loadingOptions || mountOptions.length === 0}
        >
          <SelectTrigger>
            <SelectInput placeholder={loadingOptions ? "Loading..." : "Select"} value={selectedNfsLabel} />
            <SelectIcon />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              {mountOptions.length === 0 ? (
                <SelectItem
                  label={loadingOptions ? "Loading..." : "No NFS found"}
                  value=""
                  isDisabled
                />
              ) : (
                mountOptions.map((m) => (
                  <SelectItem
                    key={m.NfsShare.Id}
                    label={`${m.NfsShare.Name} (${m.NfsShare.MachineName})`}
                    value={String(m.NfsShare.Id)}
                  />
                ))
              )}
            </SelectContent>
          </SelectPortal>
        </Select>
      </FormControl>

      {error && (
        <HStack className="items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
          <AlertCircle size={16} className="text-red-600 mt-0.5" />
          <Text className="text-sm text-red-700 flex-1">{error}</Text>
        </HStack>
      )}

      <HStack className="justify-end gap-2 mt-2">
        <Button variant="outline" className="rounded-md px-4 py-2" onPress={onCancel} disabled={saving}>
          <ButtonText>Cancel</ButtonText>
        </Button>
        <Button className="rounded-md px-4 py-2" disabled={!isValid || saving} onPress={handleSubmit}>
          {saving ? <ButtonSpinner className="mr-2" /> : null}
          <ButtonText>Clone</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}

function MigrateVmForm({
  vm,
  slaveChoices,
  onCancel,
  onMigrate,
  loading,
}: {
  vm: VM;
  slaveChoices: string[];
  onCancel: () => void;
  onMigrate: (payload: {
    targetSlave: string;
    mode: "hot" | "cold";
    live?: boolean;
    timeout?: number;
  }) => Promise<void>;
  loading: boolean;
}) {
  const uniqueChoices = Array.from(new Set(slaveChoices));
  const initial = uniqueChoices.find((s) => s !== vm.machineName) || vm.machineName;
  const [target, setTarget] = React.useState(initial);
  const [mode, setMode] = React.useState<"hot" | "cold">(
    vm.state === VmState.RUNNING ? "hot" : "cold"
  );
  const [live, setLive] = React.useState(true);
  const [timeout, setTimeoutValue] = React.useState("500");
  const [error, setError] = React.useState<string | null>(null);
  const isHot = mode === "hot";

  const handleSubmit = async () => {
    setError(null);
    if (target === vm.machineName) {
      setError("Select a destination different from the current host.");
      return;
    }
    let parsedTimeout: number | undefined;
    const shouldIncludeTimeout = isHot && live;
    if (shouldIncludeTimeout) {
      parsedTimeout = Number(timeout);
      if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
        setError("Timeout must be a positive number.");
        return;
      }
    }
    try {
      await onMigrate({
        targetSlave: target,
        mode,
        live,
        timeout: parsedTimeout,
      });
    } catch (err) {
      const message =
        err instanceof ApiError && typeof err.data === "string"
          ? err.data
          : err instanceof Error
            ? err.message
            : "Error migrating VM.";
      setError(message);
    }
  };
  return (
    <VStack className="gap-4">
      <Text className="text-gray-700">
        Migrate {vm.name} from <Text className="font-semibold">{vm.machineName}</Text> to:
      </Text>
      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            Destination (Slave)
          </FormControlLabelText>
        </FormControlLabel>
        <Select
          selectedValue={target}
          onValueChange={setTarget}
          isDisabled={uniqueChoices.length === 0}
        >
          <SelectTrigger>
            <SelectInput value={target} />
            <SelectIcon />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>
              {uniqueChoices.length === 0 ? (
                <SelectItem label="No slave available" value="" isDisabled />
              ) : (
                uniqueChoices.map((s) => (
                  <SelectItem
                    key={s}
                    label={s === vm.machineName ? `${s} (atual)` : s}
                    value={s}
                  />
                ))
              )}
            </SelectContent>
          </SelectPortal>
        </Select>
      </FormControl>
      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            Migration type
          </FormControlLabelText>
        </FormControlLabel>
        <HStack className="gap-2">
          <Button
            variant={isHot ? "solid" : "outline"}
            className="flex-1 rounded-md"
            onPress={() => setMode("hot")}
          >
            <ButtonText>{`Hot (VM running)`}</ButtonText>
          </Button>
          <Button
            variant={!isHot ? "solid" : "outline"}
            className="flex-1 rounded-md"
            onPress={() => setMode("cold")}
          >
            <ButtonText>{`Cold (VM off)`}</ButtonText>
          </Button>
        </HStack>
        <FormControlHelper>
          <FormControlHelperText className="text-xs text-typography-500">
            Hot keeps the VM running during migration. Cold requires the VM to be powered off.
          </FormControlHelperText>
        </FormControlHelper>
      </FormControl>
      {isHot && (
        <FormControl>
          <HStack className="items-center justify-between">
            <FormControlLabel>
              <FormControlLabelText className="text-sm font-semibold text-typography-800">
                Live migration
              </FormControlLabelText>
            </FormControlLabel>
            <Switch value={live} onValueChange={setLive} />
          </HStack>
          <FormControlHelper>
            <FormControlHelperText className="text-xs text-typography-500">
              Enable to migrate without shutting down the VM (when supported).
            </FormControlHelperText>
          </FormControlHelper>
        </FormControl>
      )}
      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            Timeout (seconds)
          </FormControlLabelText>
        </FormControlLabel>
        <Input variant="outline" className="rounded-md" isDisabled={!isHot || !live}>
          <InputField
            value={timeout}
            onChangeText={(value) => setTimeoutValue(value.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="500"
            editable={isHot && live}
          />
        </Input>
        <FormControlHelper>
          <FormControlHelperText className="text-xs text-typography-500">
            Maximum time to complete the migration (default: 500 seconds). Available only in Hot and Live.
          </FormControlHelperText>
        </FormControlHelper>
      </FormControl>
      {error && (
        <Text className="text-sm text-red-600">{error}</Text>
      )}
      <HStack className="justify-end gap-2 mt-2">
        <Button
          variant="outline"
          className="rounded-md px-4 py-2"
          onPress={onCancel}
          disabled={loading}
        >
          <ButtonText>Cancel</ButtonText>
        </Button>
        <Button
          className="rounded-md px-4 py-2"
          onPress={handleSubmit}
          disabled={loading || uniqueChoices.length === 0}
        >
          {loading ? <ButtonSpinner className="mr-2" /> : null}
          <ButtonText>Migrate</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}

function ChangeVncPasswordForm({
  vm,
  onCancel,
  onSubmit,
}: {
  vm: VM;
  onCancel: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = password.trim();
    if (!trimmed) {
      setError("Password is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error changing VNC password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack className="gap-4">
      <Text className="text-gray-700">
        Set a new VNC password for <Text className="font-semibold">{vm.name}</Text>.
      </Text>

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            New password
          </FormControlLabelText>
        </FormControlLabel>
        <Input variant="outline" className="rounded-md">
          <InputField
            value={password}
            onChangeText={setPassword}
            placeholder="Enter new VNC password"
            secureTextEntry
          />
        </Input>
        <FormControlHelper>
          <FormControlHelperText className="text-xs text-typography-500">
            This updates the password used by the NoVNC console.
          </FormControlHelperText>
        </FormControlHelper>
      </FormControl>

      {error && (
        <Text className="text-sm text-red-600">{error}</Text>
      )}

      <HStack className="justify-end gap-2 mt-2">
        <Button
          variant="outline"
          className="rounded-md px-4 py-2"
          onPress={onCancel}
          disabled={saving}
        >
          <ButtonText>Cancel</ButtonText>
        </Button>
        <Button
          className="rounded-md px-4 py-2"
          onPress={handleSubmit}
          disabled={saving || !password.trim()}
        >
          {saving ? <ButtonSpinner className="mr-2" /> : null}
          <ButtonText>Update</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}

function MoveDiskForm({
  vm,
  mountOptions,
  loadingOptions,
  onCancel,
  onMove,
}: {
  vm: VM;
  mountOptions: Mount[];
  loadingOptions: boolean;
  onCancel: () => void;
  onMove: (payload: { destNfsId: string; newName: string }) => Promise<void>;
}) {
  const [newName, setNewName] = React.useState(vm.name);
  const [destNfsId, setDestNfsId] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const selectedNfsLabel = React.useMemo(() => {
    const current = mountOptions.find((mount) => String(mount.NfsShare.Id) === destNfsId);
    return current ? `${current.NfsShare.Name} (${current.NfsShare.MachineName})` : undefined;
  }, [destNfsId, mountOptions]);

  React.useEffect(() => {
    setNewName(vm.name);
  }, [vm]);

  React.useEffect(() => {
    if (!destNfsId && mountOptions.length > 0) {
      setDestNfsId(String(mountOptions[0].NfsShare.Id));
    }
  }, [destNfsId, mountOptions]);

  const isValid = Boolean(destNfsId && newName.trim());

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    const normalizedName = newName.trim();
    if (!normalizedName) {
      setError("New disk name is required.");
      setSaving(false);
      return;
    }
    try {
      await onMove({ destNfsId, newName: normalizedName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error moving disk.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack className="gap-4">
      <Text className="text-gray-700">
        Move disk from {vm.name} to another NFS.
      </Text>

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            Destination NFS
          </FormControlLabelText>
        </FormControlLabel>
        <Select
          selectedValue={destNfsId}
          onValueChange={setDestNfsId}
          isDisabled={loadingOptions || mountOptions.length === 0}
        >
          <SelectTrigger>
            <SelectInput
              placeholder={loadingOptions ? "Loading..." : "Select"}
              value={selectedNfsLabel}
            />
            <SelectIcon />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>
              {mountOptions.length === 0 ? (
                <SelectItem
                  label={loadingOptions ? "Loading..." : "No NFS found"}
                  value=""
                  isDisabled
                />
              ) : (
                mountOptions.map((m) => (
                  <SelectItem
                    key={m.NfsShare.Id}
                    label={`${m.NfsShare.Name} (${m.NfsShare.MachineName})`}
                    value={String(m.NfsShare.Id)}
                  />
                ))
              )}
            </SelectContent>
          </SelectPortal>
        </Select>
      </FormControl>

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            New disk name
          </FormControlLabelText>
        </FormControlLabel>
        <Input variant="outline" className="rounded-md">
          <InputField
            placeholder={vm.name}
            value={newName}
            onChangeText={setNewName}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Input>
        <FormControlHelper>
          <FormControlHelperText className="text-xs text-typography-500">
            The new disk file name that will be created on the selected NFS.
          </FormControlHelperText>
        </FormControlHelper>
      </FormControl>

      {error && <Text className="text-sm text-red-600">{error}</Text>}

      <HStack className="justify-end gap-2 mt-2">
        <Button variant="outline" className="rounded-md px-4 py-2" onPress={onCancel} disabled={saving}>
          <ButtonText>Cancel</ButtonText>
        </Button>
        <Button className="rounded-md px-4 py-2" disabled={!isValid || saving} onPress={handleSubmit}>
          {saving ? <ButtonSpinner className="mr-2" /> : null}
          <ButtonText>Move</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}

function UpdateCpuXmlForm({
  vm,
  slaveOptions,
  onCancel,
  onUpdate,
}: {
  vm: VM;
  slaveOptions: Slave[];
  onCancel: () => void;
  onUpdate: (payload: { machineName: string; cpuXml: string }) => Promise<void>;
}) {
  const [machineName, setMachineName] = React.useState(vm.machineName);
  const [cpuXml, setCpuXml] = React.useState("");
  const [selectedSlaves, setSelectedSlaves] = React.useState<string[]>([]);
  const [currentSlaveSelect, setCurrentSlaveSelect] = React.useState("");
  const [loadingCpu, setLoadingCpu] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const availableSlaves = slaveOptions
    .map((s) => s.MachineName)
    .filter((s) => !selectedSlaves.includes(s));

  const handleFetchMutual = async () => {
    if (selectedSlaves.length === 0) {
      setError("Select at least one slave to calculate the CPU XML.");
      return;
    }
    setError(null);
    setLoadingCpu(true);
    try {
      const xml = await getCpuDisableFeatures(selectedSlaves);
      setCpuXml(xml);
    } catch (err) {
      setError("Error fetching mutual CPUs. Try again.");
    } finally {
      setLoadingCpu(false);
    }
  };

  const handleSubmit = async () => {
    const normalizedMachine = machineName.trim();
    const normalizedXml = cpuXml.trim();
    if (!normalizedMachine) {
      setError("Machine name is required.");
      return;
    }
    if (!normalizedXml) {
      setError("CPU XML is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdate({ machineName: normalizedMachine, cpuXml: normalizedXml });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating CPU XML.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack className="gap-4">
      <Text className="text-gray-700">
        Update CPU XML for VM <Text className="font-semibold">{vm.name}</Text>.
      </Text>

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            Machine name
          </FormControlLabelText>
        </FormControlLabel>
        <Input variant="outline" className="rounded-md">
          <InputField
            value={machineName}
            onChangeText={setMachineName}
            placeholder="machine_name"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Input>
      </FormControl>

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            Slaves for Mutual CPUs (optional)
          </FormControlLabelText>
        </FormControlLabel>
        {selectedSlaves.length > 0 ? (
          <HStack className="flex-wrap gap-2 mb-2">
            {selectedSlaves.map((slave) => (
              <Badge
                key={slave}
                className="bg-background-50 border border-outline-200 px-3 rounded-full"
              >
                <HStack className="items-center gap-2">
                  <BadgeText className="text-xs text-typography-800">{slave}</BadgeText>
                  <Button
                    size="xs"
                    variant="link"
                    onPress={() =>
                      setSelectedSlaves((prev) => prev.filter((item) => item !== slave))
                    }
                    className="px-0 min-h-0"
                  >
                    <ButtonText className="text-xs text-typography-700">Remove</ButtonText>
                  </Button>
                </HStack>
              </Badge>
            ))}
          </HStack>
        ) : null}
        <Select
          selectedValue={currentSlaveSelect}
          onValueChange={(value) => {
            if (
              value &&
              !selectedSlaves.includes(value) &&
              slaveOptions.find((s) => s.MachineName === value)
            ) {
              setSelectedSlaves((prev) => [...prev, value]);
              setCurrentSlaveSelect("");
            }
          }}
          isDisabled={availableSlaves.length === 0}
        >
          <SelectTrigger>
            <SelectInput
              placeholder={
                availableSlaves.length === 0
                  ? "No other slaves available"
                  : "Add slave"
              }
            />
            <SelectIcon />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>
              {availableSlaves.length === 0 ? (
                <SelectItem label="No options" value="" isDisabled />
              ) : (
                availableSlaves.map((s) => (
                  <SelectItem key={s} label={s} value={s} />
                ))
              )}
            </SelectContent>
          </SelectPortal>
        </Select>
        <FormControlHelper>
          <FormControlHelperText className="text-xs text-typography-500">
            Select multiple slaves to calculate the common XML before sending.
          </FormControlHelperText>
        </FormControlHelper>
        <Button
          variant="outline"
          onPress={handleFetchMutual}
          isDisabled={selectedSlaves.length === 0 || loadingCpu}
          className="mt-2 rounded-md"
        >
          {loadingCpu ? <ButtonSpinner className="mr-2" /> : <ButtonIcon as={Cpu} className="mr-2" />}
          <ButtonText>
            {loadingCpu ? "Fetching CPUs..." : "Get Mutual CPUs"}
          </ButtonText>
        </Button>
      </FormControl>

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            CPU XML
          </FormControlLabelText>
        </FormControlLabel>
        <Input variant="outline" className="rounded-md h-40">
          <InputField
            value={cpuXml}
            onChangeText={setCpuXml}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="<cpu>...</cpu>"
          />
        </Input>
        <FormControlHelper>
          <FormControlHelperText className="text-xs text-typography-500">
            Paste or edit the XML. It will be sent directly to the backend.
          </FormControlHelperText>
        </FormControlHelper>
      </FormControl>

      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}

      <HStack className="justify-end gap-2 mt-2">
        <Button
          variant="outline"
          className="rounded-md px-4 py-2"
          onPress={onCancel}
          disabled={saving}
        >
          <ButtonText>Cancel</ButtonText>
        </Button>
        <Button
          className="rounded-md px-4 py-2"
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? <ButtonSpinner className="mr-2" /> : null}
          <ButtonText>Update</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}
