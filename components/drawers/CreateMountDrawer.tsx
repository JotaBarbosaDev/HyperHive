import React from "react";
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from "@/components/ui/drawer";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon, CloseIcon, ChevronDownIcon, AlertCircleIcon, CheckIcon, InfoIcon } from "@/components/ui/icon";
import { FormControl, FormControlError, FormControlErrorIcon, FormControlErrorText, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from "@/components/ui/select";
import { VStack } from "@/components/ui/vstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Tooltip, TooltipContent, TooltipText } from "@/components/ui/tooltip";
import { createMount, listDirectory, listMachines } from "@/services/hyperhive";
import { Machine } from "@/types/machine";
import { DirectoryListing } from "@/types/directory";
import { DirectoryPickerModal } from "@/components/modals/DirectoryPickerModal";
import { Alert, Platform } from "react-native";

export type CreateMountDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const hostInfoDescription =
  "This setting allows only the machine sharing the NFS to access storage directly, maximizing the performance of fast SSDs and M.2 drives. However, if using slower HDDs, it's recommended to disable this setting, as the NFS cache (even on the host) is faster than direct access to the HDD. Enabling this also prevents live migration of VMs and may cause rare issues.";

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

export function CreateMountDrawer({
  isOpen,
  onClose,
  onSuccess,
}: CreateMountDrawerProps) {
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [machineName, setMachineName] = React.useState<string>("");
  const [mountName, setMountName] = React.useState<string>("");
  const [path, setPath] = React.useState<string>("/");
  const [hostNormalMount, setHostNormalMount] = React.useState<boolean>(false);
  const [dirListing, setDirListing] = React.useState<DirectoryListing | null>(null);
  const [dirError, setDirError] = React.useState<string | null>(null);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [selectedDirectory, setSelectedDirectory] = React.useState<string | null>(null);
  const [isDirModalOpen, setIsDirModalOpen] = React.useState(false);
  const [isFetchingDir, setIsFetchingDir] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  const resetState = React.useCallback(() => {
    setMachineName("");
    setMountName("");
    setPath("/");
    setHostNormalMount(false);
    setDirListing(null);
    setDirError(null);
    setCreateError(null);
    setSelectedDirectory(null);
    setIsDirModalOpen(false);
    setIsFetchingDir(false);
    setIsCreating(false);
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      resetState();
      return;
    }

    setHostNormalMount(false);

    let isCancelled = false;
    const loadMachines = async () => {
      try {
        const data = await listMachines();
        if (!isCancelled) {
          setMachines(data);
        }
      } catch (err) {
        console.error("Error fetching machine list:", err);
      }
    };

    loadMachines();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, resetState]);

  const handleHostInfoPress = React.useCallback(() => {
    if (Platform.OS === "web") {
      return;
    }
    Alert.alert("Host Normal Mount", hostInfoDescription);
  }, []);

  const directories = React.useMemo(
    () =>
      Array.isArray(dirListing?.directories)
        ? (dirListing?.directories as string[])
        : [],
    [dirListing]
  );

  const handleDirectoryFetch = React.useCallback(
    async (customPath?: string) => {
      if (!machineName.trim()) {
        setDirError("Select a machine before listing folders.");
        return undefined;
      }

      const normalizedPath = normalizePathInput(customPath ?? path);

      setDirError(null);
      setCreateError(null);
      setDirListing(null);
      setIsFetchingDir(true);
      setSelectedDirectory(null);

      try {
        const data = await listDirectory(machineName.trim(), normalizedPath);
        setDirListing(data);
        setPath(normalizedPath);
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
    [machineName, path]
  );

  const handleOpenDirectoryModal = React.useCallback(async () => {
    if (!machineName.trim()) {
      setDirError("Select a machine before listing folders.");
      return;
    }
    setDirError(null);
    setCreateError(null);
    const hasCachedDirectories = dirListing && Array.isArray(dirListing.directories);
    const result = hasCachedDirectories ? dirListing : await handleDirectoryFetch();
    if (!result) {
      return;
    }
    setSelectedDirectory(null);
    setIsDirModalOpen(true);
  }, [dirListing, handleDirectoryFetch, machineName]);

  const handleDirectoryAdd = React.useCallback(async () => {
    if (!selectedDirectory) return;
    const nextPath = computeNextPath(path, selectedDirectory);
    setCreateError(null);
    await handleDirectoryFetch(nextPath);
    setSelectedDirectory(null);
  }, [handleDirectoryFetch, path, selectedDirectory]);

  const handleDirectoryCancel = React.useCallback(() => {
    setIsDirModalOpen(false);
    setSelectedDirectory(null);
    setDirListing(null);
    setDirError(null);
    setPath("/");
  }, []);

  const handleDirectoryOk = React.useCallback(() => {
    setIsDirModalOpen(false);
    setSelectedDirectory(null);
  }, []);

  const handleSubmit = React.useCallback(async () => {
    if (isCreating) return;

    const trimmedMachine = machineName.trim();
    const trimmedName = mountName.trim();

    if (!trimmedMachine) {
      setCreateError("Select a machine.");
      return;
    }

    if (!trimmedName) {
      setCreateError("Enter a name for the mount.");
      return;
    }

    setCreateError(null);
    setIsCreating(true);

    try {
      await createMount({
        machineName: trimmedMachine,
        folderPath: path,
        name: trimmedName,
        hostNormalMount,
      });

      onClose();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error creating mount.";
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  }, [hostNormalMount, isCreating, machineName, mountName, onClose, onSuccess, path]);

  const isWeb = Platform.OS === "web";

  const formContent = (
    <VStack className="gap-4 web:gap-6">
      <FormControl isInvalid={Boolean(createError)} size="md">
        <FormControlLabel className="mb-2 web:mb-2">
          <FormControlLabelText className="text-typography-900 dark:text-[#E8EBF0] text-sm font-semibold web:text-sm web:font-semibold web:tracking-wide">
            Name
          </FormControlLabelText>
        </FormControlLabel>
        <Input
          variant="outline"
          size="md"
          className="bg-background-50 dark:bg-[#0E1524] border-outline-200 dark:border-[#2A3647] rounded-xl h-11 web:bg-background-50 dark:web:bg-[#0E1524] web:border-outline-200 dark:web:border-[#2A3647] web:rounded-xl web:h-12"
        >
          <InputField
            placeholder="Enter mount name..."
            value={mountName}
            onChangeText={(text) => {
              setMountName(text);
              setCreateError(null);
            }}
            className="text-base px-3 web:text-base web:px-4"
          />
        </Input>
      </FormControl>
      <FormControl isInvalid={Boolean(dirError)} size="md">
        <FormControlLabel className="mb-2 web:mb-2">
          <FormControlLabelText className="text-typography-900 dark:text-[#E8EBF0] text-sm font-semibold web:text-sm web:font-semibold web:tracking-wide">
            Machine
          </FormControlLabelText>
        </FormControlLabel>
        <Select
          selectedValue={machineName}
          onValueChange={(value) => {
            setMachineName(value);
            setDirError(null);
            setDirListing(null);
            setPath("/");
            setSelectedDirectory(null);
            setCreateError(null);
          }}
        >
          <SelectTrigger
            variant="outline"
            size="md"
            className="bg-background-50 dark:bg-[#0E1524] border-outline-200 dark:border-[#2A3647] rounded-xl h-11 web:bg-background-50 dark:web:bg-[#0E1524] web:border-outline-200 dark:web:border-[#2A3647] web:rounded-xl web:h-12"
          >
            <SelectInput
              placeholder="Select machine"
              className="text-base px-3 web:text-base web:px-4"
            />
            <SelectIcon className="mr-3" as={ChevronDownIcon} />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>
              {machines.map((machine, index) => {
                const keyCandidate =
                  machine?.Id ??
                  machine?.id ??
                  (machine as any)?.MachineUuid ??
                  machine?.MachineName ??
                  index;
                return (
                  <SelectItem
                    label={machine.MachineName}
                    value={machine.MachineName}
                    key={`machine-${keyCandidate}`}
                  />
                );
              })}
            </SelectContent>
          </SelectPortal>
        </Select>
        {dirError ? (
          <FormControlError className="mt-2">
            <FormControlErrorIcon as={AlertCircleIcon} />
            <FormControlErrorText>{dirError}</FormControlErrorText>
          </FormControlError>
        ) : null}
      </FormControl>
      <FormControl size="md">
        <FormControlLabel className="mb-2 web:mb-2">
          <FormControlLabelText className="text-typography-900 dark:text-[#E8EBF0] text-sm font-semibold web:text-sm web:font-semibold web:tracking-wide">
            Path
          </FormControlLabelText>
        </FormControlLabel>
        <Input
          variant="outline"
          size="md"
          className="bg-background-50 dark:bg-[#0E1524] border-outline-200 dark:border-[#2A3647] rounded-xl h-11 web:bg-background-50 dark:web:bg-[#0E1524] web:border-outline-200 dark:web:border-[#2A3647] web:rounded-xl web:h-12"
        >
          <InputField
            placeholder="/"
            value={path}
            onChangeText={(text) => {
              setPath(
                text.length === 0
                  ? "/"
                  : text.startsWith("/")
                    ? text.replace(/\/{2,}/g, "/")
                    : `/${text}`.replace(/\/{2,}/g, "/")
              );
              setDirError(null);
            }}
            className="text-base px-3 web:text-base web:px-4 pb-3"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Input>
        <Button
          variant="link"
          className="mt-2 self-start bg-background-50 dark:bg-[#0E1524] border border-[#0E1524] p-2 rounded-xl"
          onPress={handleOpenDirectoryModal}
          isDisabled={!machineName.trim() || isFetchingDir}
        >
          {isFetchingDir ? (
            <>
              <ButtonSpinner size="small" />
              <ButtonText className="ml-2 text-sm ">
                Loading directories...
              </ButtonText>
            </>
          ) : (
            <ButtonText className="text-sm text-[#0E1524] dark:text-[#E8EBF0]">
              Browse directories
            </ButtonText>
          )}
        </Button>
      </FormControl>
      <VStack className="gap-3 rounded-xl border border-outline-100 dark:border-[#2A3647] bg-background-50 dark:bg-[#0E1524] p-4">
        <Box className="flex flex-row items-start justify-between">
          <VStack className="gap-1.5">
            <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
              Host Normal Mount
            </Text>
            <Text className="text-xs text-typography-500 dark:text-typography-400">
              Allow the host to access storage directly for better
              performance.
            </Text>
          </VStack>
          <Tooltip
            trigger={(triggerProps) => (
              <Button
                {...triggerProps}
                size="xs"
                variant="link"
                accessibilityRole="button"
                accessibilityLabel="Show host mount info"
                className="ml-2 w-7 h-7 rounded-full bg-background-100 dark:bg-[#1A2332] items-center justify-center active:bg-background-200 dark:active:bg-[#0E1524] web:w-8 web:h-8 hover:web:bg-background-200 dark:hover:web:bg-[#0E1524]"
                onPress={handleHostInfoPress}
              >
                <ButtonIcon as={InfoIcon} size="sm" />
              </Button>
            )}
          >
            <TooltipContent className="mx-3 max-w-[280px] px-4 py-3 bg-background-900 dark:bg-background-100 rounded-xl shadow-2xl border border-outline-200 dark:border-[#2A3647] web:mx-0 web:max-w-[360px] web:px-5 web:py-4">
              <Heading
                size="xs"
                className="text-typography-50 dark:text-typography-900 font-bold mb-2 text-sm web:text-base"
              >
                Host Normal Mount
              </Heading>
              <TooltipText className="text-typography-100 dark:text-typography-800 text-xs leading-5 web:text-sm web:leading-6">
                {hostInfoDescription}
              </TooltipText>
            </TooltipContent>
          </Tooltip>
        </Box>
        <Button
          variant="outline"
          onPress={() => setHostNormalMount((prev) => !prev)}
          className={`flex-row items-center gap-3 h-11 rounded-xl px-4 border-2 dark:border-[#2A3B52] hover:web:bg-background-100 dark:hover:web:bg-[#1A2637] ${hostNormalMount
            ? "bg-[#2DD4BF] border-[#2DD4BF] dark:bg-[#2DD4BF] dark:border-[#2DD4BF]"
            : "bg-background-0 dark:bg-[#0E1524]"
            }`}
        >
          <Box
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${hostNormalMount
              ? "bg-[#0D1420] border-[#0D1420]"
              : "border-outline-300 dark:border-[#2A3B52]"
              }`}
          >
            {hostNormalMount ? (
              <Icon as={CheckIcon} className="text-[#2DD4BF]" size="xs" />
            ) : null}
          </Box>
          <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
            Enable host normal mount
          </Text>
        </Button>
      </VStack>
      {createError ? (
        <Box className="p-3 bg-error-50 dark:bg-error-900/20 rounded-xl border border-error-300 dark:border-error-700 web:p-4 web:bg-error-50 dark:web:bg-error-900/20 web:rounded-xl web:border web:border-error-300 dark:web:border-error-700">
          <Text className="text-error-700 dark:text-error-400 text-sm font-medium web:text-base web:font-medium">
            {createError}
          </Text>
        </Box>
      ) : null}
    </VStack>
  );

  const actionButtons = (
    <>
      <Button
        variant="outline"
        onPress={onClose}
        className="flex-1 h-11 rounded-xl border-2 web:px-6 web:h-12 web:rounded-xl web:border-2 hover:web:bg-background-100 dark:hover:web:bg-[#1A2332]"
      >
        <ButtonText className="text-base font-semibold web:text-base web:font-semibold">
          Cancel
        </ButtonText>
      </Button>
      <Button
        action="primary"
        onPress={handleSubmit}
        isDisabled={isCreating}
        className="flex-1 flex-row items-center justify-center gap-2 h-11 rounded-xl shadow-lg web:px-6 web:h-12 web:rounded-xl web:shadow-lg"
      >
        {isCreating ? (
          <>
            <ButtonSpinner />
            <ButtonText className="text-base font-semibold web:text-base web:font-semibold">
              Creating...
            </ButtonText>
          </>
        ) : (
          <ButtonText className="text-base font-semibold web:text-base web:font-semibold">
            Create Mount
          </ButtonText>
        )}
      </Button>
    </>
  );

  if (isWeb) {
    return (
      <>
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
          <ModalBackdrop className="bg-black/70" />
          <ModalContent className="w-full max-w-[720px] px-6 py-5 rounded-2xl bg-background-0 dark:bg-[#1A2332] border border-outline-200 dark:border-[#2A3647] shadow-2xl">
            <ModalHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3647] mb-4 flex-row items-start justify-between">
              <Heading
                size="lg"
                className="text-typography-900 dark:text-[#E8EBF0] text-2xl font-bold"
              >
                Create Mount
              </Heading>
              <ModalCloseButton onPress={onClose} />
            </ModalHeader>
            <ModalBody className="pt-1 pb-2 pr-1 max-h-[75vh] overflow-y-auto">
              {formContent}
            </ModalBody>
            <ModalFooter className="flex-row gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3647]">
              {actionButtons}
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
      </>
    );
  }

  return (
    <>
      <Drawer
        isOpen={isOpen}
        size="full"
        anchor="right"
        onClose={() => {
          onClose();
        }}
      >
        <DrawerBackdrop className="bg-background-950/40 backdrop-blur-sm web:bg-background-950/40 web:backdrop-blur-sm" />
        <DrawerContent className="px-5 py-4 bg-background-0 dark:bg-[#1A2332] rounded-t-3xl web:ml-auto web:h-full web:max-w-[480px] web:px-8 web:py-6 web:rounded-l-2xl web:rounded-t-none web:border-l web:border-outline-200 web:bg-background-0 dark:web:bg-[#1A2332] dark:web:border-[#2A3647] web:shadow-2xl">
          <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
            <DrawerHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3647] mb-4 web:pb-6 web:border-b web:border-outline-100 dark:web:border-[#2A3647] web:mb-6">
              <Heading
                size="lg"
                className="text-typography-900 dark:text-[#E8EBF0] text-xl font-bold web:text-3xl web:font-bold"
              >
                Create Mount
              </Heading>
              <DrawerCloseButton
                onPress={onClose}
                className="top-0 right-0 w-9 h-9 rounded-full bg-background-100 dark:bg-[#0E1524] items-center justify-center web:top-0 web:right-0 web:w-10 web:h-10 web:rounded-full web:bg-background-100 dark:web:bg-[#0E1524] hover:web:bg-background-200 dark:hover:web:bg-[#1A2332] web:items-center web:justify-center"
              >
                <Icon
                  as={CloseIcon}
                  className="text-typography-700 web:text-typography-700"
                  size="sm"
                />
              </DrawerCloseButton>
            </DrawerHeader>
            <DrawerBody className="flex-1 overflow-y-auto py-2 web:flex-1 web:overflow-y-auto web:pr-2 web:py-2">
              {formContent}
            </DrawerBody>
            <DrawerFooter className="gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3647] mt-3 web:pt-6 web:border-t web:border-outline-100 dark:web:border-[#2A3647] web:mt-4">
              {actionButtons}
            </DrawerFooter>
          </SafeAreaView>
        </DrawerContent>
      </Drawer>
      <DirectoryPickerModal
        isOpen={isDirModalOpen}
        directories={directories}
        selectedDirectory={selectedDirectory}
        onSelect={setSelectedDirectory}
        onCancel={() => {
          setIsDirModalOpen(false);
          setSelectedDirectory(null);
        }}
        onConfirm={handleDirectoryAdd}
        isLoading={isFetchingDir}
      />
    </>
  );
}
