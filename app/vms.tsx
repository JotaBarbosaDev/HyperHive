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
  moveDisk,
  deleteVM,
  cloneVm as cloneVmApi,
  listSlaves,
  Slave,
  editVmResources,
  changeVmNetwork,
  removeAllIsos,
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
  const [editVm, setEditVm] = React.useState<VM | null>(null);
  const [cloneVm, setCloneVm] = React.useState<VM | null>(null);
  const [migrateVm, setMigrateVm] = React.useState<VM | null>(null);
  const [moveDiskVm, setMoveDiskVm] = React.useState<VM | null>(null);
  const [restoreVm, setRestoreVm] = React.useState<VM | null>(null);
  const [pendingVmNames, setPendingVmNames] = React.useState<Set<string>>(new Set());
  const [mountOptions, setMountOptions] = React.useState<Mount[]>([]);
  const [slaveOptions, setSlaveOptions] = React.useState<Slave[]>([]);
  const [cloneOptionsLoading, setCloneOptionsLoading] = React.useState(false);
  const [deletingVm, setDeletingVm] = React.useState<string | null>(null);
  const [migratingVm, setMigratingVm] = React.useState<string | null>(null);
  const toast = useToast();
  const [showConsoleOptions, setShowConsoleOptions] = React.useState(false);
  const [consoleOptionsVm, setConsoleOptionsVm] = React.useState<VM | null>(null);

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
        throw new Error("Não foi possível aceder ao diretório de armazenamento.");
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

  const handleConsoleAction = React.useCallback(
    async (action: "browser" | "sprite" | "guest") => {
      const vm = consoleOptionsVm;
      if (!vm) return;
      setShowConsoleOptions(false);
      setConsoleOptionsVm(null);

      const apiBase = getApiBaseUrl();
      if (!apiBase) {
        showToastMessage(
          "Domínio não configurado",
          "Atualize o base URL antes de aceder à consola.",
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
                  "Erro",
                  "Não foi possível abrir a nova aba da consola.",
                  "error"
                );
              }
            } else {
              showToastMessage("Erro", "Não foi possível abrir a consola no browser.", "error");
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
          showToastMessage("Sprite guardado", "O ficheiro .vv foi gerado.");
          return;
        }

        if (action === "guest") {
          const guestUrl = `${normalizedBase}/guest_api/guest_page/${encodeURIComponent(
            vm.name
          )}`;
          await Clipboard.setStringAsync(guestUrl);
          showToastMessage("Link copiado", "URL do guest copiado para a área de transferência.");
          return;
        }
      } catch (error) {
        console.error("Erro ao executar ação da consola:", error);
        const message =
          error instanceof Error && error.message ? error.message : "Falha ao executar a ação.";
        showToastMessage("Erro", message, "error");
      }
    },
    [consoleOptionsVm, showToastMessage]
  );

  const fetchAndSetVms = React.useCallback(async () => {
    const data = await getAllVMs();
    setVms(data.map(mapVirtualMachineToVM));
    setPendingVmNames((prev) => {
      const next = new Set(prev);
      data.forEach((vm) => next.delete(vm.name));
      return new Set(next);
    });
    return data;
  }, []);

  // Fetch inicial de VMs
  React.useEffect(() => {
    const fetchVMs = async () => {
      try {
        await fetchAndSetVms();
      } catch (error) {
        console.error("Erro ao carregar VMs:", error);
        toast.show({
          placement: "top",
          render: ({ id }) => (
            <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="error">
              <ToastTitle size="sm">Erro ao carregar VMs</ToastTitle>
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
        const [mounts, slaves] = await Promise.all([listMounts(), listSlaves()]);
        setMountOptions(mounts);
        setSlaveOptions(slaves);
      } catch (error) {
        console.error("Erro ao carregar NFS/Slaves:", error);
        toast.show({
          placement: "top",
          render: ({ id }) => (
            <Toast
              nativeID={"toast-" + id}
              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
              action="error"
            >
              <ToastTitle size="sm">Falha ao listar NFS/Slaves</ToastTitle>
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
            <ToastTitle size="sm">Atualizado</ToastTitle>
          </Toast>
        )
      });
    } catch (error) {
      console.error("Erro ao atualizar VMs:", error);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="error">
            <ToastTitle size="sm">Erro ao atualizar</ToastTitle>
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
            <ToastTitle size="sm">{action} executado</ToastTitle>
          </Toast>
        )
      });
    } catch (error) {
      console.error("Erro ao executar ação na VM:", error);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="error">
            <ToastTitle size="sm">Erro ao executar ação</ToastTitle>
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
          <ToastTitle size="sm">Auto-start {checked ? "ativado" : "desativado"}</ToastTitle>
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
                Gestão completa de máquinas virtuais distribuídas por slave com controle de recursos e monitoramento.
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
                  Nenhuma VM encontrada
                </Text>
                <Text
                  className="text-[#9AA4B8] dark:text-[#8A94A8] text-center"
                  style={{ fontFamily: "Inter_400Regular" }}
                >
                  Comece criando sua primeira máquina virtual
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
                    Criar Primeira VM
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
                Detalhes da VM
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
                      <ButtonText>Abrir</ButtonText>
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
                        <Text className="text-sm text-gray-600">Estado</Text>
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
                        <Text className="text-sm text-gray-600">Disco</Text>
                        <Text className="text-sm text-gray-900">
                          {detailsVm.diskSizeGB} GB (Alocado: {detailsVm.AllocatedGb} GB)
                        </Text>
                      </HStack>
                      <HStack className="justify-between">
                        <Text className="text-sm text-gray-600">Network</Text>
                        <Text className="text-sm text-gray-900">
                          {detailsVm.network}
                        </Text>
                      </HStack>
                      <HStack className="justify-between">
                        <Text className="text-sm text-gray-600">Caminho do Disco</Text>
                        <Text className="text-sm text-gray-900 truncate max-w-[200px]">
                          {detailsVm.diskPath}
                        </Text>
                      </HStack>
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
                          {detailsVm.autoStart ? "Sim" : "Não"}
                        </Text>
                      </HStack>
                      <HStack className="justify-between col-span-2">
                        <Text className="text-sm text-gray-600">Live VM</Text>
                        <Text className="text-sm text-typography-900">
                          {detailsVm.isLive ? "Sim" : "Não"}
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
                        <ButtonText>Editar Recursos</ButtonText>
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-md px-4 py-2"
                        onPress={() => setCloneVm(detailsVm)}
                      >
                        <ButtonIcon as={Copy} />
                        <ButtonText>Clonar VM</ButtonText>
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-md px-4 py-2"
                        onPress={() => setMigrateVm(detailsVm)}
                      >
                        <ButtonIcon as={GitBranch} />
                        <ButtonText>Migrar VM</ButtonText>
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
                    <ButtonText>Fechar</ButtonText>
                  </Button>
                </HStack>
              </ModalFooter>
            </ModalContent>
          </Modal>
          {/* AlertDialog de confirmação */}
          <AlertDialog
            isOpen={!!confirmAction}
            onClose={() => setConfirmAction(null)}
          >
            <AlertDialogBackdrop />
            <AlertDialogContent>
              <AlertDialogHeader>
                <Heading size="md" className="text-gray-900">
                  Confirmação
                </Heading>
                <AlertDialogCloseButton />
              </AlertDialogHeader>
              <AlertDialogBody>
                <Text className="text-gray-700">
                  {confirmAction?.type === "delete"
                    ? `Tem certeza que deseja apagar a VM ${confirmAction?.vm.name}?`
                    : `Forçar desligamento de ${confirmAction?.vm.name}?`}
                </Text>
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button
                  variant="outline"
                  onPress={() => setConfirmAction(null)}
                  className="rounded-md px-4 py-2"
                >
                  <ButtonText>Cancelar</ButtonText>
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
                              <ToastTitle size="sm">VM apagada</ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Erro ao apagar VM:", error);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">Erro ao apagar VM</ToastTitle>
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
                  Editar Recursos
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
                                Recursos atualizados
                              </ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Erro ao editar VM:", error);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">
                                Erro ao editar VM
                              </ToastTitle>
                            </Toast>
                          ),
                        });
                        throw error instanceof Error
                          ? error
                          : new Error("Erro ao editar VM");
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
                  Clonar VM
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
                              <ToastTitle size="sm">VM clonada</ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Erro ao clonar VM:", error);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">Erro ao clonar VM</ToastTitle>
                              <ToastDescription size="sm">
                                {error instanceof ApiError && typeof error.data === "string"
                                  ? error.data
                                  : "Verifique nome, NFS e slave e tente novamente."}
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
                        throw error instanceof Error ? error : new Error("Erro ao clonar VM");
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
                    <ButtonText>Fechar</ButtonText>
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
                  Migrar VM
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
                    onMigrate={async ({ targetSlave, live, timeout }) => {
                      setMigratingVm(migrateVm.name);
                      try {
                        await migrateVM(migrateVm.name, {
                          targetMachineName: targetSlave,
                          originMachine: migrateVm.machineName,
                          live,
                          timeout,
                        });
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
                              <ToastTitle size="sm">VM migrada</ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Erro ao migrar VM:", error);
                        const description =
                          error instanceof ApiError && typeof error.data === "string"
                            ? error.data
                            : error instanceof Error
                              ? error.message
                              : "Verifique nome, estado da VM e destino.";
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">Erro ao migrar VM</ToastTitle>
                              <ToastDescription size="sm">{description}</ToastDescription>
                            </Toast>
                          ),
                        });
                        if (error instanceof ApiError) {
                          throw new Error(description);
                        }
                        throw error instanceof Error ? error : new Error("Erro ao migrar VM");
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
                    <ButtonText>Fechar</ButtonText>
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
                  Mover Disco
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
                    onMove={async ({ destNfsId, destDiskPath }) => {
                      try {
                        await moveDisk(moveDiskVm.name, destNfsId, destDiskPath);
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
                              <ToastTitle size="sm">Disco movido</ToastTitle>
                            </Toast>
                          ),
                        });
                      } catch (error) {
                        console.error("Erro ao mover disco:", error);
                        toast.show({
                          placement: "top",
                          render: ({ id }) => (
                            <Toast
                              nativeID={"toast-" + id}
                              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                              action="error"
                            >
                              <ToastTitle size="sm">Erro ao mover disco</ToastTitle>
                            </Toast>
                          ),
                        });
                        throw error instanceof Error ? error : new Error("Erro ao mover disco");
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
                    <ButtonText>Fechar</ButtonText>
                  </Button>
                </HStack>
              </ModalFooter>
            </ModalContent>
          </Modal>

          {/* Modal: Restaurar Backup */}
          <Modal isOpen={!!restoreVm} onClose={() => setRestoreVm(null)}>
            <ModalBackdrop />
            <ModalContent className="rounded-lg shadow-lg">
              <ModalHeader>
                <Heading size="md" className="text-gray-900">
                  Restaurar Backup
                </Heading>
                <ModalCloseButton />
              </ModalHeader>
              <ModalBody>
                {restoreVm && (
                  <VStack className="gap-3">
                    <Text className="text-gray-700">
                      Confirmar restauração de backup para {restoreVm.name}?
                    </Text>
                    <HStack className="justify-end gap-2">
                      <Button
                        variant="outline"
                        className="rounded-md px-4 py-2"
                        onPress={() => setRestoreVm(null)}
                      >
                        <ButtonText>Cancelar</ButtonText>
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
                                  Restauração iniciada
                                </ToastTitle>
                              </Toast>
                            ),
                          });
                          setRestoreVm(null);
                        }}
                      >
                        <ButtonText>Restaurar</ButtonText>
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
                    Partilhar Guest
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
                <ButtonText>Cancelar</ButtonText>
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
                  CONFIGURAÇÕES
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
                      Auto-start na inicialização
                    </Text>
                  </HStack>
                </Pressable>

                <Divider className="my-2" />

                {/* Operações */}
                <Text className="text-xs text-typography-500 px-3 py-2 font-semibold">
                  OPERAÇÕES
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
                    <Text className="text-typography-900">Editar Recursos</Text>
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
                    <Text className="text-typography-900">Clonar VM</Text>
                  </HStack>
                </Pressable>

                <Divider className="my-2" />

                {/* Migração & Disco */}
                <Text className="text-xs text-typography-500 px-3 py-2 font-semibold">
                  MIGRAÇÃO & DISCO
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
                    <Text className="text-typography-900">Migrar VM (Cold/Hot)</Text>
                  </HStack>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!selectedVm) return;
                    setMoveDiskVm(selectedVm);
                    setShowActionsheet(false);
                  }}
                  className="px-3 py-3 hover:bg-background-50 rounded-md"
                >
                  <HStack className="items-center gap-3">
                    <HardDrive size={18} className="text-typography-700" />
                    <Text className="text-typography-900">Mover Disco</Text>
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
                            <ToastTitle size="sm">ISOs removidas</ToastTitle>
                          </Toast>
                        ),
                      });
                    } catch (error) {
                      console.error("Erro ao remover ISOs:", error);
                      toast.show({
                        placement: "top",
                        render: ({ id }) => (
                          <Toast
                            nativeID={"toast-" + id}
                            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                            action="error"
                          >
                            <ToastTitle size="sm">Erro ao remover ISOs</ToastTitle>
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
                    <Text className="text-red-600">Apagar VM</Text>
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
                <ButtonText>Cancelar</ButtonText>
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
                  CONFIGURAÇÕES
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
                    "Auto-start na inicialização"}
                </ActionsheetItemText>
              </ActionsheetItem>

              {/* Operações label */}
              <Box className="h-[1px] bg-outline-100 w-full" />
              <ActionsheetItem isDisabled>
                <ActionsheetItemText className="text-xs text-typography-500">
                  OPERAÇÕES
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
                <ActionsheetItemText>Editar Recursos</ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem
                onPress={() => {
                  if (!selectedVm) return;
                  setCloneVm(selectedVm);
                  setShowActionsheet(false);
                }}
              >
                <ActionsheetIcon as={Copy} className="mr-2" />
                <ActionsheetItemText>Clonar VM</ActionsheetItemText>
              </ActionsheetItem>

              {/* Migração & Disco */}
              <Box className="h-[1px] bg-outline-100 w-full" />
              <ActionsheetItem isDisabled>
                <ActionsheetItemText className="text-xs text-typography-500">
                  MIGRAÇÃO & DISCO
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
                <ActionsheetItemText>Migrar VM (Cold/Hot)</ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem
                onPress={() => {
                  if (!selectedVm) return;
                  setMoveDiskVm(selectedVm);
                  setShowActionsheet(false);
                }}
              >
                <ActionsheetIcon as={HardDrive} className="mr-2" />
                <ActionsheetItemText>Mover Disco</ActionsheetItemText>
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
                          <ToastTitle size="sm">ISOs removidas</ToastTitle>
                        </Toast>
                      ),
                    });
                  } catch (error) {
                    console.error("Erro ao remover ISOs:", error);
                    toast.show({
                      placement: "top",
                      render: ({ id }) => (
                        <Toast
                          nativeID={"toast-" + id}
                          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                          action="error"
                        >
                          <ToastTitle size="sm">Erro ao remover ISOs</ToastTitle>
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
                  Apagar VM
                </ActionsheetItemText>
              </ActionsheetItem>

              {/* Cancelar */}
              <ActionsheetItem
                onPress={() => setShowActionsheet(false)}
                className="bg-background-100 mt-2"
              >
                <ActionsheetItemText className="font-semibold">
                  Cancelar
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

  const quickMemories = [4096, 8192, 16384, 32768];
  const quickDisks = [20, 40, 60, 80];
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
          ? "Falha de rede/CORS ao contatar a API. Verifique a URL da API e se o backend permite chamadas do navegador."
          : err instanceof Error
            ? err.message
            : "Não foi possível salvar as alterações.";
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
              VM selecionada
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
            { label: "vCPU", value: `${vcpu} cores`, previous: `${vm.DefinedCPUS} atuais` },
            { label: "RAM", value: formatMemoryLabel(memory), previous: formatMemoryLabel(vm.DefinedRam) },
            { label: "Disco", value: `${disk} GB`, previous: `${vm.diskSizeGB} GB` },
            { label: "Rede", value: network, previous: vm.network },
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
          Ajustar recursos
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
              Selecione o total de CPUs virtuais disponíveis para esta VM.
            </FormControlHelperText>
          </FormControlHelper>
        </FormControl>

        <FormControl>
          <FormControlLabel>
            <FormControlLabelText className="text-sm font-semibold text-typography-800">
              Memória (MB)
            </FormControlLabelText>
          </FormControlLabel>
          <Input variant="outline" className="rounded-md">
            <InputField
              placeholder="Ex.: 8192"
              keyboardType="numeric"
              value={memory ? String(memory) : ""}
              onChangeText={(value) => handleNumericChange(value, setMemory)}
            />
          </Input>
          <FormControlHelper>
            <FormControlHelperText className="text-xs text-typography-500">
              Digite o valor em MB (8192 MB = 8 GB).
            </FormControlHelperText>
          </FormControlHelper>
          <HStack className="mt-2 gap-2 flex-wrap">
            {quickMemories.map((preset) => (
              <Pressable
                key={preset}
                onPress={() => setMemory(preset)}
                className={`px-3 py-2 rounded-full border ${memory === preset
                  ? "border-primary-500 bg-primary-50"
                  : "border-outline-200 bg-background-0"
                  }`}
              >
                <Text className="text-xs font-medium text-typography-700">
                  {formatMemoryLabel(preset)}
                </Text>
              </Pressable>
            ))}
          </HStack>
        </FormControl>

        <FormControl>
          <FormControlLabel>
            <FormControlLabelText className="text-sm font-semibold text-typography-800">
              Disco (GB)
            </FormControlLabelText>
          </FormControlLabel>
          <Input variant="outline" className="rounded-md">
            <InputField
              placeholder="Ex.: 60"
              keyboardType="numeric"
              value={disk ? String(disk) : ""}
              onChangeText={(value) => handleNumericChange(value, setDisk)}
            />
          </Input>
          <FormControlHelper>
            <FormControlHelperText className="text-xs text-typography-500">
              Capacidade total do disco em GB.
            </FormControlHelperText>
          </FormControlHelper>
          <HStack className="mt-2 gap-2 flex-wrap">
            {quickDisks.map((preset) => (
              <Pressable
                key={preset}
                onPress={() => setDisk(preset)}
                className={`px-3 py-2 rounded-full border ${disk === preset
                  ? "border-primary-500 bg-primary-50"
                  : "border-outline-200 bg-background-0"
                  }`}
              >
                <Text className="text-xs font-medium text-typography-700">
                  {preset} GB
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
            selectedValue={network === "default" || network === "512rede" ? network : "outro"}
            onValueChange={(value) => {
              if (value === "outro") {
                setNetwork("");
              } else {
                setNetwork(value);
              }
            }}
          >
            <SelectTrigger className="rounded-md">
              <SelectInput
                placeholder="Selecione a rede"
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
                  label="outro..."
                  value="outro"
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
                placeholder="Digite o nome da rede"
                className="text-typography-900 dark:text-[#E8EBF0]"
              />
            </Input>
          )}
          <FormControlHelper>
            <FormControlHelperText className="text-xs text-typography-500">
              Selecione a rede para esta VM.
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
          <ButtonText>Cancelar</ButtonText>
        </Button>
        <Button
          className="rounded-md px-4 py-2"
          disabled={!isValid || saving}
          onPress={handleSubmit}
        >
          {saving ? <ButtonSpinner className="mr-2" /> : null}
          <ButtonText>Salvar alterações</ButtonText>
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

  const sanitizedName = newName.trim();
  const nameError =
    sanitizedName.length === 0
      ? "Nome é obrigatório"
      : !/^[a-zA-Z0-9]+$/.test(sanitizedName)
        ? "Use apenas letras e números (sem espaços ou hífens)"
        : null;

  const isValid = !nameError && destMachine && destNfs;

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onClone({ newName: sanitizedName, destNfs, destMachine });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao clonar VM.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack className="gap-4">
      <Input variant="outline" className="rounded-md">
        <InputField placeholder="Nome da nova VM" value={newName} onChangeText={setNewName} />
      </Input>
      {nameError && (
        <Text className="text-xs text-red-600">{nameError}</Text>
      )}

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            Destino (Slave)
          </FormControlLabelText>
        </FormControlLabel>
        <Select
          selectedValue={destMachine}
          onValueChange={setDestMachine}
          isDisabled={loadingOptions || slaveOptions.length === 0}
        >
          <SelectTrigger>
            <SelectInput placeholder={loadingOptions ? "Carregando..." : "Selecione"} />
            <SelectIcon />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              {slaveOptions.length === 0 ? (
                <SelectItem
                  label={loadingOptions ? "Carregando..." : "Nenhum slave encontrado"}
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
            NFS de destino
          </FormControlLabelText>
        </FormControlLabel>
        <Select
          selectedValue={destNfs}
          onValueChange={setDestNfs}
          isDisabled={loadingOptions || mountOptions.length === 0}
        >
          <SelectTrigger>
            <SelectInput placeholder={loadingOptions ? "Carregando..." : "Selecione"} />
            <SelectIcon />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              {mountOptions.length === 0 ? (
                <SelectItem
                  label={loadingOptions ? "Carregando..." : "Nenhum NFS encontrado"}
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
          <ButtonText>Cancelar</ButtonText>
        </Button>
        <Button className="rounded-md px-4 py-2" disabled={!isValid || saving} onPress={handleSubmit}>
          {saving ? <ButtonSpinner className="mr-2" /> : null}
          <ButtonText>Clonar</ButtonText>
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
    live: boolean;
    timeout: number;
  }) => Promise<void>;
  loading: boolean;
}) {
  const uniqueChoices = Array.from(new Set(slaveChoices));
  const initial = uniqueChoices.find((s) => s !== vm.machineName) || vm.machineName;
  const [target, setTarget] = React.useState(initial);
  const [live, setLive] = React.useState(vm.state === VmState.RUNNING);
  const [timeout, setTimeoutValue] = React.useState("500");
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (target === vm.machineName) {
      setError("Selecione um destino diferente do host atual.");
      return;
    }
    const parsedTimeout = Number(timeout);
    if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
      setError("Timeout deve ser um número positivo.");
      return;
    }
    try {
      await onMigrate({
        targetSlave: target,
        live,
        timeout: parsedTimeout,
      });
    } catch (err) {
      const message =
        err instanceof ApiError && typeof err.data === "string"
          ? err.data
          : err instanceof Error
            ? err.message
            : "Erro ao migrar VM.";
      setError(message);
    }
  };
  return (
    <VStack className="gap-4">
      <Text className="text-gray-700">
        Migrar {vm.name} de <Text className="font-semibold">{vm.machineName}</Text> para:
      </Text>
      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            Destino (Slave)
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
                <SelectItem label="Nenhum slave disponível" value="" isDisabled />
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
        <HStack className="items-center justify-between">
          <FormControlLabel>
            <FormControlLabelText className="text-sm font-semibold text-typography-800">
              Live migration
            </FormControlLabelText>
          </FormControlLabel>
          <Switch
            value={live}
            onValueChange={setLive}
          />
        </HStack>
        <FormControlHelper>
          <FormControlHelperText className="text-xs text-typography-500">
            {live
              ? "Tentará migrar sem desligar a VM."
              : "Será realizada uma migração a frio; a VM deve estar shutdown"}
          </FormControlHelperText>
        </FormControlHelper>
      </FormControl>
      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            Timeout (segundos)
          </FormControlLabelText>
        </FormControlLabel>
        <Input variant="outline" className="rounded-md">
          <InputField
            value={timeout}
            onChangeText={(value) => setTimeoutValue(value.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="500"
          />
        </Input>
        <FormControlHelper>
          <FormControlHelperText className="text-xs text-typography-500">
            Tempo máximo para concluir a migração (padrão: 500 segundos).
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
          <ButtonText>Cancelar</ButtonText>
        </Button>
          <Button
            className="rounded-md px-4 py-2"
            onPress={handleSubmit}
            disabled={loading || uniqueChoices.length === 0}
          >
          {loading ? <ButtonSpinner className="mr-2" /> : null}
          <ButtonText>Migrar</ButtonText>
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
  onMove: (payload: { destNfsId: string; destDiskPath?: string }) => Promise<void>;
}) {
  const [diskPath, setDiskPath] = React.useState(vm.diskPath);
  const [destNfsId, setDestNfsId] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!destNfsId && mountOptions.length > 0) {
      setDestNfsId(String(mountOptions[0].NfsShare.Id));
    }
  }, [destNfsId, mountOptions]);

  const isValid = Boolean(destNfsId);

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onMove({ destNfsId, destDiskPath: diskPath.trim() || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao mover disco.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack className="gap-4">
      <Text className="text-gray-700">
        Mover disco de {vm.name} para outro NFS.
      </Text>

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText className="text-sm font-semibold text-typography-800">
            NFS de destino
          </FormControlLabelText>
        </FormControlLabel>
        <Select
          selectedValue={destNfsId}
          onValueChange={setDestNfsId}
          isDisabled={loadingOptions || mountOptions.length === 0}
        >
          <SelectTrigger>
            <SelectInput placeholder={loadingOptions ? "Carregando..." : "Selecione"} />
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
                  label={loadingOptions ? "Carregando..." : "Nenhum NFS encontrado"}
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
            Caminho do disco (opcional)
          </FormControlLabelText>
        </FormControlLabel>
        <Input variant="outline" className="rounded-md">
          <InputField placeholder={vm.diskPath} value={diskPath} onChangeText={setDiskPath} />
        </Input>
        <FormControlHelper>
          <FormControlHelperText className="text-xs text-typography-500">
            Deixe vazio para usar o caminho padrão gerado pelo backend.
          </FormControlHelperText>
        </FormControlHelper>
      </FormControl>

      {error && <Text className="text-sm text-red-600">{error}</Text>}

      <HStack className="justify-end gap-2 mt-2">
        <Button variant="outline" className="rounded-md px-4 py-2" onPress={onCancel} disabled={saving}>
          <ButtonText>Cancelar</ButtonText>
        </Button>
        <Button className="rounded-md px-4 py-2" disabled={!isValid || saving} onPress={handleSubmit}>
          {saving ? <ButtonSpinner className="mr-2" /> : null}
          <ButtonText>Mover</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}
