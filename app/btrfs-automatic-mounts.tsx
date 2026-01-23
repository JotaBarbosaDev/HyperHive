import React from "react";
import { ScrollView, RefreshControl } from "react-native";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
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
import { Input, InputField } from "@/components/ui/input";
import { Divider } from "@/components/ui/divider";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { ChevronDownIcon } from "@/components/ui/icon";
import { DirectoryPickerModal } from "@/components/modals/DirectoryPickerModal";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@/components/ui/modal";
import { DirectoryListing } from "@/types/directory";
import { Machine } from "@/types/machine";
import { AutomaticMount, BtrfsRaid } from "@/types/btrfs";
import { listDirectory, listMachines } from "@/services/hyperhive";
import { createAutomaticMount, deleteAutomaticMount, listAutomaticMounts, listRaids } from "@/services/btrfs";
import { COMPRESSION_OPTIONS } from "@/constants/btrfs";
import { RefreshCcw, Plus, Trash2 } from "lucide-react-native";

const DEFAULT_COMPRESSION = "zstd:3";

const getCompressionLabel = (value?: string | null) => {
  if (value === null || value === undefined) return "None";
  return COMPRESSION_OPTIONS.find((opt) => opt.value === value)?.label ?? (value || "None");
};

const getRaidLabel = (uuid: string | undefined, raids: BtrfsRaid[]) => {
  if (!uuid) return "—";
  const raid = raids.find((r) => r.uuid === uuid);
  if (!raid) return uuid;
  return raid.mount_point || raid.name || raid.label || uuid;
};

const computeNextPath = (current: string, selection: string) => {
  if (!selection) return current;
  if (selection.startsWith("/")) {
    return selection.replace(/\/{2,}/g, "/") || "/";
  }
  const sanitized = selection.replace(/^\/+|\/+$/g, "");
  if (!sanitized) return current;
  const base = current === "/" ? "" : current.replace(/\/+$/g, "");
  return `${base}/${sanitized}`.replace(/\/{2,}/g, "/");
};

const normalizePathInput = (input: string) => {
  const sanitized = input.trim();
  if (sanitized.length === 0) {
    return "/";
  }
  return sanitized.startsWith("/")
    ? sanitized.replace(/\/{2,}/g, "/")
    : `/${sanitized}`.replace(/\/{2,}/g, "/");
};

export default function BtrfsAutomaticMountsScreen() {
  const toast = useToast();
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = React.useState<string>("");
  const [autoMounts, setAutoMounts] = React.useState<AutomaticMount[]>([]);
  const [raids, setRaids] = React.useState<BtrfsRaid[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const [formRaid, setFormRaid] = React.useState<string>("");
  const [formMountPoint, setFormMountPoint] = React.useState<string>("");
  const [formCompression, setFormCompression] = React.useState<string>(DEFAULT_COMPRESSION);
  const [saving, setSaving] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<number | null>(null);
  const [createModal, setCreateModal] = React.useState(false);
  const [dirListing, setDirListing] = React.useState<DirectoryListing | null>(null);
  const [dirError, setDirError] = React.useState<string | null>(null);
  const [selectedDirectory, setSelectedDirectory] = React.useState<string | null>(null);
  const [isDirModalOpen, setIsDirModalOpen] = React.useState(false);
  const [isFetchingDir, setIsFetchingDir] = React.useState(false);
  const modalBackdropClass = "bg-background-950/60 dark:bg-black/70";
  const modalShellClass = "w-full rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]";
  const modalHeaderClass = "flex-row items-start justify-between px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#1E2F47]";
  const modalBodyClass = "px-6 pt-5 pb-6 max-h-[70vh] overflow-y-auto";
  const modalFooterClass = "gap-3 px-6 pt-4 pb-6 border-t border-outline-100 dark:border-[#1E2F47]";
  const cardShellClass = "rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] shadow-soft-1";
  const softCardShellClass = "rounded-xl border border-outline-100 bg-background-50 dark:border-[#1E2F47] dark:bg-[#132038]";
  const outlineButtonClass = "border-outline-200 rounded-xl dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] hover:bg-background-50 dark:hover:bg-[#0A1628]";
  const outlineButtonTextClass = "text-typography-900 dark:text-[#E8EBF0]";
  const outlineButtonIconClass = "text-typography-900 dark:text-[#E8EBF0]";
  const dangerOutlineTextClass = "text-error-700 dark:text-error-700";
  const dangerOutlineIconClass = "text-error-600 dark:text-error-700";
  const neutralBadgeClass = "rounded-full px-3 py-1 border border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]";
  const neutralBadgeTextClass = "text-xs text-typography-800 dark:text-[#E8EBF0]";
  const selectTriggerClass = "rounded-xl border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]";
  const selectInputClass = "text-typography-900 dark:text-[#E8EBF0] placeholder:text-typography-500 dark:placeholder:text-[#9AA4B8]";
  const selectIconClass = "text-typography-700 dark:text-[#9AA4B8]";
  const inputShellClass = "rounded-xl border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]";
  const dividerClass = "border-outline-100 dark:bg-[#1E2F47] dark:border-[#1E2F47]";

  const showToast = React.useCallback(
    (title: string, description: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-start flex-row"
            action={action}
          >
            <ToastTitle size="sm">{title}</ToastTitle>
            {description ? <ToastDescription size="sm">{description}</ToastDescription> : null}
          </Toast>
        ),
      });
    },
    [toast]
  );

  const loadMachines = React.useCallback(async () => {
    try {
      const data = await listMachines();
      const list = Array.isArray(data) ? data : [];
      setMachines(list);
      if (!selectedMachine && list.length > 0) {
        setSelectedMachine(list[0].MachineName);
      }
    } catch (err) {
      console.error("Failed to load machines", err);
      showToast("Error", "Failed to load machines.", "error");
    }
  }, [selectedMachine, showToast]);

  const loadData = React.useCallback(
    async (mode: "full" | "refresh" = "full") => {
      if (!selectedMachine) return;
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const [auto, raidList] = await Promise.all([
          listAutomaticMounts(selectedMachine),
          listRaids(selectedMachine),
        ]);
        setAutoMounts(Array.isArray(auto) ? auto : []);
        setRaids(Array.isArray(raidList) ? raidList : []);
      } catch (err) {
        console.error("Failed to load auto-mounts", err);
        showToast("Error", "Unable to load auto-mounts.", "error");
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [selectedMachine, showToast]
  );

  React.useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  React.useEffect(() => {
    if (selectedMachine) {
      loadData("full");
    }
  }, [selectedMachine, loadData]);

  React.useEffect(() => {
    setDirListing(null);
    setSelectedDirectory(null);
    setDirError(null);
  }, [selectedMachine]);

  React.useEffect(() => {
    if (createModal) return;
    setIsDirModalOpen(false);
    setSelectedDirectory(null);
    setDirListing(null);
    setDirError(null);
    setIsFetchingDir(false);
  }, [createModal]);

  const directories = React.useMemo(
    () =>
      Array.isArray(dirListing?.directories)
        ? (dirListing?.directories as string[])
        : [],
    [dirListing]
  );

  const handleDirectoryFetch = React.useCallback(
    async (customPath?: string) => {
      if (!selectedMachine.trim()) {
        setDirError("Select a machine before listing folders.");
        return undefined;
      }

      const normalizedPath = normalizePathInput(customPath ?? formMountPoint);

      setDirError(null);
      setDirListing(null);
      setIsFetchingDir(true);
      setSelectedDirectory(null);

      try {
        const data = await listDirectory(selectedMachine.trim(), normalizedPath);
        setDirListing(data);
        setFormMountPoint(normalizedPath);
        return data;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Error loading directory contents.";
        setDirError(message);
        setDirListing(null);
        return undefined;
      } finally {
        setIsFetchingDir(false);
      }
    },
    [formMountPoint, selectedMachine]
  );

  const handleOpenDirectoryModal = React.useCallback(async () => {
    if (!selectedMachine.trim()) {
      setDirError("Select a machine before listing folders.");
      return;
    }
    setDirError(null);
    const hasCachedDirectories = dirListing && Array.isArray(dirListing.directories);
    const result = hasCachedDirectories ? dirListing : await handleDirectoryFetch();
    if (!result) {
      return;
    }
    setSelectedDirectory(null);
    setIsDirModalOpen(true);
  }, [dirListing, handleDirectoryFetch, selectedMachine]);

  const handleDirectoryAdd = React.useCallback(async () => {
    if (!selectedDirectory) return;
    const nextPath = computeNextPath(normalizePathInput(formMountPoint), selectedDirectory);
    await handleDirectoryFetch(nextPath);
    setSelectedDirectory(null);
  }, [formMountPoint, handleDirectoryFetch, selectedDirectory]);

  const handleDirectoryCancel = React.useCallback(() => {
    setIsDirModalOpen(false);
    setSelectedDirectory(null);
    setDirListing(null);
    setDirError(null);
  }, []);

  const handleDirectoryOk = React.useCallback(() => {
    setIsDirModalOpen(false);
    setSelectedDirectory(null);
  }, []);

  const handleCreate = async () => {
    if (!selectedMachine) return;
    if (!formRaid) {
      showToast("UUID required", "Select or enter the RAID.", "error");
      return;
    }
    if (!formMountPoint.trim()) {
      showToast("Mount point required", "Enter the mount path.", "error");
      return;
    }
    setSaving(true);
    try {
      await createAutomaticMount(selectedMachine, {
        uuid: formRaid,
        mount_point: formMountPoint.trim(),
        compression: formCompression,
      });
      showToast("Auto-mount created", "Rule added successfully.");
      setFormMountPoint("");
      setDirListing(null);
      setSelectedDirectory(null);
      setDirError(null);
      setIsDirModalOpen(false);
      await loadData("refresh");
    } catch (err) {
      console.error("Failed to create auto-mount", err);
      showToast("Create failed", "Check the data and try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: number) => {
    setRemovingId(id);
    try {
      await deleteAutomaticMount(id);
      showToast("Auto-mount removed", "Rule deleted.");
      await loadData("refresh");
    } catch (err) {
      console.error("Failed to delete auto-mount", err);
      showToast("Error", "Could not delete.", "error");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 32}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData("refresh")}
          />
        }
      >
        <Box className="p-4 pt-16 web:p-20 web:max-w-5xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            BTRFS Auto-Mounts
          </Heading>
          <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
            Rules that automatically mount BTRFS RAIDs when the machine starts.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <HStack className="gap-3 items-center flex-wrap">
              <Select
                selectedValue={selectedMachine}
                onValueChange={(val) => setSelectedMachine(val)}
              >
                <SelectTrigger
                  className={`${selectTriggerClass} min-w-[180px] pr-2`}
                >
                  <SelectInput
                    placeholder="Machine"
                    value={selectedMachine}
                    className={selectInputClass}
                  />
                  <SelectIcon
                    as={ChevronDownIcon}
                    className={selectIconClass}
                  />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {(machines ?? []).map((m) => (
                      <SelectItem
                        key={m.MachineName}
                        label={m.MachineName}
                        value={m.MachineName}
                      />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
              <Button
                variant="outline"
                action="default"
                size="sm"
                onPress={() => loadData("refresh")}
                className={`${outlineButtonClass} h-10`}
              >
                <ButtonIcon
                  as={RefreshCcw}
                  size="sm"
                  className={outlineButtonIconClass}
                />
                <ButtonText className={outlineButtonTextClass}>
                  Refresh
                </ButtonText>
              </Button>
            </HStack>
            <Button
              action="primary"
              className="h-10 px-5 rounded-xl dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
              onPress={() => setCreateModal(true)}
            >
              <ButtonIcon as={Plus} size="sm" />
              <ButtonText style={{fontFamily: "Inter_600SemiBold"}}>
                New Auto-mount
              </ButtonText>
            </Button>
          </HStack>

          <Box className={`mt-6 ${cardShellClass}`}>
            <HStack className="items-center justify-between px-4 py-3">
              <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold text-base">
                Rules
              </Text>
              <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                {autoMounts.length} items
              </Text>
            </HStack>
            <Divider className={dividerClass} />
            {loading ? (
              <VStack className="gap-3 p-4">
                {[1, 2].map((i) => (
                  <Box key={i} className={`p-3 ${softCardShellClass}`}>
                    <Skeleton className="h-5 w-1/2 mb-2" />
                    <SkeletonText className="w-1/3" />
                  </Box>
                ))}
              </VStack>
            ) : autoMounts.length === 0 ? (
              <Box className="p-4">
                <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                  No rules configured.
                </Text>
              </Box>
            ) : (
              <VStack className="divide-y divide-outline-100 dark:divide-[#1E2F47]">
                {autoMounts.map((rule) => (
                  <Box key={rule.id} className="px-4 py-3">
                    <HStack className="justify-between items-start gap-3 flex-wrap">
                      <VStack className="gap-1">
                        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">
                          {rule.mount_point}
                        </Text>
                        <Text className="text-typography-700 dark:text-[#9AA4B8] text-sm">
                          RAID:{" "}
                          {getRaidLabel(rule.uuid || rule.raid_uuid, raids)}
                        </Text>
                        <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm">
                          UUID: {rule.uuid || rule.raid_uuid}
                        </Text>
                        <HStack className="gap-2 mt-1 flex-wrap">
                          <Badge
                            className={neutralBadgeClass}
                            size="sm"
                            action="muted"
                            variant="outline"
                          >
                            <BadgeText className={neutralBadgeTextClass}>
                              Compression:{" "}
                              {getCompressionLabel(rule.compression)}
                            </BadgeText>
                          </Badge>
                          {rule.machine_name ? (
                            <Badge
                              className={neutralBadgeClass}
                              size="sm"
                              action="muted"
                              variant="outline"
                            >
                              <BadgeText className={neutralBadgeTextClass}>
                                {rule.machine_name}
                              </BadgeText>
                            </Badge>
                          ) : null}
                        </HStack>
                      </VStack>
                      <Button
                        action="negative"
                        variant="outline"
                        onPress={() => handleRemove(rule.id)}
                        isDisabled={removingId !== null}
                        className={
                          outlineButtonClass +
                          "rounded-xl border-error-300 dark:border-error-700 bg-background-0 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                        }
                      >
                        {removingId === rule.id ? (
                          <ButtonSpinner />
                        ) : (
                          <ButtonIcon
                            as={Trash2}
                            size="sm"
                            className={dangerOutlineIconClass}
                          />
                        )}
                        <ButtonText className={dangerOutlineTextClass}>
                          Remove
                        </ButtonText>
                      </Button>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </Box>
      </ScrollView>

      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        size="lg"
      >
        <ModalBackdrop className={modalBackdropClass} />
        <ModalContent className={`max-w-2xl max-h-[90vh] ${modalShellClass}`}>
          <ModalHeader className={modalHeaderClass}>
            <Heading
              size="md"
              className="text-typography-900 dark:text-[#E8EBF0]"
            >
              New Auto-mount
            </Heading>
            <ModalCloseButton className="text-typography-500 dark:text-[#9AA4B8]" />
          </ModalHeader>
          <ModalBody className={`${modalBodyClass} gap-4`}>
            <VStack className="gap-3">
              <Select selectedValue={formRaid} onValueChange={setFormRaid}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectInput
                    placeholder="Select RAID"
                    value={getRaidLabel(formRaid, raids)}
                    className={selectInputClass}
                  />
                  <SelectIcon
                    as={ChevronDownIcon}
                    className={selectIconClass}
                  />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {(raids ?? []).map((r) => (
                      <SelectItem
                        key={r.uuid}
                        value={r.uuid}
                        label={getRaidLabel(r.uuid, raids)}
                      />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
              <Input className={inputShellClass}>
                <InputField
                  value={formMountPoint}
                  onChangeText={(text) => {
                    setFormMountPoint(text);
                    setDirError(null);
                    setDirListing(null);
                    setSelectedDirectory(null);
                  }}
                  placeholder="/mnt/raid"
                  className={selectInputClass}
                />
              </Input>
              <Button
                variant="outline"
                action="default"
                size="sm"
                className={`${outlineButtonClass} self-start`}
                onPress={handleOpenDirectoryModal}
                isDisabled={!selectedMachine.trim() || isFetchingDir}
              >
                {isFetchingDir ? (
                  <>
                    <ButtonSpinner size="small" />
                    <ButtonText
                      className={`${outlineButtonTextClass} ml-2 text-sm`}
                    >
                      Loading directories...
                    </ButtonText>
                  </>
                ) : (
                  <ButtonText className={`${outlineButtonTextClass} text-sm`}>
                    Browse directories
                  </ButtonText>
                )}
              </Button>
              {dirError ? (
                <Text className="text-error-700 dark:text-error-400 text-xs">
                  {dirError}
                </Text>
              ) : null}
              <Select
                selectedValue={formCompression}
                onValueChange={setFormCompression}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectInput
                    placeholder="Compression"
                    value={getCompressionLabel(formCompression)}
                    className={selectInputClass}
                  />
                  <SelectIcon
                    as={ChevronDownIcon}
                    className={selectIconClass}
                  />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {COMPRESSION_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value || "none"}
                        value={opt.value}
                        label={opt.label}
                      />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </VStack>
          </ModalBody>
          <ModalFooter className={modalFooterClass}>
            <Button
              variant="outline"
              action="default"
              onPress={() => setCreateModal(false)}
              isDisabled={saving}
              className={outlineButtonClass}
            >
              <ButtonText className={outlineButtonTextClass}>Cancel</ButtonText>
            </Button>
            <Button
              action="primary"
              onPress={() => handleCreate().then(() => setCreateModal(false))}
              isDisabled={saving}
              className="rounded-xl dark:bg-[#5EEAD4]"
            >
              {saving ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
              <ButtonText>Create</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <DirectoryPickerModal
        isOpen={isDirModalOpen}
        directories={directories}
        selectedDirectory={selectedDirectory}
        onSelect={setSelectedDirectory}
        onCancel={handleDirectoryCancel}
        onOk={handleDirectoryOk}
        onConfirm={handleDirectoryAdd}
        isLoading={isFetchingDir}
      />
    </Box>
  );
}
