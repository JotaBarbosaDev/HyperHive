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
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
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
  return new Intl.DateTimeFormat("en-US", {
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
      <Text className="text-typography-500 dark:text-[#8A94A8] text-xs">{label}</Text>
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
                    : "bg-[#465533]"
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
            <Badge
              size="sm"
              variant="outline"
              className="border-outline-300 dark:bg-[#0F1A2E] dark:border-[#1E2F47]"
            >
              <BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">
                {update.currentVersion ? update.currentVersion : "—"} →{" "}
                {update.newVersion ? update.newVersion : "—"}
              </BadgeText>
            </Badge>
          )}
          {update.repository && (
            <Badge
              size="sm"
              variant="outline"
              className="border-outline-300 dark:border-[#243247]"
            >
              <BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">
                {update.repository}
              </BadgeText>
            </Badge>
          )}
          {update.architecture && (
            <Badge
              size="sm"
              variant="outline"
              className="border-outline-300 dark:border-[#243247]"
            >
              <BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">
                {update.architecture}
              </BadgeText>
            </Badge>
          )}
          {update.rebootRequired && (
            <Badge size="sm" variant="solid" className="bg-[#F97316]">
              <BadgeText className="text-white text-[11px]">
                Reboot required
              </BadgeText>
            </Badge>
          )}
        </HStack>
        {update.description ? (
          <Text className="text-typography-600 dark:text-[#8A94A8] text-sm leading-relaxed">
            {update.description}
          </Text>
        ) : null}
      </VStack>
      <Button
        size="sm"
        variant="solid"
        action="primary"
        className="rounded-xl px-4 dark:bg-[#5EEAD4]"
        onPress={() => onUpdate(update.name)}
        isDisabled={isUpdating}
      >
        {isUpdating ? (
          <ButtonSpinner />
        ) : (
          <>
            <ButtonIcon as={ArrowUpCircle} />
            <ButtonText>Update</ButtonText>
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
  const [pendingUpdate, setPendingUpdate] = React.useState<{pkgName: string | null} | null>(null);
  const [pendingReboot, setPendingReboot] = React.useState<boolean | null>(null);
  const [showRestartPrompt, setShowRestartPrompt] = React.useState(false);
  const [showConfirmPrompt, setShowConfirmPrompt] = React.useState(false);
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
          err instanceof Error ? err.message : "Unable to load machines.";
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
          <ToastTitle size="sm">Updates refreshed</ToastTitle>
        </Toast>
      ),
    });
  };

  const handleRunUpdate = async (pkgName?: string, reboot = false) => {
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
        reboot,
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
              {pkgName ? `Update for ${pkgName} sent` : "Full update started"}
            </ToastTitle>
          </Toast>
        ),
      });
      await refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to start the update.";
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

  const handleOpenUpdatePrompt = (pkgName?: string) => {
    if (!selectedMachine || runningUpdate) {
      return;
    }
    setPendingUpdate({pkgName: pkgName ?? null});
    setPendingReboot(null);
    setShowConfirmPrompt(false);
    setShowRestartPrompt(true);
  };

  const handleCloseRestartPrompt = () => {
    setShowRestartPrompt(false);
    setPendingUpdate(null);
    setPendingReboot(null);
  };

  const handleRestartChoice = (shouldReboot: boolean) => {
    setPendingReboot(shouldReboot);
    setShowRestartPrompt(false);
    setShowConfirmPrompt(true);
  };

  const handleCloseConfirmPrompt = () => {
    setShowConfirmPrompt(false);
    setPendingUpdate(null);
    setPendingReboot(null);
  };

  const handleConfirmUpdate = async () => {
    if (!pendingUpdate || pendingReboot === null) {
      return;
    }
    setShowConfirmPrompt(false);
    await handleRunUpdate(pendingUpdate.pkgName ?? undefined, pendingReboot);
    setPendingUpdate(null);
    setPendingReboot(null);
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
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
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
        <Box className="p-4 pt-16 web:p-20 web:max-w-7xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            Updates
          </Heading>
          <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
            Review pending packages per machine and trigger individual or full
            updates with optional automatic reboot.
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
                      placeholder={
                        loadingMachines ? "Loading..." : "Choose a machine"
                      }
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
                {isRefreshing ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonIcon as={RefreshCw} />
                )}
              </Button>

              <Button
                variant="solid"
                action="primary"
                className="rounded-xl px-5 dark:bg-[#5EEAD4]"
                onPress={() => handleOpenUpdatePrompt()}
                isDisabled={!selectedMachine || totalPending === 0}
              >
                {isUpdatingAll ? (
                  <ButtonSpinner />
                ) : (
                  <>
                    <ButtonIcon as={ArrowUpCircle} />
                    <ButtonText>Update all</ButtonText>
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
                    placeholder="Filter by name, repository, or architecture..."
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </Box>
            </HStack>
          </VStack>

          <HStack className="mt-6 gap-3 flex-wrap">
            <StatCard
              label="Machine"
              value={selectedMachine ?? "—"}
              icon={<Server size={16} className="text-[#5EEAD4]" />}
            />
            <StatCard
              label="Pending"
              value={totalPending}
              icon={<RefreshCw size={16} className="text-[#5EEAD4]" />}
            />
            <StatCard
              label="Security"
              value={securityCount}
              icon={<Shield size={16} className="text-[#5EEAD4]" />}
            />
            <StatCard
              label="Reboot expected"
              value={rebootExpected ? "Likely" : "Not expected"}
              icon={<Power size={16} className="text-[#5EEAD4]" />}
            />
          </HStack>

          {lastCheckedLabel ? (
            <Text className="text-typography-500 dark:text-[#8A94A8] text-xs mt-2">
              Last checked: {lastCheckedLabel}
            </Text>
          ) : null}

          {error ? (
            <Box className="mt-4 p-4 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A0F10]">
              <HStack className="items-start gap-3">
                <AlertCircle size={18} className="text-[#DC2626]" />
                <VStack className="gap-1">
                  <Text
                    className="text-[#DC2626]"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    Failed to load updates
                  </Text>
                  <Text className="text-[#991B1B] text-sm">{error}</Text>
                </VStack>
              </HStack>
            </Box>
          ) : null}

          {isLoading || loadingMachines ? (
            <Box className="mt-8 items-center justify-center flex-row gap-3">
              <Spinner size="large" />
              <Text className="text-typography-500 dark:text-[#8A94A8]">
                {loadingMachines ? "Loading machines..." : "Loading updates..."}
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
                      onUpdate={handleOpenUpdatePrompt}
                      isUpdating={
                        runningUpdate === update.name || isUpdatingAll
                      }
                    />
                  ))
                ) : (
                  <Box className="p-6 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] items-center">
                    <Text
                      className="text-typography-900 dark:text-[#E8EBF0] mb-1"
                      style={{fontFamily: "Inter_600SemiBold"}}
                    >
                      No pending updates
                    </Text>
                    <Text className="text-typography-600 dark:text-[#8A94A8] text-sm text-center">
                      {searchTerm
                        ? "No package matches the applied filter."
                        : "This machine currently has no updates available."}
                    </Text>
                  </Box>
                )
              ) : (
                <Box className="p-6 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] items-center">
                  <Text
                    className="text-typography-900 dark:text-[#E8EBF0] mb-1"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    Choose a machine
                  </Text>
                  <Text className="text-typography-600 dark:text-[#8A94A8] text-sm text-center">
                    Select a machine to list the pending packages.
                  </Text>
                </Box>
              )}
            </VStack>
          ) : null}
        </Box>
      </ScrollView>
      <Modal
        isOpen={showRestartPrompt}
        onClose={handleCloseRestartPrompt}
        size="md"
      >
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-5">
          <ModalHeader className="flex-row items-center gap-3 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <Box className="h-10 w-10 rounded-2xl bg-[#F97316]/10 dark:bg-[#FDBA74]/15 items-center justify-center">
              <Power size={18} className="text-[#F97316] dark:text-[#FDBA74]" />
            </Box>
            <VStack className="flex-1">
              <Heading
                size="lg"
                className="text-typography-900 dark:text-[#E8EBF0]"
              >
                Restart after Update?
              </Heading>
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                Choose whether this machine should restart once the update
                finishes.
              </Text>
            </VStack>
            <ModalCloseButton onPress={handleCloseRestartPrompt} />
          </ModalHeader>
          <ModalBody className="pt-5">
            <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] p-4">
              <VStack className="gap-2">
                <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                  Update target
                </Text>
                <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                  {pendingUpdate?.pkgName ?? "All pending updates"}
                </Text>
              </VStack>
            </Box>
          </ModalBody>
          <ModalFooter className="flex-row gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <Button
              variant="outline"
              action="secondary"
              className="flex-1 rounded-xl"
              onPress={() => handleRestartChoice(false)}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                No
              </ButtonText>
            </Button>
            <Button
              action="primary"
              className="flex-1 rounded-xl"
              onPress={() => handleRestartChoice(true)}
            >
              <ButtonText className="text-background-0 dark:text-[#0A1628]">
                Yes
              </ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal
        isOpen={showConfirmPrompt}
        onClose={handleCloseConfirmPrompt}
        size="md"
      >
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-5">
          <ModalHeader className="flex-row items-center gap-3 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <Box className="h-10 w-10 rounded-2xl bg-[#38BDF8]/15 dark:bg-[#0EA5E9]/20 items-center justify-center">
              <ArrowUpCircle
                size={18}
                className="text-[#0284C7] dark:text-[#38BDF8]"
              />
            </Box>
            <VStack className="flex-1">
              <Heading
                size="lg"
                className="text-typography-900 dark:text-[#E8EBF0]"
              >
                Are you sure you want to update?
              </Heading>
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                This will start the update job immediately.
              </Text>
            </VStack>
            <ModalCloseButton onPress={handleCloseConfirmPrompt} />
          </ModalHeader>
          <ModalBody className="pt-5">
            <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] p-4">
              <VStack className="gap-3">
                <VStack className="gap-1">
                  <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                    Update target
                  </Text>
                  <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                    {pendingUpdate?.pkgName ?? "All pending updates"}
                  </Text>
                </VStack>
                <VStack className="gap-1">
                  <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                    Restart after update
                  </Text>
                  <Text className="text-sm text-typography-700 dark:text-[#8A94A8]">
                    {pendingReboot ? "Yes" : "No"}
                  </Text>
                </VStack>
              </VStack>
            </Box>
          </ModalBody>
          <ModalFooter className="flex-row gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <Button
              variant="outline"
              action="secondary"
              className="flex-1 rounded-xl"
              onPress={handleCloseConfirmPrompt}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                Cancel
              </ButtonText>
            </Button>
            <Button
              action="primary"
              className="flex-1 rounded-xl"
              onPress={handleConfirmUpdate}
            >
              <ButtonText className="text-background-0 dark:text-[#0A1628]">
                Update
              </ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
