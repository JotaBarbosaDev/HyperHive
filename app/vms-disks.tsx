import React from "react";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { Platform, RefreshControl, ScrollView, useColorScheme } from "react-native";
import { AlertTriangle, Plus, RefreshCw, Trash2, TrendingUp } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Input, InputField } from "@/components/ui/input";
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@/components/ui/select";
import { ChevronDownIcon } from "@/components/ui/icon";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import {
  importVmDisk, moveVmDisk, listDiskOperations, reconcileDiskOperation, DiskOperation,
  createVmDisk,
  deleteVmDisk,
  growVmDisk,
  getVmDiskDownloadUrl,
  listMounts,
  listVmDisks,
  VmDisk,
} from "@/services/hyperhive";
import { Mount } from "@/types/mount";
import { attachVmDisk, detachVmDisk, getAllVMs, VirtualMachine } from "@/services/vms-client";

type DiskForm = {
  name: string;
  nfsId: string;
  sizeGb: string;
  format: string;
};

const DEFAULT_FORM: DiskForm = {
  name: "",
  nfsId: "",
  sizeGb: "100",
  format: "qcow2",
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const formatGb = (value: unknown) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return "-";
  }
  return `${numberValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} GB`;
};

const formatBytes = (value: unknown) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / Math.pow(1024, exponent);
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: exponent === 0 ? 0 : 2 })} ${units[exponent]}`;
};

const getNfsLabel = (mounts: Mount[], id: number) => {
  const mount = mounts.find((item) => item.NfsShare.Id === id);
  return mount?.NfsShare.Name || `NFS #${id}`;
};

const getNfsSelectLabel = (mounts: Mount[], id: string) => {
  const mount = mounts.find((item) => String(item.NfsShare.Id) === id);
  if (!mount) {
    return undefined;
  }
  return `${mount.NfsShare.Name} (${mount.NfsShare.MachineName})`;
};

export default function VmsDisksScreen() {
  const { token, isChecking } = useAuthGuard();
  const toast = useToast();
  const colorScheme = useColorScheme();
  const [disks, setDisks] = React.useState<VmDisk[]>([]);
  const [mounts, setMounts] = React.useState<Mount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [mountsFresh, setMountsFresh] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<DiskForm>(DEFAULT_FORM);
  const [creating, setCreating] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<VmDisk | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [attachTarget, setAttachTarget] = React.useState<VmDisk | null>(null);
  const [detachTarget, setDetachTarget] = React.useState<VmDisk | null>(null);
  const [vms, setVms] = React.useState<VirtualMachine[]>([]);
  const [selectedVm, setSelectedVm] = React.useState("");
  const [loadingVms, setLoadingVms] = React.useState(false);
  const [savingAttachment, setSavingAttachment] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [moveTarget, setMoveTarget] = React.useState<VmDisk | null>(null);
  const [transferName, setTransferName] = React.useState("");
  const [transferNfs, setTransferNfs] = React.useState("");
  const [transferFile, setTransferFile] = React.useState<Blob | null>(null);
  const [transferFileName, setTransferFileName] = React.useState("");
  const [transferring, setTransferring] = React.useState(false);
  const [transferProgress, setTransferProgress] = React.useState(0);
  const [transferError, setTransferError] = React.useState("");
  const [operations, setOperations] = React.useState<DiskOperation[]>([]);
  const [operationError, setOperationError] = React.useState("");
  const [reconciling, setReconciling] = React.useState("");
  const uploadAbort = React.useRef<AbortController | null>(null);
  const [growTarget, setGrowTarget] = React.useState<VmDisk | null>(null);
  const [growSize, setGrowSize] = React.useState("");
  const [growingId, setGrowingId] = React.useState<number | null>(null);

  const refreshControlTint = colorScheme === "dark" ? "rgb(248, 250, 252)" : "rgb(15, 23, 42)";
  const refreshControlBackground = colorScheme === "dark" ? "rgb(30, 41, 59)" : "rgb(226, 232, 240)";
  const selectedNfsLabel = React.useMemo(() => getNfsSelectLabel(mounts, form.nfsId), [form.nfsId, mounts]);
  const selectedStatus = mounts.find((mount) => String(mount.NfsShare.Id) === form.nfsId)?.Status;
  const knownCapacity = mountsFresh && selectedStatus?.working && [selectedStatus.spaceOccupiedGB, selectedStatus.spaceFreeGB, selectedStatus.spaceTotalGB].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0) && selectedStatus.spaceTotalGB > 0;

  const showToast = React.useCallback(
    (title: string, description?: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={`vm-disk-toast-${id}`} className="px-5 py-3 gap-3 shadow-soft-1" action={action}>
            <ToastTitle size="sm">{title}</ToastTitle>
            {description ? <ToastDescription size="sm">{description}</ToastDescription> : null}
          </Toast>
        ),
      });
    },
    [toast]
  );

  const loadOperations = React.useCallback(async () => {
    try { setOperations(await listDiskOperations() || []); setOperationError(""); }
    catch (error) { setOperationError(getErrorMessage(error, "Unable to load transfer status.")); }
  }, []);
  React.useEffect(() => () => uploadAbort.current?.abort(), []);
  React.useEffect(() => {
    if (!transferring) return;
    const timer = setInterval(loadOperations, 3000);
    return () => clearInterval(timer);
  }, [transferring, loadOperations]);

  const loadDisks = React.useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const data = await listVmDisks();
        setDisks(Array.isArray(data) ? data : []);
        await loadOperations();
      } catch (err) {
        const message = getErrorMessage(err, "Unable to load VM disks.");
        setError(message);
        showToast("Error loading VM disks", message, "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast, loadOperations]
  );

  const loadMountOptions = React.useCallback(async () => {
    setLoadingOptions(true);
    setMountsFresh(false);
    try {
      const data = await listMounts();
      setMountsFresh(true);
      setMounts(Array.isArray(data) ? data : []);
      setForm((current) => {
        if (current.nfsId || !Array.isArray(data) || data.length === 0) {
          return current;
        }
        return { ...current, nfsId: String(data[0].NfsShare.Id) };
      });
    } catch (err) {
      showToast("Error loading NFS", getErrorMessage(err, "Unable to load NFS shares."), "error");
    } finally {
      setLoadingOptions(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    if (!token) {
      return;
    }
    loadDisks("initial");
    loadMountOptions();
  }, [loadDisks, loadMountOptions, token]);

  const openTransfer = (disk: VmDisk | null) => {
    setMoveTarget(disk); setTransferName(disk?.name || ""); setTransferNfs("");
    setTransferFile(null); setTransferFileName(""); setTransferError(""); setTransferProgress(0);
    setTransferOpen(true); void loadMountOptions();
  };
  const capacityText = (id: number) => {
    const status = mounts.find(mount => mount.NfsShare.Id === id)?.Status;
    return mountsFresh && status?.working && [status.spaceOccupiedGB, status.spaceFreeGB, status.spaceTotalGB].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0) && status.spaceTotalGB > 0
      ? `${formatGb(status.spaceOccupiedGB)} used, ${formatGb(status.spaceFreeGB)} free of ${formatGb(status.spaceTotalGB)} total`
      : "unavailable";
  };
  const pickTransferFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false, copyToCacheDirectory: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.file || asset.file.size <= 0) throw new Error("Select a nonempty browser file.");
      setTransferFile(asset.file); setTransferFileName(asset.name);
      if (!transferName) setTransferName(asset.name.replace(/\.(raw|qcow2)$/i, ""));
    } catch (error) { setTransferError(getErrorMessage(error, "Unable to select file.")); }
  };
  const runTransfer = async () => {
    setTransferring(true); setTransferError(""); setTransferProgress(0);
    try {
      if (moveTarget) await moveVmDisk(moveTarget.id, Number(transferNfs));
      else {
        if (!transferFile) throw new Error("Select a file first.");
        uploadAbort.current = new AbortController();
        await importVmDisk(transferName, Number(transferNfs), transferFile, { onProgress: setTransferProgress, signal: uploadAbort.current.signal });
      }
      setTransferOpen(false); showToast(moveTarget ? "Disk moved" : "Disk imported");
    } catch (error) { setTransferError(getErrorMessage(error, "Transfer failed. Review its status below.")); }
    finally { uploadAbort.current = null; setTransferring(false); await Promise.all([loadDisks("refresh"), loadMountOptions()]); }
  };
  const reconcileTransfer = async (operation: DiskOperation, action: "finish" | "abort") => {
    setReconciling(operation.id);
    try { await reconcileDiskOperation(operation.id, action); showToast("Transfer reconciled"); }
    catch (error) { showToast("Reconciliation required", getErrorMessage(error, "Preserve both copies and review the operator procedure."), "error"); }
    finally { setReconciling(""); await Promise.all([loadDisks("refresh"), loadMountOptions()]); }
  };

  const resetCreateForm = () => {
    setForm({
      ...DEFAULT_FORM,
      nfsId: mounts[0]?.NfsShare.Id ? String(mounts[0].NfsShare.Id) : "",
    });
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
    loadMountOptions();
  };

  const handleCreate = async () => {
    const name = form.name.trim();
    const nfsId = Number(form.nfsId);
    const sizeGb = Number(form.sizeGb);
    const format = form.format.trim();

    if (!name || !Number.isInteger(nfsId) || nfsId <= 0 || !Number.isFinite(sizeGb) || sizeGb <= 0 || !format) {
      showToast("Required fields", "Name, NFS, size and format are required.", "error");
      return;
    }

    setCreating(true);
    try {
      const created = await createVmDisk({
        name,
        nfs_id: nfsId,
        size_gb: sizeGb,
        format,
      });
      setDisks((current) => [created, ...current.filter((disk) => disk.id !== created.id)]);
      setCreateOpen(false);
      resetCreateForm();
      showToast("VM disk created", `${created.name} is ready.`);
    } catch (err) {
      showToast("Error creating disk", getErrorMessage(err, "Unable to create VM disk."), "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setDeletingId(deleteTarget.id);
    try {
      await deleteVmDisk(deleteTarget.id);
      setDisks((current) => current.filter((disk) => disk.id !== deleteTarget.id));
      showToast("VM disk deleted", deleteTarget.name);
      setDeleteTarget(null);
    } catch (err) {
      showToast("Error deleting disk", getErrorMessage(err, "Unable to delete VM disk."), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const openAttach = async (disk: VmDisk) => {
    setAttachTarget(disk);
    setSelectedVm("");
    setVms([]);
    setLoadingVms(true);
    try {
      const result = await getAllVMs();
      setVms(Array.isArray(result) ? result : []);
    } catch (err) {
      showToast("Error loading VMs", getErrorMessage(err, "Unable to load VMs."), "error");
    } finally {
      setLoadingVms(false);
    }
  };

  const changeAttachment = async () => {
    const disk = attachTarget || detachTarget;
    if (!disk || (attachTarget && !selectedVm)) return;
    setSavingAttachment(true);
    try {
      if (attachTarget) await attachVmDisk(selectedVm, disk.id);
      else await detachVmDisk(disk.attached_vm_name, disk.id);
      setAttachTarget(null);
      setDetachTarget(null);
      showToast(attachTarget ? "VM disk attached" : "VM disk detached", disk.name);
    } catch (err) {
      showToast("Attachment operation failed", getErrorMessage(err, "Unable to update disk attachment."), "error");
    } finally {
      await loadDisks("refresh");
      setSavingAttachment(false);
    }
  };

  const openGrow = (disk: VmDisk) => {
    setGrowTarget(disk);
    setGrowSize(String(disk.size_gb));
  };

  const handleGrow = async () => {
    if (!growTarget) {
      return;
    }
    const nextSize = Number(growSize);
    if (!Number.isFinite(nextSize) || nextSize <= Number(growTarget.size_gb)) {
      showToast("Invalid size", "New size must be greater than current size.", "error");
      return;
    }

    setGrowingId(growTarget.id);
    try {
      const updated = await growVmDisk(growTarget.id, nextSize);
      setDisks((current) => current.map((disk) => (disk.id === updated.id ? updated : disk)));
      setGrowTarget(null);
      setGrowSize("");
      showToast("VM disk grown", `${updated.name} is now ${formatGb(updated.size_gb)}.`);
    } catch (err) {
      showToast("Error growing disk", getErrorMessage(err, "Unable to grow VM disk."), "error");
    } finally {
      setGrowingId(null);
    }
  };

  const usagePercent = (disk: VmDisk) => {
    const occupied = Number(disk.occupied_gb);
    const total = Number(disk.size_gb);
    if (!Number.isFinite(occupied) || !Number.isFinite(total) || total <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, (occupied / total) * 100));
  };

  if (isChecking || !token) {
    return null;
  }

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 64 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDisks("refresh")}
            tintColor={refreshControlTint}
            colors={[refreshControlTint]}
            progressBackgroundColor={refreshControlBackground}
          />
        }
      >
        <Box className="p-4 pt-24 web:px-6 web:pb-8 web:pt-24 web:lg:px-10 web:max-w-screen-2xl web:mx-auto web:w-full">
          <HStack className="justify-between items-start flex-col gap-4 mb-6 web:lg:flex-row">
            <VStack className="gap-2 flex-1 min-w-0">
              <Heading size="2xl" className="text-typography-900 dark:text-[#E8EBF0] mb-1 web:text-4xl">
                VMs Disks
              </Heading>
              <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
                Manage standalone VM disks, their NFS placement, size and attachment status.
              </Text>
            </VStack>

            <HStack className="gap-3 items-center flex-wrap web:flex-wrap">
              <Button
                variant="outline"
                action="default"
                className="h-11 px-4 rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
                accessibilityLabel="Refresh VM disks"
                onPress={() => loadDisks("refresh")}
                isDisabled={refreshing || loading}
              >
                {refreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCw} className="text-typography-900 dark:text-[#E8EBF0]" />}
              </Button>
              <Button variant="outline" onPress={() => openTransfer(null)}><ButtonText>Import Disk</ButtonText></Button>
              <Button
                action="primary"
                className="h-11 rounded-xl dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
                onPress={openCreate}
              >
                <ButtonIcon as={Plus} />
                <ButtonText>Create VM Disk</ButtonText>
              </Button>
            </HStack>
          </HStack>

          {operationError ? <Text role="alert">Transfer status unavailable: {operationError}</Text> : null}
          {operations.length > 0 ? <VStack className="mt-4 gap-3">
            <Heading size="md">Disk operations</Heading>
            {operations.map(operation => <VStack key={operation.id} className="gap-2">
              <Text>{operation.name}: {operation.phase === "cleanup-required" ? "Moved; source cleanup required" : operation.phase}</Text>
              <Text size="sm">Operation {operation.id}</Text>
              {operation.error ? <Text role="alert">{operation.error}</Text> : null}
              {["move", "import"].includes(operation.kind) ? <HStack className="gap-3 flex-wrap">
                <Button size="sm" variant="outline" isDisabled={Boolean(reconciling)} onPress={() => reconcileTransfer(operation, "finish")}><ButtonText>Reconcile transfer</ButtonText></Button>
                {["reserved", "uploading", "copying"].includes(operation.phase) ? <Button size="sm" variant="outline" isDisabled={Boolean(reconciling)} onPress={() => reconcileTransfer(operation, "abort")}><ButtonText>Discard staging</ButtonText></Button> : null}
              </HStack> : <Text>Review the operation with an administrator before releasing this disk.</Text>}
            </VStack>)}
          </VStack> : null}

          <Box className="mt-6 flex flex-col gap-4 web:grid web:grid-cols-1 web:gap-4 web:sm:grid-cols-2 web:lg:grid-cols-3 web:items-stretch">
            {loading && disks.length === 0 ? (
              Array.from({ length: 8 }).map((_, index) => (
                <Box
                  key={`vm-disk-skeleton-${index}`}
                  className="rounded-xl border border-outline-200 dark:border-[#243247] bg-background-50 dark:bg-[#0F1A2E] opacity-60"
                  style={{ minHeight: 280 }}
                />
              ))
            ) : error ? (
              <Box className="p-3">
                <Text className="text-[#EF4444]">Error loading VM disks: {error}</Text>
              </Box>
            ) : disks.length === 0 ? (
              <Box className="p-3">
                <Text className="text-[#9AA4B8] web:text-base">No VM disks found.</Text>
              </Box>
            ) : (
              disks.map((disk) => {
                const percent = usagePercent(disk);
                const attached = Boolean(disk.attached_vm_name?.trim());
                const percentLabel = `${percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
                const nfsLabel = getNfsLabel(mounts, disk.nfs_id);
                return (
                  <Box
                    key={disk.id}
                    className="rounded-xl border border-outline-200 bg-background-0 p-4 dark:border-[#2A3B52] dark:bg-[#0F1A2E]"
                    style={{ minHeight: 280 }}
                  >
                    <VStack className="h-full justify-between gap-2">
                      <VStack className="gap-3 flex-1">
                        <Box className="flex-1">
                          <HStack className="items-start justify-between gap-3">
                            <Box className="flex-1 min-w-0">
                              <Heading size="sm" numberOfLines={2} className="text-typography-900 dark:text-[#E8EBF0]">
                                {disk.name}
                              </Heading>
                              <Text className="text-xs text-typography-500 dark:text-[#8A94A8] mt-1" numberOfLines={1}>
                                {nfsLabel}
                              </Text>
                            </Box>
                            <Text
                              className={
                                attached
                                  ? "text-xs font-semibold text-[#16A34A] dark:text-[#4ADE80]"
                                  : "text-xs font-semibold text-typography-500 dark:text-[#8A94A8]"
                              }
                            >
                              {attached ? "Attached" : "Free"}
                            </Text>
                          </HStack>

                          <VStack className="gap-2 mt-4">
                            <HStack className="items-center justify-between">
                              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">Size</Text>
                              <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                                {formatGb(disk.size_gb)}
                              </Text>
                            </HStack>
                            <HStack className="items-center justify-between">
                              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">Used</Text>
                              <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                                {formatGb(disk.occupied_gb)} ({percentLabel})
                              </Text>
                            </HStack>
                            <HStack className="items-center justify-between">
                              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">Format</Text>
                              <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                                {disk.format || "-"}
                              </Text>
                            </HStack>
                            <HStack className="items-center justify-between">
                              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">ID</Text>
                              <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                                #{disk.id}
                              </Text>
                            </HStack>
                          </VStack>

                          <VStack className="gap-2 mt-4">
                            <Text className="text-sm text-typography-700 dark:text-[#C4CBD6] break-all">
                              Attached VM: {attached ? disk.attached_vm_name : "None"}
                            </Text>
                            <Text className="text-sm text-typography-700 dark:text-[#C4CBD6]">Disk path</Text>
                            <Text selectable className="text-sm text-typography-900 dark:text-[#E8EBF0] font-mono break-all">
                              {disk.disk_path || "Not reported"}
                            </Text>
                            {disk.disk_path ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="self-start rounded-lg dark:border-[#2A3B52]"
                                accessibilityLabel={`Copy disk path for ${disk.name}`}
                                onPress={async () => {
                                  try {
                                    const copied = await Clipboard.setStringAsync(disk.disk_path);
                                    if (!copied) throw new Error("Please select the path to copy it.");
                                    showToast("Disk path copied");
                                  } catch (err) {
                                    showToast("Unable to copy disk path", getErrorMessage(err, "Please select the path to copy it."), "error");
                                  }
                                }}
                              >
                                <ButtonText>Copy path</ButtonText>
                              </Button>
                            ) : null}
                          </VStack>
                        </Box>
                      </VStack>

                      <HStack className="items-center justify-between flex-wrap gap-2 pt-4 mt-4 border-t border-outline-200 dark:border-[#2A3B52]">
                        <Text className="text-xs text-typography-500 dark:text-[#6F7A8D]">
                          {formatBytes(disk.occupied_bytes)}
                        </Text>
                        <HStack className="gap-2">
                          <Button size="sm" variant="outline" accessibilityLabel={`${attached ? "Detach" : "Attach"} disk ${disk.name}`} onPress={() => attached ? setDetachTarget(disk) : void openAttach(disk)} isDisabled={savingAttachment}>
                            <ButtonText>{attached ? "Detach" : "Attach"}</ButtonText>
                          </Button>
                          <Button size="sm" variant="outline" accessibilityLabel={`Move disk ${disk.name}`} isDisabled={operations.some(operation => operation.disk_id === disk.id)} onPress={() => openTransfer(disk)}><ButtonText>Move</ButtonText></Button>
                          <Button size="sm" variant="outline" accessibilityLabel={`Download disk ${disk.name}`} onPress={async () => {
                            if (Platform.OS !== "web") { showToast("Download unavailable", "Disk download is available in the web version.", "error"); return; }
                            try {
                              const url = await getVmDiskDownloadUrl(disk.id);
                              globalThis.window.location.assign(url);
                            } catch (err) { showToast("Download failed", getErrorMessage(err, "Unable to download disk."), "error"); }
                          }}><ButtonText>Download</ButtonText></Button>
                          <Button
                            size="sm"
                            variant="outline"
                            action="secondary"
                            className="rounded-lg gap-2 dark:border-[#2A3B52]"
                            onPress={() => openGrow(disk)}
                          >
                          <ButtonIcon as={TrendingUp} size="sm" className="text-typography-700 dark:text-[#E8EBF0]" />
                            <ButtonText>Grow</ButtonText>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            action="secondary"
                            className="rounded-lg gap-2 border-red-500"
                            accessibilityLabel={`Delete disk ${disk.name}`}
                            onPress={() => setDeleteTarget(disk)}
                            isDisabled={deletingId === disk.id}
                          >
                            {deletingId === disk.id ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" className="text-red-500" />}
                            <ButtonText className="text-red-500">Delete</ButtonText>
                          </Button>
                        </HStack>
                      </HStack>
                    </VStack>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </ScrollView>

      <Modal isOpen={transferOpen} onClose={() => { if (!transferring) setTransferOpen(false); }} size="lg">
        <ModalBackdrop />
        <ModalContent className="rounded-2xl border-outline-100 dark:border-[#243247] dark:bg-[#0F1A2E]">
          <ModalHeader><Heading size="lg">{moveTarget ? `Move ${moveTarget.name}` : "Import managed disk"}</Heading></ModalHeader>
          <ModalBody><VStack className="gap-4">
            {!moveTarget && Platform.OS !== "web" ? <Text>Disk import is available in the browser only.</Text> : <>
              {!moveTarget ? <>
                <Text>Name</Text>
                <Input><InputField accessibilityLabel="Imported disk name" value={transferName} onChangeText={setTransferName} editable={!transferring} /></Input>
                <Button variant="outline" onPress={pickTransferFile} isDisabled={transferring}><ButtonText>{transferFileName || "Choose raw or qcow2 image"}</ButtonText></Button>
                {transferFile ? <Text>File size: {formatBytes(transferFile.size)}. Virtual capacity is detected after validation.</Text> : null}
                <Text>Accepts raw and standalone qcow2 images. Backing chains and external data files are rejected.</Text>
              </> : <Text>Source: {getNfsLabel(mounts, moveTarget.nfs_id)}. Capacity: {capacityText(moveTarget.nfs_id)}.</Text>}
              <Text>Destination NFS</Text>
              <Select selectedValue={transferNfs} onValueChange={setTransferNfs} isDisabled={transferring || loadingOptions}>
                <SelectTrigger><SelectInput placeholder="Select destination" value={getNfsSelectLabel(mounts, transferNfs)} /><SelectIcon as={ChevronDownIcon} /></SelectTrigger>
                <SelectPortal><SelectBackdrop /><SelectContent>
                  {mounts.filter(mount => mount.NfsShare.Id !== moveTarget?.nfs_id).map(mount => <SelectItem key={mount.NfsShare.Id} value={String(mount.NfsShare.Id)} label={`${mount.NfsShare.Name} (${mount.NfsShare.MachineName})`} />)}
                </SelectContent></SelectPortal>
              </Select>
              <Text>Destination capacity: {loadingOptions ? "refreshing" : capacityText(Number(transferNfs))}. Capacity is an estimate; the agent checks space again before writing.</Text>
              {moveTarget ? <Text>Any attached VM must be shut off. Keep it stopped throughout the move. The disk ID and attachment are preserved.</Text> : null}
              {transferring ? <Text role="status">{moveTarget ? "Copying and verifying disk. Transfer phases appear below." : transferProgress < 100 ? `Uploading: ${transferProgress}%` : "Upload sent. Validating and registering disk…"}</Text> : null}
            </>}
            {transferError ? <Text role="alert">{transferError}</Text> : null}
          </VStack></ModalBody>
          <ModalFooter>
            <Button variant="outline" onPress={() => transferring ? uploadAbort.current?.abort() : setTransferOpen(false)} isDisabled={transferring && Boolean(moveTarget)}><ButtonText>{transferring ? "Cancel upload" : "Close"}</ButtonText></Button>
            <Button onPress={runTransfer} isDisabled={transferring || !transferNfs || (!moveTarget && (Platform.OS !== "web" || !transferFile || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(transferName)))}>{transferring ? <ButtonSpinner /> : null}<ButtonText>{moveTarget ? "Move disk" : "Import disk"}</ButtonText></Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} size="lg">
        <ModalBackdrop />
        <ModalContent className="rounded-2xl border-outline-100 dark:border-[#243247] dark:bg-[#0F1A2E]">
          <ModalHeader>
            <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
              Create VM Disk
            </Heading>
          </ModalHeader>
          <ModalBody>
            <VStack className="gap-4">
              <VStack className="gap-2">
                <Text className="text-sm font-semibold text-typography-700 dark:text-[#8A94A8]">Name</Text>
                <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
                  <InputField
                    value={form.name}
                    onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                    placeholder="data01"
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </VStack>

              <VStack className="gap-2">
                <Text className="text-sm font-semibold text-typography-700 dark:text-[#8A94A8]">NFS</Text>
                <Select
                  selectedValue={form.nfsId}
                  onValueChange={(value) => setForm((current) => ({ ...current, nfsId: value }))}
                  isDisabled={loadingOptions || mounts.length === 0}
                >
                  <SelectTrigger variant="outline" size="md" className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
                    <SelectInput
                      placeholder={loadingOptions ? "Loading..." : "Select NFS"}
                      value={selectedNfsLabel}
                    />
                    <SelectIcon className="mr-3" as={ChevronDownIcon} />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent>
                      {mounts.length === 0 ? (
                        <SelectItem label={loadingOptions ? "Loading..." : "No NFS found"} value="" isDisabled />
                      ) : (
                        mounts.map((mount) => (
                          <SelectItem
                            key={mount.NfsShare.Id}
                            label={`${mount.NfsShare.Name} (${mount.NfsShare.MachineName})`}
                            value={String(mount.NfsShare.Id)}
                          />
                        ))
                      )}
                    </SelectContent>
                  </SelectPortal>
                </Select>
                {form.nfsId ? (
                  <Text className="text-xs text-typography-600 dark:text-[#AAB5C5]">
                    {loadingOptions ? "NFS capacity: refreshing." : knownCapacity ? `NFS capacity: ${formatGb(selectedStatus!.spaceOccupiedGB)} used, ${formatGb(selectedStatus!.spaceFreeGB)} free of ${formatGb(selectedStatus!.spaceTotalGB)} total.` : "NFS capacity: unavailable."}
                  </Text>
                ) : null}
              </VStack>

              <HStack className="gap-3">
                <VStack className="flex-1 gap-2">
                  <Text className="text-sm font-semibold text-typography-700 dark:text-[#8A94A8]">Size GB</Text>
                  <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
                    <InputField
                      value={form.sizeGb}
                      onChangeText={(value) => setForm((current) => ({ ...current, sizeGb: value }))}
                      keyboardType="numeric"
                      placeholder="300"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                  </Input>
                </VStack>
                <VStack className="flex-1 gap-2">
                  <Text className="text-sm font-semibold text-typography-700 dark:text-[#8A94A8]">Format</Text>
                  <Select selectedValue={form.format} onValueChange={(value) => setForm((current) => ({ ...current, format: value }))}>
                    <SelectTrigger variant="outline" size="md" className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
                      <SelectInput placeholder="Select format" value={form.format} />
                      <SelectIcon className="mr-3" as={ChevronDownIcon} />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        <SelectItem label="qcow2" value="qcow2" />
                        <SelectItem label="qcow" value="qcow" />
                        <SelectItem label="raw" value="raw" />
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </VStack>
              </HStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" className="rounded-xl" onPress={() => setCreateOpen(false)} isDisabled={creating}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button className="rounded-xl" onPress={handleCreate} isDisabled={creating}>
              {creating ? <ButtonSpinner /> : <ButtonIcon as={Plus} />}
              <ButtonText>Create</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={attachTarget !== null} onClose={() => { if (!savingAttachment) setAttachTarget(null); }} size="md">
        <ModalBackdrop />
        <ModalContent className="rounded-2xl border-outline-100 dark:border-[#243247] dark:bg-[#0F1A2E]">
          <ModalHeader><Heading size="lg">Attach {attachTarget?.name}</Heading></ModalHeader>
          <ModalBody>
            <VStack className="gap-3">
              <Text>Select the VM that will use this disk.</Text>
              <Select selectedValue={selectedVm} onValueChange={setSelectedVm} isDisabled={loadingVms || savingAttachment || vms.length === 0}>
                <SelectTrigger variant="outline" size="md"><SelectInput placeholder={loadingVms ? "Loading VMs..." : "Select VM"} value={selectedVm} /><SelectIcon as={ChevronDownIcon} /></SelectTrigger>
                <SelectPortal><SelectBackdrop /><SelectContent>
                  {vms.length ? vms.map((vm) => <SelectItem key={vm.name} label={`${vm.name} (${vm.machineName})`} value={vm.name} />) : <SelectItem label={loadingVms ? "Loading..." : "No VMs available"} value="" isDisabled />}
                </SelectContent></SelectPortal>
              </Select>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onPress={() => setAttachTarget(null)} isDisabled={savingAttachment}><ButtonText>Cancel</ButtonText></Button>
            <Button onPress={changeAttachment} isDisabled={savingAttachment || loadingVms || !selectedVm}>{savingAttachment ? <ButtonSpinner /> : null}<ButtonText>Attach</ButtonText></Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={detachTarget !== null} onClose={() => { if (!savingAttachment) setDetachTarget(null); }} size="md">
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader><Heading size="lg">Detach {detachTarget?.name}?</Heading></AlertDialogHeader>
          <AlertDialogBody><Text>Detach from {detachTarget?.attached_vm_name}. Unmount the disk in the guest first to avoid disrupting it.</Text></AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => setDetachTarget(null)} isDisabled={savingAttachment}><ButtonText>Cancel</ButtonText></Button>
            <Button onPress={changeAttachment} isDisabled={savingAttachment}>{savingAttachment ? <ButtonSpinner /> : null}<ButtonText>Detach</ButtonText></Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal isOpen={growTarget !== null} onClose={() => setGrowTarget(null)} size="md">
        <ModalBackdrop />
        <ModalContent className="rounded-2xl border-outline-100 dark:border-[#243247] dark:bg-[#0F1A2E]">
          <ModalHeader>
            <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
              Grow Disk
            </Heading>
          </ModalHeader>
          <ModalBody>
            <VStack className="gap-3">
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                Current size: {growTarget ? formatGb(growTarget.size_gb) : "-"}
              </Text>
              <VStack className="gap-2">
                <Text className="text-sm font-semibold text-typography-700 dark:text-[#8A94A8]">New size GB</Text>
                <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
                  <InputField
                    value={growSize}
                    onChangeText={setGrowSize}
                    keyboardType="numeric"
                    placeholder="600"
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </VStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" className="rounded-xl" onPress={() => setGrowTarget(null)} isDisabled={growingId !== null}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button className="rounded-xl" onPress={handleGrow} isDisabled={growingId !== null}>
              {growingId !== null ? <ButtonSpinner /> : <ButtonIcon as={TrendingUp} />}
              <ButtonText>Grow</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} size="md">
        <AlertDialogBackdrop />
        <AlertDialogContent className="rounded-2xl border-outline-100 dark:border-[#243247] dark:bg-[#0F1A2E]">
          <AlertDialogHeader>
            <HStack className="items-center gap-3">
              <Box className="w-10 h-10 rounded-xl bg-[#EF444419] items-center justify-center">
                <AlertTriangle size={22} color="#EF4444" />
              </Box>
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                Delete VM disk
              </Heading>
            </HStack>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
              Are you sure you want to delete {deleteTarget?.name}? This action cannot be undone.
              {deleteTarget?.attached_vm_name?.trim() ? ` The disk will be detached from ${deleteTarget.attached_vm_name} before deletion.` : ""}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" className="rounded-xl" onPress={() => setDeleteTarget(null)} isDisabled={deletingId !== null}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button action="negative" className="rounded-xl bg-red-500" onPress={handleDelete} isDisabled={deletingId !== null}>
              {deletingId !== null ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
              <ButtonText>Delete</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
