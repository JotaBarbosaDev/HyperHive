import React from "react";
import {ScrollView, RefreshControl, useColorScheme} from "react-native";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {VStack} from "@/components/ui/vstack";
import {HStack} from "@/components/ui/hstack";
import {Button, ButtonText, ButtonIcon, ButtonSpinner} from "@/components/ui/button";
import {Badge, BadgeText} from "@/components/ui/badge";
import {Pressable} from "@/components/ui/pressable";
import {Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton} from "@/components/ui/modal";
import {Divider} from "@/components/ui/divider";
import {Progress, ProgressFilledTrack} from "@/components/ui/progress";
import {Platform} from "react-native";
import { Switch } from "@/components/ui/switch";
import { Heading } from '@/components/ui/heading';
import { Icon, CloseIcon } from '@/components/ui/icon';
import CreateVmModal from "@/components/modals/CreateVmModal";
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
import {Toast, ToastTitle, useToast} from "@/components/ui/toast";
import {AlertDialog, AlertDialogBackdrop, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, AlertDialogCloseButton} from "@/components/ui/alert-dialog";
import {Input, InputField} from "@/components/ui/input";
import {Select, SelectTrigger, SelectInput, SelectItem, SelectIcon} from "@/components/ui/select";
import {getAllVMs, listSlaves, VirtualMachine} from "@/services/vms-client";
let Haptics: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Haptics = require("expo-haptics");
} catch (e) {
  Haptics = {
    impactAsync: async () => {},
    selectionAsync: async () => {},
    notificationAsync: async () => {},
    ImpactFeedbackStyle: {Light: "light", Medium: "medium"},
    NotificationFeedbackType: {Success: "success", Warning: "warning"},
  };
}
import {
  Cpu,
  MemoryStick,
  PauseCircle,
  Power,
  Server,
  Square,
  RefreshCw,
  Plus,
  Play,
  Pause,
  RotateCw,
  Monitor,
  Zap,
  Disc,
  Download,
  MoreVertical,
  Settings,
  Copy,
  GitBranch,
  HardDrive,
  Trash2,
  Check,
  MonitorPause,
  RefreshCcw,
} from "lucide-react-native";

// Interfaces TypeScript
interface VM {
  name: string;
  machineName: string;
  state: number;
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
const VM_STATES: Record<number, VMState> = {
  0: {label: "Unknown", color: "bg-gray-400", badgeVariant: "outline"},
  1: {label: "Running", color: "bg-green-500", badgeVariant: "solid"},
  2: {label: "Blocked", color: "bg-red-500", badgeVariant: "solid"},
  3: {label: "Paused", color: "bg-yellow-500", badgeVariant: "solid"},
  4: {label: "Shutdown", color: "bg-orange-500", badgeVariant: "solid"},
  5: {label: "Shutoff", color: "bg-gray-400", badgeVariant: "outline"},
  6: {label: "Crashed", color: "bg-red-600", badgeVariant: "solid"},
  7: {label: "PM Suspended", color: "bg-blue-400", badgeVariant: "solid"},
  8: {label: "No State", color: "bg-gray-300", badgeVariant: "outline"},
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
  const [confirmAction, setConfirmAction] = React.useState<null | {type: "delete" | "force-shutdown"; vm: VM}>(null);
  const [openCreate, setOpenCreate] = React.useState(false);
  const [editVm, setEditVm] = React.useState<VM | null>(null);
  const [cloneVm, setCloneVm] = React.useState<VM | null>(null);
  const [migrateVm, setMigrateVm] = React.useState<VM | null>(null);
  const [moveDiskVm, setMoveDiskVm] = React.useState<VM | null>(null);
  const [restoreVm, setRestoreVm] = React.useState<VM | null>(null);
  const toast = useToast();

  // Fetch inicial de VMs
  React.useEffect(() => {
    const fetchVMs = async () => {
      try {
        const data = await getAllVMs();
        setVms(data.map(mapVirtualMachineToVM));
      } catch (error) {
        console.error("Erro ao carregar VMs:", error);
        toast.show({ 
          placement: "top", 
          render: ({id}) => (
            <Toast nativeID={"toast-"+id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="error">
              <ToastTitle size="sm">Erro ao carregar VMs</ToastTitle>
            </Toast>
          )
        });
      } finally {
        setLoading(false);
      }
    };
    fetchVMs();
  }, []);

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

  const stats = React.useMemo(() => {
    const total = vms.length;
    const running = vms.filter((vm) => vm.state === 1).length;
    const stopped = vms.filter((vm) => vm.state === 5).length;
    const paused = vms.filter((vm) => vm.state === 3).length;
    const totalVcpu = vms.reduce((sum, vm) => sum + vm.DefinedCPUS, 0);
    const totalMemoryGB = (vms.reduce((sum, vm) => sum + vm.DefinedRam, 0) / 1024).toFixed(1);
    return {total, running, stopped, paused, totalVcpu, totalMemoryGB};
  }, [vms]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      Haptics.selectionAsync();
      const data = await getAllVMs();
      setVms(data.map(mapVirtualMachineToVM));
      toast.show({ placement: "top", render: ({id}) => (
        <Toast nativeID={"toast-"+id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="success">
          <ToastTitle size="sm">Atualizado</ToastTitle>
        </Toast>
      )});
    } catch (error) {
      console.error("Erro ao atualizar VMs:", error);
      toast.show({ 
        placement: "top", 
        render: ({id}) => (
          <Toast nativeID={"toast-"+id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="error">
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

  const handleVmAction = (vmName: string, action: string) => {
    setLoadingVm(vmName);
    Haptics.selectionAsync();
    setTimeout(() => {
      setLoadingVm(null);
      toast.show({ placement: "top", render: ({id}) => (
        <Toast nativeID={"toast-"+id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="success">
          <ToastTitle size="sm">{action} executado</ToastTitle>
        </Toast>
      )});
    }, 800);
  };

  const handleToggleAutostart = (vm: VM, checked: boolean) => {
    setVms((prev) => prev.map((v) => v.name === vm.name ? {...v, autoStart: checked} : v));
    Haptics.selectionAsync();
    toast.show({ placement: "top", render: ({id}) => (
      <Toast nativeID={"toast-"+id} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="success">
        <ToastTitle size="sm">Auto-start {checked ? "ativado" : "desativado"}</ToastTitle>
      </Toast>
    )});
  };

  const handleDelete = (vm: VM) => {
    setConfirmAction({type: "delete", vm});
  };

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 64}}
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
                style={{fontFamily: "Inter_700Bold"}}
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
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Total VMs
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {loading ? "..." : stats.total}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Play size={16} className="text-[#2DD4BF] dark:text-[#5EEAD4]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Running
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {loading ? "..." : stats.running}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Square size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Stopped
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {loading ? "..." : stats.stopped}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Pause size={16} className="text-[#FBBF24] dark:text-[#FCD34D]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Paused
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {loading ? "..." : stats.paused}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Cpu size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Total vCPUs
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {loading ? "..." : stats.totalVcpu}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <MemoryStick size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Total RAM
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
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
                style={{fontFamily: "Inter_400Regular"}}
              >
                Total:
              </Text>
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] font-semibold"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                {loading ? "..." : stats.total}
              </Text>
            </HStack>
            <HStack className="gap-2 items-center">
              <Box className="w-2 h-2 rounded-full bg-[#2DD4BF] dark:bg-[#5EEAD4]" />
              <Text
                className="text-typography-600 dark:text-typography-400 text-sm"
                style={{fontFamily: "Inter_400Regular"}}
              >
                Running:
              </Text>
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] font-semibold"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                {loading ? "..." : stats.running}
              </Text>
            </HStack>
            <HStack className="gap-2 items-center">
              <Box className="w-2 h-2 rounded-full bg-[#94A3B8] dark:bg-[#64748B]" />
              <Text
                className="text-typography-600 dark:text-typography-400 text-sm"
                style={{fontFamily: "Inter_400Regular"}}
              >
                Stopped:
              </Text>
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] font-semibold"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                {loading ? "..." : stats.stopped}
              </Text>
            </HStack>
            <HStack className="gap-2 items-center">
              <Text
                className="text-typography-600 dark:text-typography-400 text-sm"
                style={{fontFamily: "Inter_400Regular"}}
              >
                vCPU:
              </Text>
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] font-semibold"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                {loading ? "..." : stats.totalVcpu}
              </Text>
            </HStack>
            <HStack className="gap-2 items-center">
              <Text
                className="text-typography-600 dark:text-typography-400 text-sm"
                style={{fontFamily: "Inter_400Regular"}}
              >
                RAM:
              </Text>
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] font-semibold"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                {loading ? "..." : `${stats.totalMemoryGB} GB`}
              </Text>
            </HStack>
          </HStack>

          {/* VMs agrupadas por Slave */}
          {vms.length === 0 && !loading ? (
            <Box className="p-8 web:rounded-2xl web:bg-background-0/80 dark:web:bg-[#151F30]/80">
              <VStack className="items-center gap-4">
                <Server
                  size={48}
                  className="text-[#9AA4B8] dark:text-[#8A94A8]"
                />
                <Text
                  className="text-typography-900 dark:text-[#E8EBF0] text-lg text-center"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Nenhuma VM encontrada
                </Text>
                <Text
                  className="text-[#9AA4B8] dark:text-[#8A94A8] text-center"
                  style={{fontFamily: "Inter_400Regular"}}
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
              {Object.entries(vmsBySlave).map(([slaveName, slaveVms]) => {
                const slaveRunning = slaveVms.filter(
                  (vm) => vm.state === 1
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
                        style={{fontFamily: "Inter_700Bold"}}
                      >
                        {slaveName}
                      </Heading>
                      <Text
                        className="text-sm text-[#9AA4B8] dark:text-[#8A94A8]"
                        style={{fontFamily: "Inter_400Regular"}}
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
                          const isRunning = vm.state === 1;
                          const isPaused = vm.state === 3;
                          const isStopped = vm.state === 5;
                          const isLoading = loadingVm === vm.name;

                          return (
                            <Box
                              key={vm.name}
                              className={`rounded-xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] p-4 web:hover:shadow-lg transition-all duration-200 ${
                                isRunning
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
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      isRunning
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
                                      style={{fontFamily: "Inter_600SemiBold"}}
                                    >
                                      {vm.name}
                                    </Text>
                                  </Pressable>
                                </HStack>
                                <HStack className="items-center gap-2 shrink-0">
                                  <Badge
                                    size="sm"
                                    variant="outline"
                                    className={`rounded-full border px-2.5 py-1 ${
                                      isRunning
                                        ? "bg-[#2dd4be19] border-[#2DD4BF] dark:bg-[#2DD4BF25] dark:border-[#5EEAD4]"
                                        : isPaused
                                        ? "bg-[#fbbf2419] border-[#FBBF24] dark:bg-[#FBBF2425] dark:border-[#FCD34D]"
                                        : "bg-[#94a3b819] border-[#94A3B8] dark:bg-[#94A3B825] dark:border-[#CBD5E1]"
                                    }`}
                                  >
                                    <BadgeText
                                      className={`text-xs ${
                                        isRunning
                                          ? "text-[#2DD4BF] dark:text-[#5EEAD4]"
                                          : isPaused
                                          ? "text-[#FBBF24] dark:text-[#FCD34D]"
                                          : "text-[#64748B] dark:text-[#94A3B8]"
                                      }`}
                                      style={{fontFamily: "Inter_500Medium"}}
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
                                      style={{fontFamily: "Inter_400Regular"}}
                                    >
                                      CPU
                                    </Text>
                                    <Text
                                      className="text-xs text-typography-900 dark:text-[#E8EBF0]"
                                      style={{fontFamily: "Inter_500Medium"}}
                                    >
                                      {vm.DefinedCPUS} cores
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
                                      style={{fontFamily: "Inter_400Regular"}}
                                    >
                                      RAM
                                    </Text>
                                    <Text
                                      className="text-xs text-typography-900 dark:text-[#E8EBF0]"
                                      style={{fontFamily: "Inter_500Medium"}}
                                    >
                                      {formatMemory(vm.DefinedRam)}
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
                                      style={{fontFamily: "Inter_400Regular"}}
                                    >
                                      Disco
                                    </Text>
                                    <Text
                                      className="text-xs text-typography-900 dark:text-[#E8EBF0]"
                                      style={{fontFamily: "Inter_500Medium"}}
                                    >
                                      {vm.diskSizeGB} GB
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
                                    style={{fontFamily: "Inter_400Regular"}}
                                  >
                                    Network
                                  </Text>
                                  <Text
                                    className="text-xs text-typography-900 dark:text-[#E8EBF0]"
                                    style={{fontFamily: "Inter_500Medium"}}
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
                                    className="flex-1 rounded-lg bg-typography-900 dark:bg-[#E8EBF0]"
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
                                    <Pause
                                      onPress={() => {
                                        handleVmAction(vm.name, "pause");
                                      }}
                                      disabled={isLoading}
                                    />
                                    <RefreshCcw />
                                    <Square
                                      onPress={() => {
                                        handleVmAction(vm.name, "shutdown");
                                      }}
                                      disabled={isLoading}
                                    />
                                  </>
                                )}
                                {isPaused && (
                                  <Button
                                    size="sm"
                                    className="flex-1 rounded-lg bg-typography-900 dark:bg-[#E8EBF0]"
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
                                <Monitor onPress={() => setDetailsVm(vm)} />
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
            <ModalContent className="rounded-lg shadow-lg">
              <ModalHeader className="flex justify-between">
                <Heading size="md" className="text-gray-900">
                  Detalhes da VM
                </Heading>
                {Platform.OS === "web" ? (
                  <VStack className="gap-2">
                    <HStack className="">
                      <Button
                        className="rounded-md px-4 py-2"
                        onPress={() => alert("A abrir")}
                      >
                        <ButtonText>Abrir no Browser</ButtonText>
                      </Button>
                    </HStack>
                  </VStack>
                ) : null}
              </ModalHeader>
              <ModalBody>
                {detailsVm && (
                  <VStack className="gap-4">
                    {/* Console */}

                    <Divider className="my-2" />
                    {/* Informações */}
                    <VStack className="gap-3 web:grid ">
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
                        <HStack className="justify-between">
                          <Text className="text-sm text-gray-600">IP</Text>
                          <Text className="text-sm text-gray-900">
                            {detailsVm.ip.join(", ")}
                          </Text>
                        </HStack>
                      )}
                      <HStack className="justify-between">
                        <Text className="text-sm text-gray-600">
                          Auto-start
                        </Text>
                        <Text className="text-sm text-gray-900">
                          {detailsVm.autoStart ? "Sim" : "Não"}
                        </Text>
                      </HStack>
                    </VStack>
                    <Divider className="my-2" />
                    {/* Ações Rápidas */}
                    <HStack className="gap-2 flex-wrap">
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
                  onPress={() => {
                    if (!confirmAction) return;
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Warning
                    );
                    if (confirmAction.type === "delete") {
                      setVms((prev) =>
                        prev.filter((v) => v.name !== confirmAction.vm.name)
                      );
                      toast.show({
                        placement: "top",
                        render: ({id}) => (
                          <Toast
                            nativeID={"toast-" + id}
                            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                            action="success"
                          >
                            <ToastTitle size="sm">VM apagada</ToastTitle>
                          </Toast>
                        ),
                      });
                    } else {
                      handleVmAction(confirmAction.vm.name, "force-shutdown");
                    }
                    setConfirmAction(null);
                  }}
                  className="rounded-md px-4 py-2"
                >
                  <ButtonText>Confirmar</ButtonText>
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Modal: Criar VM */}
          <CreateVmModal
            showModal={openCreate}
            setShowModal={setOpenCreate}
            onSuccess={() => {
              // Refresh lista de VMs
              handleRefresh();
            }}
          />

          {/* Modal: Editar Recursos */}
          <Modal isOpen={!!editVm} onClose={() => setEditVm(null)}>
            <ModalBackdrop />
            <ModalContent className="rounded-lg shadow-lg">
              <ModalHeader>
                <Heading size="md" className="text-gray-900">
                  Editar Recursos
                </Heading>
                <ModalCloseButton />
              </ModalHeader>
              <ModalBody>
                {editVm && (
                  <EditVmForm
                    vm={editVm}
                    onCancel={() => setEditVm(null)}
                    onSave={(updated) => {
                      setVms((prev) =>
                        prev.map((v) => (v.name === editVm.name ? updated : v))
                      );
                      setEditVm(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toast.show({
                        placement: "top",
                        render: ({id}) => (
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
                    }}
                  />
                )}
              </ModalBody>
              <ModalFooter>
                <HStack className="justify-end gap-2">
                  <Button
                    variant="outline"
                    className="rounded-md px-4 py-2"
                    onPress={() => setEditVm(null)}
                  >
                    <ButtonText>Fechar</ButtonText>
                  </Button>
                </HStack>
              </ModalFooter>
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
                    onCancel={() => setCloneVm(null)}
                    onClone={(newVm) => {
                      setVms((prev) => [...prev, newVm]);
                      setCloneVm(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toast.show({
                        placement: "top",
                        render: ({id}) => (
                          <Toast
                            nativeID={"toast-" + id}
                            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                            action="success"
                          >
                            <ToastTitle size="sm">VM clonada</ToastTitle>
                          </Toast>
                        ),
                      });
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
                    slaves={Object.keys(vmsBySlave)}
                    onCancel={() => setMigrateVm(null)}
                    onMigrate={(targetSlave) => {
                      setVms((prev) =>
                        prev.map((v) =>
                          v.name === migrateVm.name
                            ? {...v, machineName: targetSlave}
                            : v
                        )
                      );
                      setMigrateVm(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toast.show({
                        placement: "top",
                        render: ({id}) => (
                          <Toast
                            nativeID={"toast-" + id}
                            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                            action="success"
                          >
                            <ToastTitle size="sm">VM migrada</ToastTitle>
                          </Toast>
                        ),
                      });
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
                    onCancel={() => setMoveDiskVm(null)}
                    onMove={(shareId) => {
                      setVms((prev) =>
                        prev.map((v) =>
                          v.name === moveDiskVm.name
                            ? {...v, nfs_share_id: shareId}
                            : v
                        )
                      );
                      setMoveDiskVm(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toast.show({
                        placement: "top",
                        render: ({id}) => (
                          <Toast
                            nativeID={"toast-" + id}
                            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                            action="success"
                          >
                            <ToastTitle size="sm">Disco movido</ToastTitle>
                          </Toast>
                        ),
                      });
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
                            render: ({id}) => (
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
        >
          <ModalBackdrop />
          <ModalContent className="rounded-lg shadow-lg">
            <ModalHeader>
              <Heading size="md" className="text-gray-900">
                {selectedVm?.name}
              </Heading>
              <ModalCloseButton />
            </ModalHeader>
            <ModalBody>
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
                } }
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
                } }
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
                } }
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

              {/* Force Shutdown */}
              {selectedVm?.state === 1 && (
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
                  setConfirmAction({type: "delete", vm: selectedVm});
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
          <ActionsheetContent>
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

        {/* Force Shutdown */}
        {selectedVm?.state === 1 && (
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
            setConfirmAction({type: "delete", vm: selectedVm});
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
      </ActionsheetContent>
    </Actionsheet>
      )}
    </Box>
  );
}

// Forms Components
function EditVmForm({vm, onCancel, onSave}: {vm: VM; onCancel: () => void; onSave: (vm: VM) => void}) {
  const [vcpu, setVcpu] = React.useState(vm.DefinedCPUS);
  const [memory, setMemory] = React.useState(vm.DefinedRam);
  const [disk, setDisk] = React.useState(vm.diskSizeGB);
  const isValid = vcpu > 0 && memory > 0 && disk > 0;
  return (
    <VStack className="gap-3">
      <HStack className="gap-3">
        <Select className="flex-1">
          <SelectTrigger>
            <SelectInput value={`${vcpu} vCPU`} />
            <SelectIcon />
          </SelectTrigger>
          {[1,2,4,8,16,32].map((n) => (
            <SelectItem key={n} label={`${n} vCPU`} value={String(n)} onPress={() => setVcpu(n)} />
          ))}
        </Select>
        <Input variant="outline" className="flex-1 rounded-md">
          <InputField placeholder="Memória (MB)" keyboardType="numeric" value={String(memory)} onChangeText={(t) => setMemory(Number(t) || 0)} />
        </Input>
      </HStack>
      <Input variant="outline" className="rounded-md">
        <InputField placeholder="Disco (GB)" keyboardType="numeric" value={String(disk)} onChangeText={(t) => setDisk(Number(t) || 0)} />
      </Input>
      <HStack className="justify-end gap-2 mt-2">
        <Button variant="outline" className="rounded-md px-4 py-2" onPress={onCancel}><ButtonText>Cancelar</ButtonText></Button>
        <Button className="rounded-md px-4 py-2" disabled={!isValid} onPress={() => onSave({...vm, DefinedCPUS: vcpu, DefinedRam: memory, diskSizeGB: disk})}>
          <ButtonText>Salvar</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}

function CloneVmForm({vm, onCancel, onClone}: {vm: VM; onCancel: () => void; onClone: (vm: VM) => void}) {
  const [name, setName] = React.useState(vm.name + "-clone");
  const [vcpu, setVcpu] = React.useState(vm.DefinedCPUS);
  const [memory, setMemory] = React.useState(vm.DefinedRam);
  const [disk, setDisk] = React.useState(vm.diskSizeGB);
  const isValid = name.trim().length > 0 && vcpu > 0 && memory > 0 && disk > 0;
  return (
    <VStack className="gap-3">
      <Input variant="outline" className="rounded-md">
        <InputField placeholder="Nome da nova VM" value={name} onChangeText={setName} />
      </Input>
      <HStack className="gap-3">
        <Select className="flex-1">
          <SelectTrigger>
            <SelectInput value={`${vcpu} vCPU`} />
            <SelectIcon />
          </SelectTrigger>
          {[1,2,4,8,16,32].map((n) => (
            <SelectItem key={n} label={`${n} vCPU`} value={String(n)} onPress={() => setVcpu(n)} />
          ))}
        </Select>
        <Input variant="outline" className="flex-1 rounded-md">
          <InputField placeholder="Memória (MB)" keyboardType="numeric" value={String(memory)} onChangeText={(t) => setMemory(Number(t) || 0)} />
        </Input>
      </HStack>
      <Input variant="outline" className="rounded-md">
        <InputField placeholder="Disco (GB)" keyboardType="numeric" value={String(disk)} onChangeText={(t) => setDisk(Number(t) || 0)} />
      </Input>
      <HStack className="justify-end gap-2 mt-2">
        <Button variant="outline" className="rounded-md px-4 py-2" onPress={onCancel}><ButtonText>Cancelar</ButtonText></Button>
        <Button className="rounded-md px-4 py-2" disabled={!isValid} onPress={() => onClone({
          name,
          machineName: vm.machineName,
          state: 5,
          DefinedCPUS: vcpu,
          DefinedRam: memory,
          memoryMB: 0,
          diskSizeGB: disk,
          AllocatedGb: 0,
          network: vm.network,
          autoStart: vm.autoStart,
          diskPath: vm.diskPath,
          ip: [],
          novnclink: "",
          novncPort: "",
          currentCpuUsage: 0,
          currentMemoryUsageMB: 0,
          cpuCount: 0,
          isLive: false,
        })}>
          <ButtonText>Clonar</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}

function MigrateVmForm({vm, slaves, onCancel, onMigrate}: {vm: VM; slaves: string[]; onCancel: () => void; onMigrate: (targetSlave: string) => void}) {
  const [target, setTarget] = React.useState(slaves.find((s) => s !== vm.machineName) || vm.machineName);
  return (
    <VStack className="gap-3">
      <Text className="text-gray-700">Migrar {vm.name} de {vm.machineName} para:</Text>
      <Select>
        <SelectTrigger>
          <SelectInput value={target} />
          <SelectIcon />
        </SelectTrigger>
        {slaves.map((s) => (
          <SelectItem key={s} label={s} value={s} onPress={() => setTarget(s)} />
        ))}
      </Select>
      <HStack className="justify-end gap-2 mt-2">
        <Button variant="outline" className="rounded-md px-4 py-2" onPress={onCancel}><ButtonText>Cancelar</ButtonText></Button>
        <Button className="rounded-md px-4 py-2" onPress={() => onMigrate(target)}>
          <ButtonText>Migrar</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}

function MoveDiskForm({vm, onCancel, onMove}: {vm: VM; onCancel: () => void; onMove: (diskPath: string) => void}) {
  const [diskPath, setDiskPath] = React.useState(vm.diskPath);
  return (
    <VStack className="gap-3">
      <Text className="text-gray-700">Mover disco de {vm.name} para novo caminho:</Text>
      <Input variant="outline" className="rounded-md">
        <InputField placeholder="Caminho do disco" value={diskPath} onChangeText={setDiskPath} />
      </Input>
      <HStack className="justify-end gap-2 mt-2">
        <Button variant="outline" className="rounded-md px-4 py-2" onPress={onCancel}><ButtonText>Cancelar</ButtonText></Button>
        <Button className="rounded-md px-4 py-2" disabled={diskPath.trim().length === 0} onPress={() => onMove(diskPath)}>
          <ButtonText>Mover</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}
