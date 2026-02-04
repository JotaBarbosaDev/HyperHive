import React from "react";
import { RefreshControl, ScrollView, useColorScheme } from "react-native";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
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
  Select,
  SelectBackdrop as SelectBackdropContent,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@/components/ui/select";
import { Toast, ToastTitle, useToast } from "@/components/ui/toast";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMachines } from "@/hooks/useMachines";
import { useSelectedMachine } from "@/hooks/useSelectedMachine";
import { attachGpuToVm, detachGpuFromVm, listHostGpus } from "@/services/pci";
import { getAllVMs, VirtualMachine } from "@/services/vms-client";
import { Machine } from "@/types/machine";
import { PciGpu } from "@/types/pci";
import { ChevronDown, Cpu, PlugZap, RefreshCcw, X } from "lucide-react-native";

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const resolveVmMachineName = (vm: VirtualMachine): string | null => {
  return (
    toTrimmedString(vm.machineName) ??
    toTrimmedString((vm as Record<string, unknown>).MachineName) ??
    null
  );
};

const resolveAttachedVmNames = (gpu: PciGpu): string[] => {
  const source = gpu as Record<string, unknown>;
  const fromTopLevel = uniqueSortedValues([
    ...(Array.isArray(source.attached_to_vms) ? source.attached_to_vms : []),
    ...(Array.isArray(source.attachedToVms) ? source.attachedToVms : []),
    ...(Array.isArray(source.attached_vms) ? source.attached_vms : []),
    ...(Array.isArray(source.attachedVms) ? source.attachedVms : []),
    ...(Array.isArray(source.used_by_vms) ? source.used_by_vms : []),
    ...(Array.isArray(source.usedByVms) ? source.usedByVms : []),
    source.vm_name,
    source.vmName,
    source.attached_vm,
    source.attachedVm,
    source.attached_to_vm,
    source.attachedToVm,
    source.used_by_vm,
    source.usedByVm,
    source.used_by,
    source.usedBy,
    source.in_use_by,
    source.inUseBy,
    source.vm,
    source.guest,
  ]);

  if (source.status && typeof source.status === "object") {
    const status = source.status as Record<string, unknown>;
    const nested = uniqueSortedValues([
      ...(Array.isArray(status.attached_to_vms) ? status.attached_to_vms : []),
      ...(Array.isArray(status.attachedToVms) ? status.attachedToVms : []),
      ...(Array.isArray(status.attached_vms) ? status.attached_vms : []),
      ...(Array.isArray(status.attachedVms) ? status.attachedVms : []),
      ...(Array.isArray(status.used_by_vms) ? status.used_by_vms : []),
      ...(Array.isArray(status.usedByVms) ? status.usedByVms : []),
      status.vm_name,
      status.vmName,
      status.attached_vm,
      status.attachedVm,
      status.used_by_vm,
      status.usedByVm,
      status.used_by,
      status.usedBy,
    ]);
    return uniqueSortedValues([...fromTopLevel, ...nested]);
  }

  return fromTopLevel;
};

const uniqueSortedValues = (values: Array<string | null | undefined>) => {
  return Array.from(
    new Set(values.map((value) => toTrimmedString(value)).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));
};

const formatNumaNode = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return String(value);
  }
  return "N/A";
};

const formatBusValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return "N/A";
};

export default function GpusScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const { token, isChecking } = useAuthGuard();
  const { machines, isLoading: isLoadingMachines, error: machinesError } = useMachines(token);
  const { selectedMachine, setSelectedMachine } = useSelectedMachine();
  const [gpus, setGpus] = React.useState<PciGpu[]>([]);
  const [machineVms, setMachineVms] = React.useState<VirtualMachine[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [attachModalGpu, setAttachModalGpu] = React.useState<PciGpu | null>(null);
  const [detachModalGpu, setDetachModalGpu] = React.useState<PciGpu | null>(null);
  const [attachVmName, setAttachVmName] = React.useState("");
  const [detachVmName, setDetachVmName] = React.useState("");
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(null);

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  const showToastMessage = React.useCallback(
    (title: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: () => (
          <Toast action={action}>
            <ToastTitle>{title}</ToastTitle>
          </Toast>
        ),
      });
    },
    [toast]
  );

  React.useEffect(() => {
    if (!selectedMachine && machines.length > 0) {
      setSelectedMachine(machines[0].MachineName);
      return;
    }
    if (
      selectedMachine &&
      machines.length > 0 &&
      !machines.some((machine) => machine.MachineName === selectedMachine)
    ) {
      setSelectedMachine(machines[0].MachineName);
    }
  }, [machines, selectedMachine, setSelectedMachine]);

  const fetchGpusAndVms = React.useCallback(
    async (mode: "initial" | "refresh" | "silent" = "initial") => {
      if (!selectedMachine) {
        setGpus([]);
        setMachineVms([]);
        setError(null);
        return;
      }

      const isSilent = mode === "silent";
      if (!isSilent) {
        mode === "refresh" ? setIsRefreshing(true) : setIsLoading(true);
      }

      try {
        const [gpuList, allVms] = await Promise.all([
          listHostGpus(selectedMachine),
          getAllVMs().catch(() => [] as VirtualMachine[]),
        ]);

        const filteredVms = (Array.isArray(allVms) ? allVms : []).filter(
          (vm) => resolveVmMachineName(vm) === selectedMachine
        );

        const normalizedGpus = [...(Array.isArray(gpuList) ? gpuList : [])].sort((a, b) => {
          const left = toTrimmedString(a.address) ?? "";
          const right = toTrimmedString(b.address) ?? "";
          return left.localeCompare(right);
        });

        setGpus(normalizedGpus);
        setMachineVms(filteredVms);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load GPUs.";
        setError(message);
      } finally {
        if (!isSilent) {
          mode === "refresh" ? setIsRefreshing(false) : setIsLoading(false);
        }
      }
    },
    [selectedMachine]
  );

  React.useEffect(() => {
    if (selectedMachine) {
      fetchGpusAndVms("initial");
    }
  }, [selectedMachine, fetchGpusAndVms]);

  React.useEffect(() => {
    if (!selectedMachine) return;
    const id = setInterval(() => {
      fetchGpusAndVms("silent");
    }, 10000);
    return () => clearInterval(id);
  }, [selectedMachine, fetchGpusAndVms]);

  const machineVmNames = React.useMemo(() => {
    return uniqueSortedValues(machineVms.map((vm) => vm.name));
  }, [machineVms]);

  const selectedMachineLabel = selectedMachine ?? "No machine selected";
  const attachedCount = React.useMemo(() => {
    return gpus.filter((gpu) => resolveAttachedVmNames(gpu).length > 0).length;
  }, [gpus]);

  const openAttachModal = (gpu: PciGpu) => {
    const defaultVm = machineVmNames[0] ?? "";
    setAttachVmName(defaultVm);
    setAttachModalGpu(gpu);
  };

  const openDetachModal = (gpu: PciGpu) => {
    const attachedVmNames = resolveAttachedVmNames(gpu);
    setDetachVmName(attachedVmNames[0] ?? machineVmNames[0] ?? "");
    setDetachModalGpu(gpu);
  };

  const closeAttachModal = () => {
    setAttachModalGpu(null);
    setAttachVmName("");
  };

  const closeDetachModal = () => {
    setDetachModalGpu(null);
    setDetachVmName("");
  };

  const handleAttachConfirm = async () => {
    if (!selectedMachine || !attachModalGpu) return;
    const vmName = toTrimmedString(attachVmName);
    const gpuRef = toTrimmedString(attachModalGpu.address);
    if (!vmName || !gpuRef || actionInProgress) return;

    const actionKey = `attach:${gpuRef}`;
    setActionInProgress(actionKey);
    try {
      await attachGpuToVm(selectedMachine, { vm_name: vmName, gpu_ref: gpuRef });
      showToastMessage("GPU attached");
      closeAttachModal();
      await fetchGpusAndVms("silent");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to attach GPU.";
      showToastMessage(message, "error");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDetachConfirm = async () => {
    if (!selectedMachine || !detachModalGpu) return;
    const fallbackVm = resolveAttachedVmNames(detachModalGpu)[0] ?? null;
    const vmName = toTrimmedString(detachVmName) ?? fallbackVm;
    const gpuRef = toTrimmedString(detachModalGpu.address);
    if (!vmName || !gpuRef || actionInProgress) return;

    const actionKey = `detach:${gpuRef}`;
    setActionInProgress(actionKey);
    try {
      await detachGpuFromVm(selectedMachine, { vm_name: vmName, gpu_ref: gpuRef });
      showToastMessage("GPU detached");
      closeDetachModal();
      await fetchGpusAndVms("silent");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to detach GPU.";
      showToastMessage(message, "error");
    } finally {
      setActionInProgress(null);
    }
  };

  if (isChecking || !token) return null;

  const detachModalVmOptions = uniqueSortedValues([
    ...(detachModalGpu ? resolveAttachedVmNames(detachModalGpu) : []),
    ...machineVmNames,
  ]);

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={() => fetchGpusAndVms("refresh")}
      tintColor={refreshControlTint}
      colors={[refreshControlTint]}
      progressBackgroundColor={refreshControlBackground}
    />
  );

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <Box className="p-4 pt-16 web:p-10 web:max-w-7xl web:mx-auto web:w-full gap-4">
        <Heading
          size="2xl"
          className="text-typography-900 dark:text-[#E8EBF0] mb-2 web:text-4xl"
          style={{ fontFamily: "Inter_700Bold" }}
        >
          GPUs
        </Heading>

        <HStack className="items-center justify-between flex-wrap gap-3">
          <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
            Manage GPU passthrough on the selected machine.
          </Text>
          <Button
            variant="outline"
            className="rounded-xl"
            onPress={() => fetchGpusAndVms("refresh")}
            isDisabled={!selectedMachine || isRefreshing}
          >
            {isRefreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} />}
            <ButtonText>Refresh</ButtonText>
          </Button>
        </HStack>

        <VStack className="mt-5 gap-4">
          <HStack className="gap-3 flex-wrap items-end">
            <Box className="min-w-[180px]">
              <Text className="text-xs text-typography-500 dark:text-[#8A94A8] mb-1">Machine</Text>
              <Select
                selectedValue={selectedMachine ?? undefined}
                onValueChange={setSelectedMachine as any}
                isDisabled={isLoadingMachines || machines.length === 0}
              >
                <SelectTrigger className="w-52 rounded-xl border border-outline-200 dark:border-[#1F2A3C]">
                  <SelectInput placeholder={isLoadingMachines ? "Loading..." : "Select machine"} />
                  <SelectIcon as={ChevronDown} className="text-typography-500" />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdropContent />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {machines.map((machine: Machine) => (
                      <SelectItem
                        key={machine.MachineName}
                        label={machine.MachineName}
                        value={machine.MachineName}
                      />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
              {machinesError ? (
                <Text className="text-[12px] text-[#EF4444] mt-1">{machinesError}</Text>
              ) : null}
            </Box>

            <HStack className="gap-3 flex-wrap">
              <Box className="p-3 rounded-xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628]">
                <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Machine</Text>
                <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                  {selectedMachineLabel}
                </Text>
              </Box>
              <Box className="p-3 rounded-xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628]">
                <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">GPUs</Text>
                <Text className="text-xl font-semibold text-typography-900 dark:text-[#E8EBF0]">{gpus.length}</Text>
              </Box>
              <Box className="p-3 rounded-xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628]">
                <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Attached</Text>
                <Text className="text-xl font-semibold text-typography-900 dark:text-[#E8EBF0]">{attachedCount}</Text>
              </Box>
            </HStack>
          </HStack>

          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 72 }}
            refreshControl={refreshControl}
          >
            {isLoading ? (
              <Text className="text-typography-500 dark:text-[#8A94A8]">Loading GPUs...</Text>
            ) : error ? (
              <Text className="text-[#EF4444]">{error}</Text>
            ) : gpus.length === 0 ? (
              <Text className="text-typography-500 dark:text-[#8A94A8]">No GPUs found on this machine.</Text>
            ) : (
              <Box className="flex flex-col gap-4 web:grid web:grid-cols-2 web:gap-5 web:xl:grid-cols-3">
                {gpus.map((gpu, index) => {
                  const address = toTrimmedString(gpu.address) ?? "unknown";
                  const vendor = toTrimmedString(gpu.vendor) ?? "Unknown vendor";
                  const product = toTrimmedString(gpu.product) ?? "Unknown product";
                  const attachedVmNames = resolveAttachedVmNames(gpu);
                  const isAttached = attachedVmNames.length > 0;
                  const attachedVmLabel = isAttached
                    ? `${attachedVmNames.length > 1 ? "VMs" : "VM"}: ${attachedVmNames.join(", ")}`
                    : "Host";
                  const isBusy =
                    actionInProgress === `attach:${address}` || actionInProgress === `detach:${address}`;
                  const canAttach = machineVmNames.length > 0 && address !== "unknown";
                  const detachVmOptions = uniqueSortedValues([...attachedVmNames, ...machineVmNames]);
                  const canDetach = detachVmOptions.length > 0 && address !== "unknown";

                  return (
                    <Box
                      key={`${address}-${gpu.node_name ?? index}`}
                      className="rounded-3xl border border-outline-100 bg-background-0 p-5 shadow-soft-3 min-h-[280px] dark:border-[#2A3B52] dark:bg-[#0E1524]"
                    >
                      <VStack className="gap-4">
                        <HStack className="items-start justify-between gap-3">
                          <Box className="w-10 h-10 rounded-2xl bg-background-50 dark:bg-[#1A2637] items-center justify-center">
                            <Cpu className="text-typography-500 dark:text-[#5EEAD4]" />
                          </Box>
                          <Badge
                            variant={isAttached ? "solid" : "outline"}
                            size="sm"
                            className={
                              isAttached
                                ? "border-transparent bg-primary-600"
                                : "border-outline-300 dark:border-[#243247]"
                            }
                          >
                            <BadgeText
                              className={
                                isAttached
                                  ? "text-background-0"
                                  : "text-typography-600 dark:text-[#8A94A8]"
                              }
                            >
                              {attachedVmLabel}
                            </BadgeText>
                          </Badge>
                        </HStack>

                        <VStack className="gap-1">
                          <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                            {vendor}
                          </Text>
                          <Text className="text-sm text-typography-600 dark:text-[#8A94A8]" numberOfLines={2}>
                            {product}
                          </Text>
                          <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">{address}</Text>
                        </VStack>

                        <VStack className="gap-2">
                          <Text className="text-xs text-typography-600 dark:text-[#8A94A8]">
                            Node: {toTrimmedString(gpu.node_name) ?? "N/A"}
                          </Text>
                          <Text className="text-xs text-typography-600 dark:text-[#8A94A8]">
                            IOMMU: {gpu.iommu_group ?? "N/A"} | BUS: {formatBusValue(gpu.bus)} | NUMA:{" "}
                            {formatNumaNode(gpu.numa_node)}
                          </Text>
                          <Text className="text-xs text-typography-600 dark:text-[#8A94A8]">
                            VID: {toTrimmedString(gpu.vendor_id) ?? "N/A"} | PID:{" "}
                            {toTrimmedString(gpu.product_id) ?? "N/A"}
                          </Text>
                        </VStack>

                        <HStack className="justify-end pt-1">
                          {isAttached ? (
                            <Button
                              size="sm"
                              variant="outline"
                              action="negative"
                              className="rounded-xl"
                              onPress={() => openDetachModal(gpu)}
                              isDisabled={!canDetach || isBusy}
                            >
                              {actionInProgress === `detach:${address}` ? (
                                <ButtonSpinner />
                              ) : (
                                <ButtonIcon as={X} />
                              )}
                              <ButtonText>Detach</ButtonText>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
                              onPress={() => openAttachModal(gpu)}
                              isDisabled={!canAttach || isBusy}
                            >
                              {actionInProgress === `attach:${address}` ? (
                                <ButtonSpinner />
                              ) : (
                                <ButtonIcon as={PlugZap} />
                              )}
                              <ButtonText>Attach</ButtonText>
                            </Button>
                          )}
                        </HStack>
                      </VStack>
                    </Box>
                  );
                })}
              </Box>
            )}
          </ScrollView>
        </VStack>
      </Box>

      <Modal isOpen={!!attachModalGpu} onClose={closeAttachModal} size="md">
        <ModalBackdrop />
        <ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
          <ModalHeader className="flex-row items-center justify-between">
            <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
              Attach GPU
            </Heading>
            <ModalCloseButton onPress={closeAttachModal} />
          </ModalHeader>
          <ModalBody>
            <VStack className="gap-3">
              <Text className="text-typography-600 dark:text-[#8A94A8]">
                Confirm attaching GPU {toTrimmedString(attachModalGpu?.address) ?? "N/A"} to a VM.
              </Text>
              <Box>
                <Text className="text-xs text-typography-500 dark:text-[#8A94A8] mb-1">VM</Text>
                <Select
                  selectedValue={attachVmName || undefined}
                  onValueChange={(value) => setAttachVmName(value)}
                  isDisabled={machineVmNames.length === 0}
                >
                  <SelectTrigger className="rounded-xl border border-outline-200 dark:border-[#1F2A3C]">
                    <SelectInput placeholder={machineVmNames.length ? "Select VM" : "No VMs on this machine"} />
                    <SelectIcon as={ChevronDown} className="text-typography-500" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdropContent />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {machineVmNames.map((vmName) => (
                        <SelectItem key={vmName} label={vmName} value={vmName} />
                      ))}
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter className="flex-row gap-3">
            <Button variant="outline" action="secondary" className="flex-1 rounded-xl" onPress={closeAttachModal}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button
              action="primary"
              className="flex-1 rounded-xl"
              onPress={handleAttachConfirm}
              isDisabled={!toTrimmedString(attachVmName) || !toTrimmedString(attachModalGpu?.address) || !!actionInProgress}
            >
              {attachModalGpu && actionInProgress === `attach:${toTrimmedString(attachModalGpu.address)}` ? (
                <ButtonSpinner />
              ) : (
                <ButtonIcon as={PlugZap} />
              )}
              <ButtonText>Attach</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!detachModalGpu} onClose={closeDetachModal} size="md">
        <ModalBackdrop />
        <ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
          <ModalHeader className="flex-row items-center justify-between">
            <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
              Detach GPU
            </Heading>
            <ModalCloseButton onPress={closeDetachModal} />
          </ModalHeader>
          <ModalBody>
            <VStack className="gap-3">
              <Text className="text-typography-600 dark:text-[#8A94A8]">
                Confirm detaching GPU {toTrimmedString(detachModalGpu?.address) ?? "N/A"}.
              </Text>
              <Box>
                <Text className="text-xs text-typography-500 dark:text-[#8A94A8] mb-1">VM</Text>
                <Select
                  selectedValue={detachVmName || undefined}
                  onValueChange={(value) => setDetachVmName(value)}
                  isDisabled={detachModalVmOptions.length === 0}
                >
                  <SelectTrigger className="rounded-xl border border-outline-200 dark:border-[#1F2A3C]">
                    <SelectInput placeholder="Select VM" />
                    <SelectIcon as={ChevronDown} className="text-typography-500" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdropContent />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {detachModalVmOptions.map((vmName) => (
                        <SelectItem key={vmName} label={vmName} value={vmName} />
                      ))}
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter className="flex-row gap-3">
            <Button variant="outline" action="secondary" className="flex-1 rounded-xl" onPress={closeDetachModal}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button
              action="negative"
              className="flex-1 rounded-xl"
              onPress={handleDetachConfirm}
              isDisabled={
                !(
                  toTrimmedString(detachVmName) ||
                  (detachModalGpu ? resolveAttachedVmNames(detachModalGpu)[0] : null)
                ) ||
                !toTrimmedString(detachModalGpu?.address) ||
                !!actionInProgress
              }
            >
              {detachModalGpu && actionInProgress === `detach:${toTrimmedString(detachModalGpu.address)}` ? (
                <ButtonSpinner />
              ) : (
                <ButtonIcon as={X} />
              )}
              <ButtonText>Detach</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
