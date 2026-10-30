import React from "react";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { Platform, RefreshControl, ScrollView, useColorScheme } from "react-native";
import {
  AlertTriangle,
  ArrowRightLeft,
  Copy,
  HardDrive,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Unlink,
  Upload,
  X,
} from "lucide-react-native";
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

const SURFACE = "rounded-2xl border border-outline-100 bg-background-0 shadow-soft-1 dark:border-[#2A3B52] dark:bg-[#0F1A2E]";
const MODAL_SURFACE = "rounded-2xl border border-outline-100 bg-background-0 shadow-2xl dark:border-[#2A3B52] dark:bg-[#0A1628] web:max-h-[calc(100vh_-_48px)]";
const DIALOG_SURFACE = "rounded-2xl border border-outline-100 bg-background-0 shadow-2xl dark:border-[#2A3B52] dark:bg-[#0A1628]";
const INPUT_SURFACE = "rounded-xl border-outline-200 bg-background-0 dark:border-[#2A3B52] dark:bg-[#0E1524]";
const GHOST_CONTROL = "rounded-xl border-outline-200 bg-background-0 dark:border-[#2A3B52] dark:bg-[#0F1A2E]";
const MODAL_HEADER = "items-start gap-3 border-b border-outline-100 px-6 pb-4 pt-6 dark:border-[#22304A]";
const MODAL_BODY = "px-6 pt-5 web:max-h-[calc(100vh_-_220px)] web:overflow-y-auto";
const MODAL_FOOTER = "flex-wrap gap-3 border-t border-outline-100 px-6 pb-6 pt-4 dark:border-[#22304A]";
const PRIMARY_BUTTON = "rounded-xl dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]";
const PRIMARY_TEXT = "text-white dark:text-[#0A1628]";

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

const phaseLabel = (phase: string) => (phase === "cleanup-required" ? "Moved; source cleanup required" : phase.replace(/-/g, " "));

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">{children}</Text>;
}

function HelperText({ children }: { children: React.ReactNode }) {
  return <Text className="text-xs leading-5 text-typography-600 dark:text-[#8A94A8]">{children}</Text>;
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <VStack className="gap-2">
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint ? <HelperText>{hint}</HelperText> : null}
    </VStack>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <HStack
      role="alert"
      accessibilityLiveRegion="polite"
      className="items-start gap-2 rounded-xl border border-error-200 bg-error-50 px-3 py-2 dark:border-[#7F1D1D] dark:bg-[#2A1315]"
    >
      <AlertTriangle size={15} color="#EF4444" />
      <Text className="flex-1 text-sm leading-5 text-error-700 dark:text-[#FCA5A5]">{children}</Text>
    </HStack>
  );
}

function StatusPill({ attached }: { attached: boolean }) {
  return (
    <HStack
      className={
        attached
          ? "shrink-0 items-center gap-1.5 rounded-full border border-[#86EFAC] bg-[#F0FDF4] px-2.5 py-1 dark:border-[#166534] dark:bg-[#052E16]"
          : "shrink-0 items-center gap-1.5 rounded-full border border-outline-200 bg-background-50 px-2.5 py-1 dark:border-[#2A3B52] dark:bg-[#101B2E]"
      }
    >
      <Box className={attached ? "h-1.5 w-1.5 rounded-full bg-[#16A34A] dark:bg-[#22C55E]" : "h-1.5 w-1.5 rounded-full bg-[#94A3B8] dark:bg-[#64748B]"} />
      <Text
        className={
          attached
            ? "text-xs font-semibold uppercase tracking-wider text-[#15803D] dark:text-[#4ADE80]"
            : "text-xs font-semibold uppercase tracking-wider text-typography-600 dark:text-[#94A3B8]"
        }
      >
        {attached ? "Attached" : "Free"}
      </Text>
    </HStack>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Box className="min-w-[150px] flex-1 rounded-xl border border-outline-100 bg-background-0 px-4 py-3 dark:border-[#243247] dark:bg-[#0B1424]">
      <Text className="text-xs font-semibold uppercase tracking-wider text-typography-600 dark:text-[#8A94A8]">{label}</Text>
      <Text className="mt-1 text-lg font-semibold tabular-nums text-typography-900 dark:text-[#E8EBF0]">{value}</Text>
      {detail ? <Text className="mt-0.5 text-xs text-typography-600 dark:text-[#8A94A8]">{detail}</Text> : null}
    </Box>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <HStack className="items-center justify-between gap-3">
      <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">{label}</Text>
      <Text className={`text-sm font-semibold tabular-nums text-typography-900 dark:text-[#E8EBF0] ${mono ? "font-mono" : ""}`}>
        {value}
      </Text>
    </HStack>
  );
}

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
  const [createError, setCreateError] = React.useState("");
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
  const [growError, setGrowError] = React.useState("");
  const [growingId, setGrowingId] = React.useState<number | null>(null);

  const refreshControlTint = colorScheme === "dark" ? "rgb(248, 250, 252)" : "rgb(15, 23, 42)";
  const refreshControlBackground = colorScheme === "dark" ? "rgb(30, 41, 59)" : "rgb(226, 232, 240)";
  const selectedNfsLabel = React.useMemo(() => getNfsSelectLabel(mounts, form.nfsId), [form.nfsId, mounts]);
  const selectedStatus = mounts.find((mount) => String(mount.NfsShare.Id) === form.nfsId)?.Status;
  const knownCapacity = mountsFresh && selectedStatus?.working && [selectedStatus.spaceOccupiedGB, selectedStatus.spaceFreeGB, selectedStatus.spaceTotalGB].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0) && selectedStatus.spaceTotalGB > 0;

  const attachedCount = disks.filter((disk) => Boolean(disk.attached_vm_name?.trim())).length;
  const totalCapacity = disks.reduce((sum, disk) => sum + (Number(disk.size_gb) || 0), 0);
  const usedCapacity = disks.reduce((sum, disk) => sum + (Number(disk.occupied_gb) || 0), 0);
  const usedPercent = totalCapacity > 0 ? Math.min(100, (usedCapacity / totalCapacity) * 100) : 0;

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
    setCreateError("");
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
      setCreateError("Name, NFS share, size and format are required. Size must be greater than zero.");
      return;
    }

    setCreating(true);
    setCreateError("");
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
      setCreateError(getErrorMessage(err, "Unable to create VM disk."));
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
    setGrowError("");
  };

  const handleGrow = async () => {
    if (!growTarget) {
      return;
    }
    const nextSize = Number(growSize);
    if (!Number.isFinite(nextSize) || nextSize <= Number(growTarget.size_gb)) {
      setGrowError(`Enter a size greater than the current ${formatGb(growTarget.size_gb)}.`);
      return;
    }

    setGrowingId(growTarget.id);
    setGrowError("");
    try {
      const updated = await growVmDisk(growTarget.id, nextSize);
      setDisks((current) => current.map((disk) => (disk.id === updated.id ? updated : disk)));
      setGrowTarget(null);
      setGrowSize("");
      showToast("VM disk grown", `${updated.name} is now ${formatGb(updated.size_gb)}.`);
    } catch (err) {
      setGrowError(getErrorMessage(err, "Unable to grow VM disk."));
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

            <HStack className="gap-2 items-center flex-wrap web:flex-wrap">
              <Button
                variant="outline"
                action="default"
                className={`h-11 px-3.5 rounded-xl ${GHOST_CONTROL}`}
                accessibilityLabel="Refresh VM disks"
                onPress={() => loadDisks("refresh")}
                isDisabled={refreshing || loading}
              >
                {refreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCw} size="sm" className="text-typography-900 dark:text-[#E8EBF0]" />}
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Refresh</ButtonText>
              </Button>
              <Button variant="outline" className={`h-11 rounded-xl px-4 ${GHOST_CONTROL}`} onPress={() => openTransfer(null)}>
                <ButtonIcon as={Upload} size="sm" className="text-typography-900 dark:text-[#E8EBF0]" />
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Import Disk</ButtonText>
              </Button>
              <Button className={`h-11 rounded-xl px-4 ${PRIMARY_BUTTON}`} onPress={openCreate}>
                <ButtonIcon as={Plus} size="sm" className={PRIMARY_TEXT} />
                <ButtonText className={PRIMARY_TEXT}>Create VM Disk</ButtonText>
              </Button>
            </HStack>
          </HStack>

          {!(error && disks.length === 0) && !(loading && disks.length === 0) ? (
            <HStack className="flex-wrap gap-3">
              <Metric label="Disks" value={String(disks.length)} detail={disks.length === 1 ? "1 standalone disk" : `${disks.length} standalone disks`} />
              <Metric label="Attached" value={`${attachedCount}`} detail={disks.length ? `${disks.length - attachedCount} free` : "No attachments"} />
              <Metric label="Provisioned" value={formatGb(totalCapacity)} detail="Virtual capacity" />
              <Metric
                label="Used"
                value={`${usedPercent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`}
                detail={`${formatGb(usedCapacity)} written`}
              />
            </HStack>
          ) : null}

          {operationError ? (
            <Box className="mt-4">
              <ErrorNote>Transfer status unavailable: {operationError}</ErrorNote>
            </Box>
          ) : null}

          {operations.length > 0 ? (
            <VStack className="mt-6 gap-3">
              <HStack className="items-center justify-between gap-3">
                <Heading size="sm" className="text-typography-900 dark:text-[#E8EBF0]">Disk operations</Heading>
                <Text className="text-xs text-typography-600 dark:text-[#8A94A8]">
                  {operations.length === 1 ? "1 operation" : `${operations.length} operations`}
                </Text>
              </HStack>
              {operations.map((operation) => (
                <Box key={operation.id} className={`${SURFACE} p-4`}>
                  <VStack className="gap-3">
                    <HStack className="items-start justify-between gap-3">
                      <VStack className="flex-1 gap-1">
                        <HStack className="items-center gap-2 flex-wrap">
                          <Text className="font-semibold text-typography-900 dark:text-[#E8EBF0]">{operation.name}</Text>
                          <Box
                            className={
                              operation.phase === "cleanup-required"
                                ? "rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 dark:border-[#78350F] dark:bg-[#2A1F0B]"
                                : "rounded-full border border-outline-200 bg-background-50 px-2 py-0.5 dark:border-[#2A3B52] dark:bg-[#101B2E]"
                            }
                          >
                            <Text
                              className={
                                operation.phase === "cleanup-required"
                                  ? "text-xs font-semibold uppercase tracking-wider text-[#B45309] dark:text-[#FCD34D]"
                                  : "text-xs font-semibold uppercase tracking-wider text-typography-600 dark:text-[#94A3B8]"
                              }
                            >
                              {phaseLabel(operation.phase)}
                            </Text>
                          </Box>
                        </HStack>
                        <Text className="text-xs text-typography-600 dark:text-[#8A94A8]">Operation {operation.id}</Text>
                      </VStack>
                      <Text className="text-xs text-typography-600 dark:text-[#8A94A8]">{operation.kind}</Text>
                    </HStack>

                    {operation.phase === "cleanup-required" ? (
                      <Text className="text-sm text-typography-700 dark:text-[#C4CBD6]">
                        Source cleanup is still required. Review the operation with an administrator before releasing this disk.
                      </Text>
                    ) : null}

                    {operation.error ? <ErrorNote>{operation.error}</ErrorNote> : null}

                    {["move", "import"].includes(operation.kind) ? (
                      <HStack className="gap-2 flex-wrap web:flex-wrap">
                        <Button size="sm" variant="outline" className={`rounded-lg px-3 ${GHOST_CONTROL}`} isDisabled={Boolean(reconciling)} onPress={() => reconcileTransfer(operation, "finish")}>
                          <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Reconcile transfer</ButtonText>
                        </Button>
                        {["reserved", "uploading", "copying"].includes(operation.phase) ? (
                          <Button size="sm" variant="outline" className={`rounded-lg px-3 ${GHOST_CONTROL}`} isDisabled={Boolean(reconciling)} onPress={() => reconcileTransfer(operation, "abort")}>
                            <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Discard staging</ButtonText>
                          </Button>
                        ) : null}
                      </HStack>
                    ) : (
                      <Text className="text-sm text-typography-700 dark:text-[#C4CBD6]">
                        Review the operation with an administrator before releasing this disk.
                      </Text>
                    )}
                  </VStack>
                </Box>
              ))}
            </VStack>
          ) : null}

          {error && disks.length > 0 ? (
            <Box className="mt-4">
              <ErrorNote>Could not refresh VM disks: {error}</ErrorNote>
            </Box>
          ) : null}

          {loading && disks.length === 0 ? (
            <Box className="mt-6 flex flex-col gap-4 web:grid web:grid-cols-1 web:gap-4 web:sm:grid-cols-2 web:lg:grid-cols-3 web:items-stretch">
              {Array.from({ length: 6 }).map((_, index) => (
                <Box
                  key={`vm-disk-skeleton-${index}`}
                  className="rounded-2xl border border-outline-100 bg-background-0 p-5 dark:border-[#2A3B52] dark:bg-[#0F1A2E]"
                  style={{ minHeight: 320 }}
                  accessibilityLabel="Loading VM disk"
                >
                  <VStack className="flex-1 gap-4">
                    <HStack className="items-center justify-between gap-3">
                      <Box className="h-4 w-2/3 rounded bg-background-200 dark:bg-[#16233A]" />
                      <Box className="h-5 w-16 rounded-full bg-background-200 dark:bg-[#16233A]" />
                    </HStack>
                    <Box className="h-1.5 w-full rounded-full bg-background-100 dark:bg-[#16233A]" />
                    <Box className="h-3 w-1/2 rounded bg-background-100 dark:bg-[#16233A]" />
                    <Box className="h-px w-full bg-background-100 dark:bg-[#22304A]" />
                    <Box className="h-3 w-3/4 rounded bg-background-100 dark:bg-[#16233A]" />
                    <Box className="h-3 w-2/3 rounded bg-background-100 dark:bg-[#16233A]" />
                    <Box className="h-12 w-full rounded-lg bg-background-100 dark:bg-[#16233A]" />
                    <Box className="mt-auto h-9 w-full rounded-lg bg-background-100 dark:bg-[#16233A]" />
                  </VStack>
                </Box>
              ))}
            </Box>
          ) : error && disks.length === 0 ? (
            <Box className={`${SURFACE} mt-6 items-start gap-4 p-6`}>
              <HStack className="items-start gap-3">
                <Box className="h-10 w-10 items-center justify-center rounded-xl bg-[#EF44441A]">
                  <AlertTriangle size={20} color="#EF4444" />
                </Box>
                <VStack className="flex-1 gap-1">
                  <Heading size="sm" className="text-typography-900 dark:text-[#E8EBF0]">Unable to load VM disks</Heading>
                  <Text role="alert" className="text-sm leading-6 text-typography-600 dark:text-[#8A94A8]">
                    Error loading VM disks: {error}
                  </Text>
                </VStack>
              </HStack>
              <Button variant="outline" className={`h-11 rounded-xl px-4 ${GHOST_CONTROL}`} onPress={() => loadDisks("refresh")} isDisabled={refreshing}>
                {refreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCw} size="sm" className="text-typography-900 dark:text-[#E8EBF0]" />}
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Try again</ButtonText>
              </Button>
            </Box>
          ) : disks.length === 0 ? (
            <Box className="mt-6 items-center gap-4 rounded-2xl border border-dashed border-outline-200 bg-background-0 p-8 dark:border-[#2A3B52] dark:bg-[#0A1628]">
              <Box className="h-12 w-12 items-center justify-center rounded-2xl bg-background-50 dark:bg-[#101B2E]">
                <HardDrive size={22} color="#8A94A8" />
              </Box>
              <VStack className="items-center gap-1">
                <Heading size="sm" className="text-typography-900 dark:text-[#E8EBF0]">No VM disks found.</Heading>
                <Text className="max-w-md text-center text-sm leading-6 text-typography-600 dark:text-[#8A94A8]">
                  Create a standalone disk on an NFS share, or import an existing raw or qcow2 image, then attach it to a VM when needed.
                </Text>
              </VStack>
              <HStack className="gap-3 flex-wrap justify-center">
                <Button variant="outline" className={`h-11 rounded-xl px-4 ${GHOST_CONTROL}`} onPress={() => openTransfer(null)}>
                  <ButtonIcon as={Upload} size="sm" className="text-typography-900 dark:text-[#E8EBF0]" />
                  <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Import Disk</ButtonText>
                </Button>
                <Button className={`h-11 rounded-xl px-4 ${PRIMARY_BUTTON}`} onPress={openCreate}>
                  <ButtonIcon as={Plus} size="sm" className={PRIMARY_TEXT} />
                  <ButtonText className={PRIMARY_TEXT}>Create VM Disk</ButtonText>
                </Button>
              </HStack>
            </Box>
          ) : (
            <Box className="mt-6 flex flex-col gap-4 web:grid web:grid-cols-1 web:gap-4 web:sm:grid-cols-2 web:lg:grid-cols-3 web:items-stretch">
              {disks.map((disk) => {
                const percent = usagePercent(disk);
                const attached = Boolean(disk.attached_vm_name?.trim());
                const percentLabel = `${percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
                const nfsLabel = getNfsLabel(mounts, disk.nfs_id);
                return (
                  <Box key={disk.id} className={`${SURFACE} p-5`} style={{ minHeight: 280 }}>
                    <VStack className="h-full justify-between gap-4">
                      <VStack className="flex-1 gap-4">
                        <HStack className="items-start justify-between gap-3">
                          <VStack className="flex-1 min-w-0 gap-1.5">
                            <Heading size="sm" numberOfLines={2} className="text-typography-900 dark:text-[#E8EBF0]">
                              {disk.name}
                            </Heading>
                            <HStack className="items-center gap-1.5">
                              <HardDrive size={13} color="#8A94A8" />
                              <Text className="flex-1 text-xs text-typography-600 dark:text-[#8A94A8]" numberOfLines={1}>
                                {nfsLabel}
                              </Text>
                            </HStack>
                          </VStack>
                          <StatusPill attached={attached} />
                        </HStack>

                        <HStack className="items-center justify-between gap-2">
                          <Text className="flex-1 text-sm text-typography-600 dark:text-[#8A94A8]">
                            {formatGb(disk.occupied_gb)} of {formatGb(disk.size_gb)} used
                          </Text>
                          <Text className="text-sm font-semibold tabular-nums text-typography-900 dark:text-[#E8EBF0]">{percentLabel}</Text>
                        </HStack>

                        <VStack className="gap-2 border-t border-outline-100 pt-4 dark:border-[#22304A]">
                          <InfoRow label="Format" value={disk.format || "-"} />
                          <InfoRow label="Disk ID" value={`#${disk.id}`} mono />
                          <Text className="text-sm text-typography-700 dark:text-[#C4CBD6] break-all">
                            Attached VM: {attached ? disk.attached_vm_name : "None"}
                          </Text>
                        </VStack>

                        <VStack className="gap-2">
                          <Text className="text-xs font-semibold uppercase tracking-wider text-typography-600 dark:text-[#8A94A8]">Disk path</Text>
                          <HStack className="items-start gap-2 rounded-lg border border-outline-100 bg-background-50 p-3 dark:border-[#22304A] dark:bg-[#0B1424]">
                            <Text selectable className="flex-1 text-xs font-mono leading-5 break-all text-typography-900 dark:text-[#E8EBF0]">
                              {disk.disk_path || "Not reported"}
                            </Text>
                            {disk.disk_path ? (
                              <Button
                                size="xs"
                                variant="outline"
                                hitSlop={6}
                                className={`rounded-md px-2 ${GHOST_CONTROL}`}
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
                                <ButtonIcon as={Copy} size="sm" className="text-typography-700 dark:text-[#E8EBF0]" />
                              </Button>
                            ) : null}
                          </HStack>
                        </VStack>
                      </VStack>

                      <VStack className="mt-auto gap-3 border-t border-outline-100 pt-4 dark:border-[#22304A]">
                        <HStack className="items-center justify-between gap-3">
                          <Text className="text-xs text-typography-600 dark:text-[#8A94A8]">On disk</Text>
                          <Text className="text-xs font-medium tabular-nums text-typography-700 dark:text-[#C4CBD6]">
                            {formatBytes(disk.occupied_bytes)}
                          </Text>
                        </HStack>
                        <HStack className="gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            hitSlop={4}
                            className={`flex-1 min-w-0 rounded-lg px-2 ${GHOST_CONTROL}`}
                            accessibilityLabel={`${attached ? "Detach" : "Attach"} disk ${disk.name}`}
                            onPress={() => attached ? setDetachTarget(disk) : void openAttach(disk)}
                            isDisabled={savingAttachment}
                          >
                            <ButtonText numberOfLines={1} className="text-xs text-typography-700 dark:text-[#E8EBF0]">{attached ? "Detach" : "Attach"}</ButtonText>
                          </Button>
                          <Button size="sm" variant="outline" hitSlop={4} className={`flex-1 min-w-0 rounded-lg px-2 ${GHOST_CONTROL}`} accessibilityLabel={`Move disk ${disk.name}`} isDisabled={operations.some(operation => operation.disk_id === disk.id)} onPress={() => openTransfer(disk)}>
                            <ButtonText numberOfLines={1} className="text-xs text-typography-700 dark:text-[#E8EBF0]">Move</ButtonText>
                          </Button>
                          <Button size="sm" variant="outline" hitSlop={4} className={`flex-1 min-w-0 rounded-lg px-2 ${GHOST_CONTROL}`} accessibilityLabel={`Download disk ${disk.name}`} onPress={async () => {
                            if (Platform.OS !== "web") { showToast("Download unavailable", "Disk download is available in the web version.", "error"); return; }
                            try {
                              const url = await getVmDiskDownloadUrl(disk.id);
                              globalThis.window.location.assign(url);
                            } catch (err) { showToast("Download failed", getErrorMessage(err, "Unable to download disk."), "error"); }
                          }}>
                            <ButtonText numberOfLines={1} className="text-xs text-typography-700 dark:text-[#E8EBF0]">Download</ButtonText>
                          </Button>
                        </HStack>
                        <HStack className="gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            hitSlop={4}
                            className={`flex-1 min-w-0 rounded-lg px-2 ${GHOST_CONTROL}`}
                            onPress={() => openGrow(disk)}
                          >
                            <ButtonText numberOfLines={1} className="text-xs text-typography-700 dark:text-[#E8EBF0]">Grow</ButtonText>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            hitSlop={4}
                            className="flex-1 min-w-0 rounded-lg px-2 border-[#FCA5A5] dark:border-[#7F1D1D]"
                            accessibilityLabel={`Delete disk ${disk.name}`}
                            onPress={() => setDeleteTarget(disk)}
                            isDisabled={deletingId === disk.id}
                          >
                            {deletingId === disk.id ? <ButtonSpinner /> : null}
                            <ButtonText numberOfLines={1} className="text-xs text-[#DC2626] dark:text-[#FCA5A5]">Delete</ButtonText>
                          </Button>
                        </HStack>
                      </VStack>
                    </VStack>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </ScrollView>

      <Modal isOpen={transferOpen} onClose={() => { if (!transferring) setTransferOpen(false); }} size="lg">
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className={MODAL_SURFACE}>
          <ModalHeader className={MODAL_HEADER}>
            <VStack className="flex-1 gap-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                {moveTarget ? `Move ${moveTarget.name}` : "Import managed disk"}
              </Heading>
              <Text className="text-sm leading-6 text-typography-600 dark:text-[#8A94A8]">
                {moveTarget ? "Copy the disk to another NFS share without changing its ID or attachment." : "Upload a raw or standalone qcow2 image and register it as a managed disk."}
              </Text>
            </VStack>
            <Button
              size="sm"
              variant="outline"
              className={`h-11 w-11 rounded-lg p-0 ${GHOST_CONTROL}`}
              accessibilityLabel="Close transfer dialog"
              isDisabled={transferring}
              onPress={() => setTransferOpen(false)}
            >
              <ButtonIcon as={X} size="sm" className="text-typography-700 dark:text-[#E8EBF0]" />
            </Button>
          </ModalHeader>
          <ModalBody className={MODAL_BODY}>
            <VStack className="gap-5">
              {!moveTarget && Platform.OS !== "web" ? (
                <Text className="text-sm leading-6 text-typography-700 dark:text-[#C4CBD6]">Disk import is available in the browser only.</Text>
              ) : (
                <>
                  {!moveTarget ? (
                    <>
                      <Field label="Name" hint="Unique on the destination share. Derived from the file name when left empty.">
                        <Input size="lg" className={INPUT_SURFACE}>
                          <InputField accessibilityLabel="Imported disk name" value={transferName} onChangeText={setTransferName} editable={!transferring} className="text-typography-900 dark:text-[#E8EBF0]" />
                        </Input>
                      </Field>

                      <Field label="Disk image" hint="Accepts raw and standalone qcow2 images. Backing chains and external data files are rejected.">
                        <Button variant="outline" className={`h-11 rounded-xl px-4 ${GHOST_CONTROL}`} onPress={pickTransferFile} isDisabled={transferring}>
                          <ButtonIcon as={Upload} size="sm" className="text-typography-700 dark:text-[#E8EBF0]" />
                          <ButtonText className="text-typography-700 dark:text-[#E8EBF0]">{transferFileName || "Choose raw or qcow2 image"}</ButtonText>
                        </Button>
                        {transferFile ? (
                          <HelperText>File size: {formatBytes(transferFile.size)}. Virtual capacity is detected after validation.</HelperText>
                        ) : null}
                      </Field>
                    </>
                  ) : (
                    <Box className="rounded-xl border border-outline-100 bg-background-50 p-4 dark:border-[#22304A] dark:bg-[#0B1424]">
                      <Text className="text-sm leading-6 text-typography-700 dark:text-[#C4CBD6]">
                        Source: {getNfsLabel(mounts, moveTarget.nfs_id)}. Capacity: {capacityText(moveTarget.nfs_id)}.
                      </Text>
                    </Box>
                  )}

                  <Field label="Destination NFS">
                    <Select selectedValue={transferNfs} onValueChange={setTransferNfs} isDisabled={transferring || loadingOptions}>
                      <SelectTrigger accessibilityLabel="Destination NFS share" className={INPUT_SURFACE}>
                        <SelectInput placeholder="Select destination" value={getNfsSelectLabel(mounts, transferNfs)} />
                        <SelectIcon as={ChevronDownIcon} />
                      </SelectTrigger>
                      <SelectPortal><SelectBackdrop /><SelectContent>
                        {mounts.filter(mount => mount.NfsShare.Id !== moveTarget?.nfs_id).map(mount => <SelectItem key={mount.NfsShare.Id} value={String(mount.NfsShare.Id)} label={`${mount.NfsShare.Name} (${mount.NfsShare.MachineName})`} />)}
                      </SelectContent></SelectPortal>
                    </Select>
                    <HelperText>
                      Destination capacity: {loadingOptions ? "refreshing" : capacityText(Number(transferNfs))}. Capacity is an estimate; the agent checks space again before writing.
                    </HelperText>
                  </Field>

                  {moveTarget ? (
                    <HelperText>Any attached VM must be shut off. Keep it stopped throughout the move. The disk ID and attachment are preserved.</HelperText>
                  ) : null}

                  {transferring ? (
                    <VStack className="gap-2" accessibilityLiveRegion="polite">
                      <Text role="status" className="text-sm leading-6 text-typography-700 dark:text-[#C4CBD6]">
                        {moveTarget ? "Copying and verifying disk. Transfer phases appear below." : transferProgress < 100 ? `Uploading: ${transferProgress}%` : "Upload sent. Validating and registering disk…"}
                      </Text>
                      {!moveTarget ? (
                        <Box
                          className="h-1.5 w-full overflow-hidden rounded-full bg-background-200 dark:bg-[#1E293B]"
                          accessibilityRole="progressbar"
                          accessibilityLabel="Upload progress"
                          accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.max(0, transferProgress)) }}
                        >
                          <Box className="h-full rounded-full bg-[#2DD4BF]" style={{ width: `${Math.min(100, Math.max(0, transferProgress))}%` }} />
                        </Box>
                      ) : null}
                    </VStack>
                  ) : null}
                </>
              )}
              {transferError ? <ErrorNote>{transferError}</ErrorNote> : null}
            </VStack>
          </ModalBody>
          <ModalFooter className={MODAL_FOOTER}>
            <Button variant="outline" className={`h-11 rounded-xl px-4 ${GHOST_CONTROL}`} onPress={() => transferring ? uploadAbort.current?.abort() : setTransferOpen(false)} isDisabled={transferring && Boolean(moveTarget)}>
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">{transferring ? "Cancel upload" : "Close"}</ButtonText>
            </Button>
            <Button className={`h-11 rounded-xl px-4 ${PRIMARY_BUTTON}`} onPress={runTransfer} isDisabled={transferring || !transferNfs || (!moveTarget && (Platform.OS !== "web" || !transferFile || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(transferName)))}>
              {transferring ? <ButtonSpinner /> : <ButtonIcon as={moveTarget ? ArrowRightLeft : Upload} size="sm" className={PRIMARY_TEXT} />}
              <ButtonText className={PRIMARY_TEXT}>{moveTarget ? "Move disk" : "Import disk"}</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={createOpen} onClose={() => { if (!creating) setCreateOpen(false); }} size="lg">
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className={MODAL_SURFACE}>
          <ModalHeader className={MODAL_HEADER}>
            <VStack className="flex-1 gap-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                Create VM Disk
              </Heading>
              <Text className="text-sm leading-6 text-typography-600 dark:text-[#8A94A8]">
                Provision a standalone disk on an NFS share. It can be attached to a VM later.
              </Text>
            </VStack>
            <Button
              size="sm"
              variant="outline"
              className={`h-11 w-11 rounded-lg p-0 ${GHOST_CONTROL}`}
              accessibilityLabel="Close create disk dialog"
              isDisabled={creating}
              onPress={() => setCreateOpen(false)}
            >
              <ButtonIcon as={X} size="sm" className="text-typography-700 dark:text-[#E8EBF0]" />
            </Button>
          </ModalHeader>
          <ModalBody className={MODAL_BODY}>
            <VStack className="gap-5">
              {createError ? <ErrorNote>{createError}</ErrorNote> : null}

              <Field label="Name" hint="Used as the disk file name. It must be unique on the selected share.">
                <Input size="lg" className={INPUT_SURFACE}>
                  <InputField
                    accessibilityLabel="Disk name"
                    value={form.name}
                    onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                    placeholder="data01"
                    autoCapitalize="none"
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </Field>

              <VStack className="gap-2">
                <FieldLabel>NFS share</FieldLabel>
                <Select
                  selectedValue={form.nfsId}
                  onValueChange={(value) => setForm((current) => ({ ...current, nfsId: value }))}
                  isDisabled={loadingOptions || mounts.length === 0}
                >
                  <SelectTrigger accessibilityLabel="NFS share" variant="outline" size="lg" className={INPUT_SURFACE}>
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
                  <HelperText>
                    {loadingOptions ? "NFS capacity: refreshing." : knownCapacity ? `NFS capacity: ${formatGb(selectedStatus!.spaceOccupiedGB)} used, ${formatGb(selectedStatus!.spaceFreeGB)} free of ${formatGb(selectedStatus!.spaceTotalGB)} total.` : "NFS capacity: unavailable."}
                  </HelperText>
                ) : null}
              </VStack>

              <HStack className="flex-wrap gap-4">
                <VStack className="flex-1 min-w-[140px] gap-2">
                  <FieldLabel>Size GB</FieldLabel>
                  <Input size="lg" className={INPUT_SURFACE}>
                    <InputField
                      accessibilityLabel="Disk size in GB"
                      value={form.sizeGb}
                      onChangeText={(value) => setForm((current) => ({ ...current, sizeGb: value }))}
                      keyboardType="numeric"
                      placeholder="300"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                  </Input>
                  <HelperText>Virtual capacity. It cannot be reduced later.</HelperText>
                </VStack>
                <VStack className="flex-1 min-w-[140px] gap-2">
                  <FieldLabel>Format</FieldLabel>
                  <Select selectedValue={form.format} onValueChange={(value) => setForm((current) => ({ ...current, format: value }))}>
                    <SelectTrigger accessibilityLabel="Disk format" variant="outline" size="lg" className={INPUT_SURFACE}>
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
                  <HelperText>qcow2 supports snapshots and thin allocation.</HelperText>
                </VStack>
              </HStack>
            </VStack>
          </ModalBody>
          <ModalFooter className={MODAL_FOOTER}>
            <Button variant="outline" className={`h-11 rounded-xl px-4 ${GHOST_CONTROL}`} onPress={() => setCreateOpen(false)} isDisabled={creating}>
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>
            <Button className={`h-11 rounded-xl px-4 ${PRIMARY_BUTTON}`} onPress={handleCreate} isDisabled={creating}>
              {creating ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" className={PRIMARY_TEXT} />}
              <ButtonText className={PRIMARY_TEXT}>Create</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={attachTarget !== null} onClose={() => { if (!savingAttachment) setAttachTarget(null); }} size="md">
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className={MODAL_SURFACE}>
          <ModalHeader className={MODAL_HEADER}>
            <VStack className="flex-1 gap-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">Attach {attachTarget?.name}</Heading>
              <Text className="text-sm leading-6 text-typography-600 dark:text-[#8A94A8]">Select the VM that will use this disk.</Text>
            </VStack>
            <Button
              size="sm"
              variant="outline"
              className={`h-11 w-11 rounded-lg p-0 ${GHOST_CONTROL}`}
              accessibilityLabel="Close attach dialog"
              isDisabled={savingAttachment}
              onPress={() => setAttachTarget(null)}
            >
              <ButtonIcon as={X} size="sm" className="text-typography-700 dark:text-[#E8EBF0]" />
            </Button>
          </ModalHeader>
          <ModalBody className={MODAL_BODY}>
            <VStack className="gap-3">
              <Select selectedValue={selectedVm} onValueChange={setSelectedVm} isDisabled={loadingVms || savingAttachment || vms.length === 0}>
                <SelectTrigger accessibilityLabel="Virtual machine" variant="outline" size="lg" className={INPUT_SURFACE}>
                  <SelectInput placeholder={loadingVms ? "Loading VMs..." : "Select VM"} value={selectedVm} />
                  <SelectIcon className="mr-3" as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal><SelectBackdrop /><SelectContent>
                  {vms.length ? vms.map((vm) => <SelectItem key={vm.name} label={`${vm.name} (${vm.machineName})`} value={vm.name} />) : <SelectItem label={loadingVms ? "Loading..." : "No VMs available"} value="" isDisabled />}
                </SelectContent></SelectPortal>
              </Select>
              {!loadingVms && vms.length === 0 ? (
                <HStack className="items-center justify-between gap-3 rounded-xl border border-dashed border-outline-200 px-3 py-2 dark:border-[#2A3B52]">
                  <Text className="flex-1 text-xs leading-5 text-typography-600 dark:text-[#8A94A8]">No VMs are available to attach this disk to.</Text>
                  <Button size="sm" variant="outline" className={`rounded-lg px-3 ${GHOST_CONTROL}`} onPress={() => attachTarget && void openAttach(attachTarget)} isDisabled={savingAttachment}>
                    <ButtonIcon as={RefreshCw} size="sm" className="text-typography-700 dark:text-[#E8EBF0]" />
                    <ButtonText className="text-typography-700 dark:text-[#E8EBF0]">Retry</ButtonText>
                  </Button>
                </HStack>
              ) : (
                <HelperText>The disk stays attached until you detach it. Restart the guest if it does not detect the new device.</HelperText>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter className={MODAL_FOOTER}>
            <Button variant="outline" className={`h-11 rounded-xl px-4 ${GHOST_CONTROL}`} onPress={() => setAttachTarget(null)} isDisabled={savingAttachment}>
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>
            <Button className={`h-11 rounded-xl px-4 ${PRIMARY_BUTTON}`} onPress={changeAttachment} isDisabled={savingAttachment || loadingVms || !selectedVm}>
              {savingAttachment ? <ButtonSpinner /> : <ButtonIcon as={Link2} size="sm" className={PRIMARY_TEXT} />}
              <ButtonText className={PRIMARY_TEXT}>Attach</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={detachTarget !== null} onClose={() => { if (!savingAttachment) setDetachTarget(null); }} size="md">
        <AlertDialogBackdrop className="bg-black/60" />
        <AlertDialogContent className={`${DIALOG_SURFACE} gap-4`}>
          <AlertDialogHeader>
            <HStack className="items-center gap-3">
              <Box className="h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B1A]">
                <Unlink size={20} color="#F59E0B" />
              </Box>
              <Heading size="lg" className="flex-1 text-typography-900 dark:text-[#E8EBF0]">Detach {detachTarget?.name}?</Heading>
            </HStack>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-sm leading-6 text-typography-600 dark:text-[#8A94A8]">
              Detach from {detachTarget?.attached_vm_name}. Unmount the disk in the guest first to avoid disrupting it.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-2 flex-wrap web:flex-wrap">
            <Button variant="outline" className={`h-11 rounded-xl px-4 ${GHOST_CONTROL}`} onPress={() => setDetachTarget(null)} isDisabled={savingAttachment}>
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>
            <Button className={`h-11 rounded-xl px-4 ${PRIMARY_BUTTON}`} onPress={changeAttachment} isDisabled={savingAttachment}>
              {savingAttachment ? <ButtonSpinner /> : <ButtonIcon as={Unlink} size="sm" className={PRIMARY_TEXT} />}
              <ButtonText className={PRIMARY_TEXT}>Detach</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal isOpen={growTarget !== null} onClose={() => { if (growingId === null) setGrowTarget(null); }} size="md">
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className={MODAL_SURFACE}>
          <ModalHeader className={MODAL_HEADER}>
            <VStack className="flex-1 gap-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                Grow Disk
              </Heading>
              <Text className="text-sm leading-6 text-typography-600 dark:text-[#8A94A8]">
                Increase the virtual capacity of {growTarget?.name}. Existing data is preserved.
              </Text>
            </VStack>
            <Button
              size="sm"
              variant="outline"
              className={`h-11 w-11 rounded-lg p-0 ${GHOST_CONTROL}`}
              accessibilityLabel="Close grow dialog"
              isDisabled={growingId !== null}
              onPress={() => setGrowTarget(null)}
            >
              <ButtonIcon as={X} size="sm" className="text-typography-700 dark:text-[#E8EBF0]" />
            </Button>
          </ModalHeader>
          <ModalBody className={MODAL_BODY}>
            <VStack className="gap-5">
              <HStack className="items-center justify-between gap-3 rounded-xl border border-outline-100 bg-background-50 px-4 py-3 dark:border-[#22304A] dark:bg-[#0B1424]">
                <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">Current size</Text>
                <Text className="text-base font-semibold tabular-nums text-typography-900 dark:text-[#E8EBF0]">
                  {growTarget ? formatGb(growTarget.size_gb) : "-"}
                </Text>
              </HStack>

              {growError ? <ErrorNote>{growError}</ErrorNote> : null}

              <Field label="New size GB" hint="The disk can only grow. Shrink is not supported.">
                <Input size="lg" className={INPUT_SURFACE}>
                  <InputField
                    accessibilityLabel="New disk size in GB"
                    value={growSize}
                    onChangeText={setGrowSize}
                    keyboardType="numeric"
                    placeholder="600"
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </Field>
            </VStack>
          </ModalBody>
          <ModalFooter className={MODAL_FOOTER}>
            <Button variant="outline" className={`h-11 rounded-xl px-4 ${GHOST_CONTROL}`} onPress={() => setGrowTarget(null)} isDisabled={growingId !== null}>
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>
            <Button className={`h-11 rounded-xl px-4 ${PRIMARY_BUTTON}`} onPress={handleGrow} isDisabled={growingId !== null}>
              {growingId !== null ? <ButtonSpinner /> : <ButtonIcon as={TrendingUp} size="sm" className={PRIMARY_TEXT} />}
              <ButtonText className={PRIMARY_TEXT}>Grow</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={deleteTarget !== null} onClose={() => { if (deletingId === null) setDeleteTarget(null); }} size="md">
        <AlertDialogBackdrop className="bg-black/60" />
        <AlertDialogContent className={`${DIALOG_SURFACE} gap-4`}>
          <AlertDialogHeader>
            <HStack className="items-center gap-3">
              <Box className="h-10 w-10 items-center justify-center rounded-xl bg-[#EF444419]">
                <AlertTriangle size={22} color="#EF4444" />
              </Box>
              <Heading size="lg" className="flex-1 text-typography-900 dark:text-[#E8EBF0]">
                Delete VM disk
              </Heading>
            </HStack>
          </AlertDialogHeader>
          <AlertDialogBody>
            <VStack className="gap-3">
              <Text className="text-sm leading-6 text-typography-600 dark:text-[#8A94A8]">
                Are you sure you want to delete {deleteTarget?.name}? This action cannot be undone.
                {deleteTarget?.attached_vm_name?.trim() ? ` The disk will be detached from ${deleteTarget.attached_vm_name} before deletion.` : ""}
              </Text>
              <Text className="text-sm leading-6 text-typography-600 dark:text-[#8A94A8]">
                The disk file is removed from {deleteTarget ? getNfsLabel(mounts, deleteTarget.nfs_id) : "its NFS share"}.
              </Text>
            </VStack>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-2 flex-wrap web:flex-wrap">
            <Button variant="outline" className={`h-11 rounded-xl px-4 ${GHOST_CONTROL}`} onPress={() => setDeleteTarget(null)} isDisabled={deletingId !== null}>
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>
            <Button action="negative" className="h-11 rounded-xl bg-[#DC2626] px-4" onPress={handleDelete} isDisabled={deletingId !== null}>
              {deletingId !== null ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" className="text-white" />}
              <ButtonText className="text-white">Delete</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
