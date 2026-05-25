import React from "react";
import { RefreshControl, ScrollView, useColorScheme } from "react-native";
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
  createVmDisk,
  deleteVmDisk,
  growVmDisk,
  listMounts,
  listVmDisks,
  VmDisk,
} from "@/services/hyperhive";
import { Mount } from "@/types/mount";

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
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<DiskForm>(DEFAULT_FORM);
  const [creating, setCreating] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<VmDisk | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [growTarget, setGrowTarget] = React.useState<VmDisk | null>(null);
  const [growSize, setGrowSize] = React.useState("");
  const [growingId, setGrowingId] = React.useState<number | null>(null);

  const refreshControlTint = colorScheme === "dark" ? "rgb(248, 250, 252)" : "rgb(15, 23, 42)";
  const refreshControlBackground = colorScheme === "dark" ? "rgb(30, 41, 59)" : "rgb(226, 232, 240)";
  const selectedNfsLabel = React.useMemo(() => getNfsSelectLabel(mounts, form.nfsId), [form.nfsId, mounts]);

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
      } catch (err) {
        const message = getErrorMessage(err, "Unable to load VM disks.");
        setError(message);
        showToast("Error loading VM disks", message, "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  const loadMountOptions = React.useCallback(async () => {
    setLoadingOptions(true);
    try {
      const data = await listMounts();
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

  const resetCreateForm = () => {
    setForm({
      ...DEFAULT_FORM,
      nfsId: mounts[0]?.NfsShare.Id ? String(mounts[0].NfsShare.Id) : "",
    });
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
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
        <Box className="p-4 pt-16 web:p-20 web:max-w-7xl web:mx-auto web:w-full">
          <VStack className="gap-2 mb-6">
            <Heading size="2xl" className="text-typography-900 dark:text-[#E8EBF0] mb-1 web:text-4xl">
              VMs Disks
            </Heading>
            <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
              Manage standalone VM disks, their NFS placement, size and attachment status.
            </Text>
          </VStack>

          <HStack className="gap-3 items-center justify-end flex-shrink-0 mb-6">
            <Button
              variant="outline"
              action="default"
              className="h-11 px-4 rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
              onPress={() => loadDisks("refresh")}
              isDisabled={refreshing || loading}
            >
              {refreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCw} className="text-typography-900 dark:text-[#E8EBF0]" />}
            </Button>
            <Button
              action="primary"
              className="h-11 rounded-xl dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
              onPress={openCreate}
            >
              <ButtonIcon as={Plus} />
              <ButtonText>Create Vm Disk</ButtonText>
            </Button>
          </HStack>

          <Box className="mt-6 flex flex-col gap-5 web:grid web:grid-cols-1 web:gap-6 web:sm:grid-cols-2 web:lg:grid-cols-3 web:xl:grid-cols-4 web:items-stretch">
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <Box
                  key={`vm-disk-skeleton-${index}`}
                  className="rounded-2xl border border-outline-100 dark:border-[#243247] bg-background-50 dark:bg-[#0F1A2E] opacity-60"
                  style={{ aspectRatio: 1, minHeight: 260 }}
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
                    className="rounded-xl border border-outline-100 bg-background-0 p-4 shadow-soft-1 dark:border-[#2A3B52] dark:bg-[#0E1524]"
                    style={{ aspectRatio: 1, minHeight: 280 }}
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

                          <VStack className="gap-1 mt-4">
                            <Text className="text-xs text-typography-500 dark:text-[#8A94A8]" numberOfLines={1}>
                              {attached ? disk.attached_vm_name : "Not attached to a VM"}
                            </Text>
                            <Text className="text-xs text-typography-500 dark:text-[#8A94A8]" numberOfLines={1}>
                              {disk.folder_path || disk.disk_path}
                            </Text>
                          </VStack>
                        </Box>
                      </VStack>

                      <HStack className="items-center justify-between gap-2 pt-3">
                        <Text className="text-xs text-typography-500 dark:text-[#6F7A8D]">
                          {formatBytes(disk.occupied_bytes)}
                        </Text>
                        <HStack className="gap-2">
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
                            onPress={() => setDeleteTarget(disk)}
                            isDisabled={deletingId === disk.id}
                          >
                            {deletingId === disk.id ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" className="text-red-500" />}
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

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} size="lg">
        <ModalBackdrop />
        <ModalContent className="rounded-2xl border-outline-100 dark:border-[#243247] dark:bg-[#0F1A2E]">
          <ModalHeader>
            <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
              Create Vm Disk
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
