import React from "react";
import { ScrollView, RefreshControl, useColorScheme, Platform } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Input, InputField, InputSlot, InputIcon } from "@/components/ui/input";
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton } from "@/components/ui/modal";
import { Select, SelectTrigger, SelectInput, SelectItem, SelectIcon, SelectPortal, SelectBackdrop as SelectBackdropContent, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper } from "@/components/ui/select";
import { Toast, ToastTitle, useToast } from "@/components/ui/toast";
import { Checkbox, CheckboxIndicator, CheckboxIcon, CheckboxLabel } from "@/components/ui/checkbox";
import { Pressable } from "@/components/ui/pressable";
import { ChevronDownIcon } from "@/components/ui/icon";
import { Search, HardDrive, Calendar, Database, RefreshCw, Trash2, RotateCcw, Plus, Download, X, Cpu, Copy, Check } from "lucide-react-native";
import { listBackups, deleteBackup as deleteBackupApi, createBackup as createBackupApi, useBackup as useBackupApi, getBackupDownloadUrl } from "@/services/backups";
import { getAllVMs, listSlaves, VirtualMachine, Slave, getCpuDisableFeatures } from "@/services/vms-client";
import { listMounts } from "@/services/hyperhive";
import { Mount } from "@/types/mount";
import { StableTextInput } from "@/components/ui/stable-text-input";

// Interfaces TypeScript
type BackupStatus = "complete" | "partial" | "failed" | string;
type BackupType = "full" | "incremental" | string;

interface Backup {
  id: string;
  vmName: string;
  machineName: string;
  backupDate: Date;
  size: number | null; // em GB
  nfsShareId: number | null;
  status?: BackupStatus | null;
  type?: BackupType | null;
  live?: boolean;
  automatic?: boolean;
  path?: string;
}

interface BackupStats {
  total: number;
  complete: number;
  totalSize: number; // em GB
  lastBackup: Date | null;
}

export default function BackupsScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const [backups, setBackups] = React.useState<Backup[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [restoreBackup, setRestoreBackup] = React.useState<Backup | null>(null);
  const [restoreMachine, setRestoreMachine] = React.useState<string>("");
  const [restoreVmName, setRestoreVmName] = React.useState("");
  const [restoreMemory, setRestoreMemory] = React.useState("");
  const [restoreVcpu, setRestoreVcpu] = React.useState("");
  const [restoreNetwork, setRestoreNetwork] = React.useState("");
  const [restorePassword, setRestorePassword] = React.useState("");
  const [restoreNfsShare, setRestoreNfsShare] = React.useState<string>("");
  const [restoreCpuXml, setRestoreCpuXml] = React.useState("");
  const [restoreLive, setRestoreLive] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [selectedSlaves, setSelectedSlaves] = React.useState<string[]>([]);
  const [currentSlaveSelect, setCurrentSlaveSelect] = React.useState("");
  const [loadingCPU, setLoadingCPU] = React.useState(false);
  const [mobileActionBackup, setMobileActionBackup] = React.useState<Backup | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Backup | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [createVmName, setCreateVmName] = React.useState("");
  const [createNfsId, setCreateNfsId] = React.useState<string>("");
  const [creatingBackup, setCreatingBackup] = React.useState(false);
  const [nfsShares, setNfsShares] = React.useState<Record<number, string>>({});
  const [vmOptions, setVmOptions] = React.useState<VirtualMachine[]>([]);
  const [machineOptions, setMachineOptions] = React.useState<Slave[]>([]);
  const [loadingOptions, setLoadingOptions] = React.useState(false);

  const showToastMessage = React.useCallback(
    (title: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action={action}
          >
            <ToastTitle size="sm">{title}</ToastTitle>
          </Toast>
        ),
      });
    },
    [toast]
  );

  const parseBackupDate = (value: unknown) => {
    const candidates = Array.isArray(value) ? value : [value];
    const knownKeys = [
      "backupDate",
      "backup_date",
      "date",
      "created_at",
      "timestamp",
      "time",
      "CreatedAt",
    ];
    if (value && typeof value === "object") {
      for (const key of knownKeys) {
        const candidate = (value as Record<string, unknown>)[key];
        if (candidate) {
          const parsed = new Date(String(candidate));
          if (!Number.isNaN(parsed.getTime())) {
            return parsed;
          }
        }
      }
    }
    for (const candidate of candidates) {
      if (!candidate) continue;
      const parsed = new Date(String(candidate));
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  };

  const extractShareFromPath = (path?: string | null) => {
    if (!path) return "";
    const parts = path.split("/").filter(Boolean);
    const sharedIndex = parts.findIndex((p) => p === "shared");
    if (sharedIndex >= 0 && parts[sharedIndex + 1]) {
      return parts[sharedIndex + 1];
    }
    return "";
  };

  const mapBackup = React.useCallback((item: any, index: number): Backup => {
    const source = item?.db_res ?? item;
    const fallbackId = `backup-${index}`;
    const id =
      source?.Id ??
      item?.id ??
      item?.backup_id ??
      item?.bak_id ??
      item?._id ??
      source?.Name ??
      fallbackId;
    const vmName = source?.Name ?? item?.vm_name ?? item?.vmName ?? item?.vm ?? "Unknown VM";
    const path = source?.Path ?? item?.path ?? "";
    const machineName =
      extractShareFromPath(path) ||
      item?.machine_name ||
      item?.slave_name ||
      item?.machine ||
      item?.host ||
      "Unknown host";
    const sizeRaw =
      source?.Size ??
      source?.size ??
      source?.size_gb ??
      source?.sizeGB ??
      source?.total_size_gb ??
      item?.size ??
      null;
    const parsedSize =
      typeof sizeRaw === "number"
        ? sizeRaw
        : typeof sizeRaw === "string"
          ? Number(sizeRaw)
          : null;
    const nfsRaw =
      source?.NfsId ??
      item?.nfs_share_id ??
      item?.nfsShareId ??
      item?.nfs_id ??
      item?.nfs ??
      item?.nfsId;
    const nfsShareId =
      nfsRaw === undefined || nfsRaw === null || Number.isNaN(Number(nfsRaw))
        ? null
        : Number(nfsRaw);
    const status =
      item?.status ??
      item?.state ??
      item?.backup_status ??
      source?.status ??
      ("complete" as BackupStatus | null);
    const type = item?.type ?? item?.backup_type ?? source?.type ?? ("full" as BackupType | null);
    const live = Boolean(item?.live ?? item?.isLive ?? source?.live);
    const automatic = Boolean(source?.Automatic ?? item?.automatic ?? item?.Automatic);

    return {
      id: String(id),
      vmName: String(vmName),
      machineName: String(machineName),
      backupDate: parseBackupDate(
        item?.backupDate ?? item?.created_at ?? item?.date ?? source?.CreatedAt ?? item
      ),
      size: Number.isFinite(parsedSize) ? Number(parsedSize) : null,
      nfsShareId,
      status,
      type,
      live,
      automatic,
      path,
    };
  }, []);

  const loadOptions = React.useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [mounts, vms, slaves] = await Promise.all([
        listMounts().catch(() => [] as Mount[]),
        getAllVMs().catch(() => [] as VirtualMachine[]),
        listSlaves().catch(() => [] as Slave[]),
      ]);
      if (Array.isArray(mounts)) {
        const mapped: Record<number, string> = {};
        mounts.forEach((mount) => {
          if (!mount?.NfsShare) return;
          const id = mount.NfsShare.Id;
          const label =
            mount.NfsShare.Name ||
            mount.NfsShare.Target ||
            mount.NfsShare.FolderPath ||
            `NFS #${id}`;
          mapped[id] = label;
        });
        setNfsShares(mapped);
      }
      if (Array.isArray(vms)) {
        setVmOptions(vms);
      }
      if (Array.isArray(slaves)) {
        setMachineOptions(slaves);
      }
    } catch (err) {
      console.error("Error loading backup dependencies", err);
      const message = err instanceof Error ? err.message : "Failed to load backup options.";
      showToastMessage(message, "error");
    } finally {
      setLoadingOptions(false);
    }
  }, [showToastMessage]);

  const refreshBackups = React.useCallback(
    async (showMessage = false) => {
      setIsRefreshing(true);
      try {
        const data = await listBackups();
        const mapped = Array.isArray(data) ? data.map(mapBackup) : [];
        setBackups(mapped);
        if (showMessage) {
          showToastMessage("Backups updated");
        }
      } catch (err) {
        console.error("Error fetching backups", err);
        const message = err instanceof Error ? err.message : "Unable to load backups.";
        showToastMessage(message, "error");
      } finally {
        setIsRefreshing(false);
      }
    },
    [mapBackup, showToastMessage]
  );

  React.useEffect(() => {
    refreshBackups();
    loadOptions();
  }, [refreshBackups, loadOptions]);

  React.useEffect(() => {
    if (!restoreBackup) return;
    const vmMatch = vmOptions.find((vm) => vm.name === restoreBackup.vmName);
    const preferredMachine = restoreBackup.machineName || vmMatch?.machineName || "";
    const defaultMachine = machineOptions.some((m) => m.MachineName === preferredMachine)
      ? preferredMachine
      : machineOptions[0]?.MachineName || "";
    const defaultNfs =
      restoreBackup.nfsShareId != null
        ? String(restoreBackup.nfsShareId)
        : Object.keys(nfsShares)[0] ?? "";
    const memoryValue = vmMatch?.DefinedRam ?? vmMatch?.memoryMB ?? null;
    const vcpuValue = vmMatch?.DefinedCPUS ?? vmMatch?.cpuCount ?? null;
    const defaultNetwork = vmMatch?.network ?? "";

    setRestoreVmName(restoreBackup.vmName);
    setRestoreMachine(defaultMachine);
    setRestoreMemory(memoryValue ? String(memoryValue) : "");
    setRestoreVcpu(vcpuValue ? String(vcpuValue) : "");
    setRestoreNetwork(defaultNetwork || "default");
    setRestorePassword(vmMatch?.VNCPassword ?? "");
    setRestoreNfsShare(defaultNfs);
    setRestoreCpuXml(vmMatch?.CPUXML ?? "");
    setRestoreLive(false);
    setSelectedSlaves([]);
    setCurrentSlaveSelect("");
  }, [restoreBackup, vmOptions, machineOptions, nfsShares]);

  React.useEffect(() => {
    if (!createVmName && vmOptions.length > 0) {
      setCreateVmName(vmOptions[0].name);
    }
  }, [createVmName, vmOptions]);

  React.useEffect(() => {
    if (!createNfsId && Object.keys(nfsShares).length > 0) {
      setCreateNfsId(Object.keys(nfsShares)[0]);
    }
  }, [createNfsId, nfsShares]);

  // Agrupar backups por VM
  const backupsByVm = React.useMemo(() => {
    const filtered = backups.filter(
      (b) =>
        b.vmName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.machineName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const grouped: Record<string, Backup[]> = {};
    filtered.forEach((backup) => {
      const key = backup.vmName;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(backup);
    });
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => b.backupDate.getTime() - a.backupDate.getTime());
    });
    return grouped;
  }, [backups, searchQuery]);

  const stats: BackupStats = React.useMemo(() => {
    const total = backups.length;
    const complete = backups.filter(
      (b) => (b.status ?? "").toString().toLowerCase() === "complete"
    ).length;
    const totalSize = backups.reduce(
      (sum, b) => sum + (typeof b.size === "number" && Number.isFinite(b.size) ? b.size : 0),
      0
    );
    const timestamps = backups
      .map((b) => b.backupDate?.getTime?.())
      .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
    const lastBackup = timestamps.length ? new Date(Math.max(...timestamps)) : null;
    return { total, complete, totalSize, lastBackup };
  }, [backups]);

  const formatDate = (date: Date): string => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "Invalid date";
    }
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getNfsName = (id: number | null | undefined): string => {
    if (id == null) return "N/A";
    return nfsShares[id] || `NFS #${id}`;
  };
  const restoreNfsLabel = restoreNfsShare ? getNfsName(Number(restoreNfsShare)) : "";
  const createNfsLabel = createNfsId ? getNfsName(Number(createNfsId)) : "";
  const quickRestoreMemoryGb = [2, 4, 8, 12, 32];
  const availableSlaves = React.useMemo(
    () => machineOptions.map((s) => s.MachineName).filter((s) => !selectedSlaves.includes(s)),
    [machineOptions, selectedSlaves]
  );

  const handleRefresh = () => {
    refreshBackups(true);
  };

  const handleDownload = async (backup: Backup) => {
    try {
      const url = await getBackupDownloadUrl(backup.id);

      // Para web, abre em nova aba para não interromper a aplicação
      if (typeof window !== "undefined") {
        window.open(url, "_blank");
        showToastMessage("Download started");
      } else {
        // Para mobile, você pode usar Linking ou outra solução
        showToastMessage(`Download URL: ${url}`, "success");
      }
    } catch (err) {
      console.error("Error getting download URL", err);
      const message = err instanceof Error ? err.message : "Failed to get download URL.";
      showToastMessage(message, "error");
    }
  };

  const handleDelete = (backup: Backup) => {
    if (deletingId) return;
    setDeleteError(null);
    setDeleteTarget(backup);
  };

  const handleCloseDeleteModal = () => {
    if (deletingId) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id);
    setDeleteError(null);
    try {
      await deleteBackupApi(deleteTarget.id);
      setBackups((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      showToastMessage("Backup deleted");
      setDeleteTarget(null);
    } catch (err) {
      console.error("Error deleting backup", err);
      const message = err instanceof Error ? err.message : "Failed to delete backup.";
      setDeleteError(message);
      showToastMessage(message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const resetRestoreForm = React.useCallback(() => {
    setRestoreMachine("");
    setRestoreVmName("");
    setRestoreMemory("");
    setRestoreVcpu("");
    setRestoreNetwork("");
    setRestorePassword("");
    setRestoreNfsShare("");
    setRestoreCpuXml("");
    setRestoreLive(false);
    setSelectedSlaves([]);
    setCurrentSlaveSelect("");
  }, []);

  const handleGetMutualCPUs = async () => {
    if (selectedSlaves.length === 0) {
      showToastMessage("Select at least one slave.", "error");
      return;
    }
    setLoadingCPU(true);
    try {
      const cpuXmlResult = await getCpuDisableFeatures(selectedSlaves);
      setRestoreCpuXml(cpuXmlResult);
    } catch (err) {
      console.error("Error fetching CPUs:", err);
      const message = err instanceof Error ? err.message : "Failed to fetch CPUs.";
      showToastMessage(message, "error");
    } finally {
      setLoadingCPU(false);
    }
  };

  const handleCopyXml = async () => {
    if (!restoreCpuXml) return;
    try {
      const Clipboard = require("expo-clipboard");
      await Clipboard.setStringAsync(restoreCpuXml);
      showToastMessage("XML copied");
    } catch (err) {
      console.warn("Clipboard unavailable", err);
    }
  };

  const handleRestoreSubmit = async () => {
    if (!restoreBackup) return;
    const vmName = restoreVmName || restoreBackup.vmName;
    const machine = restoreMachine || restoreBackup.machineName;
    const nfsIdRaw = restoreNfsShare || (restoreBackup.nfsShareId != null ? String(restoreBackup.nfsShareId) : "");
    const memory = Number(restoreMemory || 0);
    const vcpu = Number(restoreVcpu || 0);
    const nfsId = Number(nfsIdRaw || 0);

    setRestoring(true);
    try {
      await useBackupApi(restoreBackup.id, {
        slave_name: machine,
        vm_name: vmName,
        memory: Number.isFinite(memory) ? memory : 0,
        vcpu: Number.isFinite(vcpu) ? vcpu : 0,
        network: restoreNetwork || "default",
        VNC_password: restorePassword,
        nfs_share_id: Number.isFinite(nfsId) ? nfsId : 0,
        cpu_xml: restoreCpuXml ?? "",
        live: restoreLive,
      });
      showToastMessage("Restore started");
      setRestoreBackup(null);
      resetRestoreForm();
    } catch (err) {
      console.error("Error restoring backup", err);
      const message = err instanceof Error ? err.message : "Failed to start restore.";
      showToastMessage(message, "error");
    } finally {
      setRestoring(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!createVmName || !createNfsId) {
      showToastMessage("Select a VM and NFS target", "error");
      return;
    }

    setCreatingBackup(true);
    try {
      await createBackupApi(createVmName, Number(createNfsId));
      showToastMessage("Backup started");
      setShowCreateModal(false);
      await refreshBackups(true);
    } catch (err) {
      console.error("Error creating backup", err);
      const message = err instanceof Error ? err.message : "Failed to start backup.";
      showToastMessage(message, "error");
    } finally {
      setCreatingBackup(false);
    }
  };

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";
  const isWeb = Platform.OS === "web";

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 64 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={refreshControlTint}
            colors={[refreshControlTint]}
            progressBackgroundColor={refreshControlBackground}
          />
        }
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-7xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            Backups
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl mb-6">
            Full backup management for virtual machines with quick restores and version control.
          </Text>

          {/* Stats Overview */}
          <HStack className="mb-6 gap-4 flex-wrap web:grid web:grid-cols-4">
            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <HardDrive size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Total Backups
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {stats.total}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Database size={16} className="text-[#2DD4BF] dark:text-[#5EEAD4]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Completed
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {stats.complete}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <HardDrive size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Total Space
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {stats.totalSize.toFixed(1)} GB
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Calendar size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Last Backup
                </Text>
              </HStack>
              <Text
                className="text-sm text-typography-900 dark:text-[#E8EBF0]"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                {stats.lastBackup
                  ? formatDate(stats.lastBackup).split(",")[0]
                  : "N/A"}
              </Text>
            </Box>
          </HStack>

          {/* Search Bar */}
          <HStack className="mb-6 gap-2 flex-wrap">
            <Input variant="outline" className="flex-1 rounded-lg">
              <InputSlot className="pl-3">
                <InputIcon as={Search} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
              </InputSlot>
              <InputField
                placeholder="Search by VM or slave..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </Input>
            <Button
              variant="outline"
              size="md"
              onPress={handleRefresh}
              disabled={isRefreshing}
              className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]"
            >
              {isRefreshing ? (
                <ButtonSpinner />
              ) : (
                <ButtonIcon
                  as={RefreshCw}
                  className="text-typography-700 rounded-xl dark:text-[#E8EBF0]"
                />
              )}
            </Button>
            <Button
              size="md"
              className="rounded-xl"
              onPress={() => setShowCreateModal(true)}
              disabled={creatingBackup}
            >
              {creatingBackup ? (
                <ButtonSpinner />
              ) : (
                <>
                  <ButtonIcon as={Plus} className="text-background-0 mr-1.5" />
                  <ButtonText className="text-background-0" style={{ fontFamily: "Inter_600SemiBold" }}>
                    New backup
                  </ButtonText>
                </>
              )}
            </Button>
          </HStack>

          {/* Backups List */}
          {Object.keys(backupsByVm).length === 0 ? (
            <Box className="p-8 web:rounded-2xl web:bg-background-0/80 dark:web:bg-[#151F30]/80">
              <VStack className="items-center gap-4">
                <HardDrive size={48} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-typography-900 dark:text-[#E8EBF0] text-lg text-center"
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  No backups found
                </Text>
                <Text
                  className="text-[#9AA4B8] dark:text-[#8A94A8] text-center"
                  style={{ fontFamily: "Inter_400Regular" }}
                >
                  {searchQuery
                    ? "Try refining your search"
                    : "Backups will appear here automatically"}
                </Text>
              </VStack>
            </Box>
          ) : isWeb ? (
            <VStack className="gap-6">
              {Object.entries(backupsByVm).map(([vmName, vmBackups]) => {
                const firstBackup = vmBackups[0];
                return (
                  <Box
                    key={vmName}
                    className="rounded-2xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] overflow-hidden web:shadow-md dark:web:shadow-none"
                  >
                    {/* Header */}
                    <Box className="border-b border-outline-100 dark:border-[#2A3B52] p-4 web:p-6">
                      <Heading
                        size="lg"
                        className="text-typography-900 dark:text-[#E8EBF0] mb-1"
                        style={{ fontFamily: "Inter_700Bold" }}
                      >
                        {vmName}
                      </Heading>
                      <Text
                        className="text-sm text-[#9AA4B8] dark:text-[#8A94A8]"
                        style={{ fontFamily: "Inter_400Regular" }}
                      >
                        {getNfsName(firstBackup?.nfsShareId ?? null)} • {vmBackups.length} backup
                        {vmBackups.length > 1 ? "s" : ""}
                      </Text>
                    </Box>

                    {/* Table */}
                    <Box className="overflow-x-auto">
                      <Box className="min-w-[800px]">
                        {/* Table Header */}
                        <HStack className="bg-background-50 dark:bg-[#0A1628] px-4 py-3 border-b border-outline-100 dark:border-[#1E2F47]">
                          <Text
                            className="flex-[2] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{ fontFamily: "Inter_600SemiBold" }}
                          >
                            DATE
                          </Text>
                          <Text
                            className="flex-[2] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{ fontFamily: "Inter_600SemiBold" }}
                          >
                            NFS SHARE
                          </Text>
                          <Text
                            className="flex-1 text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{ fontFamily: "Inter_600SemiBold" }}
                          >
                            AUTOMATIC
                          </Text>
                          <Text
                            className="flex-1 text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{ fontFamily: "Inter_600SemiBold" }}
                          >
                            LIVE
                          </Text>
                          <Text
                            className="flex-1 text-xs text-[#9AA4B8] dark:text-[#8A94A8] text-right"
                            style={{ fontFamily: "Inter_600SemiBold" }}
                          >
                            ACTIONS
                          </Text>
                        </HStack>

                        {/* Table Rows */}
                        {vmBackups.map((backup, index) => {
                          const automatic = Boolean(backup.automatic);
                          const live = Boolean(backup.live);

                          return (
                            <HStack
                              key={backup.id}
                              className={`px-4 py-3 items-center ${index !== vmBackups.length - 1
                                ? "border-b border-outline-100 dark:border-[#1E2F47]"
                                : ""
                                }`}
                            >
                              <Text
                                className="flex-[2] text-sm text-typography-900 dark:text-[#E8EBF0]"
                                style={{ fontFamily: "Inter_400Regular" }}
                              >
                                {formatDate(backup.backupDate)}
                              </Text>
                              <Text
                                className="flex-[2] text-sm text-typography-600 dark:text-typography-400"
                                style={{ fontFamily: "Inter_400Regular" }}
                              >
                                {getNfsName(backup.nfsShareId)}
                              </Text>
                              <Box className="flex-1">
                                <Badge
                                  size="sm"
                                  variant="outline"
                                  className={`rounded-full w-fit ${automatic
                                    ? "bg-[#3b82f619] border-[#3b82f6] dark:bg-[#3b82f625] dark:border-[#60a5fa]"
                                    : "bg-[#ef444419] border-[#ef4444] dark:bg-[#ef444425] dark:border-[#f87171]"
                                    }`}
                                >
                                  <BadgeText
                                    className={`text-xs ${automatic
                                      ? "text-[#3b82f6] dark:text-[#60a5fa]"
                                      : "text-[#ef4444] dark:text-[#f87171]"
                                      }`}
                                    style={{ fontFamily: "Inter_500Medium" }}
                                  >
                                    {automatic ? "Automatic" : "Manual"}
                                  </BadgeText>
                                </Badge>
                              </Box>
                              <Box className="flex-1">
                                <Badge
                                  size="sm"
                                  variant="outline"
                                  className={`rounded-full w-fit ${live
                                    ? "bg-[#22c55e19] border-[#22c55e] dark:bg-[#22c55e25] dark:border-[#4ade80]"
                                    : "bg-[#9AA4B819] border-[#9AA4B8] dark:bg-[#9AA4B825] dark:border-[#94a3b8]"
                                    }`}
                                >
                                  <BadgeText
                                    className={`text-xs ${live
                                      ? "text-[#22c55e] dark:text-[#4ade80]"
                                      : "text-[#475569] dark:text-[#cbd5e1]"
                                      }`}
                                    style={{ fontFamily: "Inter_500Medium" }}
                                  >
                                    {live ? "Live" : "Cold"}
                                  </BadgeText>
                                </Badge>
                              </Box>
                              <HStack className="flex-1 gap-2 justify-end">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  className="rounded-xl"
                                  onPress={() => handleDownload(backup)}
                                >
                                  <ButtonIcon
                                    as={Download}
                                    size="xs"
                                    className="text-typography-700 dark:text-[#E8EBF0]"
                                  />
                                </Button>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  className="rounded-xl"
                                  onPress={() => setRestoreBackup(backup)}
                                  disabled={restoring}
                                >
                                  <ButtonIcon
                                    as={RotateCcw}
                                    size="xs"
                                    className="text-typography-700 dark:text-[#E8EBF0]"
                                  />
                                </Button>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  className="rounded-xl border-red-500"
                                  onPress={() => handleDelete(backup)}
                                  disabled={deletingId === backup.id}
                                >
                                  {deletingId === backup.id ? (
                                    <ButtonSpinner />
                                  ) : (
                                    <ButtonIcon
                                      as={Trash2}
                                      size="xs"
                                      className="text-red-500"
                                    />
                                  )}
                                </Button>
                              </HStack>
                            </HStack>
                          );
                        })}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </VStack>
          ) : (
            <VStack className="gap-4">
              {Object.entries(backupsByVm).map(([vmName, vmBackups]) => (
                <VStack key={vmName} className="gap-3">
                  <HStack className="items-center justify-between px-1">
                    <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                      {vmName}
                    </Text>
                    <Text className="text-xs text-typography-500 dark:text-typography-400">
                      {vmBackups.length} backup{vmBackups.length > 1 ? "s" : ""}
                    </Text>
                  </HStack>
                  <VStack className="gap-2">
                    {vmBackups.map((backup) => {
                      const automatic = Boolean(backup.automatic);
                      return (
                        <Pressable
                          key={backup.id}
                          onPress={() => setMobileActionBackup(backup)}
                          className="rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4"
                        >
                          <HStack className="items-start justify-between">
                            <VStack className="flex-1 pr-3">
                              <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                                {backup.vmName}
                              </Text>
                              <Text className="text-xs text-typography-600 dark:text-typography-400 mt-1">
                                {formatDate(backup.backupDate)}
                              </Text>
                              <Text className="text-xs text-typography-500 dark:text-typography-400 mt-1">
                                {backup.machineName}
                              </Text>
                            </VStack>
                            <Badge
                              size="sm"
                              variant="outline"
                              className={`rounded-full ${automatic
                                ? "bg-[#3b82f619] border-[#3b82f6] dark:bg-[#3b82f625] dark:border-[#60a5fa]"
                                : "bg-[#ef444419] border-[#ef4444] dark:bg-[#ef444425] dark:border-[#f87171]"
                                }`}
                            >
                              <BadgeText
                                className={`text-xs ${automatic
                                  ? "text-[#3b82f6] dark:text-[#60a5fa]"
                                  : "text-[#ef4444] dark:text-[#f87171]"
                                  }`}
                              >
                                {automatic ? "Automatic" : "Manual"}
                              </BadgeText>
                            </Badge>
                          </HStack>
                        </Pressable>
                      );
                    })}
                  </VStack>
                </VStack>
              ))}
            </VStack>
          )}
        </Box>
      </ScrollView>

      {/* Modal: Restaurar Backup */}
      <Modal
        isOpen={!!restoreBackup}
        onClose={() => {
          setRestoreBackup(null);
          resetRestoreForm();
        }}
        size="full"
      >
        <ModalBackdrop />
        <ModalContent className="max-w-[90%] max-h-[90%] web:max-w-4xl">
          <ModalHeader className="border-b border-outline-100 dark:border-[#2A3B52]">
            <Heading
              size="lg"
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              Restore Backup
            </Heading>
            <ModalCloseButton>
              <X className="text-typography-700 dark:text-[#E8EBF0]" />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody className="bg-background-50 dark:bg-[#0A1628]">
            <ScrollView showsVerticalScrollIndicator>
              <Box className="p-4 web:p-6">
                {restoreBackup && (
                  <VStack className="gap-5">
                    <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] p-4">
                      <VStack className="gap-3">
                        <HStack className="items-center justify-between">
                          <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-typography-400">
                            VM
                          </Text>
                          <Text className="text-sm text-typography-900 dark:text-[#E8EBF0]">
                            {restoreBackup.vmName}
                          </Text>
                        </HStack>
                        <HStack className="items-center justify-between">
                          <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-typography-400">
                            Backup Date
                          </Text>
                          <Text className="text-sm text-typography-700 dark:text-typography-200">
                            {formatDate(restoreBackup.backupDate)}
                          </Text>
                        </HStack>
                      </VStack>
                    </Box>

                    <VStack className="gap-4 web:grid web:grid-cols-2 web:gap-4">
                      <VStack className="gap-2">
                        <Text
                          className="text-sm text-typography-700 dark:text-typography-300"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          VM name
                        </Text>
                        <Input
                          variant="outline"
                          className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]"
                        >
                          <InputField
                            value={restoreVmName}
                            onChangeText={setRestoreVmName}
                            className="text-typography-900 dark:text-[#E8EBF0]"
                          />
                        </Input>
                      </VStack>

                      <VStack className="gap-2">
                        <Text
                          className="text-sm text-typography-700 dark:text-typography-300"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          Target machine
                        </Text>
                        <Select
                          selectedValue={restoreMachine}
                          onValueChange={setRestoreMachine}
                          isDisabled={loadingOptions || machineOptions.length === 0}
                        >
                          <SelectTrigger variant="outline" size="md" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]">
                            <SelectInput
                              placeholder={loadingOptions ? "Loading..." : "Choose a machine..."}
                              value={restoreMachine}
                              className="text-typography-900 dark:text-[#E8EBF0]"
                            />
                            <SelectIcon className="mr-3 text-typography-500 dark:text-typography-400" as={ChevronDownIcon} />
                          </SelectTrigger>
                          <SelectPortal>
                            <SelectBackdropContent />
                            <SelectContent className="bg-background-0 dark:bg-[#151F30]">
                              <SelectDragIndicatorWrapper>
                                <SelectDragIndicator />
                              </SelectDragIndicatorWrapper>
                              {machineOptions.length === 0 ? (
                                <SelectItem label={loadingOptions ? "Loading..." : "No machines"} value="" isDisabled />
                              ) : (
                                machineOptions.map((machine) => (
                                  <SelectItem
                                    key={machine.MachineName}
                                    label={machine.MachineName}
                                    value={machine.MachineName}
                                  />
                                ))
                              )}
                            </SelectContent>
                          </SelectPortal>
                        </Select>
                      </VStack>

                      <VStack className="gap-2">
                        <Text
                          className="text-sm text-typography-700 dark:text-typography-300"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          vCPU
                        </Text>
                        <Input
                          variant="outline"
                          className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]"
                        >
                          <InputField
                            keyboardType="numeric"
                            value={restoreVcpu}
                            onChangeText={setRestoreVcpu}
                            className="text-typography-900 dark:text-[#E8EBF0]"
                          />
                        </Input>
                      </VStack>

                      <VStack className="gap-2">
                        <Text
                          className="text-sm text-typography-700 dark:text-typography-300"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          Memory (MB)
                        </Text>
                        <Input
                          variant="outline"
                          className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]"
                        >
                          <InputField
                            keyboardType="numeric"
                            value={restoreMemory}
                            onChangeText={setRestoreMemory}
                            className="text-typography-900 dark:text-[#E8EBF0]"
                          />
                        </Input>
                        <HStack className="gap-2 flex-wrap">
                          {quickRestoreMemoryGb.map((gb) => (
                            <Pressable
                              key={`restore-mem-${gb}`}
                              onPress={() => setRestoreMemory(String(gb * 1024))}
                              className={`px-3 py-2 rounded-full border ${
                                Number(restoreMemory) === gb * 1024
                                  ? "border-primary-500 bg-primary-50/20"
                                  : "border-outline-200 bg-background-0"
                              }`}
                            >
                              <Text className="text-xs font-medium text-typography-700">
                                {gb} GB
                              </Text>
                            </Pressable>
                          ))}
                        </HStack>
                      </VStack>

                      <VStack className="gap-2">
                        <Text
                          className="text-sm text-typography-700 dark:text-typography-300"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          Network
                        </Text>
                        <Input
                          variant="outline"
                          className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]"
                        >
                          <InputField
                            value={restoreNetwork}
                            onChangeText={setRestoreNetwork}
                            className="text-typography-900 dark:text-[#E8EBF0]"
                          />
                        </Input>
                      </VStack>

                      <VStack className="gap-2">
                        <Text
                          className="text-sm text-typography-700 dark:text-typography-300"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          VNC password
                        </Text>
                        <Input
                          variant="outline"
                          className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]"
                        >
                          <InputField
                            value={restorePassword}
                            onChangeText={setRestorePassword}
                            placeholder="Optional"
                            className="text-typography-900 dark:text-[#E8EBF0]"
                          />
                        </Input>
                      </VStack>

                      <VStack className="gap-2">
                        <Text
                          className="text-sm text-typography-700 dark:text-typography-300"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          NFS share
                        </Text>
                        <Select
                          selectedValue={restoreNfsShare}
                          onValueChange={setRestoreNfsShare}
                          isDisabled={loadingOptions || Object.keys(nfsShares).length === 0}
                        >
                          <SelectTrigger variant="outline" size="md" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]">
                            <SelectInput
                              placeholder={loadingOptions ? "Loading..." : "Choose a NFS share..."}
                              value={restoreNfsLabel}
                              className="text-typography-900 dark:text-[#E8EBF0]"
                            />
                            <SelectIcon className="mr-3 text-typography-500 dark:text-typography-400" as={ChevronDownIcon} />
                          </SelectTrigger>
                          <SelectPortal>
                            <SelectBackdropContent />
                            <SelectContent className="bg-background-0 dark:bg-[#151F30]">
                              <SelectDragIndicatorWrapper>
                                <SelectDragIndicator />
                              </SelectDragIndicatorWrapper>
                              {Object.keys(nfsShares).length === 0 ? (
                                <SelectItem label={loadingOptions ? "Loading..." : "No NFS shares"} value="" isDisabled />
                              ) : (
                                Object.entries(nfsShares).map(([id, label]) => (
                                  <SelectItem key={id} label={label} value={id} />
                                ))
                              )}
                            </SelectContent>
                          </SelectPortal>
                        </Select>
                      </VStack>

                    </VStack>

                    <VStack className="gap-3 mt-2">
                      <Checkbox
                        value="live-restore"
                        isChecked={restoreLive}
                        onChange={setRestoreLive}
                        className="gap-2"
                      >
                        <CheckboxIndicator className="border-outline-300 dark:border-[#2A3B52]">
                          <CheckboxIcon as={Check} />
                        </CheckboxIndicator>
                        <CheckboxLabel className="text-typography-700 dark:text-typography-300">
                          Live restore
                        </CheckboxLabel>
                      </Checkbox>
                    </VStack>

                    {restoreLive && (
                      <Box className="mt-4 p-4 bg-background-0 dark:bg-[#0F1A2E] border border-outline-200 dark:border-[#2A3B52] rounded-xl">
                        <HStack className="gap-2 items-center mb-3">
                          <Cpu size={20} className="text-typography-700 dark:text-[#E8EBF0]" />
                          <Heading
                            size="sm"
                            className="text-typography-900 dark:text-[#E8EBF0]"
                            style={{ fontFamily: "Inter_700Bold" }}
                          >
                            Advanced CPU Configuration
                          </Heading>
                        </HStack>

                        <Text className="text-sm text-typography-600 dark:text-typography-400 mb-4">
                          Select slaves to compare and get a CPU configuration compatible between them.
                        </Text>

                        <VStack className="gap-2 mb-4">
                          <Text
                            className="text-sm text-typography-700 dark:text-typography-300"
                            style={{ fontFamily: "Inter_600SemiBold" }}
                          >
                            Selected slaves ({selectedSlaves.length})
                          </Text>

                          <Box className="p-3 bg-background-50 dark:bg-[#0A1628] border border-outline-200 dark:border-[#1E2F47] rounded-lg min-h-[60px]">
                            {selectedSlaves.length === 0 ? (
                              <Text className="text-sm text-typography-400 dark:text-typography-500 text-center">
                                No slave selected
                              </Text>
                            ) : (
                              <HStack className="gap-2 flex-wrap">
                                {selectedSlaves.map((slaveName) => (
                                  <Badge
                                    key={slaveName}
                                    variant="solid"
                                    className="rounded-full bg-typography-100 dark:bg-[#1E2F47]"
                                  >
                                    <HStack className="gap-1 items-center">
                                      <BadgeText className="text-typography-900 dark:text-[#E8EBF0]">
                                        {slaveName}
                                      </BadgeText>
                                      <Button
                                        size="xs"
                                        variant="link"
                                        onPress={() => {
                                          setSelectedSlaves(
                                            selectedSlaves.filter((s) => s !== slaveName)
                                          );
                                        }}
                                        className="p-0 min-w-0 h-4"
                                      >
                                        <ButtonIcon
                                          as={X}
                                          size="xs"
                                          className="text-typography-700 dark:text-[#E8EBF0]"
                                        />
                                      </Button>
                                    </HStack>
                                  </Badge>
                                ))}
                              </HStack>
                            )}
                          </Box>
                        </VStack>

                        <VStack className="gap-2 mb-4">
                          <Text
                            className="text-sm text-typography-700 dark:text-typography-300"
                            style={{ fontFamily: "Inter_600SemiBold" }}
                          >
                            Add slave to comparison
                          </Text>

                          <Select
                            selectedValue={currentSlaveSelect}
                            onValueChange={(value) => {
                              if (
                                value &&
                                machineOptions.find((s) => s.MachineName === value) &&
                                !selectedSlaves.includes(value)
                              ) {
                                setSelectedSlaves([...selectedSlaves, value]);
                                setCurrentSlaveSelect("");
                              }
                            }}
                            isDisabled={loadingOptions || availableSlaves.length === 0}
                          >
                            <SelectTrigger className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]">
                              <SelectInput
                                placeholder={loadingOptions ? "Loading..." : "Select a slave..."}
                                className="text-typography-900 dark:text-[#E8EBF0]"
                              />
                              <SelectIcon as={ChevronDownIcon} className="mr-3" />
                            </SelectTrigger>
                            <SelectPortal>
                              <SelectBackdropContent />
                              <SelectContent className="bg-background-0 dark:bg-[#151F30]">
                                <SelectDragIndicatorWrapper>
                                  <SelectDragIndicator />
                                </SelectDragIndicatorWrapper>
                                {availableSlaves.length === 0 ? (
                                  <SelectItem label="All slaves have been added" value="" isDisabled />
                                ) : (
                                  availableSlaves.map((s) => (
                                    <SelectItem
                                      key={s}
                                      label={s}
                                      value={s}
                                      className="text-typography-900 dark:text-[#E8EBF0]"
                                    />
                                  ))
                                )}
                              </SelectContent>
                            </SelectPortal>
                          </Select>
                        </VStack>

                        <Button
                          variant="outline"
                          onPress={handleGetMutualCPUs}
                          disabled={selectedSlaves.length === 0 || loadingCPU}
                          className="rounded-lg mb-4 border-outline-200 dark:border-[#2A3B52]"
                        >
                          {loadingCPU ? (
                            <>
                              <ButtonSpinner className="mr-2" />
                              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                                Fetching CPUs...
                              </ButtonText>
                            </>
                          ) : (
                            <>
                              <ButtonIcon as={Cpu} className="mr-2 text-typography-900 dark:text-[#E8EBF0]" />
                              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                                Get Mutual CPUs
                              </ButtonText>
                            </>
                          )}
                        </Button>

                        <VStack className="gap-2">
                          <HStack className="justify-between items-center">
                            <Text
                              className="text-sm text-typography-700 dark:text-typography-300"
                              style={{ fontFamily: "Inter_600SemiBold" }}
                            >
                              CPU Configuration XML
                            </Text>
                            <HStack className="gap-2">
                              <Button
                                size="xs"
                                variant="outline"
                                onPress={handleCopyXml}
                                disabled={!restoreCpuXml}
                                className="rounded-md border-outline-200 dark:border-[#2A3B52]"
                              >
                                <ButtonIcon
                                  as={Copy}
                                  size="xs"
                                  className="text-typography-700 dark:text-[#E8EBF0]"
                                />
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onPress={() => setRestoreCpuXml("")}
                                disabled={!restoreCpuXml}
                                className="rounded-md border-red-300 dark:border-red-700"
                              >
                                <ButtonIcon
                                  as={Trash2}
                                  size="xs"
                                  className="text-red-600 dark:text-red-400"
                                />
                              </Button>
                            </HStack>
                          </HStack>

                          <Text className="text-xs text-typography-500 dark:text-typography-400">
                            This XML configures the VM CPU. You can edit it manually if needed.
                          </Text>

                          <Box className="bg-[#0F172A] border border-[#1E2F47] rounded-lg overflow-hidden">
                            <Box className="bg-[#0A0E1A] px-3 py-2 border-b border-[#1E2F47] flex-row justify-between items-center">
                              <Text className="text-xs text-[#64748B] font-mono">
                                XML Editor
                              </Text>
                              <Text className="text-xs text-[#475569]">
                                {restoreCpuXml.length} chars
                              </Text>
                            </Box>
                            <StableTextInput
                              value={restoreCpuXml}
                              onChangeText={setRestoreCpuXml}
                              multiline
                              scrollEnabled
                              autoCorrect={false}
                              autoCapitalize="none"
                              spellCheck={false}
                              textAlignVertical="top"
                              style={{
                                fontFamily: Platform.select({
                                  ios: "Menlo",
                                  android: "monospace",
                                }),
                                color: restoreCpuXml ? "#22C55E" : "#64748B",
                                backgroundColor: "#0F172A",
                                fontSize: 12,
                                lineHeight: 18,
                                padding: 12,
                                height: 240,
                              }}
                            />
                          </Box>
                        </VStack>
                      </Box>
                    )}
                  </VStack>
                )}
              </Box>
            </ScrollView>
          </ModalBody>
          <ModalFooter className="border-t border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0F1A2E]">
            <HStack className="gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1 rounded-lg border-outline-200 dark:border-[#2A3B52]"
                onPress={() => {
                  setRestoreBackup(null);
                  resetRestoreForm();
                }}
              >
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                  Cancel
                </ButtonText>
              </Button>
              <Button
                className="flex-1 rounded-lg bg-typography-900 dark:bg-[#2DD4BF]"
                disabled={
                  restoring ||
                  !restoreMachine ||
                  !restoreVmName ||
                  !restoreNfsShare
                }
                onPress={handleRestoreSubmit}
              >
                {restoring ? <ButtonSpinner className="mr-2" /> : null}
                <ButtonText className="text-background-0 dark:text-[#0A1628]">
                  Restore
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={handleCloseDeleteModal}>
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <HStack className="items-center gap-3">
              <Box className="h-10 w-10 rounded-2xl bg-error-500/10 dark:bg-error-900/20 items-center justify-center">
                <Trash2 size={18} className="text-error-600 dark:text-error-400" />
              </Box>
              <VStack>
                <Heading
                  size="md"
                  className="text-typography-900 dark:text-[#E8EBF0]"
                  style={{ fontFamily: "Inter_700Bold" }}
                >
                  Delete backup?
                </Heading>
                <Text className="text-sm text-typography-600 dark:text-typography-400">
                  This permanently removes the backup file from storage.
                </Text>
              </VStack>
            </HStack>
            <ModalCloseButton className="text-typography-600 dark:text-typography-400" />
          </ModalHeader>
          <ModalBody className="pt-5">
            <VStack className="gap-4">
              {deleteTarget ? (
                <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0A1628] p-4">
                  <VStack className="gap-3">
                    <HStack className="items-center justify-between">
                      <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-typography-400">
                        VM
                      </Text>
                      <Text className="text-sm text-typography-900 dark:text-[#E8EBF0]">
                        {deleteTarget.vmName}
                      </Text>
                    </HStack>
                    <HStack className="items-center justify-between">
                      <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-typography-400">
                        Date
                      </Text>
                      <Text className="text-sm text-typography-700 dark:text-typography-200">
                        {formatDate(deleteTarget.backupDate)}
                      </Text>
                    </HStack>
                    <HStack className="items-center justify-between">
                      <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-typography-400">
                        NFS share
                      </Text>
                      <Text className="text-sm text-typography-700 dark:text-typography-200">
                        {getNfsName(deleteTarget.nfsShareId)}
                      </Text>
                    </HStack>
                    <HStack className="items-center justify-between">
                      <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-typography-400">
                        Type
                      </Text>
                      <Text className="text-sm text-typography-700 dark:text-typography-200">
                        {deleteTarget.type ? String(deleteTarget.type) : "—"}
                      </Text>
                    </HStack>
                    <HStack className="items-center justify-between">
                      <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-typography-400">
                        Status
                      </Text>
                      <Text className="text-sm text-typography-700 dark:text-typography-200">
                        {deleteTarget.status ? String(deleteTarget.status) : "—"}
                      </Text>
                    </HStack>
                    <HStack className="items-center justify-between">
                      <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-typography-400">
                        Size
                      </Text>
                      <Text className="text-sm text-typography-700 dark:text-typography-200">
                        {typeof deleteTarget.size === "number" &&
                        Number.isFinite(deleteTarget.size)
                          ? `${deleteTarget.size.toFixed(1)} GB`
                          : "—"}
                      </Text>
                    </HStack>
                  </VStack>
                </Box>
              ) : null}
              {deleteError ? (
                <Box className="rounded-xl border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/20 px-4 py-3">
                  <Text className="text-sm text-error-700 dark:text-error-200">
                    {deleteError}
                  </Text>
                </Box>
              ) : null}
            </VStack>
          </ModalBody>
          <ModalFooter className="gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <Button
              variant="outline"
              className="rounded-xl px-4"
              onPress={handleCloseDeleteModal}
              isDisabled={Boolean(deletingId)}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>
            <Button
              action="negative"
              onPress={handleConfirmDelete}
              isDisabled={Boolean(deletingId)}
              className="rounded-xl bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
            >
              {deletingId ? (
                <ButtonSpinner />
              ) : (
                <ButtonText className="text-background-0 dark:text-[#0A1628]">
                  Delete backup
                </ButtonText>
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={!!mobileActionBackup}
        onClose={() => setMobileActionBackup(null)}
      >
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <Heading
              size="md"
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              Backup Actions
            </Heading>
            <ModalCloseButton className="text-typography-600 dark:text-typography-400" />
          </ModalHeader>
          <ModalBody className="py-4">
            {mobileActionBackup ? (
              <VStack className="gap-4">
                <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0A1628] p-4">
                  <VStack className="gap-2">
                    <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                      {mobileActionBackup.vmName}
                    </Text>
                    <Text className="text-xs text-typography-600 dark:text-typography-400">
                      {formatDate(mobileActionBackup.backupDate)}
                    </Text>
                    <Text className="text-xs text-typography-500 dark:text-typography-400">
                      {mobileActionBackup.machineName}
                    </Text>
                  </VStack>
                </Box>
                <Button
                  className="rounded-xl bg-typography-900 dark:bg-[#2DD4BF]"
                  onPress={async () => {
                    if (!mobileActionBackup) return;
                    await handleDownload(mobileActionBackup);
                    setMobileActionBackup(null);
                  }}
                >
                  <ButtonText className="text-background-0 dark:text-[#0A1628]">
                    Transfer
                  </ButtonText>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border-outline-200 dark:border-[#2A3B52]"
                  onPress={() => {
                    if (!mobileActionBackup) return;
                    setRestoreBackup(mobileActionBackup);
                    setMobileActionBackup(null);
                  }}
                >
                  <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                    Use Backup
                  </ButtonText>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border-red-500"
                  onPress={() => {
                    if (!mobileActionBackup) return;
                    handleDelete(mobileActionBackup);
                    setMobileActionBackup(null);
                  }}
                >
                  <ButtonText className="text-red-600 dark:text-red-400">
                    Delete
                  </ButtonText>
                </Button>
              </VStack>
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Modal: Criar Backup */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4">
            <Heading
              size="lg"
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              Create Backup
            </Heading>
            <ModalCloseButton className="text-typography-600 dark:text-typography-400" />
          </ModalHeader>
          <ModalBody className="py-4">
            <VStack className="gap-5">
              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  VM
                </Text>
                <Select
                  selectedValue={createVmName}
                  onValueChange={setCreateVmName}
                  isDisabled={loadingOptions || vmOptions.length === 0}
                >
                  <SelectTrigger variant="outline" size="md" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                    <SelectInput
                      placeholder={loadingOptions ? "Loading..." : "Choose a VM..."}
                      value={createVmName}
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                    <SelectIcon className="mr-3 text-typography-500 dark:text-typography-400" as={ChevronDownIcon} />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdropContent />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {vmOptions.length === 0 ? (
                        <SelectItem label={loadingOptions ? "Loading..." : "No VMs available"} value="" isDisabled />
                      ) : (
                        vmOptions.map((vm) => (
                          <SelectItem key={vm.name} label={`${vm.name} (${vm.machineName})`} value={vm.name} />
                        ))
                      )}
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </VStack>

              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  NFS share
                </Text>
                <Select
                  selectedValue={createNfsId}
                  onValueChange={setCreateNfsId}
                  isDisabled={loadingOptions || Object.keys(nfsShares).length === 0}
                >
                  <SelectTrigger variant="outline" size="md" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                    <SelectInput
                      placeholder={loadingOptions ? "Loading..." : "Choose a NFS share..."}
                      value={createNfsLabel}
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                    <SelectIcon className="mr-3 text-typography-500 dark:text-typography-400" as={ChevronDownIcon} />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdropContent />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {Object.keys(nfsShares).length === 0 ? (
                        <SelectItem label={loadingOptions ? "Loading..." : "No NFS shares"} value="" isDisabled />
                      ) : (
                        Object.entries(nfsShares).map(([id, label]) => (
                          <SelectItem key={id} label={label} value={id} />
                        ))
                      )}
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </VStack>
            </VStack>
          </ModalBody>
          <ModalFooter className="pt-6 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="justify-end gap-3 w-full">
              <Button
                variant="outline"
                className="rounded-xl px-6 py-2.5 border-outline-200 dark:border-[#2A3B52]"
                onPress={() => setShowCreateModal(false)}
                disabled={creatingBackup}
              >
                <ButtonText
                  className="text-typography-700 dark:text-[#E8EBF0]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Cancel
                </ButtonText>
              </Button>
              <Button
                size="md"
                className="rounded-xl px-4"
                disabled={creatingBackup || !createVmName || !createNfsId}
                onPress={handleCreateBackup}
              >
                {creatingBackup ? (
                  <ButtonSpinner />
                ) : (
                  <>
                    <ButtonIcon as={Plus} className="text-background-0 mr-1.5" />
                    <ButtonText
                      className="text-background-0"
                      style={{ fontFamily: "Inter_600SemiBold" }}
                    >
                      New backup
                    </ButtonText>
                  </>
                )}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
