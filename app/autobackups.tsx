import React from "react";
import {ScrollView, RefreshControl, useColorScheme, Alert, Platform} from "react-native";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {VStack} from "@/components/ui/vstack";
import {HStack} from "@/components/ui/hstack";
import {Button, ButtonText, ButtonIcon, ButtonSpinner} from "@/components/ui/button";
import {Badge, BadgeText} from "@/components/ui/badge";
import {Input, InputField} from "@/components/ui/input";
import {Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton} from "@/components/ui/modal";
import {Select, SelectTrigger, SelectInput, SelectItem, SelectIcon, SelectPortal, SelectBackdrop as SelectBackdropContent, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper} from "@/components/ui/select";
import {Checkbox, CheckboxIndicator, CheckboxIcon, CheckboxLabel} from "@/components/ui/checkbox";
import {ChevronDownIcon} from "@/components/ui/icon";
import {Toast, ToastTitle, useToast} from "@/components/ui/toast";
import {Fab, FabIcon, FabLabel} from "@/components/ui/fab";
import {Calendar, Database, TrendingUp, RefreshCw, Trash2, Edit, Power, PowerOff, Plus, Clock, Check} from "lucide-react-native";

// Interfaces TypeScript
interface AutoBackup {
  id: string;
  vmName: string;
  machineName: string;
  frequencyDays: number;
  minTime: string; // HH:MM
  maxTime: string; // HH:MM
  nfsShareId: number;
  retention: number; // número de backups a manter
  lastBackup: Date | null;
  isEnabled: boolean;
  isLive: boolean;
}

interface AutoBackupStats {
  total: number;
  active: number;
  totalVms: number;
  avgFrequency: number;
}

// Mock Data
const MOCK_AUTO_BACKUPS: AutoBackup[] = [
  {
    id: "ab-001",
    vmName: "IEOP",
    machineName: "marques512sv",
    frequencyDays: 1,
    minTime: "03:00",
    maxTime: "05:00",
    nfsShareId: 1,
    retention: 7,
    lastBackup: new Date("2025-11-27T03:30:00"),
    isEnabled: true,
    isLive: false,
  },
  {
    id: "ab-002",
    vmName: "test",
    machineName: "marques2673sv",
    frequencyDays: 7,
    minTime: "02:00",
    maxTime: "04:00",
    nfsShareId: 2,
    retention: 4,
    lastBackup: new Date("2025-11-23T02:45:00"),
    isEnabled: true,
    isLive: true,
  },
  {
    id: "ab-003",
    vmName: "win10",
    machineName: "marques512sv",
    frequencyDays: 30,
    minTime: "01:00",
    maxTime: "03:00",
    nfsShareId: 1,
    retention: 3,
    lastBackup: null,
    isEnabled: false,
    isLive: false,
  },
  {
    id: "ab-004",
    vmName: "test",
    machineName: "marques2673sv",
    frequencyDays: 1,
    minTime: "04:00",
    maxTime: "06:00",
    nfsShareId: 2,
    retention: 14,
    lastBackup: new Date("2025-11-27T04:15:00"),
    isEnabled: true,
    isLive: false,
  },
];

const NFS_SHARES: Record<number, string> = {
  1: "marques512sv_500gymKlE2",
  2: "marques2673sv_testeraidRItPmt",
};

const FREQUENCY_OPTIONS = [
  {label: "Diário", value: 1},
  {label: "Semanal", value: 7},
  {label: "Mensal", value: 30},
];

export default function AutoBackupsScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const [schedules, setSchedules] = React.useState<AutoBackup[]>(MOCK_AUTO_BACKUPS);
  const [loading, setLoading] = React.useState(false);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [editSchedule, setEditSchedule] = React.useState<AutoBackup | null>(null);
  
  // Form state
  const [formVm, setFormVm] = React.useState("");
  const [formFrequency, setFormFrequency] = React.useState(1);
  const [formMinTime, setFormMinTime] = React.useState("");
  const [formMaxTime, setFormMaxTime] = React.useState("");
  const [formNfsShare, setFormNfsShare] = React.useState<number | null>(null);
  const [formRetention, setFormRetention] = React.useState("");
  const [formIsLive, setFormIsLive] = React.useState(false);

  // Agrupar schedules por VM
  const schedulesByVm = React.useMemo(() => {
    const grouped: Record<string, AutoBackup[]> = {};
    schedules.forEach((schedule) => {
      const key = `${schedule.vmName}@${schedule.machineName}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(schedule);
    });
    // Ordenar schedules por frequência (ascendente)
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => a.frequencyDays - b.frequencyDays);
    });
    return grouped;
  }, [schedules]);

  // Estatísticas
  const stats: AutoBackupStats = React.useMemo(() => {
    const total = schedules.length;
    const active = schedules.filter((s) => s.isEnabled).length;
    const uniqueVms = new Set(schedules.map((s) => `${s.vmName}@${s.machineName}`));
    const totalVms = uniqueVms.size;
    const avgFrequency = total > 0
      ? Math.round(schedules.reduce((sum, s) => sum + s.frequencyDays, 0) / total)
      : 0;
    return {total, active, totalVms, avgFrequency};
  }, [schedules]);

  const getFrequencyLabel = (days: number): string => {
    if (days === 1) return "Diário";
    if (days === 7) return "Semanal";
    if (days === 30) return "Mensal";
    return `${days} dias`;
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "Nunca";
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getNfsName = (id: number): string => {
    return NFS_SHARES[id] || `NFS #${id}`;
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await new Promise((res) => setTimeout(res, 800));
      toast.show({
        placement: "top",
        render: ({id}) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action="success"
          >
            <ToastTitle size="sm">Agendamentos atualizados</ToastTitle>
          </Toast>
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = (schedule: AutoBackup) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === schedule.id ? {...s, isEnabled: !s.isEnabled} : s
      )
    );
    toast.show({
      placement: "top",
      render: ({id}) => (
        <Toast
          nativeID={"toast-" + id}
          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
          action="success"
        >
          <ToastTitle size="sm">
            Agendamento {!schedule.isEnabled ? "ativado" : "desativado"}
          </ToastTitle>
        </Toast>
      ),
    });
  };

  const handleEdit = (schedule: AutoBackup) => {
    setEditSchedule(schedule);
    setFormVm(`${schedule.vmName}@${schedule.machineName}`);
    setFormFrequency(schedule.frequencyDays);
    setFormMinTime(schedule.minTime);
    setFormMaxTime(schedule.maxTime);
    setFormNfsShare(schedule.nfsShareId);
    setFormRetention(String(schedule.retention));
    setFormIsLive(schedule.isLive);
    setShowCreateModal(true);
  };

  const handleDelete = (schedule: AutoBackup) => {
    Alert.alert(
      "Confirmar Exclusão",
      `Tem certeza que deseja apagar o agendamento de ${schedule.vmName}?`,
      [
        {text: "Cancelar", style: "cancel"},
        {
          text: "Apagar",
          style: "destructive",
          onPress: () => {
            setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
            toast.show({
              placement: "top",
              render: ({id}) => (
                <Toast
                  nativeID={"toast-" + id}
                  className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                  action="success"
                >
                  <ToastTitle size="sm">Agendamento apagado</ToastTitle>
                </Toast>
              ),
            });
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormVm("");
    setFormFrequency(1);
    setFormMinTime("");
    setFormMaxTime("");
    setFormNfsShare(null);
    setFormRetention("");
    setFormIsLive(false);
    setEditSchedule(null);
  };

  const handleSubmit = () => {
    if (!formVm || !formNfsShare) {
      toast.show({
        placement: "top",
        render: ({id}) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action="error"
          >
            <ToastTitle size="sm">Preencha todos os campos obrigatórios</ToastTitle>
          </Toast>
        ),
      });
      return;
    }

    const [vmName, machineName] = formVm.split("@");

    if (editSchedule) {
      // Editar
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === editSchedule.id
            ? {
                ...s,
                vmName,
                machineName,
                frequencyDays: formFrequency,
                minTime: formMinTime,
                maxTime: formMaxTime,
                nfsShareId: formNfsShare,
                retention: Number(formRetention) || 7,
                isLive: formIsLive,
              }
            : s
        )
      );
      toast.show({
        placement: "top",
        render: ({id}) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action="success"
          >
            <ToastTitle size="sm">Agendamento atualizado</ToastTitle>
          </Toast>
        ),
      });
    } else {
      // Criar
      const newSchedule: AutoBackup = {
        id: `ab-${Date.now()}`,
        vmName,
        machineName,
        frequencyDays: formFrequency,
        minTime: formMinTime,
        maxTime: formMaxTime,
        nfsShareId: formNfsShare,
        retention: Number(formRetention) || 7,
        lastBackup: null,
        isEnabled: true,
        isLive: formIsLive,
      };
      setSchedules((prev) => [...prev, newSchedule]);
      toast.show({
        placement: "top",
        render: ({id}) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action="success"
          >
            <ToastTitle size="sm">Agendamento criado</ToastTitle>
          </Toast>
        ),
      });
    }

    setShowCreateModal(false);
    resetForm();
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
                Configure agendamentos automáticos de backup para suas VMs com
                controle de frequência e retenção.
              </Text>
            </VStack>
            {/* Botão desktop */}
            <Box className="hidden web:flex">
              <Button
                size="md"
                onPress={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="rounded-lg bg-typography-900 dark:bg-[#E8EBF0]"
              >
                <ButtonIcon
                  as={Plus}
                  className="text-background-0 dark:text-typography-900"
                />
                <ButtonText className="text-background-0 dark:text-typography-900">
                  Novo Agendamento
                </ButtonText>
              </Button>
            </Box>
          </HStack>

          {/* Stats Overview */}
          <HStack className="mb-6 mt-6 gap-4 flex-wrap web:grid web:grid-cols-4">
            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Calendar size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Total Agendamentos
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
                <Power size={16} className="text-[#2DD4BF] dark:text-[#5EEAD4]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Ativos
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
                <Database size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  VMs
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {stats.totalVms}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Média Frequência
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {stats.avgFrequency} dias
              </Text>
            </Box>
          </HStack>

          {/* Schedules List */}
          {Object.keys(schedulesByVm).length === 0 ? (
            <Box className="p-8 web:rounded-2xl web:bg-background-0/80 dark:web:bg-[#151F30]/80">
              <VStack className="items-center gap-4">
                <Calendar size={48} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-typography-900 dark:text-[#E8EBF0] text-lg text-center"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Nenhum agendamento encontrado
                </Text>
                <Text
                  className="text-[#9AA4B8] dark:text-[#8A94A8] text-center"
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  Crie seu primeiro agendamento automático
                </Text>
              </VStack>
            </Box>
          ) : (
            <VStack className="gap-6">
              {Object.entries(schedulesByVm).map(([key, vmSchedules]) => {
                const [vmName, machineName] = key.split("@");
                return (
                  <Box
                    key={key}
                    className="rounded-2xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] overflow-hidden web:shadow-md dark:web:shadow-none"
                  >
                    {/* Header */}
                    <Box className="border-b border-outline-100 dark:border-[#2A3B52] p-4 web:p-6">
                      <Heading
                        size="lg"
                        className="text-typography-900 dark:text-[#E8EBF0] mb-1"
                        style={{fontFamily: "Inter_700Bold"}}
                      >
                        {vmName}
                      </Heading>
                      <Text
                        className="text-sm text-[#9AA4B8] dark:text-[#8A94A8]"
                        style={{fontFamily: "Inter_400Regular"}}
                      >
                        {machineName} • {vmSchedules.length} agendamento
                        {vmSchedules.length > 1 ? "s" : ""}
                      </Text>
                    </Box>

                    {/* Table */}
                    <Box className="overflow-x-auto">
                      <Box className="min-w-[1000px]">
                        {/* Table Header */}
                        <HStack className="bg-background-50 dark:bg-[#0A1628] px-4 py-3 border-b border-outline-100 dark:border-[#1E2F47]">
                          <Text
                            className="w-[60px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            ID
                          </Text>
                          <Text
                            className="w-[120px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            FREQUÊNCIA
                          </Text>
                          <Text
                            className="w-[150px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            HORÁRIO
                          </Text>
                          <Text
                            className="flex-1 min-w-[150px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            NFS SHARE
                          </Text>
                          <Text
                            className="w-[100px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            RETENÇÃO
                          </Text>
                          <Text
                            className="w-[150px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            ÚLTIMO BACKUP
                          </Text>
                          <Text
                            className="w-[80px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            STATUS
                          </Text>
                          <Text
                            className="w-[140px] text-xs text-[#9AA4B8] dark:text-[#8A94A8] text-right"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            AÇÕES
                          </Text>
                        </HStack>

                        {/* Table Rows */}
                        {vmSchedules.map((schedule, index) => (
                          <HStack
                            key={schedule.id}
                            className={`px-4 py-3 items-center ${
                              index !== vmSchedules.length - 1
                                ? "border-b border-outline-100 dark:border-[#1E2F47]"
                                : ""
                            }`}
                          >
                            <Text
                              className="w-[60px] text-xs text-typography-600 dark:text-typography-400"
                              style={{fontFamily: "Inter_400Regular"}}
                            >
                              #{schedule.id.split("-")[1]}
                            </Text>
                            <Text
                              className="w-[120px] text-sm text-typography-900 dark:text-[#E8EBF0]"
                              style={{fontFamily: "Inter_500Medium"}}
                            >
                              {getFrequencyLabel(schedule.frequencyDays)}
                            </Text>
                            <HStack className="w-[150px] items-center gap-1">
                              <Clock size={14} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                              <Text
                                className="text-sm text-typography-900 dark:text-[#E8EBF0]"
                                style={{fontFamily: "Inter_400Regular"}}
                              >
                                {schedule.minTime} - {schedule.maxTime}
                              </Text>
                            </HStack>
                            <Text
                              className="flex-1 min-w-[150px] text-sm text-typography-600 dark:text-typography-400"
                              style={{fontFamily: "Inter_400Regular"}}
                            >
                              {getNfsName(schedule.nfsShareId)}
                            </Text>
                            <Text
                              className="w-[100px] text-sm text-typography-900 dark:text-[#E8EBF0]"
                              style={{fontFamily: "Inter_400Regular"}}
                            >
                              {schedule.retention} backups
                            </Text>
                            <Text
                              className="w-[150px] text-sm text-typography-600 dark:text-typography-400"
                              style={{fontFamily: "Inter_400Regular"}}
                            >
                              {formatDate(schedule.lastBackup)}
                            </Text>
                            <Box className="w-[80px]">
                              <Badge
                                size="sm"
                                variant="outline"
                                className={`rounded-full w-fit ${
                                  schedule.isEnabled
                                    ? "bg-[#2dd4be19] border-[#2DD4BF] dark:bg-[#2DD4BF25] dark:border-[#5EEAD4]"
                                    : "bg-[#94a3b819] border-[#94A3B8] dark:bg-[#94A3B825] dark:border-[#CBD5E1]"
                                }`}
                              >
                                <BadgeText
                                  className={`text-xs ${
                                    schedule.isEnabled
                                      ? "text-[#2DD4BF] dark:text-[#5EEAD4]"
                                      : "text-[#64748B] dark:text-[#94A3B8]"
                                  }`}
                                  style={{fontFamily: "Inter_500Medium"}}
                                >
                                  {schedule.isEnabled ? "Ativo" : "Inativo"}
                                </BadgeText>
                              </Badge>
                            </Box>
                            <HStack className="w-[140px] gap-1 justify-end">
                              <Button
                                size="xs"
                                variant="outline"
                                className={`rounded-md ${
                                  !schedule.isEnabled
                                    ? "border-green-500"
                                    : ""
                                }`}
                                onPress={() => handleToggleEnabled(schedule)}
                              >
                                <ButtonIcon
                                  as={schedule.isEnabled ? PowerOff : Power}
                                  size="xs"
                                  className={
                                    schedule.isEnabled
                                      ? "text-typography-700 dark:text-[#E8EBF0]"
                                      : "text-green-500"
                                  }
                                />
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className="rounded-md"
                                onPress={() => handleEdit(schedule)}
                              >
                                <ButtonIcon
                                  as={Edit}
                                  size="xs"
                                  className="text-typography-700 dark:text-[#E8EBF0]"
                                />
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className="rounded-md border-red-500"
                                onPress={() => handleDelete(schedule)}
                              >
                                <ButtonIcon
                                  as={Trash2}
                                  size="xs"
                                  className="text-red-500"
                                />
                              </Button>
                            </HStack>
                          </HStack>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </VStack>
          )}
        </Box>
      </ScrollView>

      {/* FAB - Mobile only */}
      {Platform.OS !== "web" && (
        <Fab
          size="lg"
          placement="bottom right"
          className="bg-typography-900 dark:bg-[#E8EBF0] shadow-lg"
          onPress={() => {
            resetForm();
            setShowCreateModal(true);
          }}
        >
          <FabIcon as={Plus} className="text-background-0 dark:text-typography-900" />
        </Fab>
      )}

      {/* Modal: Criar/Editar Agendamento */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4">
            <Heading 
              size="lg" 
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{fontFamily: "Inter_700Bold"}}
            >
              {editSchedule ? "Editar" : "Novo"} Agendamento
            </Heading>
            <ModalCloseButton className="text-typography-600 dark:text-typography-400" />
          </ModalHeader>
          <ModalBody className="py-4">
            <VStack className="gap-5">
              <VStack className="gap-2">
                <Text 
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  VM <Text className="text-red-500 dark:text-[#f87171]">*</Text>
                </Text>
                <Select>
                  <SelectTrigger variant="outline" size="md" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                    <SelectInput
                      placeholder="Selecione uma VM..."
                      value={formVm}
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                    <SelectIcon className="mr-3 text-typography-500 dark:text-typography-400" as={ChevronDownIcon} />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdropContent />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      <SelectItem
                        label="IEOP (marques512sv)"
                        value="IEOP@marques512sv"
                      />
                      <SelectItem
                        label="test (marques2673sv)"
                        value="test@marques2673sv"
                      />
                      <SelectItem
                        label="win10 (marques512sv)"
                        value="win10@marques512sv"
                      />
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </VStack>

              <VStack className="gap-2">
                <Text 
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Frequência
                </Text>
                <Select>
                  <SelectTrigger variant="outline" size="md" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                    <SelectInput
                      placeholder={getFrequencyLabel(formFrequency)}
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                    <SelectIcon className="mr-3 text-typography-500 dark:text-typography-400" as={ChevronDownIcon} />
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

              <HStack className="gap-3">
                <VStack className="gap-2 flex-1">
                  <Text 
                    className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                    style={{fontFamily: "Inter_500Medium"}}
                  >
                    Horário Mínimo
                  </Text>
                  <Input 
                    variant="outline" 
                    className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                  >
                    <InputField
                      placeholder="HH:MM"
                      value={formMinTime}
                      onChangeText={setFormMinTime}
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                  </Input>
                </VStack>
                <VStack className="gap-2 flex-1">
                  <Text 
                    className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                    style={{fontFamily: "Inter_500Medium"}}
                  >
                    Horário Máximo
                  </Text>
                  <Input 
                    variant="outline" 
                    className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                  >
                    <InputField
                      placeholder="HH:MM"
                      value={formMaxTime}
                      onChangeText={setFormMaxTime}
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                  </Input>
                </VStack>
              </HStack>

              <VStack className="gap-2">
                <Text 
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  NFS Share <Text className="text-red-500 dark:text-[#f87171]">*</Text>
                </Text>
                <Select>
                  <SelectTrigger variant="outline" size="md" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                    <SelectInput
                      placeholder="Selecione um NFS..."
                      value={formNfsShare ? getNfsName(formNfsShare) : ""}
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                    <SelectIcon className="mr-3 text-typography-500 dark:text-typography-400" as={ChevronDownIcon} />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdropContent />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      <SelectItem
                        label={getNfsName(1)}
                        value="1"
                      />
                      <SelectItem
                        label={getNfsName(2)}
                        value="2"
                      />
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </VStack>

              <VStack className="gap-2">
                <Text 
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Retenção (backups)
                </Text>
                <Input 
                  variant="outline" 
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                >
                  <InputField
                    placeholder="7"
                    keyboardType="numeric"
                    value={formRetention}
                    onChangeText={setFormRetention}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </VStack>

              <Checkbox
                value="live"
                isChecked={formIsLive}
                onChange={setFormIsLive}
                className="gap-3 items-center"
              >
                <CheckboxIndicator className="border-outline-200 dark:border-[#2A3B52]">
                  <CheckboxIcon as={Check} className="text-typography-900 dark:text-[#E8EBF0]" />
                </CheckboxIndicator>
                <CheckboxLabel 
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  Live Backup (sem parar VM)
                </CheckboxLabel>
              </Checkbox>
            </VStack>
          </ModalBody>
          <ModalFooter className="pt-6 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="justify-end gap-3 w-full">
              <Button
                variant="outline"
                className="rounded-lg px-6 py-2.5 border-outline-200 dark:border-[#2A3B52]"
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                <ButtonText 
                  className="text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Cancelar
                </ButtonText>
              </Button>
              <Button
                className="rounded-lg px-6 py-2.5 bg-typography-900 dark:bg-[#E8EBF0]"
                onPress={handleSubmit}
              >
                <ButtonText 
                  className="text-background-0 dark:text-typography-900"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  {editSchedule ? "Salvar" : "Criar"}
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
