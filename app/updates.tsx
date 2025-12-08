import React from "react";
import {ScrollView, RefreshControl, useColorScheme} from "react-native";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {VStack} from "@/components/ui/vstack";
import {HStack} from "@/components/ui/hstack";
import {Button, ButtonIcon, ButtonSpinner, ButtonText} from "@/components/ui/button";
import {Input, InputField, InputIcon, InputSlot} from "@/components/ui/input";
import {Badge, BadgeText} from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectItem,
  SelectIcon,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
} from "@/components/ui/select";
import {Switch} from "@/components/ui/switch";
import {Toast, ToastTitle, useToast} from "@/components/ui/toast";
import {Spinner} from "@/components/ui/spinner";
import {useAuthGuard} from "@/hooks/useAuthGuard";
import {useUpdates} from "@/hooks/useUpdates";
import {listMachines, performMachineUpdate} from "@/services/hyperhive";
import {Machine} from "@/types/machine";
import {UpdateEntry} from "@/types/update";
import {ChevronDownIcon} from "@/components/ui/icon";
import {
  RefreshCw,
  ArrowUpCircle,
  Shield,
  Server,
  Power,
  AlertCircle,
  Search,
} from "lucide-react-native";

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
};

const StatCard = ({label, value, icon}: StatCardProps) => (
  <Box className="flex-1 min-w-[180px] p-4 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628]">
    <HStack className="items-center justify-between mb-2">
      <Text className="text-typography-500 dark:text-typography-400 text-xs">{label}</Text>
      {icon}
    </HStack>
    <Text
      className="text-typography-900 dark:text-[#E8EBF0] text-2xl font-semibold"
      style={{fontFamily: "Inter_600SemiBold"}}
    >
      {value}
    </Text>
  </Box>
);

const UpdateCard = ({
  update,
  onUpdate,
  isUpdating,
}: {
  update: UpdateEntry;
  onUpdate: (pkgName: string) => void;
  isUpdating: boolean;
}) => (
  <Box className="p-4 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628]">
    <HStack className="items-start justify-between gap-4">
      <VStack className="flex-1 gap-2">
        <HStack className="items-center gap-2 flex-wrap">
          <Text
            className="text-typography-900 dark:text-[#E8EBF0] text-base"
            style={{fontFamily: "Inter_600SemiBold"}}
          >
            {update.name}
          </Text>
          {update.severity && (
            <Badge
              size="sm"
              variant="solid"
              className={
                update.severity === "security"
                  ? "bg-[#0F766E]"
                  : update.severity === "bugfix"
                    ? "bg-[#1D4ED8]"
                    : "bg-[#334155]"
              }
            >
              <BadgeText className="text-white text-[11px] capitalize">
                {update.severity}
              </BadgeText>
            </Badge>
          )}
        </HStack>
        <HStack className="flex-wrap gap-2">
          {(update.currentVersion || update.newVersion) && (
            <Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
              <BadgeText className="text-xs text-typography-600 dark:text-typography-300">
                {update.currentVersion ? update.currentVersion : "—"} →{" "}
                {update.newVersion ? update.newVersion : "—"}
              </BadgeText>
            </Badge>
          )}
          {update.repository && (
            <Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
              <BadgeText className="text-xs text-typography-600 dark:text-typography-300">
                {update.repository}
              </BadgeText>
            </Badge>
          )}
          {update.architecture && (
            <Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
              <BadgeText className="text-xs text-typography-600 dark:text-typography-300">
                {update.architecture}
              </BadgeText>
            </Badge>
          )}
          {update.rebootRequired && (
            <Badge size="sm" variant="solid" className="bg-[#F97316]">
              <BadgeText className="text-white text-[11px]">Requer reboot</BadgeText>
            </Badge>
          )}
        </HStack>
        {update.description ? (
          <Text className="text-typography-600 dark:text-typography-400 text-sm leading-relaxed">
            {update.description}
          </Text>
        ) : null}
      </VStack>
      <Button
        size="sm"
        variant="solid"
        action="primary"
        className="rounded-xl px-4"
        onPress={() => onUpdate(update.name)}
        isDisabled={isUpdating}
      >
        {isUpdating ? (
          <ButtonSpinner />
        ) : (
          <>
            <ButtonIcon as={ArrowUpCircle} />
            <ButtonText>Atualizar</ButtonText>
          </>
        )}
      </Button>
    </HStack>
  </Box>
);

export default function UpdatesScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const {token, isChecking} = useAuthGuard();
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = React.useState<string | null>(null);
  const [loadingMachines, setLoadingMachines] = React.useState(false);
  const [runningUpdate, setRunningUpdate] = React.useState<string | null>(null);
  const [rebootAfter, setRebootAfter] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");

  const {updates, isLoading, isRefreshing, error, refresh} = useUpdates({
    machineName: selectedMachine,
    token,
  });

  const totalPending = updates?.items.length ?? 0;
  const securityCount = updates?.items.filter((item) => item.severity === "security").length ?? 0;
  const rebootExpected = updates?.rebootRequired ?? false;
  const lastCheckedLabel = formatDateTime(updates?.fetchedAt);

  React.useEffect(() => {
    if (!token || isChecking) return;
    let isActive = true;

    const loadMachines = async () => {
      setLoadingMachines(true);
      try {
        const response = await listMachines();
        if (!isActive) return;
        setMachines(response);
        setSelectedMachine((prev) => prev ?? response[0]?.MachineName ?? null);
      } catch (err) {
        if (!isActive) return;
        const message =
          err instanceof Error ? err.message : "Não foi possível carregar as máquinas.";
        toast.show({
          placement: "top",
          render: ({id}) => (
            <Toast
              nativeID={"toast-" + id}
              className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
              action="error"
            >
              <ToastTitle size="sm">{message}</ToastTitle>
            </Toast>
          ),
        });
      } finally {
        if (isActive) {
          setLoadingMachines(false);
        }
      }
    };

    loadMachines();
    return () => {
      isActive = false;
    };
  }, [token, isChecking, toast]);

  const handleRefresh = async () => {
    await refresh();
    toast.show({
      placement: "top",
      render: ({id}) => (
        <Toast
          nativeID={"toast-" + id}
          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
          action="success"
        >
          <ToastTitle size="sm">Updates atualizadas</ToastTitle>
        </Toast>
      ),
    });
  };

  const handleRunUpdate = async (pkgName?: string) => {
    if (!selectedMachine) {
      return;
    }
    if (runningUpdate) {
      return;
    }
    const actionKey = pkgName ?? "__all__";
    setRunningUpdate(actionKey);
    try {
      await performMachineUpdate(selectedMachine, {
        pkgName: pkgName ?? "",
        reboot: rebootAfter,
      });
      toast.show({
        placement: "top",
        render: ({id}) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action="success"
          >
            <ToastTitle size="sm">
              {pkgName ? `Atualização de ${pkgName} enviada` : "Atualização completa iniciada"}
            </ToastTitle>
          </Toast>
        ),
      });
      await refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Não foi possível iniciar a atualização.";
      toast.show({
        placement: "top",
        render: ({id}) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action="error"
          >
            <ToastTitle size="sm">{message}</ToastTitle>
          </Toast>
        ),
      });
    } finally {
      setRunningUpdate(null);
    }
  };

  const filteredUpdates = React.useMemo(() => {
    if (!updates?.items) return [];
    if (!searchTerm.trim()) return updates.items;
    const search = searchTerm.toLowerCase();
    return updates.items.filter((item) => {
      const haystacks = [
        item.name,
        item.description ?? "",
        item.repository ?? "",
        item.architecture ?? "",
      ]
        .filter(Boolean)
        .map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(search));
    });
  }, [updates?.items, searchTerm]);

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";
  const isUpdatingAll = runningUpdate === "__all__";

  if (isChecking || !token) {
    return null;
  }

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 32}}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
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
            Updates
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Consulte pacotes pendentes por máquina e dispare atualizações individuais ou completas com opção
            de reboot automático.
          </Text>

          <VStack className="mt-6 gap-3">
            <HStack className="gap-3 flex-wrap items-center">
              <Box className="min-w-[220px] flex-1 max-w-sm">
                <Select
                  selectedValue={selectedMachine ?? undefined}
                  onValueChange={setSelectedMachine}
                  isDisabled={loadingMachines || machines.length === 0}
                >
                  <SelectTrigger
                    variant="outline"
                    size="md"
                    className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                  >
                    <SelectInput
                      placeholder={loadingMachines ? "A carregar..." : "Escolhe uma máquina"}
                      className="text-typography-900 dark:text-[#E8EBF0]"
                      style={{fontFamily: "Inter_500Medium"}}
                    />
                    <SelectIcon className="mr-3" as={ChevronDownIcon} />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent>
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
              </Box>

              <Button
                variant="outline"
                action="primary"
                className="rounded-xl px-4"
                onPress={handleRefresh}
                isDisabled={isRefreshing}
              >
                {isRefreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCw} />}
              </Button>

              <Button
                variant="solid"
                action="primary"
                className="rounded-xl px-5"
                onPress={() => handleRunUpdate()}
                isDisabled={!selectedMachine || totalPending === 0}
              >
                {isUpdatingAll ? (
                  <ButtonSpinner />
                ) : (
                  <>
                    <ButtonIcon as={ArrowUpCircle} />
                    <ButtonText>Atualizar tudo</ButtonText>
                  </>
                )}
              </Button>
            </HStack>

            <HStack className="gap-3 flex-wrap items-center">
              <Box className="flex-1 min-w-[220px]">
                <Input
                  variant="outline"
                  size="md"
                  className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                >
                  <InputSlot className="pl-3">
                    <InputIcon as={Search} className="text-typography-400" />
                  </InputSlot>
                  <InputField
                    placeholder="Filtrar por nome, repositório ou arquitetura..."
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </Box>
              <HStack className="items-center gap-3 px-4 py-3 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628]">
                <VStack className="gap-1">
                  <Text className="text-typography-600 dark:text-typography-400 text-xs">
                    Reboot após atualizar
                  </Text>
                  <HStack className="items-center gap-2">
                    <Power size={16} className="text-typography-400" />
                    <Text className="text-typography-900 dark:text-[#E8EBF0] text-sm">
                      {rebootAfter ? "Ativado" : "Desativado"}
                    </Text>
                  </HStack>
                </VStack>
                <Switch value={rebootAfter} onValueChange={setRebootAfter} />
              </HStack>
            </HStack>
          </VStack>

          <HStack className="mt-6 gap-3 flex-wrap">
            <StatCard
              label="Máquina"
              value={selectedMachine ?? "—"}
              icon={<Server size={16} className="text-typography-400" />}
            />
            <StatCard
              label="Pendentes"
              value={totalPending}
              icon={<RefreshCw size={16} className="text-typography-400" />}
            />
            <StatCard
              label="Segurança"
              value={securityCount}
              icon={<Shield size={16} className="text-typography-400" />}
            />
            <StatCard
              label="Reboot esperado"
              value={rebootExpected ? "Provável" : "Não previsto"}
              icon={<Power size={16} className="text-typography-400" />}
            />
          </HStack>

          {lastCheckedLabel ? (
            <Text className="text-typography-500 dark:text-typography-400 text-xs mt-2">
              Última leitura: {lastCheckedLabel}
            </Text>
          ) : null}

          {error ? (
            <Box className="mt-4 p-4 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A0F10]">
              <HStack className="items-start gap-3">
                <AlertCircle size={18} className="text-[#DC2626]" />
                <VStack className="gap-1">
                  <Text className="text-[#DC2626]" style={{fontFamily: "Inter_600SemiBold"}}>
                    Falha ao carregar updates
                  </Text>
                  <Text className="text-[#991B1B] text-sm">{error}</Text>
                </VStack>
              </HStack>
            </Box>
          ) : null}

          {isLoading || loadingMachines ? (
            <Box className="mt-8 items-center justify-center flex-row gap-3">
              <Spinner size="large" />
              <Text className="text-typography-500 dark:text-typography-400">
                {loadingMachines ? "A carregar máquinas..." : "A carregar updates..."}
              </Text>
            </Box>
          ) : null}

          {!isLoading && !loadingMachines ? (
            <VStack className="mt-6 gap-3">
              {selectedMachine ? (
                filteredUpdates.length > 0 ? (
                  filteredUpdates.map((update) => (
                    <UpdateCard
                      key={update.id}
                      update={update}
                      onUpdate={handleRunUpdate}
                      isUpdating={runningUpdate === update.name || isUpdatingAll}
                    />
                  ))
                ) : (
                  <Box className="p-6 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] items-center">
                    <Text className="text-typography-900 dark:text-[#E8EBF0] mb-1" style={{fontFamily: "Inter_600SemiBold"}}>
                      Nenhuma atualização pendente
                    </Text>
                    <Text className="text-typography-600 dark:text-typography-400 text-sm text-center">
                      {searchTerm
                        ? "Nenhum pacote corresponde ao filtro aplicado."
                        : "Esta máquina não tem updates disponíveis de momento."}
                    </Text>
                  </Box>
                )
              ) : (
                <Box className="p-6 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] items-center">
                  <Text className="text-typography-900 dark:text-[#E8EBF0] mb-1" style={{fontFamily: "Inter_600SemiBold"}}>
                    Escolhe uma máquina
                  </Text>
                  <Text className="text-typography-600 dark:text-typography-400 text-sm text-center">
                    Seleciona uma máquina para listar os pacotes pendentes.
                  </Text>
                </Box>
              )}
            </VStack>
          ) : null}
        </Box>
      </ScrollView>
    </Box>
  );
}
