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
  { value: "extended", label: "Extended Self-Test (mais demorado)" },
];

const WEEK_DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const HOURS = Array.from({ length: 24 }).map((_, i) => ({ value: i, label: `${String(i).padStart(2, "0")}:00` }));

const STATUS_COLOR: Record<string, string> = {
  ok: "bg-success-100 text-success-700",
  healthy: "bg-success-100 text-success-700",
  atenção: "bg-warning-100 text-warning-700",
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
      showToast("Erro ao carregar máquinas", "Tente novamente.", "error");
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
          showToast("Erro ao carregar", "Não foi possível obter os dados do SmartDisk.", "error");
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
      showToast("Self-test iniciado", `${selfTestTarget.device} em execução.`);
      setSelfTestTarget(null);
    } catch (err) {
      console.error("Failed to start self-test", err);
      showToast("Erro ao iniciar teste", "Tente novamente.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const handleScheduleSave = async () => {
    if (!scheduleForm.device) {
      showToast("Dispositivo obrigatório", "Selecione um disco.", "error");
      return;
    }
    setSavingAction("schedule");
    try {
      await createSchedule(selectedMachine, scheduleForm);
      showToast("Agendamento criado", "Teste será executado automaticamente.");
      setScheduleModal(false);
      await loadData("silent");
    } catch (err) {
      console.error("Failed to create schedule", err);
      showToast("Erro ao agendar", "Tente novamente.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const toggleSchedule = async (sched: SmartDiskSchedule) => {
    setSavingAction(`sched-${sched.id}`);
    try {
      await enableSchedule(selectedMachine, sched.id, !sched.active);
      showToast("Agendamento atualizado", sched.active ? "Agendamento desativado." : "Agendamento ativado.");
      await loadData("silent");
    } catch (err) {
      console.error("Failed to toggle schedule", err);
      showToast("Erro ao atualizar agendamento", "Tente novamente.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const handleDeleteSchedule = async (sched: SmartDiskSchedule) => {
    setSavingAction(`sched-del-${sched.id}`);
    try {
      await deleteSchedule(selectedMachine, sched.id);
      showToast("Agendamento removido", "Agendamento excluído.");
      await loadData("silent");
    } catch (err) {
      console.error("Failed to delete schedule", err);
      showToast("Erro ao remover agendamento", "Tente novamente.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const badgeStatus = (status?: string) => {
    if (!status) return null;
    const key = status.toLowerCase();
    const cls = STATUS_COLOR[key] ?? "bg-background-100 text-typography-800";
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
      showToast("Ação enviada", "Reallocate acionado.");
    } catch (err) {
      console.error("Failed realloc action", err);
      showToast("Erro na ação", "Tente novamente.", "error");
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
            Monitoramento SMART e testes de disco.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <HStack className="gap-3 items-center flex-wrap">
              <Select selectedValue={selectedMachine} onValueChange={(val) => setSelectedMachine(val)}>
                <SelectTrigger className="min-w-[180px]">
                  <SelectInput placeholder="Máquina" value={selectedMachine} />
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
                <ButtonText>Atualizar</ButtonText>
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
              <ButtonText>Novo Agendamento</ButtonText>
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
                  <Text className="text-typography-900 font-semibold text-base">Discos</Text>
                  <Text className="text-typography-600 text-sm">{disks.length} itens</Text>
                </HStack>
                <Divider />
                <Box className="px-4 py-2">
                  {(Array.isArray(disks) ? disks : []).length === 0 ? (
                    <Text className="text-typography-600 text-sm py-3">Nenhum disco elegível encontrado para esta máquina.</Text>
                  ) : (
                    <>
                      <HStack className="py-2">
                        <Text className="flex-1 text-typography-700 font-semibold">Dispositivo</Text>
                        <Text className="flex-1 text-typography-700 font-semibold">Modelo</Text>
                        <Text className="w-16 text-typography-700 font-semibold">Temp</Text>
                        <Text className="w-24 text-typography-700 font-semibold text-center">Realocados</Text>
                        <Text className="w-24 text-typography-700 font-semibold text-center">Pending</Text>
                        <Text className="w-20 text-typography-700 font-semibold text-center">Status</Text>
                        <Text className="w-20 text-typography-700 font-semibold text-center">Ações</Text>
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
                  <Text className="text-typography-900 font-semibold text-base">Testes Agendados</Text>
                  <Text className="text-typography-600 text-sm">{schedules.length} itens</Text>
                </HStack>
                <Divider />
                {schedules.length === 0 ? (
                  <Box className="p-4">
                    <Text className="text-typography-600 text-sm">Nenhum agendamento.</Text>
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
                          <BadgeText className="text-xs text-typography-800">{sched.active ? "Ativo" : "Inativo"}</BadgeText>
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
              Executar Self-Test
            </Heading>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4">
            <Text className="text-typography-700">{selfTestTarget ? formatDeviceDisplay(selfTestTarget) : ""}</Text>
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Tipo de Teste</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={scheduleForm.type}
                onValueChange={(val) => setScheduleForm((prev) => ({ ...prev, type: val }))}
              >
                <SelectTrigger>
                  <SelectInput placeholder="Selecione" value={scheduleForm.type} />
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
                <FormControlHelperText>Teste rápido ou estendido.</FormControlHelperText>
              </FormControlHelper>
            </FormControl>
          </ModalBody>
          <ModalFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setSelfTestTarget(null)} isDisabled={savingAction === "selftest"}>
              <ButtonText>Cancelar</ButtonText>
            </Button>
            <Button action="primary" onPress={handleStartSelfTest} isDisabled={savingAction === "selftest"}>
              {savingAction === "selftest" ? <ButtonSpinner /> : <ButtonIcon as={Play} size="sm" />}
              <ButtonText>Iniciar Teste</ButtonText>
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
                Novo Agendamento
              </Heading>
              <Text className="text-typography-600 text-sm">Agendar teste SMART automático</Text>
            </VStack>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4">
            <FormControl isRequired>
              <FormControlLabel>
                <FormControlLabelText>Dispositivo</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={scheduleForm.device}
                onValueChange={(val) => setScheduleForm((prev) => ({ ...prev, device: val }))}
              >
                <SelectTrigger>
                  <SelectInput placeholder="Selecionar disco" value={getDeviceLabel(scheduleForm.device, disks, deviceMeta)} />
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
                <FormControlLabelText>Tipo de Teste</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={scheduleForm.type}
                onValueChange={(val) => setScheduleForm((prev) => ({ ...prev, type: val }))}
              >
                <SelectTrigger>
                  <SelectInput placeholder="Selecione" value={scheduleForm.type} />
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
                <FormControlLabelText>Dia da Semana</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={String(scheduleForm.week_day)}
                onValueChange={(val) => setScheduleForm((prev) => ({ ...prev, week_day: Number(val) }))}
              >
                <SelectTrigger>
                  <SelectInput placeholder="Dia" value={String(scheduleForm.week_day)} />
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
                <FormControlLabelText>Hora</FormControlLabelText>
              </FormControlLabel>
              <Select
                selectedValue={String(scheduleForm.hour)}
                onValueChange={(val) => setScheduleForm((prev) => ({ ...prev, hour: Number(val) }))}
              >
                <SelectTrigger>
                  <SelectInput placeholder="Hora" value={String(scheduleForm.hour)} />
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
              <Text className="text-typography-800">Agendamento ativo</Text>
            </HStack>
          </ModalBody>
          <ModalFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setScheduleModal(false)} isDisabled={savingAction === "schedule"}>
              <ButtonText>Cancelar</ButtonText>
            </Button>
            <Button action="primary" onPress={handleScheduleSave} isDisabled={savingAction === "schedule"}>
              {savingAction === "schedule" ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
              <ButtonText>Criar</ButtonText>
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
                Detalhes do Disco
              </Heading>
              <Text className="text-typography-600">{diskDetail ? formatDeviceDisplay(diskDetail) : ""}</Text>
            </VStack>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4 max-h-[70vh]">
            <Box className="p-3 rounded-xl border border-background-200 bg-background-50">
              <Text className="text-typography-800 font-semibold mb-2">Informações Gerais</Text>
              <VStack className="gap-2">
                <Text className="text-typography-700">Modelo: {diskDetail?.model || "—"}</Text>
                <Text className="text-typography-700">Serial: {diskDetail?.serial || "—"}</Text>
                <Text className="text-typography-700">Firmware: {diskDetail?.firmware || "—"}</Text>
                <Text className="text-typography-700">Capacidade: {diskDetail?.capacity || "—"}</Text>
                <Text className="text-typography-700">Power On Hours: {diskDetail?.powerOnHours ?? "—"}</Text>
              </VStack>
            </Box>

            <Box className="p-3 rounded-xl border border-background-200">
              <Text className="text-typography-800 font-semibold mb-2">Status de Saúde</Text>
              <HStack className="gap-3 items-center flex-wrap">
                <Text className="text-typography-700">Health Status: {diskDetail?.healthStatus || diskDetail?.status || "—"}</Text>
                <Text className="text-typography-700">SMART Passed: {diskDetail?.smartPassed ? "Sim" : "Não"}</Text>
                {diskDetail?.recommendedAction ? (
                  <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                    <BadgeText className="text-xs text-typography-800">{diskDetail.recommendedAction}</BadgeText>
                  </Badge>
                ) : null}
              </HStack>
              <HStack className="gap-4 mt-3 flex-wrap">
                <HStack className="items-center gap-2">
                  <ThermometerSun size={16} color="#0f172a" />
                  <Text className="text-typography-700">Temp Máx: {diskDetail?.maxTemp ?? "—"}</Text>
                </HStack>
                <HStack className="items-center gap-2">
                  <ThermometerSnowflake size={16} color="#0f172a" />
                  <Text className="text-typography-700">Temp Mín: {diskDetail?.minTemp ?? "—"}</Text>
                </HStack>
                <Text className="text-typography-700">Power Cycles: {diskDetail?.powerCycles ?? "—"}</Text>
              </HStack>
            </Box>

            <Box className="p-3 rounded-xl border border-background-200">
              <Text className="text-typography-800 font-semibold mb-2">Métricas SMART</Text>
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
                <Text className="text-typography-600 text-sm">Nenhum histórico disponível.</Text>
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
                  <ButtonText>Cancelar</ButtonText>
                </Button>
              </HStack>
            </Box>
          </ModalBody>
          <ModalFooter className="gap-3">
            <Button action="primary" onPress={() => setDiskDetail(null)}>
              <ButtonText>Fechar</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
