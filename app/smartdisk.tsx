import React from "react";
import { RefreshControl, ScrollView } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectItem,
  SelectIcon,
  SelectPortal,
  SelectContent,
  SelectDragIndicator,
  SelectBackdrop,
  SelectDragIndicatorWrapper,
} from "@/components/ui/select";
import { ChevronDownIcon } from "@/components/ui/icon";
import { Divider } from "@/components/ui/divider";
import { Pressable } from "@/components/ui/pressable";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@/components/ui/modal";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogCloseButton,
} from "@/components/ui/alert-dialog";
import { FormControl, FormControlHelper, FormControlHelperText, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Machine } from "@/types/machine";
import { SmartDiskDevice, SmartDiskSchedule } from "@/types/smartdisk";
import { listMachines } from "@/services/hyperhive";
import {
  listAllDisks,
} from "@/services/btrfs";
import {
  createSchedule,
  deleteSchedule,
  enableSchedule,
  listSchedules,
  listSmartDisks,
  startSelfTest,
  reallocFullWipe,
  reallocNonDestructive,
  reallocCancel,
} from "@/services/smartdisk";
import { AlertTriangle, Activity, CalendarClock, Plus, RefreshCcw, Trash2, Play, Info, ThermometerSun, ThermometerSnowflake } from "lucide-react-native";
import { BtrfsDisk } from "@/types/btrfs";

const TEST_TYPES = [
  { value: "short", label: "Short Self-Test (~2 min)" },
  { value: "extended", label: "Extended Self-Test (longer)" },
];

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const HOURS = Array.from({ length: 24 }).map((_, i) => ({ value: i, label: `${String(i).padStart(2, "0")}:00` }));

const STATUS_COLOR: Record<string, string> = {
  ok: "bg-success-100 text-success-700",
  healthy: "bg-success-100 text-success-700",
  atencao: "bg-warning-100 text-warning-700",
  attention: "bg-warning-100 text-warning-700",
  warning: "bg-warning-100 text-warning-700",
  critical: "bg-error-100 text-error-700",
};

const formatTemp = (temp?: string | number) => {
  if (temp === null || temp === undefined || temp === "") return "—";
  const num = typeof temp === "number" ? temp : Number(temp);
  if (isNaN(num)) return String(temp);
  return `${num}°C`;
};

const formatDeviceDisplay = (device: SmartDiskDevice | BtrfsDisk | string): string => {
  if (typeof device === "string") return device;
  const dev = device.device || "";
  const model = (device as any).model || "";
  if (model) return `${dev} - ${model}`;
  return dev;
};

const findDeviceLabel = (dev: string, disks: SmartDiskDevice[]) => {
  const found = disks.find((d) => d.device === dev);
  return found ? formatDeviceDisplay(found) : dev;
};

const buildDeviceMeta = (rawDevices: any[]): Record<string, string> => {
  const meta: Record<string, string> = {};
  rawDevices.forEach((d) => {
    const device = normalizeDevicePath(d?.device ?? d?.path ?? d?.name ?? d) ?? "";
    if (!device) return;
    const model = d?.model ?? "";
    if (model) meta[device] = model;
  });
  return meta;
};

const getDeviceLabel = (dev: string, disks: SmartDiskDevice[], meta: Record<string, string>) => {
  const found = disks.find((d) => d.device === dev);
  if (found) return formatDeviceDisplay(found);
  if (meta[dev]) return `${dev} - ${meta[dev]}`;
  return dev;
};

const normalizeDevicePath = (dev?: string | null): string | null => {
  if (!dev) return null;
  if (dev.startsWith("/dev/")) return dev;
  if (/^(sd|nvme|vd|hd|xvd)/.test(dev)) return `/dev/${dev}`;
  return null;
};

const isAllowedDevice = (dev?: string | null) => {
  const normalized = normalizeDevicePath(dev);
  if (!normalized) return false;
  return /^\/dev\/(sd|nvme|vd|hd|xvd)/.test(normalized);
};

export default function SmartDiskScreen() {
  const toast = useToast();
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = React.useState<string>("");
  const [disks, setDisks] = React.useState<SmartDiskDevice[]>([]);
  const [deviceOptions, setDeviceOptions] = React.useState<string[]>([]);
  const [deviceMeta, setDeviceMeta] = React.useState<Record<string, string>>({});
  const [schedules, setSchedules] = React.useState<SmartDiskSchedule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [diskDetail, setDiskDetail] = React.useState<SmartDiskDevice | null>(null);
  const [selfTestTarget, setSelfTestTarget] = React.useState<SmartDiskDevice | null>(null);
  const [scheduleModal, setScheduleModal] = React.useState(false);
  const defaultSchedule = React.useMemo(
    () => ({ device: "", type: "short", week_day: 0, hour: 0, active: true }),
    []
  );
  const [scheduleForm, setScheduleForm] = React.useState<{ device: string; type: string; week_day: number; hour: number; active: boolean }>(
    defaultSchedule
  );
  const [progress, setProgress] = React.useState<string>("");
  const [savingAction, setSavingAction] = React.useState<string | null>(null);

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
      showToast("Error loading machines", "Try again.", "error");
    }
  }, [selectedMachine, showToast]);

  const loadData = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (!selectedMachine) return;
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const [rawDevices, schedResp] = await Promise.all([
          listAllDisks(selectedMachine).catch(() => []),
          listSchedules(selectedMachine),
        ]);
        setDeviceMeta(buildDeviceMeta(Array.isArray(rawDevices) ? rawDevices : []));
        const deviceList = Array.from(
          new Set(
            (Array.isArray(rawDevices) ? rawDevices : [])
              .map((d) => (d as any).device || (d as any).path || (d as any).name)
              .map(normalizeDevicePath)
              .filter(Boolean) as string[]
          )
        ).filter(isAllowedDevice);
        setDeviceOptions(deviceList);

        let allDisks: SmartDiskDevice[] = [];
        for (const dev of deviceList) {
          try {
            const result = await listSmartDisks(selectedMachine, dev);
            if (Array.isArray(result)) {
              allDisks = allDisks.concat(result);
            }
          } catch (err) {
            console.warn("Falha ao carregar smartdisk para", dev, err);
          }
        }
        setDisks(allDisks);
        setSchedules(Array.isArray(schedResp) ? schedResp : []);

        if (!scheduleForm.device && deviceList[0]) {
          setScheduleForm((prev) => ({ ...prev, device: deviceList[0] }));
        }
      } catch (err) {
        console.error("Failed to load smartdisk data", err);
        if (mode === "full") {
          showToast("Error loading", "Unable to fetch SmartDisk data.", "error");
        }
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [selectedMachine, showToast, scheduleForm.device]
  );

  React.useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  React.useEffect(() => {
    if (selectedMachine) {
      loadData();
    }
  }, [selectedMachine, loadData]);

  const handleOpenDetail = async (device: SmartDiskDevice) => {
    if (!isAllowedDevice(device.device)) {
      setDiskDetail(device);
      return;
    }
    try {
      const detail = await listSmartDisks(selectedMachine, device.device);
      setDiskDetail(Array.isArray(detail) && detail.length > 0 ? detail[0] : device);
    } catch {
      setDiskDetail(device);
    }
  };

  const handleStartSelfTest = async () => {
    if (!selfTestTarget) return;
    setSavingAction("selftest");
    try {
      await startSelfTest(selectedMachine, { device: selfTestTarget.device, type: scheduleForm.type });
      showToast("Self-test started", `${selfTestTarget.device} running.`);
      setSelfTestTarget(null);
    } catch (err) {
      console.error("Failed to start self-test", err);
      showToast("Error starting test", "Try again.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const handleScheduleSave = async () => {
    if (!scheduleForm.device) {
      showToast("Device required", "Select a disk.", "error");
      return;
    }
    setSavingAction("schedule");
    try {
      await createSchedule(selectedMachine, scheduleForm);
      showToast("Schedule created", "Test will run automatically.");
      setScheduleModal(false);
      await loadData("silent");
    } catch (err) {
      console.error("Failed to create schedule", err);
      showToast("Error scheduling", "Try again.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const toggleSchedule = async (sched: SmartDiskSchedule) => {
    setSavingAction(`sched-${sched.id}`);
    try {
      await enableSchedule(selectedMachine, sched.id, !sched.active);
      showToast("Schedule updated", sched.active ? "Schedule disabled." : "Schedule enabled.");
      await loadData("silent");
    } catch (err) {
      console.error("Failed to toggle schedule", err);
      showToast("Error updating schedule", "Try again.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const handleDeleteSchedule = async (sched: SmartDiskSchedule) => {
    setSavingAction(`sched-del-${sched.id}`);
    try {
      await deleteSchedule(selectedMachine, sched.id);
      showToast("Schedule removed", "Schedule deleted.");
      await loadData("silent");
    } catch (err) {
      console.error("Failed to delete schedule", err);
      showToast("Error removing schedule", "Try again.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const badgeStatus = (status?: string) => {
    if (!status) return null;
    const key = status.toLowerCase();
    const normalizedKey = key.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const cls = STATUS_COLOR[normalizedKey] ?? STATUS_COLOR[key] ?? "bg-background-100 text-typography-800";
    return (
      <Badge className={`rounded-full px-3 py-1 ${cls}`} size="sm" action="muted" variant="solid">
        <BadgeText className="text-xs text-typography-800">{status}</BadgeText>
      </Badge>
    );
  };

  const performReallocAction = async (action: string, fn: () => Promise<unknown>) => {
    setSavingAction(action);
    try {
      await fn();
      showToast("Action sent", "Reallocate triggered.");
    } catch (err) {
      console.error("Failed realloc action", err);
      showToast("Error performing action", "Try again.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            SmartDisk Health
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            SMART monitoring and disk testing.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <HStack className="gap-3 items-center flex-wrap">
              <Select selectedValue={selectedMachine} onValueChange={(val) => setSelectedMachine(val)}>
                <SelectTrigger className="min-w-[180px]">
                  <SelectInput placeholder="Machine" value={selectedMachine} />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {(machines ?? []).map((m) => (
                      <SelectItem key={m.MachineName} value={m.MachineName} label={m.MachineName} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
              <Button variant="outline" action="default" size="sm" onPress={() => loadData("refresh")}>
                <ButtonIcon as={RefreshCcw} size="sm" />
                <ButtonText>Refresh</ButtonText>
              </Button>
            </HStack>
            <Button
              action="primary"
              variant="solid"
              size="md"
              onPress={() => {
                setScheduleForm((prev) => ({
                  ...defaultSchedule,
                  device: deviceOptions[0] ?? "",
                  type: prev.type,
                }));
                setScheduleModal(true);
              }}
            >
              <ButtonIcon as={Plus} size="sm" />
              <ButtonText>New Schedule</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            <VStack className="mt-6 gap-4">
              {[1, 2, 3].map((idx) => (
                <Box key={idx} className="p-4 rounded-2xl bg-background-0 border border-background-100 shadow-soft-1">
                  <Skeleton className="h-5 w-1/3 mb-2" />
                  <SkeletonText className="w-1/2" />
                </Box>
              ))}
            </VStack>
          ) : (
            <>
              <Box className="mt-6 rounded-2xl bg-background-0 border border-background-200 shadow-soft-1">
                <HStack className="px-4 py-3 items-center justify-between">
                  <Text className="text-typography-900 font-semibold text-base">Disks</Text>
                  <Text className="text-typography-600 text-sm">{disks.length} items</Text>
                </HStack>
                <Divider />
                <Box className="px-4 py-2">
                  {(Array.isArray(disks) ? disks : []).length === 0 ? (
                    <Text className="text-typography-600 text-sm py-3">No eligible disks found for this machine.</Text>
                  ) : (
                    <>
                      <HStack className="py-2">
                        <Text className="flex-1 text-typography-700 font-semibold">Device</Text>
                        <Text className="flex-1 text-typography-700 font-semibold">Model</Text>
                        <Text className="w-16 text-typography-700 font-semibold">Temp</Text>
                        <Text className="w-24 text-typography-700 font-semibold text-center">Reallocated</Text>
                        <Text className="w-24 text-typography-700 font-semibold text-center">Pending</Text>
                        <Text className="w-20 text-typography-700 font-semibold text-center">Status</Text>
                        <Text className="w-20 text-typography-700 font-semibold text-center">Actions</Text>
                      </HStack>
                      <Divider />
                      {(Array.isArray(disks) ? disks : []).map((disk) => (
                        <HStack key={disk.device} className="py-3 items-center">
                          <Text className="flex-1 text-typography-900 font-semibold">{formatDeviceDisplay(disk)}</Text>
                          <Text className="flex-1 text-typography-700">{disk.model || "—"}</Text>
                          <Text className="w-16 text-typography-700">{formatTemp(disk.temp)}</Text>
                          <Text className="w-24 text-center text-typography-700">{disk.reallocated ?? 0}</Text>
                          <Text className="w-24 text-center text-typography-700">{disk.pending ?? 0}</Text>
                          <Box className="w-20 items-center">{badgeStatus(disk.status) || badgeStatus(disk.healthStatus)}</Box>
                          <HStack className="w-20 justify-end gap-2">
                            <Button action="default" variant="outline" size="sm" onPress={() => setSelfTestTarget(disk)}>
                              <ButtonIcon as={Activity} size="sm" />
                            </Button>
                            <Button action="default" variant="outline" size="sm" onPress={() => handleOpenDetail(disk)}>
                              <ButtonIcon as={ChevronDownIcon} size="sm" />
                            </Button>
                          </HStack>
                        </HStack>
                      ))}
                    </>
                  )}
                </Box>
              </Box>

              <Box className="mt-6 rounded-2xl bg-background-0 border border-background-200 shadow-soft-1">
                <HStack className="px-4 py-3 items-center justify-between">
                  <Text className="text-typography-900 font-semibold text-base">Scheduled Tests</Text>
                  <Text className="text-typography-600 text-sm">{schedules.length} items</Text>
                </HStack>
                <Divider />
                {schedules.length === 0 ? (
                  <Box className="p-4">
                    <Text className="text-typography-600 text-sm">No schedules.</Text>
                  </Box>
                ) : (
                  <VStack className="divide-y divide-background-200">
                    {schedules.map((sched) => (
                      <HStack key={sched.id} className="px-4 py-3 items-center flex-wrap gap-2">
                        <Text className="flex-1 text-typography-900 font-semibold">{getDeviceLabel(sched.device, disks, deviceMeta)}</Text>
                        <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                          <BadgeText className="text-xs text-typography-800">{sched.type}</BadgeText>
                        </Badge>
                        <Text className="w-28 text-typography-700">{WEEK_DAYS[sched.week_day] ?? sched.week_day}</Text>
                        <Text className="w-16 text-typography-700">{`${String(sched.hour).padStart(2, "0")}:00`}</Text>
                        <Badge className="rounded-full px-3 py-1" size="sm" action={sched.active ? "success" : "muted"} variant="solid">
                          <BadgeText className="text-xs text-typography-800">{sched.active ? "Active" : "Inactive"}</BadgeText>
                        </Badge>
                        <HStack className="gap-2 ml-auto">
                          <Button
                            action="default"
                            variant="outline"
                            size="sm"
                            onPress={() => toggleSchedule(sched)}
                            isDisabled={savingAction === `sched-${sched.id}`}
                          >
                            {savingAction === `sched-${sched.id}` ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                          </Button>
                          <Button
                            action="negative"
                            variant="outline"
                            size="sm"
                            onPress={() => handleDeleteSchedule(sched)}
                            isDisabled={savingAction === `sched-del-${sched.id}`}
                          >
                            {savingAction === `sched-del-${sched.id}` ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
                          </Button>
                        </HStack>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Box>
            </>
          )}
        </Box>
      </ScrollView>

      <Modal isOpen={selfTestTarget !== null} onClose={() => setSelfTestTarget(null)} size="md">
        <ModalBackdrop />
        <ModalContent className="max-w-xl">
          <ModalHeader className="flex-row items-start justify-between">
            <Heading size="md" className="text-typography-900">
              Run Self-Test
            </Heading>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4">
            <Text className="text-typography-700">{selfTestTarget ? formatDeviceDisplay(selfTestTarget) : ""}</Text>
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Test Type</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={scheduleForm.type}
                onValueChange={(val) => setScheduleForm((prev) => ({ ...prev, type: val }))}
              >
                <SelectTrigger>
                  <SelectInput placeholder="Select" value={scheduleForm.type} />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {TEST_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} label={t.label} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
              <FormControlHelper>
                <FormControlHelperText>Quick or extended test.</FormControlHelperText>
              </FormControlHelper>
            </FormControl>
          </ModalBody>
          <ModalFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setSelfTestTarget(null)} isDisabled={savingAction === "selftest"}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button action="primary" onPress={handleStartSelfTest} isDisabled={savingAction === "selftest"}>
              {savingAction === "selftest" ? <ButtonSpinner /> : <ButtonIcon as={Play} size="sm" />}
              <ButtonText>Start Test</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={scheduleModal} onClose={() => setScheduleModal(false)} size="lg">
        <ModalBackdrop />
        <ModalContent className="max-w-2xl">
          <ModalHeader className="flex-row items-start justify-between">
            <VStack>
              <Heading size="md" className="text-typography-900">
                New Schedule
              </Heading>
              <Text className="text-typography-600 text-sm">Schedule automatic SMART tests</Text>
            </VStack>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4">
            <FormControl isRequired>
              <FormControlLabel>
                <FormControlLabelText>Device</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={scheduleForm.device}
                onValueChange={(val) => setScheduleForm((prev) => ({ ...prev, device: val }))}
              >
                <SelectTrigger>
                  <SelectInput placeholder="Select disk" value={getDeviceLabel(scheduleForm.device, disks, deviceMeta)} />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {(Array.isArray(deviceOptions) ? deviceOptions : []).map((dev) => {
                      const label = getDeviceLabel(dev, disks, deviceMeta);
                      return <SelectItem key={dev} value={dev} label={label} />;
                    })}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Test Type</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={scheduleForm.type}
                onValueChange={(val) => setScheduleForm((prev) => ({ ...prev, type: val }))}
              >
                <SelectTrigger>
                  <SelectInput placeholder="Select" value={scheduleForm.type} />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {TEST_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} label={t.label} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Day of the Week</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={String(scheduleForm.week_day)}
                onValueChange={(val) => setScheduleForm((prev) => ({ ...prev, week_day: Number(val) }))}
              >
                <SelectTrigger>
                  <SelectInput placeholder="Day" value={String(scheduleForm.week_day)} />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {WEEK_DAYS.map((day, idx) => (
                      <SelectItem key={idx} value={String(idx)} label={day} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Hour</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={String(scheduleForm.hour)}
                onValueChange={(val) => setScheduleForm((prev) => ({ ...prev, hour: Number(val) }))}
              >
                <SelectTrigger>
                  <SelectInput placeholder="Hour" value={String(scheduleForm.hour)} />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {HOURS.map((h) => (
                      <SelectItem key={h.value} value={String(h.value)} label={h.label} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

            <HStack className="items-center gap-2">
              <Switch
                value={scheduleForm.active}
                onValueChange={(val) => setScheduleForm((prev) => ({ ...prev, active: val }))}
              />
              <Text className="text-typography-800">Active schedule</Text>
            </HStack>
          </ModalBody>
          <ModalFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setScheduleModal(false)} isDisabled={savingAction === "schedule"}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button action="primary" onPress={handleScheduleSave} isDisabled={savingAction === "schedule"}>
              {savingAction === "schedule" ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
              <ButtonText>Create</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={diskDetail !== null} onClose={() => setDiskDetail(null)} size="lg">
        <ModalBackdrop />
        <ModalContent className="max-w-3xl max-h-[90vh]">
          <ModalHeader className="flex-row items-start justify-between">
            <VStack>
              <Heading size="md" className="text-typography-900">
                Disk Details
              </Heading>
              <Text className="text-typography-600">{diskDetail ? formatDeviceDisplay(diskDetail) : ""}</Text>
            </VStack>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4 max-h-[70vh]">
            <Box className="p-3 rounded-xl border border-background-200 bg-background-50">
              <Text className="text-typography-800 font-semibold mb-2">General Information</Text>
              <VStack className="gap-2">
                <Text className="text-typography-700">Modelo: {diskDetail?.model || "—"}</Text>
                <Text className="text-typography-700">Serial: {diskDetail?.serial || "—"}</Text>
                <Text className="text-typography-700">Firmware: {diskDetail?.firmware || "—"}</Text>
                <Text className="text-typography-700">Capacidade: {diskDetail?.capacity || "—"}</Text>
                <Text className="text-typography-700">Power On Hours: {diskDetail?.powerOnHours ?? "—"}</Text>
              </VStack>
            </Box>

            <Box className="p-3 rounded-xl border border-background-200">
              <Text className="text-typography-800 font-semibold mb-2">Health Status</Text>
              <HStack className="gap-3 items-center flex-wrap">
                <Text className="text-typography-700">Health Status: {diskDetail?.healthStatus || diskDetail?.status || "—"}</Text>
                <Text className="text-typography-700">SMART Passed: {diskDetail?.smartPassed ? "Yes" : "No"}</Text>
                {diskDetail?.recommendedAction ? (
                  <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                    <BadgeText className="text-xs text-typography-800">{diskDetail.recommendedAction}</BadgeText>
                  </Badge>
                ) : null}
              </HStack>
              <HStack className="gap-4 mt-3 flex-wrap">
                <HStack className="items-center gap-2">
                  <ThermometerSun size={16} color="#0f172a" />
                  <Text className="text-typography-700">Max Temp: {diskDetail?.maxTemp ?? "—"}</Text>
                </HStack>
                <HStack className="items-center gap-2">
                  <ThermometerSnowflake size={16} color="#0f172a" />
                  <Text className="text-typography-700">Min Temp: {diskDetail?.minTemp ?? "—"}</Text>
                </HStack>
                <Text className="text-typography-700">Power Cycles: {diskDetail?.powerCycles ?? "—"}</Text>
              </HStack>
            </Box>

            <Box className="p-3 rounded-xl border border-background-200">
              <Text className="text-typography-800 font-semibold mb-2">SMART Metrics</Text>
              <VStack className="gap-1">
                <Text className="text-typography-700">Reallocated Sectors: {diskDetail?.metrics?.reallocatedSectors ?? "—"}</Text>
                <Text className="text-typography-700">Reallocated Event Count: {diskDetail?.metrics?.reallocatedEventCount ?? "—"}</Text>
                <Text className="text-typography-700">Pending Sectors: {diskDetail?.metrics?.pendingSectors ?? "—"}</Text>
                <Text className="text-typography-700">Offline Uncorrectable: {diskDetail?.metrics?.offlineUncorrectable ?? "—"}</Text>
              </VStack>
            </Box>

            <Box className="p-3 rounded-xl border border-background-200">
              <Text className="text-typography-800 font-semibold mb-2">Self-Tests History</Text>
              {diskDetail?.testsHistory && diskDetail.testsHistory.length > 0 ? (
                <VStack className="gap-2">
                  {diskDetail.testsHistory.map((t, idx) => (
                    <Box key={idx} className="p-2 rounded-lg border border-background-200 bg-background-50">
                      <Text className="text-typography-900 font-semibold">{t.type || "Test"}</Text>
                      <Text className="text-typography-700 text-sm">Status: {t.status || "—"}</Text>
                      <Text className="text-typography-700 text-sm">Lifetime Hours: {t.lifetimeHours ?? "—"}</Text>
                    </Box>
                  ))}
                </VStack>
              ) : (
                <Text className="text-typography-600 text-sm">No history available.</Text>
              )}
            </Box>

            <Box className="p-3 rounded-xl border border-background-200">
              <Text className="text-typography-800 font-semibold mb-2">Reallocate</Text>
              <HStack className="gap-2 flex-wrap">
                <Button
                  action="primary"
                  variant="outline"
                  onPress={() => diskDetail?.device && performReallocAction("realloc-full", () => reallocFullWipe(selectedMachine, diskDetail.device))}
                  isDisabled={savingAction === "realloc-full"}
                >
                  {savingAction === "realloc-full" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                  <ButtonText>Full Wipe</ButtonText>
                </Button>
                <Button
                  action="default"
                  variant="outline"
                  onPress={() => diskDetail?.device && performReallocAction("realloc-non", () => reallocNonDestructive(selectedMachine, diskDetail.device))}
                  isDisabled={savingAction === "realloc-non"}
                >
                  {savingAction === "realloc-non" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                  <ButtonText>Non-Destructive</ButtonText>
                </Button>
                <Button
                  action="negative"
                  variant="outline"
                  onPress={() => diskDetail?.device && performReallocAction("realloc-cancel", () => reallocCancel(selectedMachine, diskDetail.device))}
                  isDisabled={savingAction === "realloc-cancel"}
                >
                  {savingAction === "realloc-cancel" ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
                  <ButtonText>Cancel</ButtonText>
                </Button>
              </HStack>
            </Box>
          </ModalBody>
          <ModalFooter className="gap-3">
            <Button action="primary" onPress={() => setDiskDetail(null)}>
              <ButtonText>Close</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
