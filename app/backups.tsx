import React from "react";
import {ScrollView, RefreshControl, useColorScheme, Alert} from "react-native";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {VStack} from "@/components/ui/vstack";
import {HStack} from "@/components/ui/hstack";
import {Button, ButtonText, ButtonIcon, ButtonSpinner} from "@/components/ui/button";
import {Badge, BadgeText} from "@/components/ui/badge";
import {Input, InputField, InputSlot, InputIcon} from "@/components/ui/input";
import {Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton} from "@/components/ui/modal";
import {Select, SelectTrigger, SelectInput, SelectItem, SelectIcon, SelectPortal, SelectBackdrop as SelectBackdropContent, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper} from "@/components/ui/select";
import {Toast, ToastTitle, useToast} from "@/components/ui/toast";
import {ChevronDownIcon} from "@/components/ui/icon";
import {Search, HardDrive, Calendar, Database, RefreshCw, Trash2, RotateCcw} from "lucide-react-native";

// Interfaces TypeScript
interface Backup {
  id: string;
  vmName: string;
  machineName: string;
  backupDate: Date;
  size: number; // em GB
  nfsShareId: number;
  status: "complete" | "partial" | "failed";
  type: "full" | "incremental";
}

interface BackupStats {
  total: number;
  complete: number;
  totalSize: number; // em GB
  lastBackup: Date | null;
}

// Mock Data
const MOCK_BACKUPS: Backup[] = [
  {
    id: "bkp-001",
    vmName: "IEOP",
    machineName: "marques512sv",
    backupDate: new Date("2025-11-27T03:00:00"),
    size: 45.2,
    nfsShareId: 1,
    status: "complete",
    type: "full",
  },
  {
    id: "bkp-002",
    vmName: "IEOP",
    machineName: "marques512sv",
    backupDate: new Date("2025-11-26T03:00:00"),
    size: 8.5,
    nfsShareId: 1,
    status: "complete",
    type: "incremental",
  },
  {
    id: "bkp-003",
    vmName: "test",
    machineName: "marques2673sv",
    backupDate: new Date("2025-11-27T03:00:00"),
    size: 38.7,
    nfsShareId: 2,
    status: "complete",
    type: "full",
  },
  {
    id: "bkp-004",
    vmName: "win10",
    machineName: "marques512sv",
    backupDate: new Date("2025-11-25T03:00:00"),
    size: 52.1,
    nfsShareId: 1,
    status: "complete",
    type: "full",
  },
  {
    id: "bkp-005",
    vmName: "test",
    machineName: "marques2673sv",
    backupDate: new Date("2025-11-26T03:00:00"),
    size: 5.2,
    nfsShareId: 2,
    status: "complete",
    type: "incremental",
  },
];

const NFS_SHARES: Record<number, string> = {
  1: "marques512sv_500gymKlE2",
  2: "marques2673sv_testeraidRItPmt",
};

export default function BackupsScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const [backups, setBackups] = React.useState<Backup[]>(MOCK_BACKUPS);
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [restoreBackup, setRestoreBackup] = React.useState<Backup | null>(null);
  const [selectedMachine, setSelectedMachine] = React.useState<string>("");

  // Agrupar backups por VM
  const backupsByVm = React.useMemo(() => {
    const filtered = backups.filter(
      (b) =>
        b.vmName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.machineName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const grouped: Record<string, Backup[]> = {};
    filtered.forEach((backup) => {
      const key = `${backup.vmName}@${backup.machineName}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(backup);
    });
    // Ordenar backups por data (mais recente primeiro)
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => b.backupDate.getTime() - a.backupDate.getTime());
    });
    return grouped;
  }, [backups, searchQuery]);

  // Estatísticas
  const stats: BackupStats = React.useMemo(() => {
    const total = backups.length;
    const complete = backups.filter((b) => b.status === "complete").length;
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const lastBackup =
      backups.length > 0
        ? new Date(Math.max(...backups.map((b) => b.backupDate.getTime())))
        : null;
    return {total, complete, totalSize, lastBackup};
  }, [backups]);

  const formatDate = (date: Date): string => {
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
      // Simulação de fetch
      await new Promise((res) => setTimeout(res, 800));
      toast.show({
        placement: "top",
        render: ({id}) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action="success"
          >
            <ToastTitle size="sm">Backups atualizados</ToastTitle>
          </Toast>
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (backup: Backup) => {
    Alert.alert(
      "Confirmar Exclusão",
      `Tem certeza que deseja apagar o backup de ${backup.vmName} (${formatDate(backup.backupDate)})?`,
      [
        {text: "Cancelar", style: "cancel"},
        {
          text: "Apagar",
          style: "destructive",
          onPress: () => {
            setBackups((prev) => prev.filter((b) => b.id !== backup.id));
            toast.show({
              placement: "top",
              render: ({id}) => (
                <Toast
                  nativeID={"toast-" + id}
                  className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                  action="success"
                >
                  <ToastTitle size="sm">Backup apagado</ToastTitle>
                </Toast>
              ),
            });
          },
        },
      ]
    );
  };

  const handleRestoreSubmit = () => {
    if (!restoreBackup || !selectedMachine) return;
    
    toast.show({
      placement: "top",
      render: ({id}) => (
        <Toast
          nativeID={"toast-" + id}
          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
          action="success"
        >
          <ToastTitle size="sm">Restauração iniciada</ToastTitle>
        </Toast>
      ),
    });
    setRestoreBackup(null);
    setSelectedMachine("");
  };

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 64}}
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
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            Backups
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl mb-6">
            Gestão completa de backups das máquinas virtuais com restauração
            rápida e controle de versões.
          </Text>

          {/* Stats Overview */}
          <HStack className="mb-6 gap-4 flex-wrap web:grid web:grid-cols-4">
            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <HardDrive size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Total Backups
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
                <Database size={16} className="text-[#2DD4BF] dark:text-[#5EEAD4]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Completos
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {stats.complete}
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <HardDrive size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Espaço Total
                </Text>
              </HStack>
              <Text
                className="text-2xl text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {stats.totalSize.toFixed(1)} GB
              </Text>
            </Box>

            <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-4">
              <HStack className="items-center gap-2 mb-2">
                <Calendar size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Último Backup
                </Text>
              </HStack>
              <Text
                className="text-sm text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                {stats.lastBackup
                  ? formatDate(stats.lastBackup).split(",")[0]
                  : "N/A"}
              </Text>
            </Box>
          </HStack>

          {/* Search Bar */}
          <HStack className="mb-6 gap-2">
            <Input variant="outline" className="flex-1 rounded-lg">
              <InputSlot className="pl-3">
                <InputIcon as={Search} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
              </InputSlot>
              <InputField
                placeholder="Pesquisar por VM ou slave..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </Input>
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

          {/* Backups List */}
          {Object.keys(backupsByVm).length === 0 ? (
            <Box className="p-8 web:rounded-2xl web:bg-background-0/80 dark:web:bg-[#151F30]/80">
              <VStack className="items-center gap-4">
                <HardDrive size={48} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                <Text
                  className="text-typography-900 dark:text-[#E8EBF0] text-lg text-center"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Nenhum backup encontrado
                </Text>
                <Text
                  className="text-[#9AA4B8] dark:text-[#8A94A8] text-center"
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  {searchQuery
                    ? "Tente ajustar sua pesquisa"
                    : "Os backups aparecerão aqui automaticamente"}
                </Text>
              </VStack>
            </Box>
          ) : (
            <VStack className="gap-6">
              {Object.entries(backupsByVm).map(([key, vmBackups]) => {
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
                        {machineName} • {vmBackups.length} backup
                        {vmBackups.length > 1 ? "s" : ""}
                      </Text>
                    </Box>

                    {/* Table */}
                    <Box className="overflow-x-auto">
                      <Box className="min-w-[800px]">
                        {/* Table Header */}
                        <HStack className="bg-background-50 dark:bg-[#0A1628] px-4 py-3 border-b border-outline-100 dark:border-[#1E2F47]">
                          <Text
                            className="flex-[2] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            DATA
                          </Text>
                          <Text
                            className="flex-1 text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            TIPO
                          </Text>
                          <Text
                            className="flex-1 text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            TAMANHO
                          </Text>
                          <Text
                            className="flex-[2] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            NFS SHARE
                          </Text>
                          <Text
                            className="flex-1 text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            STATUS
                          </Text>
                          <Text
                            className="flex-1 text-xs text-[#9AA4B8] dark:text-[#8A94A8] text-right"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            AÇÕES
                          </Text>
                        </HStack>

                        {/* Table Rows */}
                        {vmBackups.map((backup, index) => (
                          <HStack
                            key={backup.id}
                            className={`px-4 py-3 items-center ${
                              index !== vmBackups.length - 1
                                ? "border-b border-outline-100 dark:border-[#1E2F47]"
                                : ""
                            }`}
                          >
                            <Text
                              className="flex-[2] text-sm text-typography-900 dark:text-[#E8EBF0]"
                              style={{fontFamily: "Inter_400Regular"}}
                            >
                              {formatDate(backup.backupDate)}
                            </Text>
                            <Box className="flex-1">
                              <Badge
                                size="sm"
                                variant="outline"
                                className={`rounded-full w-fit ${
                                  backup.type === "full"
                                    ? "bg-[#3b82f619] border-[#3b82f6] dark:bg-[#3b82f625] dark:border-[#60a5fa]"
                                    : "bg-[#8b5cf619] border-[#8b5cf6] dark:bg-[#8b5cf625] dark:border-[#a78bfa]"
                                }`}
                              >
                                <BadgeText
                                  className={`text-xs ${
                                    backup.type === "full"
                                      ? "text-[#3b82f6] dark:text-[#60a5fa]"
                                      : "text-[#8b5cf6] dark:text-[#a78bfa]"
                                  }`}
                                  style={{fontFamily: "Inter_500Medium"}}
                                >
                                  {backup.type === "full" ? "Full" : "Incremental"}
                                </BadgeText>
                              </Badge>
                            </Box>
                            <Text
                              className="flex-1 text-sm text-typography-900 dark:text-[#E8EBF0]"
                              style={{fontFamily: "Inter_400Regular"}}
                            >
                              {backup.size.toFixed(1)} GB
                            </Text>
                            <Text
                              className="flex-[2] text-sm text-typography-600 dark:text-typography-400"
                              style={{fontFamily: "Inter_400Regular"}}
                            >
                              {getNfsName(backup.nfsShareId)}
                            </Text>
                            <Box className="flex-1">
                              <Badge
                                size="sm"
                                variant="outline"
                                className={`rounded-full w-fit ${
                                  backup.status === "complete"
                                    ? "bg-[#2dd4be19] border-[#2DD4BF] dark:bg-[#2DD4BF25] dark:border-[#5EEAD4]"
                                    : backup.status === "partial"
                                    ? "bg-[#fbbf2419] border-[#FBBF24] dark:bg-[#FBBF2425] dark:border-[#FCD34D]"
                                    : "bg-[#ef444419] border-[#ef4444] dark:bg-[#ef444425] dark:border-[#f87171]"
                                }`}
                              >
                                <BadgeText
                                  className={`text-xs ${
                                    backup.status === "complete"
                                      ? "text-[#2DD4BF] dark:text-[#5EEAD4]"
                                      : backup.status === "partial"
                                      ? "text-[#FBBF24] dark:text-[#FCD34D]"
                                      : "text-[#ef4444] dark:text-[#f87171]"
                                  }`}
                                  style={{fontFamily: "Inter_500Medium"}}
                                >
                                  {backup.status === "complete"
                                    ? "Completo"
                                    : backup.status === "partial"
                                    ? "Parcial"
                                    : "Falhou"}
                                </BadgeText>
                              </Badge>
                            </Box>
                            <HStack className="flex-1 gap-2 justify-end">
                              <Button
                                size="xs"
                                variant="outline"
                                className="rounded-md"
                                onPress={() => setRestoreBackup(backup)}
                              >
                                <ButtonIcon
                                  as={RotateCcw}
                                  size="xs"
                                  className="text-typography-700 dark:text-[#E8EBF0]"
                                />
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className="rounded-md border-red-500"
                                onPress={() => handleDelete(backup)}
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

      {/* Modal: Restaurar Backup */}
      <Modal isOpen={!!restoreBackup} onClose={() => setRestoreBackup(null)}>
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4">
            <Heading 
              size="lg" 
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{fontFamily: "Inter_700Bold"}}
            >
              Restaurar Backup
            </Heading>
            <ModalCloseButton className="text-typography-600 dark:text-typography-400" />
          </ModalHeader>
          <ModalBody className="py-4">
            {restoreBackup && (
              <VStack className="gap-5">
                <VStack className="gap-2">
                  <Text 
                    className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                    style={{fontFamily: "Inter_500Medium"}}
                  >
                    VM
                  </Text>
                  <Text
                    className="text-base text-typography-900 dark:text-[#E8EBF0]"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    {restoreBackup.vmName}
                  </Text>
                </VStack>
                <VStack className="gap-2">
                  <Text 
                    className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                    style={{fontFamily: "Inter_500Medium"}}
                  >
                    Data do Backup
                  </Text>
                  <Text className="text-base text-typography-900 dark:text-[#E8EBF0]">
                    {formatDate(restoreBackup.backupDate)}
                  </Text>
                </VStack>
                <VStack className="gap-2">
                  <Text 
                    className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                    style={{fontFamily: "Inter_500Medium"}}
                  >
                    Tamanho
                  </Text>
                  <Text className="text-base text-typography-900 dark:text-[#E8EBF0]">
                    {restoreBackup.size.toFixed(1)} GB
                  </Text>
                </VStack>
                <VStack className="gap-2">
                  <Text 
                    className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                    style={{fontFamily: "Inter_500Medium"}}
                  >
                    Selecionar Máquina Destino
                  </Text>
                  <Select>
                    <SelectTrigger variant="outline" size="md" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                      <SelectInput
                        placeholder="Escolha uma máquina..."
                        value={selectedMachine}
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
                          label="marques512sv"
                          value="marques512sv"
                        />
                        <SelectItem
                          label="marques2673sv"
                          value="marques2673sv"
                        />
                        <SelectItem
                          label="swift512"
                          value="swift512"
                        />
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </VStack>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter className="pt-6 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="justify-end gap-3 w-full">
              <Button
                variant="outline"
                className="rounded-lg px-6 py-2.5 border-outline-200 dark:border-[#2A3B52]"
                onPress={() => setRestoreBackup(null)}
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
                disabled={!selectedMachine}
                onPress={handleRestoreSubmit}
              >
                <ButtonText 
                  className="text-background-0 dark:text-typography-900"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Restaurar
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
