import React, { useEffect, useState, useMemo, useCallback } from "react";
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
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  FormControlHelper,
  FormControlHelperText,
} from "@/components/ui/form-control";
import { Spinner } from "@/components/ui/spinner";
import { Pressable } from "@/components/ui/pressable";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Divider } from "@/components/ui/divider";
import { useToast, Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { X, Cpu, ChevronDown } from "lucide-react-native";
import {
  getCpuTopology,
  getCpuPinning,
  setCpuPinning,
  removeCpuPinning,
} from "@/services/cpu-pinning";
import type { CpuSocket, CpuCore, CpuPinningInfo } from "@/types/cpu-pinning";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";

// ─── Props ──────────────────────────────────────────────────────────────────────

export interface CpuPinningModalProps {
  isOpen: boolean;
  onClose: () => void;
  vmName: string;
  machineName: string;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function CpuPinningModal({
  isOpen,
  onClose,
  vmName,
  machineName,
}: CpuPinningModalProps) {
  const { resolvedMode } = useAppTheme();
  const isWeb = Platform.OS === "web";
  const toast = useToast();

  // Theme helpers
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

  // ── State ───────────────────────────────────────────────────────────────────

  const [sockets, setSockets] = useState<CpuSocket[]>([]);
  const [pinning, setPinning] = useState<CpuPinningInfo | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedSocketId, setSelectedSocketId] = useState<number | null>(null);
  const [hyperThreading, setHyperThreading] = useState(false);
  const [coreStart, setCoreStart] = useState<string>("");
  const [coreEnd, setCoreEnd] = useState<string>("");

  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // ── Fetch data on open ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [topology, pinningInfo] = await Promise.all([
        getCpuTopology(machineName),
        getCpuPinning(vmName),
      ]);

      const topologySockets = topology?.sockets ?? [];
      setSockets(topologySockets);
      setPinning(pinningInfo);

      // Pre-fill from existing pinning
      if (pinningInfo?.hasPinning) {
        setSelectedSocketId(pinningInfo.socketId);
        setHyperThreading(pinningInfo.hyperThreading);
        setCoreStart(String(pinningInfo.rangeStart));
        setCoreEnd(String(pinningInfo.rangeEnd));
      } else {
        // Defaults
        setSelectedSocketId(topologySockets.length > 0 ? topologySockets[0].socketId : null);
        setHyperThreading(false);
        setCoreStart("");
        setCoreEnd("");
      }
    } catch (err) {
      console.error("Error loading CPU pinning data:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to load CPU topology or pinning data.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [machineName, vmName]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
    // Reset on close
    if (!isOpen) {
      setSockets([]);
      setPinning(null);
      setError(null);
      setLoading(true);
      setSaving(false);
      setShowRemoveConfirm(false);
    }
  }, [isOpen, fetchData]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const selectedSocket = useMemo(
    () => sockets.find((s) => s.socketId === selectedSocketId) ?? null,
    [sockets, selectedSocketId]
  );

  /** "Real" cores = the cores[] from the selected socket's topology. */
  const realCores: CpuCore[] = useMemo(
    () => (selectedSocket ? selectedSocket.cores : []),
    [selectedSocket]
  );

  const totalRealCores = realCores.length;

  const parsedStart = parseInt(coreStart, 10);
  const parsedEnd = parseInt(coreEnd, 10);

  const maxCoreIndex = totalRealCores > 0 ? totalRealCores - 1 : 0;

  // ── Validation ──────────────────────────────────────────────────────────────

  const validationError = useMemo(() => {
    if (selectedSocketId === null) return "Select a socket.";
    if (coreStart === "" || coreEnd === "") return "Core start and end are required.";
    if (!Number.isFinite(parsedStart) || !Number.isFinite(parsedEnd))
      return "Core start and end must be valid integers.";
    if (parsedStart < 0) return "Core start cannot be negative.";
    if (parsedEnd < 0) return "Core end cannot be negative.";
    if (parsedStart > parsedEnd) return "Core start must be ≤ core end.";
    if (parsedEnd > maxCoreIndex)
      return `Core end exceeds maximum index (${maxCoreIndex}) for this socket.`;
    if (parsedStart > maxCoreIndex)
      return `Core start exceeds maximum index (${maxCoreIndex}) for this socket.`;
    return null;
  }, [selectedSocketId, coreStart, coreEnd, parsedStart, parsedEnd, maxCoreIndex]);

  const isFormValid = validationError === null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const showToast = useCallback(
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

  const handleSave = useCallback(async () => {
    if (!isFormValid || saving) return;
    setSaving(true);
    try {
      await setCpuPinning(vmName, {
        range_start: parsedStart,
        range_end: parsedEnd,
        hyper_threading: hyperThreading,
        SocketID: selectedSocketId!,
      });
      showToast("CPU pinning saved", `Pinning set for cores ${parsedStart}–${parsedEnd}`);
      onClose();
    } catch (err) {
      console.error("Error saving CPU pinning:", err);
      const msg = err instanceof Error ? err.message : "Failed to save CPU pinning.";
      showToast("Error saving CPU pinning", msg, "error");
    } finally {
      setSaving(false);
    }
  }, [
    isFormValid,
    saving,
    vmName,
    parsedStart,
    parsedEnd,
    hyperThreading,
    selectedSocketId,
    showToast,
    onClose,
  ]);

  const handleRemovePinning = useCallback(async () => {
    setSaving(true);
    setShowRemoveConfirm(false);
    try {
      await removeCpuPinning(vmName);
      showToast("CPU pinning removed");
      // Reset form
      setPinning((prev) => (prev ? { ...prev, hasPinning: false, pins: [] } : prev));
      setCoreStart("");
      setCoreEnd("");
      setHyperThreading(false);
      if (sockets.length > 0) setSelectedSocketId(sockets[0].socketId);
      onClose();
    } catch (err) {
      console.error("Error removing CPU pinning:", err);
      const msg = err instanceof Error ? err.message : "Failed to remove CPU pinning.";
      showToast("Error removing pinning", msg, "error");
    } finally {
      setSaving(false);
    }
  }, [vmName, sockets, showToast, onClose]);

  const handleSocketChange = useCallback(
    (value: string) => {
      const socketId = parseInt(value, 10);
      setSelectedSocketId(socketId);
      // Reset core range when socket changes
      setCoreStart("");
      setCoreEnd("");
    },
    []
  );

  // ── Core chip tap handler ───────────────────────────────────────────────────

  const handleCoreTap = useCallback(
    (coreIndex: number) => {
      const startVal = parseInt(coreStart, 10);
      const endVal = parseInt(coreEnd, 10);

      // If nothing selected yet, set both start and end
      if (coreStart === "" || !Number.isFinite(startVal)) {
        setCoreStart(String(coreIndex));
        setCoreEnd(String(coreIndex));
        return;
      }

      // If we already have a start but no valid end, or tap extends range
      if (coreIndex < startVal) {
        setCoreStart(String(coreIndex));
      } else if (coreIndex > (Number.isFinite(endVal) ? endVal : startVal)) {
        setCoreEnd(String(coreIndex));
      } else {
        // Tap within range — re-anchor
        setCoreStart(String(coreIndex));
        setCoreEnd(String(coreIndex));
      }
    },
    [coreStart, coreEnd]
  );

  // ── Core selection set ──────────────────────────────────────────────────────

  const selectedCoreIndices = useMemo(() => {
    if (!Number.isFinite(parsedStart) || !Number.isFinite(parsedEnd)) return new Set<number>();
    const set = new Set<number>();
    for (let i = parsedStart; i <= parsedEnd; i++) set.add(i);
    return set;
  }, [parsedStart, parsedEnd]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalBackdrop />
        <ModalContent className="w-[88%] max-w-[340px] web:max-w-[640px] max-h-[82%] web:max-h-[88vh] rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] px-4 py-4 web:px-6 web:py-6">
          <ModalHeader className="flex-row items-center gap-3 pb-2">
            <Cpu
              size={20}
              color={resolvedMode === "dark" ? "#5EEAD4" : "#0F172A"}
            />
            <Heading
              size="lg"
              className="flex-1 text-typography-900 dark:text-[#E8EBF0]"
            >
              Edit CPU Pinning
            </Heading>
            <ModalCloseButton onPress={onClose} />
          </ModalHeader>

          <Divider className="bg-outline-100 dark:bg-[#1E2F47]" />

          <ModalBody
            className="mt-3 mb-0 flex-1"
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentContainerStyle={{ paddingBottom: 8 }}
          >
              {/* ── Loading ─────────────────────────────────────────────── */}
              {loading && (
                <VStack className="items-center justify-center py-12 gap-3">
                  <Spinner size="large" />
                  <Text className="text-typography-500 dark:text-[#8A94A8]">
                    Loading CPU topology…
                  </Text>
                </VStack>
              )}

              {/* ── Error ───────────────────────────────────────────────── */}
              {!loading && error && (
                <VStack className="items-center justify-center py-12 gap-3">
                  <Text className="text-red-500 text-center">{error}</Text>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onPress={fetchData}
                  >
                    <ButtonText>Retry</ButtonText>
                  </Button>
                </VStack>
              )}

              {/* ── Form ────────────────────────────────────────────────── */}
              {!loading && !error && (
                <VStack className="gap-5 py-2">
                  {/* VM info banner */}
                  <HStack className="items-center gap-2 flex-wrap">
                    <Badge
                      action="muted"
                      className="rounded-lg bg-outline-50 dark:bg-[#162236]"
                    >
                      <BadgeText numberOfLines={1} className="text-xs text-typography-600 dark:text-[#8A94A8]">
                        VM: {vmName}
                      </BadgeText>
                    </Badge>
                    <Badge
                      action="muted"
                      className="rounded-lg bg-outline-50 dark:bg-[#162236]"
                    >
                      <BadgeText numberOfLines={1} className="text-xs text-typography-600 dark:text-[#8A94A8]">
                        Host: {machineName}
                      </BadgeText>
                    </Badge>
                    {pinning?.hasPinning && (
                      <Badge
                        action="success"
                        className="rounded-lg"
                      >
                        <BadgeText className="text-xs">Pinned</BadgeText>
                      </Badge>
                    )}
                  </HStack>

                  {/* ─ Socket select ─ */}
                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText className="text-typography-900 dark:text-[#E8EBF0]">
                        Socket
                      </FormControlLabelText>
                    </FormControlLabel>
                    <Select
                      selectedValue={
                        selectedSocketId !== null ? String(selectedSocketId) : undefined
                      }
                      onValueChange={handleSocketChange}
                    >
                      <SelectTrigger
                        variant="outline"
                        className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0F1A2E]"
                      >
                        <SelectInput
                          placeholder="Select socket"
                          className="text-typography-900 dark:text-[#E8EBF0]"
                        />
                        <SelectIcon as={ChevronDown} className="mr-3" />
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent>
                          <SelectDragIndicatorWrapper>
                            <SelectDragIndicator />
                          </SelectDragIndicatorWrapper>
                          {sockets.map((s) => (
                            <SelectItem
                              key={s.socketId}
                              label={`Socket ${s.socketId} (${s.cores.length} cores)`}
                              value={String(s.socketId)}
                            />
                          ))}
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  </FormControl>

                  {/* ─ Hyper-Threading toggle ─ */}
                  <FormControl>
                    <HStack className="items-center justify-between">
                      <FormControlLabel className="flex-1">
                        <FormControlLabelText className="text-typography-900 dark:text-[#E8EBF0]">
                          Hyper-Threading
                        </FormControlLabelText>
                      </FormControlLabel>
                      <Switch
                        value={hyperThreading}
                        onValueChange={setHyperThreading}
                        trackColor={{
                          false: resolvedMode === "dark" ? "#2A3B52" : "#D1D5DB",
                          true: "#2DD4BF",
                        }}
                      />
                    </HStack>
                    <FormControlHelper>
                      <FormControlHelperText className="text-typography-500 dark:text-[#8A94A8]">
                        When enabled, HT sibling threads of each selected core will also be
                        pinned automatically.
                      </FormControlHelperText>
                    </FormControlHelper>
                  </FormControl>

                  {/* ─ Core start / end ─ */}
                  <HStack className="gap-3 flex-col web:flex-row">
                    <FormControl className="w-full web:flex-1">
                      <FormControlLabel>
                        <FormControlLabelText className="text-typography-900 dark:text-[#E8EBF0]">
                          Core Start
                        </FormControlLabelText>
                      </FormControlLabel>
                      <Input
                        variant="outline"
                        className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0F1A2E]"
                      >
                        <InputField
                          placeholder="0"
                          keyboardType="numeric"
                          value={coreStart}
                          onChangeText={(val) =>
                            setCoreStart(val.replace(/[^\d]/g, ""))
                          }
                          className="text-typography-900 dark:text-[#E8EBF0]"
                        />
                      </Input>
                    </FormControl>
                    <FormControl className="w-full web:flex-1">
                      <FormControlLabel>
                        <FormControlLabelText className="text-typography-900 dark:text-[#E8EBF0]">
                          Core End
                        </FormControlLabelText>
                      </FormControlLabel>
                      <Input
                        variant="outline"
                        className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0F1A2E]"
                      >
                        <InputField
                          placeholder={String(maxCoreIndex)}
                          keyboardType="numeric"
                          value={coreEnd}
                          onChangeText={(val) =>
                            setCoreEnd(val.replace(/[^\d]/g, ""))
                          }
                          className="text-typography-900 dark:text-[#E8EBF0]"
                        />
                      </Input>
                    </FormControl>
                  </HStack>

                  {/* ─ Socket info ─ */}
                  {selectedSocket && (
                    <HStack className="items-center gap-2">
                      <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                        Socket {selectedSocketId} has{" "}
                        <Text className="font-semibold text-xs text-typography-900 dark:text-[#E8EBF0]">
                          {totalRealCores}
                        </Text>{" "}
                        physical cores (index 0–{maxCoreIndex})
                      </Text>
                    </HStack>
                  )}

                  {/* ─ Visual core grid ─ */}
                  {selectedSocket && totalRealCores > 0 && (
                    <VStack className="gap-2">
                      <Text className="text-sm font-medium text-typography-900 dark:text-[#E8EBF0]">
                        Core Map — Socket {selectedSocketId}
                      </Text>
                      <Box className="flex-row flex-wrap gap-2">
                        {realCores.map((core) => {
                          const isSelected = selectedCoreIndices.has(core.coreIndex);
                          return (
                            <Pressable
                              key={core.coreIndex}
                              onPress={() => handleCoreTap(core.coreIndex)}
                            >
                              <Box
                                className={`
                                  items-center justify-center rounded-lg w-10 h-10 web:w-12 web:h-12 border
                                  ${isSelected
                                    ? "bg-[#2DD4BF]/20 border-[#2DD4BF] dark:bg-[#2DD4BF]/30 dark:border-[#2DD4BF]"
                                    : "bg-background-50 dark:bg-[#162236] border-outline-200 dark:border-[#2A3B52]"
                                  }
                                `}
                              >
                                <Text
                                  selectable={false}
                                  className={`text-xs font-semibold ${isSelected
                                    ? "text-[#0D9488] dark:text-[#5EEAD4]"
                                    : "text-typography-600 dark:text-[#8A94A8]"
                                    }`}
                                  style={{ userSelect: "none" }}
                                >
                                  {core.coreIndex}
                                </Text>
                                {hyperThreading && (
                                  <Text
                                    selectable={false}
                                    className={`text-[9px] ${isSelected
                                      ? "text-[#0D9488]/70 dark:text-[#5EEAD4]/70"
                                      : "text-typography-400 dark:text-[#5A6478]"
                                      }`}
                                    style={{ userSelect: "none" }}
                                  >
                                    HT
                                  </Text>
                                )}
                              </Box>
                            </Pressable>
                          );
                        })}
                      </Box>
                      {isFormValid && (
                        <Text className="text-xs text-typography-500 dark:text-[#8A94A8] mt-1">
                          Selected: cores {parsedStart}–{parsedEnd} (
                          {parsedEnd - parsedStart + 1} core
                          {parsedEnd - parsedStart + 1 !== 1 ? "s" : ""}
                          {hyperThreading
                            ? `, ${(parsedEnd - parsedStart + 1) * 2} threads with HT`
                            : ""}
                          )
                        </Text>
                      )}
                    </VStack>
                  )}

                  {/* ─ Validation error ─ */}
                  {!isFormValid && coreStart !== "" && coreEnd !== "" && (
                    <Text className="text-xs text-red-500">{validationError}</Text>
                  )}
                </VStack>
              )}
          </ModalBody>

          {/* ── Footer ───────────────────────────────────────────────── */}
          {!loading && !error && (
            <>
              <Divider className="bg-outline-100 dark:bg-[#1E2F47]" />
              <ModalFooter className="w-full pt-3">
                <Box className="w-full flex-col gap-3 web:flex-row web:items-center">
                  {/* Remove pinning — only if currently pinned */}
                  {pinning?.hasPinning && (
                    <Button
                      variant="outline"
                      action="negative"
                      className="w-full web:w-auto rounded-xl web:mr-auto"
                      onPress={() => setShowRemoveConfirm(true)}
                      isDisabled={saving}
                    >
                      <ButtonText>Remove Pinning</ButtonText>
                    </Button>
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
                    onPress={handleSave}
                    isDisabled={!isFormValid || saving}
                  >
                    {saving && <ButtonSpinner className="mr-2" />}
                    <ButtonText className={primaryButtonTextClass}>
                      {saving ? "Saving…" : "Save"}
                    </ButtonText>
                  </Button>
                </Box>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* ── Remove pinning confirmation ────────────────────────────── */}
      <ConfirmDialog
        isOpen={showRemoveConfirm}
        title="Remove CPU Pinning"
        description={`Are you sure you want to remove CPU pinning from "${vmName}"? The VM will use the default CPU scheduling.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={handleRemovePinning}
        onClose={() => setShowRemoveConfirm(false)}
      />
    </>
  );
}
