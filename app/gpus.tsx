import React from "react";
import { RefreshControl, ScrollView, useColorScheme } from "react-native";
import { ChevronDown, RefreshCw } from "lucide-react-native";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
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
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMachines } from "@/hooks/useMachines";
import { useSelectedMachine } from "@/hooks/useSelectedMachine";
import { listHostGpus } from "@/services/pci";
import { PciGpu } from "@/types/pci";

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const uniqueSortedValues = (values: unknown[]): string[] => {
  return Array.from(
    new Set(values.map((value) => toTrimmedString(value)).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));
};

const resolveAttachedVmNames = (gpu: PciGpu): string[] => {
  const source = gpu as Record<string, unknown>;
  const topLevelValues = [
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
  ];

  if (source.status && typeof source.status === "object") {
    const status = source.status as Record<string, unknown>;
    topLevelValues.push(
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
      status.usedBy
    );
  }

  return uniqueSortedValues(topLevelValues);
};

const formatValue = (value: unknown, fallback = "N/A") => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  const normalized = toTrimmedString(value);
  return normalized ?? fallback;
};

export default function GpusScreen() {
  const colorScheme = useColorScheme();
  const { token, isChecking } = useAuthGuard();
  const { machines, isLoading: isLoadingMachines, error: machinesError } = useMachines(token);
  const { selectedMachine, setSelectedMachine } = useSelectedMachine();

  const [gpus, setGpus] = React.useState<PciGpu[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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

  const fetchGpus = React.useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!selectedMachine) {
        setGpus([]);
        setError(null);
        return;
      }

      if (mode === "refresh") {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const gpuList = await listHostGpus(selectedMachine);
        const normalizedGpus = [...(Array.isArray(gpuList) ? gpuList : [])].sort((a, b) =>
          formatValue(a.address, "").localeCompare(formatValue(b.address, ""))
        );
        setGpus(normalizedGpus);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load GPUs.";
        setError(message);
      } finally {
        if (mode === "refresh") {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [selectedMachine]
  );

  React.useEffect(() => {
    if (selectedMachine) {
      fetchGpus("initial");
    }
  }, [selectedMachine, fetchGpus]);

  if (isChecking || !token) return null;

  const attachedCount = gpus.filter((gpu) => resolveAttachedVmNames(gpu).length > 0).length;
  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 64 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchGpus("refresh")}
            tintColor={refreshControlTint}
            colors={[refreshControlTint]}
            progressBackgroundColor={refreshControlBackground}
          />
        }
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <VStack className="gap-2 mb-5">
            <Heading
              size="2xl"
              className="text-typography-900 dark:text-[#E8EBF0] web:text-4xl"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              GPUs
            </Heading>
            <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base">
              Simple list of host GPUs and passthrough usage.
            </Text>
          </VStack>

          <Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4 mb-4">
            <VStack className="gap-3">
              <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                Machine
              </Text>
              <Select
                selectedValue={selectedMachine ?? undefined}
                onValueChange={setSelectedMachine as any}
                isDisabled={isLoadingMachines || machines.length === 0}
              >
                <SelectTrigger className="w-full h-11 rounded-xl border border-outline-300 dark:border-[#29405F] bg-background-0 dark:bg-[#0D1B31] px-3">
                  <SelectInput placeholder={isLoadingMachines ? "Loading..." : "Select machine"} />
                  <SelectIcon as={ChevronDown} className="text-typography-500 dark:text-[#93C5FD]" />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628]">
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {machines.map((machine) => (
                      <SelectItem
                        key={machine.MachineName}
                        label={machine.MachineName}
                        value={machine.MachineName}
                      />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>

              <HStack className="items-center justify-between gap-3 flex-wrap">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onPress={() => fetchGpus("refresh")}
                  isDisabled={!selectedMachine || isRefreshing}
                >
                  {isRefreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCw} />}
                  <ButtonText>Refresh</ButtonText>
                </Button>
                <HStack className="gap-2">
                  <Badge variant="outline" className="rounded-lg border-outline-300 dark:border-[#243247]">
                    <BadgeText className="text-typography-600 dark:text-[#8A94A8]">
                      Total: {gpus.length}
                    </BadgeText>
                  </Badge>
                  <Badge variant="outline" className="rounded-lg border-outline-300 dark:border-[#243247]">
                    <BadgeText className="text-typography-600 dark:text-[#8A94A8]">
                      Attached: {attachedCount}
                    </BadgeText>
                  </Badge>
                </HStack>
              </HStack>

              {machinesError ? (
                <Text className="text-xs text-[#EF4444]">{machinesError}</Text>
              ) : null}
            </VStack>
          </Box>

          {isLoading ? (
            <Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
              <Text className="text-typography-600 dark:text-[#8A94A8]">Loading GPUs...</Text>
            </Box>
          ) : error ? (
            <Box className="rounded-2xl border border-[#FCA5A5] dark:border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#2A1010] p-4">
              <Text className="text-[#B91C1C] dark:text-[#FCA5A5] text-sm">{error}</Text>
            </Box>
          ) : gpus.length === 0 ? (
            <Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
              <Text className="text-typography-700 dark:text-[#D6DEEA]">No GPUs found for this machine.</Text>
            </Box>
          ) : (
            <VStack className="gap-3">
              {gpus.map((gpu, index) => {
                const address = formatValue(gpu.address);
                const vendor = formatValue(gpu.vendor, "Unknown vendor");
                const product = formatValue(gpu.product, "Unknown product");
                const node = formatValue(gpu.node_name);
                const attachedVmNames = resolveAttachedVmNames(gpu);
                const isAttached = attachedVmNames.length > 0;

                return (
                  <Box
                    key={`${address}-${index}`}
                    className="rounded-2xl border border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1524] p-4"
                  >
                    <VStack className="gap-2">
                      <HStack className="items-start justify-between gap-3">
                        <VStack className="gap-0.5 flex-1">
                          <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                            {vendor}
                          </Text>
                          <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">{product}</Text>
                          <Text className="text-xs font-mono text-typography-500 dark:text-[#8A94A8]">{address}</Text>
                        </VStack>
                        <Badge
                          variant={isAttached ? "solid" : "outline"}
                          className={
                            isAttached
                              ? "rounded-lg border-transparent bg-primary-600"
                              : "rounded-lg border-outline-300 dark:border-[#243247]"
                          }
                        >
                          <BadgeText
                            className={
                              isAttached
                                ? "text-background-0"
                                : "text-typography-600 dark:text-[#8A94A8]"
                            }
                          >
                            {isAttached ? "Attached" : "Available"}
                          </BadgeText>
                        </Badge>
                      </HStack>

                      <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                        Node: {node} | IOMMU: {formatValue(gpu.iommu_group)} | NUMA: {formatValue(gpu.numa_node)}
                      </Text>
                      <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                        VID: {formatValue(gpu.vendor_id)} | PID: {formatValue(gpu.product_id)}
                      </Text>
                      <Text className="text-xs text-typography-600 dark:text-[#A3B1C6]">
                        VMs: {attachedVmNames.length > 0 ? attachedVmNames.join(", ") : "-"}
                      </Text>
                    </VStack>
                  </Box>
                );
              })}
            </VStack>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}
