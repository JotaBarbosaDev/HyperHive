import React from "react";
import { ScrollView, RefreshControl, useColorScheme, Alert } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Input, InputField } from "@/components/ui/input";
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton } from "@/components/ui/modal";
import { Select, SelectTrigger, SelectInput, SelectItem, SelectIcon, SelectPortal, SelectBackdrop as SelectBackdropContent, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper } from "@/components/ui/select";
import { Checkbox, CheckboxIndicator, CheckboxIcon, CheckboxLabel } from "@/components/ui/checkbox";
import { ChevronDownIcon } from "@/components/ui/icon";
import { Toast, ToastTitle, useToast } from "@/components/ui/toast";
import { Fab, FabIcon, FabLabel } from "@/components/ui/fab";
import { Calendar, Database, TrendingUp, RefreshCw, Trash2, Edit, Power, PowerOff, Plus, Clock, Check, Info } from "lucide-react-native";

import {
  listAutoBackups,
  createAutoBackup,
  updateAutoBackup,
  deleteAutoBackup,
  enableAutoBackup,
  disableAutoBackup,
  AutoBackupRecord,
} from "@/services/autobackups";
import { listMounts } from "@/services/hyperhive";
import { getAllVMs, VirtualMachine } from "@/services/vms-client";
import { Mount } from "@/types/mount";

type AutoBackup = {
  id: string;
  vmName: string;
  frequencyDays: number;
  minTime: string;
  maxTime: string;
  nfsShareId: number;
  retention: number;
  lastBackup: Date | null;
  isEnabled: boolean;
};

type AutoBackupStats = {
  total: number;
  active: number;
  totalVms: number;
  avgFrequency: number;
};

const FREQUENCY_OPTIONS = [
  { label: "Daily", value: 1 },
  { label: "Weekly", value: 7 },
  { label: "Monthly", value: 30 },
];

const TIME_OPTIONS = [
  ...Array.from({ length: 96 }, (_, idx) => {
    const hours = String(Math.floor(idx / 4)).padStart(2, "0");
    const minutes = String((idx % 4) * 15).padStart(2, "0");
    return `${hours}:${minutes}`;
  }),
  "23:59",
];

export default function AutoBackupsScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const [schedules, setSchedules] = React.useState<AutoBackup[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [editSchedule, setEditSchedule] = React.useState<AutoBackup | null>(null);
  const [nfsShares, setNfsShares] = React.useState<Record<number, string>>({});
  const [vmOptions, setVmOptions] = React.useState<VirtualMachine[]>([]);
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Form state
  const [formVm, setFormVm] = React.useState("");
  const [formFrequency, setFormFrequency] = React.useState(1);
  const [formMinTime, setFormMinTime] = React.useState("");
  const [formMaxTime, setFormMaxTime] = React.useState("");
  const [formNfsShare, setFormNfsShare] = React.useState<number | null>(null);
  const [formRetention, setFormRetention] = React.useState("");

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

  const formatDate = (date: Date | null): string => {
    if (!date || Number.isNaN(date.getTime())) return "Never";
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const timeToMinutes = (time: string): number | null => {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [h, m] = time.split(":").map((v) => Number(v));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const mapRecord = (record: AutoBackupRecord): AutoBackup => {
    return {
      id: String(record.Id),
      vmName: record.VmName,
      frequencyDays: record.FrequencyDays,
      minTime: record.MinTime,
      maxTime: record.MaxTime,
      nfsShareId: record.NfsMountId,
      retention: record.MaxBackupsRetain,
      lastBackup: record.LastBackupTime ? new Date(record.LastBackupTime) : null,
      isEnabled: Boolean(record.Enabled),
    };
  };

  const loadOptions = React.useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [mounts, vms] = await Promise.all([
        listMounts().catch(() => [] as Mount[]),
        getAllVMs().catch(() => [] as VirtualMachine[]),
      ]);
      if (Array.isArray(mounts)) {
        const mapped: Record<number, string> = {};
        mounts.forEach((m) => {
          if (!m?.NfsShare) return;
          mapped[m.NfsShare.Id] =
            m.NfsShare.Name || m.NfsShare.Target || m.NfsShare.FolderPath || `NFS #${m.NfsShare.Id}`;
        });
        setNfsShares(mapped);
        if (formNfsShare == null && Object.keys(mapped).length) {
          const first = Number(Object.keys(mapped)[0]);
          setFormNfsShare(first);
        }
      }
      if (Array.isArray(vms)) {
        setVmOptions(vms);
        if (!formVm && vms.length) {
          setFormVm(vms[0].name);
        }
      }
    } catch (err) {
      console.error("Error loading auto-backup options", err);
      const message = err instanceof Error ? err.message : "Failed to load options.";
      showToastMessage(message, "error");
    } finally {
      setLoadingOptions(false);
    }
  }, [formNfsShare, formVm, showToastMessage]);

  const refreshSchedules = React.useCallback(
    async (showMessage = false) => {
      setLoading(true);
      try {
        const data = await listAutoBackups();
        const mapped = Array.isArray(data) ? data.map(mapRecord) : [];
        setSchedules(mapped);
        if (showMessage) {
          showToastMessage("Auto-backups updated");
        }
      } catch (err) {
        console.error("Error loading auto-backups", err);
        const message = err instanceof Error ? err.message : "Unable to load auto-backups.";
        showToastMessage(message, "error");
      } finally {
        setLoading(false);
      }
    },
    [showToastMessage]
  );

  React.useEffect(() => {
    refreshSchedules();
    loadOptions();
  }, [refreshSchedules, loadOptions]);

  React.useEffect(() => {
    if (!formMinTime) {
      setFormMinTime(TIME_OPTIONS[0]);
    }
    if (!formMaxTime) {
      setFormMaxTime(TIME_OPTIONS[TIME_OPTIONS.length - 1]);
    }
  }, [formMinTime, formMaxTime]);

  const resetForm = () => {
    setFormVm(vmOptions[0]?.name ?? "");
    setFormFrequency(1);
    setFormMinTime(TIME_OPTIONS[0]);
    setFormMaxTime(TIME_OPTIONS[TIME_OPTIONS.length - 1]);
    setFormNfsShare(nfsShares ? Number(Object.keys(nfsShares)[0]) || null : null);
    setFormRetention("");
    setEditSchedule(null);
  };

  const stats: AutoBackupStats = React.useMemo(() => {
    const total = schedules.length;
    const active = schedules.filter((s) => s.isEnabled).length;
    const uniqueVms = new Set(schedules.map((s) => s.vmName));
    const totalVms = uniqueVms.size;
    const avgFrequency =
      total > 0
        ? Math.round(schedules.reduce((sum, s) => sum + s.frequencyDays, 0) / total)
        : 0;
    return { total, active, totalVms, avgFrequency };
  }, [schedules]);

  const getFrequencyLabel = (days: number): string => {
    if (days === 1) return "Daily";
    if (days === 7) return "Weekly";
    if (days === 30) return "Monthly";
    return `${days} days`;
  };

  const getNfsName = (id: number): string => nfsShares[id] || `NFS #${id}`;
  const selectedNfsLabel = formNfsShare != null ? getNfsName(formNfsShare) : "";

  const handleRefresh = () => refreshSchedules(true);

  const handleDelete = (schedule: AutoBackup) => {
    Alert.alert(
      "Delete schedule",
      `Delete auto-backup for ${schedule.vmName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAutoBackup(schedule.id);
              setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
              showToastMessage("Schedule deleted");
            } catch (err) {
              console.error("Error deleting auto-backup", err);
              const message = err instanceof Error ? err.message : "Failed to delete schedule.";
              showToastMessage(message, "error");
            }
          },
        },
      ]
    );
  };

  const openEdit = (schedule: AutoBackup) => {
    setEditSchedule(schedule);
    setFormVm(schedule.vmName);
    setFormFrequency(schedule.frequencyDays);
    setFormMinTime(schedule.minTime);
    setFormMaxTime(schedule.maxTime);
    setFormNfsShare(schedule.nfsShareId);
    setFormRetention(String(schedule.retention));
    setShowCreateModal(true);
  };

  const handleToggleEnabled = async (schedule: AutoBackup) => {
    try {
      if (schedule.isEnabled) {
        await disableAutoBackup(schedule.id);
      } else {
        await enableAutoBackup(schedule.id);
      }
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === schedule.id ? { ...s, isEnabled: !schedule.isEnabled } : s
        )
      );
    } catch (err) {
      console.error("Error toggling auto-backup", err);
      const message = err instanceof Error ? err.message : "Failed to update schedule.";
      showToastMessage(message, "error");
    }
  };

  const handleSubmit = async () => {
    if (!formVm || !formMinTime || !formMaxTime || !formNfsShare || !formRetention) {
      showToastMessage("Fill all required fields", "error");
      return;
    }

    const minMinutes = timeToMinutes(formMinTime);
    const maxMinutes = timeToMinutes(formMaxTime);
    if (minMinutes == null || maxMinutes == null) {
      showToastMessage("Use HH:MM for times", "error");
      return;
    }
    if (maxMinutes <= minMinutes) {
      showToastMessage("Max time must be after min time", "error");
      return;
    }

    const payload = {
      vm_name: formVm,
      frequency_days: formFrequency,
      min_time: formMinTime,
      max_time: formMaxTime,
      nfs_mount_id: formNfsShare,
      max_backups_retain: Number(formRetention) || 0,
    };

    setSaving(true);
    try {
      if (editSchedule) {
        await updateAutoBackup(editSchedule.id, payload);
        showToastMessage("Schedule updated");
      } else {
        await createAutoBackup(payload);
        showToastMessage("Schedule created");
      }
      setShowCreateModal(false);
      resetForm();
      await refreshSchedules();
    } catch (err) {
      console.error("Error saving auto-backup", err);
      const message = err instanceof Error ? err.message : "Failed to save schedule.";
      showToastMessage(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 100}}
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
                Auto-Backups
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl mt-2">
                Configure automatic backup schedules for your VMs with frequency
                and retention control.
              </Text>
            </VStack>
            <Box className="hidden web:flex">
              <Button
                className="rounded-lg px-4"
                onPress={() => setShowCreateModal(true)}
              >
                <ButtonIcon as={Plus} className="text-background-0 mr-1.5" />
                <ButtonText
                  className="text-background-0"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  New schedule
                </ButtonText>
              </Button>
            </Box>
          </HStack>

          {/* Stats Overview */}
          <HStack className="mb-6 gap-4 flex-wrap web:grid web:grid-cols-4">
            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Calendar
                  size={16}
                  className="text-[#9AA4B8] dark:text-[#8A94A8]"
                />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Total Schedules
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {stats.total}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Database
                  size={16}
                  className="text-[#2DD4BF] dark:text-[#5EEAD4]"
                />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Active
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {stats.active}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <TrendingUp
                  size={16}
                  className="text-[#9AA4B8] dark:text-[#8A94A8]"
                />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Avg Frequency
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {stats.avgFrequency} d
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Clock
                  size={16}
                  className="text-[#9AA4B8] dark:text-[#8A94A8]"
                />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  VMs Covered
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {stats.totalVms}
              </Text>
            </Box>
          </HStack>

          {/* Search/Actions */}
          <HStack className="mb-6 gap-2">
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
          </HStack>

          {/* Schedules */}
          {schedules.length === 0 ? (
            <Box className="p-8 web:rounded-2xl web:bg-background-0/80 dark:web:bg-[#151F30]/80">
              <VStack className="items-center gap-4">
                <Calendar
                  size={48}
                  className="text-[#9AA4B8] dark:text-[#8A94A8]"
                />
                <Text
                  className="text-typography-900 dark:text-[#E8EBF0] text-lg text-center"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  No auto-backups yet
                </Text>
                <Text
                  className="text-[#9AA4B8] dark:text-[#8A94A8] text-center"
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  Create a schedule to start automatic backups.
                </Text>
              </VStack>
            </Box>
          ) : (
            <VStack className="gap-4">
              {schedules.map((schedule) => (
                <Box
                  key={schedule.id}
                  className="rounded-2xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4 web:p-6"
                >
                  <HStack className="justify-between items-start">
                    <VStack className="gap-1">
                      <Heading
                        size="md"
                        className="text-typography-900 dark:text-[#E8EBF0]"
                        style={{fontFamily: "Inter_700Bold"}}
                      >
                        {schedule.vmName}
                      </Heading>
                      <Text
                        className="text-sm text-[#9AA4B8] dark:text-[#8A94A8]"
                        style={{fontFamily: "Inter_400Regular"}}
                      >
                        {getFrequencyLabel(schedule.frequencyDays)} •{" "}
                        {schedule.minTime} - {schedule.maxTime}
                      </Text>
                      <Text
                        className="text-sm text-[#9AA4B8] dark:text-[#8A94A8]"
                        style={{fontFamily: "Inter_400Regular"}}
                      >
                        NFS: {getNfsName(schedule.nfsShareId)} • Retain{" "}
                        {schedule.retention} backups
                      </Text>
                      <Text
                        className="text-xs text-typography-600 dark:text-typography-400"
                        style={{fontFamily: "Inter_400Regular"}}
                      >
                        Last backup: {formatDate(schedule.lastBackup)}
                      </Text>
                    </VStack>
                    <HStack className="gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-md"
                        onPress={() => openEdit(schedule)}
                      >
                        <ButtonIcon
                          as={Edit}
                          className="text-typography-700 dark:text-[#E8EBF0]"
                        />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-md border-red-500"
                        onPress={() => handleDelete(schedule)}
                      >
                        <ButtonIcon as={Trash2} className="text-red-500" />
                      </Button>
                    </HStack>
                  </HStack>
                  <HStack className="mt-4 items-center gap-3">
                    <Badge
                      size="sm"
                      variant="outline"
                      className={`rounded-full w-fit ${
                        schedule.isEnabled
                          ? "bg-[#22c55e19] border-[#22c55e] dark:bg-[#22c55e25] dark:border-[#4ade80]"
                          : "bg-[#fbbf2419] border-[#FBBF24] dark:bg-[#FBBF2425] dark:border-[#FCD34D]"
                      }`}
                    >
                      <BadgeText
                        className={`text-xs ${
                          schedule.isEnabled
                            ? "text-[#22c55e] dark:text-[#4ade80]"
                            : "text-[#FBBF24] dark:text-[#FCD34D]"
                        }`}
                        style={{fontFamily: "Inter_500Medium"}}
                      >
                        {schedule.isEnabled ? "Enabled" : "Disabled"}
                      </BadgeText>
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-md"
                      onPress={() => handleToggleEnabled(schedule)}
                    >
                      <ButtonIcon
                        as={schedule.isEnabled ? PowerOff : Power}
                        className="text-typography-700 dark:text-[#E8EBF0] mr-1.5"
                      />
                      <ButtonText className="text-typography-700 dark:text-[#E8EBF0]">
                        {schedule.isEnabled ? "Disable" : "Enable"}
                      </ButtonText>
                    </Button>
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}
        </Box>
      </ScrollView>

      {/* FAB mobile */}
      <Fab
        placement="bottom right"
        size="lg"
        onPress={() => setShowCreateModal(true)}
        className="md:hidden"
      >
        <FabIcon as={Plus} className="text-background-0" />
        <FabLabel
          className="text-background-0"
          style={{fontFamily: "Inter_600SemiBold"}}
        >
          New
        </FabLabel>
      </Fab>

      {/* Modal create/edit */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4">
            <Heading
              size="lg"
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{fontFamily: "Inter_700Bold"}}
            >
              {editSchedule ? "Edit Auto-Backup" : "New Auto-Backup"}
            </Heading>
            <ModalCloseButton className="text-typography-600 dark:text-typography-400" />
          </ModalHeader>
          <ModalBody className="py-4">
            <VStack className="gap-4">
              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  VM
                </Text>
                <Select
                  selectedValue={formVm}
                  onValueChange={setFormVm}
                  isDisabled={loadingOptions || vmOptions.length === 0}
                >
                  <SelectTrigger
                    variant="outline"
                    size="md"
                    className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                  >
                    <SelectInput
                      placeholder={
                        loadingOptions ? "Loading..." : "Choose a VM..."
                      }
                      value={formVm}
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                    <SelectIcon
                      className="mr-3 text-typography-500 dark:text-typography-400"
                      as={ChevronDownIcon}
                    />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdropContent />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {vmOptions.length === 0 ? (
                        <SelectItem
                          label={
                            loadingOptions ? "Loading..." : "No VMs available"
                          }
                          value=""
                          isDisabled
                        />
                      ) : (
                        vmOptions.map((vm) => (
                          <SelectItem
                            key={vm.name}
                            label={`${vm.name} (${vm.machineName})`}
                            value={vm.name}
                          />
                        ))
                      )}
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </VStack>

              <HStack className="gap-3">
                <VStack className="flex-1 gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                    style={{fontFamily: "Inter_500Medium"}}
                  >
                    Frequency
                  </Text>
                  <Select
                    selectedValue={String(formFrequency)}
                    onValueChange={(val) => setFormFrequency(Number(val) || 1)}
                  >
                    <SelectTrigger
                      variant="outline"
                      size="md"
                      className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                    >
                      <SelectInput
                        placeholder="Select frequency"
                        value={String(formFrequency)}
                        className="text-typography-900 dark:text-[#E8EBF0]"
                      />
                      <SelectIcon
                        className="mr-3 text-typography-500 dark:text-typography-400"
                        as={ChevronDownIcon}
                      />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdropContent />
                      <SelectContent>
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        {FREQUENCY_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            label={opt.label}
                            value={String(opt.value)}
                          />
                        ))}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </VStack>
                <VStack className="flex-1 gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                    style={{fontFamily: "Inter_500Medium"}}
                  >
                    Retention (backups)
                  </Text>
                  <Input variant="outline" className="rounded-lg">
                    <InputField
                      keyboardType="numeric"
                      value={formRetention}
                      onChangeText={setFormRetention}
                      placeholder="e.g. 5"
                    />
                  </Input>
                </VStack>
              </HStack>

              <HStack className="gap-3">
                <VStack className="flex-1 gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                    style={{fontFamily: "Inter_500Medium"}}
                  >
                    Min time
                  </Text>
                  <Select
                    selectedValue={formMinTime || undefined}
                    onValueChange={(val) => setFormMinTime(val)}
                  >
                    <SelectTrigger
                      variant="outline"
                      size="md"
                      className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                    >
                      <SelectInput
                        placeholder="Select time"
                        value={formMinTime}
                        className="text-typography-900 dark:text-[#E8EBF0]"
                      />
                      <SelectIcon
                        className="mr-3 text-typography-500 dark:text-typography-400"
                        as={ChevronDownIcon}
                      />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdropContent />
                      <SelectContent>
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={time} label={time} value={time} />
                        ))}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </VStack>
                <VStack className="flex-1 gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                    style={{fontFamily: "Inter_500Medium"}}
                  >
                    Max time
                  </Text>
                  <Select
                    selectedValue={formMaxTime || undefined}
                    onValueChange={(val) => setFormMaxTime(val)}
                  >
                    <SelectTrigger
                      variant="outline"
                      size="md"
                      className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                    >
                      <SelectInput
                        placeholder="Select time"
                        value={formMaxTime}
                        className="text-typography-900 dark:text-[#E8EBF0]"
                      />
                      <SelectIcon
                        className="mr-3 text-typography-500 dark:text-typography-400"
                        as={ChevronDownIcon}
                      />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdropContent />
                      <SelectContent>
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={time} label={time} value={time} />
                        ))}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </VStack>
              </HStack>

              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  NFS share
                </Text>
                <Select
                  selectedValue={
                    formNfsShare != null ? String(formNfsShare) : ""
                  }
                  onValueChange={(val) => setFormNfsShare(Number(val))}
                  isDisabled={
                    loadingOptions || Object.keys(nfsShares).length === 0
                  }
                >
                  <SelectTrigger
                    variant="outline"
                    size="md"
                    className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                  >
                    <SelectInput
                      placeholder={
                        loadingOptions ? "Loading..." : "Choose a NFS share..."
                      }
                      value={selectedNfsLabel}
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                    <SelectIcon
                      className="mr-3 text-typography-500 dark:text-typography-400"
                      as={ChevronDownIcon}
                    />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdropContent />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {Object.keys(nfsShares).length === 0 ? (
                        <SelectItem
                          label={
                            loadingOptions ? "Loading..." : "No NFS shares"
                          }
                          value=""
                          isDisabled
                        />
                      ) : (
                        Object.entries(nfsShares).map(([id, label]) => (
                          <SelectItem key={id} label={label} value={id} />
                        ))
                      )}
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </VStack>

              <HStack className="items-center gap-2">
                <Checkbox
                  isDisabled
                  value="live-required"
                  isChecked
                  aria-label="Live backups require qemu-guest-agent"
                >
                  <CheckboxLabel className="text-sm text-typography-600 dark:text-typography-400">
                    VMs need qemu-guest-agent for live backups
                  </CheckboxLabel>
                </Checkbox>
              </HStack>
            </VStack>
          </ModalBody>
          <ModalFooter className="pt-6 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="justify-end gap-3 w-full">
              <Button
                variant="outline"
                className="rounded-lg px-6 py-2.5 border-outline-200 dark:border-[#2A3B52]"
                onPress={() => setShowCreateModal(false)}
                disabled={saving}
              >
                <ButtonText
                  className="text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Cancel
                </ButtonText>
              </Button>
              <Button
                className="rounded-lg px-6 py-2.5 bg-typography-900 dark:bg-[#E8EBF0]"
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText
                    className="text-background-0 dark:text-typography-900"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    {editSchedule ? "Save changes" : "Create"}
                  </ButtonText>
                )}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
