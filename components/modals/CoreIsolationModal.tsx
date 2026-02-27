import React from "react";
import { Platform } from "react-native";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Divider } from "@/components/ui/divider";
import { Pressable } from "@/components/ui/pressable";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Toast, ToastTitle, ToastDescription, useToast } from "@/components/ui/toast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import { ApiError } from "@/services/api-client";
import { getCpuTopology } from "@/services/cpu-pinning";
import {
  createCoreIsolation,
  deleteCoreIsolation,
  getCoreIsolation,
  updateCoreIsolation,
  type CoreIsolationStatus,
} from "@/services/core-isolation";
import type { CpuSocket } from "@/types/cpu-pinning";
import { Cpu, RefreshCcw, Trash2 } from "lucide-react-native";

export interface CoreIsolationModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineName: string;
  onUpdated?: (status: CoreIsolationStatus) => void;
}

type SelectedBySocket = Record<number, number[]>;

const normalizeSelectedBySocket = (sockets: CpuSocket[], status?: CoreIsolationStatus | null): SelectedBySocket => {
  const next: SelectedBySocket = {};
  const socketCoreSet = new Map<number, Set<number>>();

  sockets.forEach((socket) => {
    next[socket.socketId] = [];
    socketCoreSet.set(socket.socketId, new Set(socket.cores.map((core) => core.coreIndex)));
  });

  (status?.sockets ?? []).forEach((socketStatus) => {
    const validSet = socketCoreSet.get(socketStatus.socketId);
    if (!validSet) {
      return;
    }
    const uniqueSorted = Array.from(
      new Set(
        (socketStatus.isolatedCoreIndices ?? []).filter((coreIndex) => validSet.has(coreIndex))
      )
    ).sort((a, b) => a - b);
    next[socketStatus.socketId] = uniqueSorted;
  });

  return next;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    if (typeof error.data === "string" && error.data.trim()) {
      return error.data;
    }
    if (
      error.data &&
      typeof error.data === "object" &&
      "message" in error.data &&
      typeof (error.data as { message?: unknown }).message === "string"
    ) {
      return (error.data as { message: string }).message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export default function CoreIsolationModal({
  isOpen,
  onClose,
  machineName,
  onUpdated,
}: CoreIsolationModalProps) {
  const { resolvedMode } = useAppTheme();
  const isWeb = Platform.OS === "web";
  const toast = useToast();

  const primaryButtonClass = isWeb
    ? "bg-typography-900 dark:bg-[#2DD4BF]"
    : resolvedMode === "dark"
      ? "bg-[#2DD4BF]"
      : "bg-typography-900";
  const primaryButtonTextClass = isWeb
    ? "text-background-0 dark:text-[#0A1628]"
    : resolvedMode === "dark"
      ? "text-[#0A1628]"
      : "text-background-0";

  const [topologySockets, setTopologySockets] = React.useState<CpuSocket[]>([]);
  const [status, setStatus] = React.useState<CoreIsolationStatus | null>(null);
  const [selectedBySocket, setSelectedBySocket] = React.useState<SelectedBySocket>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = React.useState(false);
  const [selectionNotice, setSelectionNotice] = React.useState<string | null>(null);

  const showToast = React.useCallback(
    (title: string, description?: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action={action}
          >
            <VStack>
              <ToastTitle size="sm">{title}</ToastTitle>
              {description ? <ToastDescription size="sm">{description}</ToastDescription> : null}
            </VStack>
          </Toast>
        ),
      });
    },
    [toast]
  );

  const fetchData = React.useCallback(async () => {
    if (!machineName) return;
    setLoading(true);
    setError(null);
    setSelectionNotice(null);
    try {
      const [topology, isolationStatus] = await Promise.all([
        getCpuTopology(machineName),
        getCoreIsolation(machineName),
      ]);

      const sockets = Array.isArray(topology?.sockets) ? topology.sockets : [];
      setTopologySockets(sockets);
      setStatus(isolationStatus);
      setSelectedBySocket(normalizeSelectedBySocket(sockets, isolationStatus));
    } catch (err) {
      console.error("Failed to load core isolation data:", err);
      setError(getApiErrorMessage(err, "Failed to load core topology or isolation status."));
    } finally {
      setLoading(false);
    }
  }, [machineName]);

  React.useEffect(() => {
    if (isOpen) {
      void fetchData();
    } else {
      setTopologySockets([]);
      setStatus(null);
      setSelectedBySocket({});
      setLoading(true);
      setError(null);
      setSaving(false);
      setShowRemoveConfirm(false);
      setSelectionNotice(null);
    }
  }, [fetchData, isOpen]);

  const statusSocketMap = React.useMemo(() => {
    const map = new Map<number, CoreIsolationStatus["sockets"][number]>();
    (status?.sockets ?? []).forEach((socket) => {
      map.set(socket.socketId, socket);
    });
    return map;
  }, [status]);

  const getSocketLimit = React.useCallback(
    (socket: CpuSocket) => {
      const statusSocket = statusSocketMap.get(socket.socketId);
      const fromStatus = statusSocket?.maxIsolatableCores;
      if (typeof fromStatus === "number" && Number.isFinite(fromStatus) && fromStatus >= 0) {
        return fromStatus;
      }
      return Math.floor(socket.cores.length / 2);
    },
    [statusSocketMap]
  );

  const hasExistingIsolation = React.useMemo(() => {
    if (!status) return false;
    if (status.enabled) return true;
    if (Array.isArray(status.configuredCpus) && status.configuredCpus.length > 0) return true;
    return (status.sockets ?? []).some((socket) => (socket.isolatedCoreIndices?.length ?? 0) > 0);
  }, [status]);

  const totalSelectedPhysicalCores = React.useMemo(() => {
    return Object.values(selectedBySocket).reduce((sum, list) => sum + list.length, 0);
  }, [selectedBySocket]);

  const socketValidationErrors = React.useMemo(() => {
    const entries = new Map<number, string>();

    topologySockets.forEach((socket) => {
      const selected = selectedBySocket[socket.socketId] ?? [];
      const validIndices = new Set(socket.cores.map((core) => core.coreIndex));
      const invalid = selected.find((coreIndex) => !validIndices.has(coreIndex));
      if (invalid !== undefined) {
        entries.set(
          socket.socketId,
          `Socket ${socket.socketId} contains an invalid core index (${invalid}).`
        );
        return;
      }

      const limit = getSocketLimit(socket);
      if (selected.length > limit) {
        entries.set(
          socket.socketId,
          `Socket ${socket.socketId} exceeds the limit (${selected.length}/${limit} selected).`
        );
      }
    });

    return entries;
  }, [getSocketLimit, selectedBySocket, topologySockets]);

  const validationError = React.useMemo(() => {
    const first = socketValidationErrors.values().next();
    if (!first.done) return first.value;
    return null;
  }, [socketValidationErrors]);

  const hasAnySelection = totalSelectedPhysicalCores > 0;

  const savePayload = React.useMemo(() => {
    return {
      sockets: topologySockets
        .map((socket) => ({
          socket_id: socket.socketId,
          core_indices: [...(selectedBySocket[socket.socketId] ?? [])].sort((a, b) => a - b),
        }))
        .filter((socket) => socket.core_indices.length > 0),
    };
  }, [selectedBySocket, topologySockets]);

  const isSaveDisabled = loading || saving || Boolean(error) || Boolean(validationError) || !hasAnySelection;

  const handleToggleCore = React.useCallback(
    (socket: CpuSocket, coreIndex: number) => {
      if (saving) return;
      setSelectionNotice(null);
      setSelectedBySocket((prev) => {
        const current = prev[socket.socketId] ?? [];
        const currentSet = new Set(current);
        const isSelected = currentSet.has(coreIndex);
        if (isSelected) {
          currentSet.delete(coreIndex);
          return {
            ...prev,
            [socket.socketId]: Array.from(currentSet).sort((a, b) => a - b),
          };
        }

        const limit = getSocketLimit(socket);
        if (currentSet.size >= limit) {
          setSelectionNotice(
            `Socket ${socket.socketId} cannot exceed ${limit} isolated physical core${limit === 1 ? "" : "s"} (50% max).`
          );
          return prev;
        }

        currentSet.add(coreIndex);
        return {
          ...prev,
          [socket.socketId]: Array.from(currentSet).sort((a, b) => a - b),
        };
      });
    },
    [getSocketLimit, saving]
  );

  const handleClearSocket = React.useCallback((socketId: number) => {
    if (saving) return;
    setSelectionNotice(null);
    setSelectedBySocket((prev) => ({
      ...prev,
      [socketId]: [],
    }));
  }, [saving]);

  const handleFillSocketLimit = React.useCallback(
    (socket: CpuSocket) => {
      if (saving) return;
      setSelectionNotice(null);
      const limit = getSocketLimit(socket);
      const sortedCoreIndices = [...socket.cores]
        .map((core) => core.coreIndex)
        .sort((a, b) => a - b)
        .slice(0, limit);
      setSelectedBySocket((prev) => ({
        ...prev,
        [socket.socketId]: sortedCoreIndices,
      }));
    },
    [getSocketLimit, saving]
  );

  const syncFromResponse = React.useCallback(
    (nextStatus: CoreIsolationStatus) => {
      setStatus(nextStatus);
      setSelectedBySocket((prev) => {
        if (topologySockets.length === 0) return prev;
        return normalizeSelectedBySocket(topologySockets, nextStatus);
      });
      onUpdated?.(nextStatus);
    },
    [onUpdated, topologySockets]
  );

  const handleSave = React.useCallback(async () => {
    if (!machineName || isSaveDisabled) return;
    setSaving(true);
    setSelectionNotice(null);
    try {
      const shouldUpdate = hasExistingIsolation;
      const response = shouldUpdate
        ? await updateCoreIsolation(machineName, savePayload)
        : await createCoreIsolation(machineName, savePayload);

      syncFromResponse(response);
      showToast(
        shouldUpdate ? "Core isolation updated" : "Core isolation applied",
        response.message || (response.rebootRequired ? "Reboot required." : undefined)
      );
      onClose();
    } catch (err) {
      console.error("Failed to save core isolation:", err);
      const message = getApiErrorMessage(err, "Failed to save core isolation.");
      showToast("Core isolation error", message, "error");
    } finally {
      setSaving(false);
    }
  }, [
    createCoreIsolation,
    hasExistingIsolation,
    isSaveDisabled,
    machineName,
    onClose,
    savePayload,
    showToast,
    syncFromResponse,
    updateCoreIsolation,
  ]);

  const handleRemove = React.useCallback(async () => {
    if (!machineName) return;
    setSaving(true);
    setShowRemoveConfirm(false);
    try {
      const response = await deleteCoreIsolation(machineName);
      syncFromResponse(response);
      showToast("Core isolation removed", response.message || (response.rebootRequired ? "Reboot required." : undefined));
      onClose();
    } catch (err) {
      console.error("Failed to remove core isolation:", err);
      const message = getApiErrorMessage(err, "Failed to remove core isolation.");
      showToast("Core isolation error", message, "error");
    } finally {
      setSaving(false);
    }
  }, [machineName, onClose, showToast, syncFromResponse]);

  const applyButtonLabel = hasExistingIsolation ? "Update Isolation" : "Apply Isolation";

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalBackdrop />
        <ModalContent className="w-[92%] max-w-[360px] web:max-w-[860px] max-h-[88%] web:max-h-[90vh] rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] px-4 py-4 web:px-6 web:py-6">
          <ModalHeader className="flex-row items-center gap-3 pb-2">
            <Cpu size={20} color={resolvedMode === "dark" ? "#5EEAD4" : "#0F172A"} />
            <Heading size="lg" className="flex-1 text-typography-900 dark:text-[#E8EBF0]">
              Isolate Cores
            </Heading>
            <Pressable
              onPress={() => void fetchData()}
              disabled={loading || saving}
              className="p-2 rounded-lg border border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0E1A2B]"
            >
              <RefreshCcw size={16} color={resolvedMode === "dark" ? "#5EEAD4" : "#0F172A"} />
            </Pressable>
            <ModalCloseButton onPress={onClose} />
          </ModalHeader>

          <Divider className="bg-outline-100 dark:bg-[#1E2F47]" />

          <ModalBody
            className="mt-3 mb-0 flex-1"
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            {loading ? (
              <VStack className="items-center justify-center py-12 gap-3">
                <Spinner size="large" />
                <Text className="text-typography-500 dark:text-[#8A94A8]">
                  Loading core topology and isolation status...
                </Text>
              </VStack>
            ) : error ? (
              <VStack className="items-center justify-center py-12 gap-3">
                <Text className="text-red-500 text-center">{error}</Text>
                <Button variant="outline" size="sm" className="rounded-xl" onPress={() => void fetchData()}>
                  <ButtonText>Retry</ButtonText>
                </Button>
              </VStack>
            ) : (
              <VStack className="gap-5 py-2">
                <HStack className="items-center gap-2 flex-wrap">
                  <Badge action="muted" className="rounded-lg bg-outline-50 dark:bg-[#162236]">
                    <BadgeText numberOfLines={1} className="text-xs text-typography-600 dark:text-[#8A94A8]">
                      Host: {machineName}
                    </BadgeText>
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`rounded-lg ${status?.enabled
                      ? "border-success-300 dark:border-success-700"
                      : "border-outline-300 dark:border-[#243247]"
                      }`}
                  >
                    <BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">
                      {status?.enabled ? "Enabled" : "Disabled"}
                    </BadgeText>
                  </Badge>
                  {status?.rebootRequired ? (
                    <Badge variant="outline" className="rounded-lg border-warning-300 dark:border-warning-700">
                      <BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">
                        Reboot Required
                      </BadgeText>
                    </Badge>
                  ) : null}
                </HStack>

                {status?.message ? (
                  <Box className="rounded-xl border border-outline-200 dark:border-[#243247] bg-background-50 dark:bg-[#111D30] px-3 py-2">
                    <Text className="text-xs text-typography-600 dark:text-[#8A94A8]">
                      {status.message}
                    </Text>
                  </Box>
                ) : null}

                <VStack className="gap-2">
                  <HStack className="gap-2 flex-wrap">
                    <Badge variant="outline" className="rounded-lg border-outline-300 dark:border-[#243247]">
                      <BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">
                        Configured CPUs: {status?.configuredCpus?.length ?? 0}
                      </BadgeText>
                    </Badge>
                    <Badge variant="outline" className="rounded-lg border-outline-300 dark:border-[#243247]">
                      <BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">
                        Active CPUs: {status?.activeCpus?.length ?? 0}
                      </BadgeText>
                    </Badge>
                    <Badge variant="outline" className="rounded-lg border-outline-300 dark:border-[#243247]">
                      <BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">
                        Selected physical cores: {totalSelectedPhysicalCores}
                      </BadgeText>
                    </Badge>
                  </HStack>
                  <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                    Select physical cores per socket. Hyper-Threading siblings are isolated automatically by the host.
                  </Text>
                </VStack>

                {selectionNotice ? (
                  <Text className="text-xs text-warning-600 dark:text-warning-400">{selectionNotice}</Text>
                ) : null}
                {validationError ? (
                  <Text className="text-xs text-red-500">{validationError}</Text>
                ) : null}

                <VStack className="gap-4">
                  {topologySockets.map((socket) => {
                    const selected = selectedBySocket[socket.socketId] ?? [];
                    const selectedSet = new Set(selected);
                    const statusSocket = statusSocketMap.get(socket.socketId);
                    const limit = getSocketLimit(socket);
                    const totalPhysical = statusSocket?.totalPhysicalCores ?? socket.cores.length;
                    const socketError = socketValidationErrors.get(socket.socketId);

                    return (
                      <Box
                        key={socket.socketId}
                        className="rounded-2xl border border-outline-200 dark:border-[#243247] bg-background-50 dark:bg-[#0E1A2B] p-3"
                      >
                        <HStack className="items-start justify-between gap-3 flex-col web:flex-row web:items-center">
                          <VStack className="gap-1 flex-1">
                            <Heading size="sm" className="text-typography-900 dark:text-[#E8EBF0]">
                              Socket {socket.socketId}
                            </Heading>
                            <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                              {selected.length}/{limit} physical cores selected (max 50% of {totalPhysical})
                            </Text>
                            {statusSocket ? (
                              <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                                Current isolated cores:{" "}
                                {statusSocket.isolatedCoreIndices.length > 0
                                  ? statusSocket.isolatedCoreIndices.join(", ")
                                  : "none"}
                              </Text>
                            ) : null}
                            {socketError ? (
                              <Text className="text-xs text-red-500">{socketError}</Text>
                            ) : null}
                          </VStack>
                          <HStack className="gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
                              onPress={() => handleFillSocketLimit(socket)}
                              isDisabled={saving || limit === 0}
                            >
                              <ButtonText>Fill Max</ButtonText>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              action="secondary"
                              className="rounded-xl"
                              onPress={() => handleClearSocket(socket.socketId)}
                              isDisabled={saving || selected.length === 0}
                            >
                              <ButtonText>Clear</ButtonText>
                            </Button>
                          </HStack>
                        </HStack>

                        <Box className="flex-row flex-wrap gap-2 mt-3">
                          {[...socket.cores]
                            .sort((a, b) => a.coreIndex - b.coreIndex)
                            .map((core) => {
                              const isSelected = selectedSet.has(core.coreIndex);
                              return (
                                <Pressable
                                  key={`${socket.socketId}-${core.coreIndex}`}
                                  onPress={() => handleToggleCore(socket, core.coreIndex)}
                                  disabled={saving}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Socket ${socket.socketId} core ${core.coreIndex}`}
                                >
                                  <Box
                                    className={`w-14 h-12 web:w-16 web:h-14 rounded-lg border items-center justify-center px-1 ${isSelected
                                      ? "bg-[#2DD4BF]/20 border-[#2DD4BF] dark:bg-[#2DD4BF]/30 dark:border-[#2DD4BF]"
                                      : "bg-background-0 dark:bg-[#121E31] border-outline-200 dark:border-[#2A3B52]"
                                      }`}
                                  >
                                    <Text
                                      selectable={false}
                                      className={`text-xs font-semibold ${isSelected
                                        ? "text-[#0D9488] dark:text-[#5EEAD4]"
                                        : "text-typography-700 dark:text-[#CBD5E1]"
                                        }`}
                                      style={{ userSelect: "none" }}
                                    >
                                      {core.coreIndex}
                                    </Text>
                                    <Text
                                      selectable={false}
                                      className={`text-[9px] ${isSelected
                                        ? "text-[#0D9488]/70 dark:text-[#5EEAD4]/70"
                                        : "text-typography-500 dark:text-[#8A94A8]"
                                        }`}
                                      style={{ userSelect: "none" }}
                                    >
                                      {core.siblings?.length ? `HT ${core.siblings.join("/")}` : "No HT"}
                                    </Text>
                                  </Box>
                                </Pressable>
                              );
                            })}
                        </Box>
                      </Box>
                    );
                  })}
                </VStack>

                <VStack className="gap-2">
                  <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                    Configured `isolcpus`: {status?.isolcpus || "—"}
                  </Text>
                  <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                    Active `isolcpus`: {status?.activeIsolcpus || "—"}
                  </Text>
                </VStack>
              </VStack>
            )}
          </ModalBody>

          {!loading && !error ? (
            <>
              <Divider className="bg-outline-100 dark:bg-[#1E2F47]" />
              <ModalFooter className="w-full pt-3">
                <Box className="w-full flex-col gap-3 web:flex-row web:items-center">
                  {hasExistingIsolation ? (
                    <Button
                      variant="outline"
                      action="negative"
                      className="w-full web:w-auto rounded-xl web:mr-auto"
                      onPress={() => setShowRemoveConfirm(true)}
                      isDisabled={saving}
                    >
                      <ButtonIcon as={Trash2} className="mr-2" />
                      <ButtonText>Remove Isolation</ButtonText>
                    </Button>
                  ) : (
                    <Box className="web:mr-auto" />
                  )}

                  <Button
                    variant="outline"
                    action="secondary"
                    className="w-full web:w-auto rounded-xl"
                    onPress={onClose}
                    isDisabled={saving}
                  >
                    <ButtonText>Cancel</ButtonText>
                  </Button>

                  <Button
                    className={`w-full web:w-auto rounded-xl ${primaryButtonClass}`}
                    onPress={() => void handleSave()}
                    isDisabled={isSaveDisabled}
                  >
                    {saving ? <ButtonSpinner className="mr-2" /> : null}
                    <ButtonText className={primaryButtonTextClass}>
                      {saving ? "Saving..." : applyButtonLabel}
                    </ButtonText>
                  </Button>
                </Box>
              </ModalFooter>
            </>
          ) : null}
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={showRemoveConfirm}
        title="Remove Core Isolation"
        description={`Are you sure you want to remove host core isolation on "${machineName}"? A reboot may be required for the change to fully take effect.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => void handleRemove()}
        onClose={() => setShowRemoveConfirm(false)}
      />
    </>
  );
}
