import React from "react";
import { Platform, RefreshControl, ScrollView } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { ApiError } from "@/services/api-client";
import {
  addDnsAlias,
  checkDnsAliasExists,
  listDnsAliases,
  removeDnsAlias,
} from "@/services/dnsmasq";
import { DnsAliasEntry, DnsAliasPayload } from "@/types/dns";
import { Plus, Trash2 } from "lucide-react-native";

type LoadMode = "full" | "refresh" | "silent";

const IPV4_REGEX =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const ALIAS_REGEX = /^[A-Za-z0-9._-]+$/;

const aliasKey = (item: Pick<DnsAliasEntry, "alias" | "ip">) => `${item.alias}|${item.ip}`;

const sortAliases = (items: DnsAliasEntry[]) =>
  [...items].sort((a, b) => {
    const aliasCompare = a.alias.localeCompare(b.alias, undefined, { sensitivity: "base" });
    if (aliasCompare !== 0) {
      return aliasCompare;
    }
    return a.ip.localeCompare(b.ip, undefined, { numeric: true, sensitivity: "base" });
  });

const validateAlias = (value: string) => {
  const normalized = value.trim();
  if (!normalized || !/^(\*\.)?[A-Za-z0-9._-]+$/.test(normalized)) {
    return false;
  }
  if (normalized.startsWith(".") || normalized.endsWith(".") || normalized.includes("..")) {
    return false;
  }
  return true;
};

const validateIpv4 = (value: string) => IPV4_REGEX.test(value.trim());

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof ApiError) {
    if (typeof err.data === "string" && err.data.trim().length > 0) {
      return err.data;
    }
    if (err.message) {
      return err.message;
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
};

export default function DnsScreen() {
  const toast = useToast();
  const { token, isChecking } = useAuthGuard();
  const [aliases, setAliases] = React.useState<DnsAliasEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [formAlias, setFormAlias] = React.useState("");
  const [formIp, setFormIp] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [showAddAliasModal, setShowAddAliasModal] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<DnsAliasEntry | null>(null);
  const [deletingKey, setDeletingKey] = React.useState<string | null>(null);
  const isWeb = Platform.OS === "web";

  const showToast = React.useCallback(
    (title: string, description: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-2 shadow-soft-1 items-start flex-row"
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

  const loadAliases = React.useCallback(
    async (mode: LoadMode = "full") => {
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await listDnsAliases();
        setAliases(sortAliases(Array.isArray(data) ? data : []));
      } catch (err) {
        console.error("Failed to load DNS aliases", err);
        showToast("Load error", getErrorMessage(err, "Could not fetch DNS aliases."), "error");
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [showToast]
  );

  React.useEffect(() => {
    if (!isChecking && token) {
      loadAliases("full");
    }
  }, [isChecking, loadAliases, token]);

  const handleAddAlias = async () => {
    const payload: DnsAliasPayload = {
      alias: formAlias.trim(),
      ip: formIp.trim(),
    };

    if (!validateAlias(payload.alias)) {
      showToast("Invalid alias", "Use a valid host alias, for example nas.local.", "error");
      return;
    }
    if (!validateIpv4(payload.ip)) {
      showToast("Invalid IP", "Use a valid IPv4 address, for example 192.168.1.10.", "error");
      return;
    }

    setAdding(true);
    try {
      const exists = await checkDnsAliasExists(payload);
      if (exists) {
        showToast("Alias already exists", `${payload.alias} -> ${payload.ip} is already configured.`, "error");
        return;
      }

      await addDnsAlias(payload);
      showToast("Alias added", `${payload.alias} -> ${payload.ip} added successfully.`);
      setFormAlias("");
      setFormIp("");
      setShowAddAliasModal(false);
      await loadAliases("silent");
    } catch (err) {
      console.error("Failed to add DNS alias", err);
      showToast("Add error", getErrorMessage(err, "Could not add DNS alias."), "error");
    } finally {
      setAdding(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const payload: DnsAliasPayload = {
      alias: deleteTarget.alias.trim(),
      ip: deleteTarget.ip.trim(),
    };
    const currentKey = aliasKey(payload);
    setDeletingKey(currentKey);
    try {
      const exists = await checkDnsAliasExists(payload);
      if (!exists) {
        showToast("Alias not found", `${payload.alias} -> ${payload.ip} does not exist.`, "error");
        setDeleteTarget(null);
        await loadAliases("silent");
        return;
      }

      await removeDnsAlias(payload);
      showToast("Alias removed", `${payload.alias} -> ${payload.ip} removed successfully.`);
      setDeleteTarget(null);
      await loadAliases("silent");
    } catch (err) {
      console.error("Failed to remove DNS alias", err);
      showToast("Remove error", getErrorMessage(err, "Could not remove DNS alias."), "error");
    } finally {
      setDeletingKey(null);
    }
  };

  const closeDeleteDialog = () => {
    if (deletingKey) return;
    setDeleteTarget(null);
  };

  const openAddAliasModal = () => {
    setFormAlias("");
    setFormIp("");
    setShowAddAliasModal(true);
  };

  const closeAddAliasModal = () => {
    if (adding) return;
    setShowAddAliasModal(false);
  };

  if (isChecking || !token) {
    return null;
  }

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadAliases("refresh")} />
        }
      >
        <Box className="p-4 pt-16 web:p-20 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            DNS
          </Heading>
          <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl mb-6">
            Manage local DNS aliases (`dnsmasq`) by adding or removing alias to IP mappings.
          </Text>

          <VStack className="gap-6">
            <Box className="rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] shadow-soft-1 overflow-hidden">
              <HStack className="items-center justify-between px-5 py-4 border-b border-outline-100 dark:border-[#1E2F47]">
                <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                  Aliases ({aliases.length})
                </Heading>
                <HStack className="items-center gap-3">
                  {loading ? (
                    <Text className="text-typography-500 dark:text-[#8A94A8] text-xs">Loading...</Text>
                  ) : null}
                  <Button
                    action="primary"
                    size="sm"
                    className="rounded-xl px-4 bg-typography-900 dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
                    onPress={openAddAliasModal}
                  >
                    <ButtonIcon as={Plus} className="text-background-0 dark:text-[#0A1628]" />
                    <ButtonText className="text-background-0 dark:text-[#0A1628]">Add Alias</ButtonText>
                  </Button>
                </HStack>
              </HStack>

              {loading ? (
                <Box className="p-6">
                  <Text className="text-typography-600 dark:text-[#9AA4B8] text-center">
                    Loading aliases...
                  </Text>
                </Box>
              ) : aliases.length === 0 ? (
                <Box className="p-8 items-center">
                  <Text className="text-typography-700 dark:text-[#E8EBF0] text-base font-semibold">
                    No aliases configured
                  </Text>
                  <Text className="text-typography-500 dark:text-[#9AA4B8] text-sm mt-1 text-center">
                    Add your first DNS alias with the Add Alias button.
                  </Text>
                </Box>
              ) : isWeb ? (
                <Box className="overflow-x-auto">
                  <Box className="min-w-[760px]">
                    <HStack className="bg-background-50 dark:bg-[#0A1628] px-6 py-3 border-b border-outline-100 dark:border-[#1E2F47]">
                      <Text className="flex-1 text-xs text-[#9AA4B8] dark:text-[#8A94A8]" style={{ fontFamily: "Inter_600SemiBold" }}>
                        ALIAS
                      </Text>
                      <Text className="w-[180px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]" style={{ fontFamily: "Inter_600SemiBold" }}>
                        IPV4
                      </Text>
                      <Text className="w-[90px] text-xs text-[#9AA4B8] dark:text-[#8A94A8] text-right" style={{ fontFamily: "Inter_600SemiBold" }}>
                        ACTIONS
                      </Text>
                    </HStack>
                    {aliases.map((item, index) => {
                      const key = aliasKey(item);
                      const isDeleting = deletingKey === key;
                      return (
                        <HStack
                          key={key}
                          className={`px-6 py-4 items-center ${index !== aliases.length - 1 ? "border-b border-outline-100 dark:border-[#1E2F47]" : ""
                            }`}
                        >
                          <Text className="flex-1 text-sm text-typography-900 dark:text-[#E8EBF0]" style={{ fontFamily: "Inter_500Medium" }}>
                            {item.alias}
                          </Text>
                          <Text className="w-[180px] text-sm text-typography-600 dark:text-[#9AA4B8]">
                            {item.ip}
                          </Text>
                          <HStack className="w-[90px] justify-end">
                            <Button
                              variant="outline"
                              size="xs"
                              className="rounded-xl border-error-300 dark:border-error-700 bg-background-0 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                              onPress={() => setDeleteTarget(item)}
                              isDisabled={isDeleting}
                            >
                              {isDeleting ? (
                                <ButtonSpinner className="text-error-600 dark:text-error-400" />
                              ) : (
                                <ButtonIcon as={Trash2} size="xs" className="text-error-600 dark:text-error-400" />
                              )}
                            </Button>
                          </HStack>
                        </HStack>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <VStack className="gap-3 p-4">
                  {aliases.map((item) => {
                    const key = aliasKey(item);
                    const isDeleting = deletingKey === key;
                    return (
                      <Box
                        key={key}
                        className="rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0A1628] p-4"
                      >
                        <HStack className="items-start justify-between gap-3">
                          <VStack className="gap-1 flex-1">
                            <Text className="text-base text-typography-900 dark:text-[#E8EBF0]" style={{ fontFamily: "Inter_600SemiBold" }}>
                              {item.alias}
                            </Text>
                            <Text className="text-sm text-typography-600 dark:text-[#9AA4B8]">{item.ip}</Text>
                          </VStack>
                          <Button
                            variant="outline"
                            size="xs"
                            className="rounded-xl border-red-500"
                            onPress={() => setDeleteTarget(item)}
                            isDisabled={isDeleting}
                          >
                            {isDeleting ? (
                              <ButtonSpinner className="text-red-500" />
                            ) : (
                              <>
                                <ButtonIcon as={Trash2} size="xs" className="text-red-500" />
                                <ButtonText className="text-red-500 text-xs">Delete</ButtonText>
                              </>
                            )}
                          </Button>
                        </HStack>
                      </Box>
                    );
                  })}
                </VStack>
              )}
            </Box>
          </VStack>
        </Box>
      </ScrollView>

      <Modal isOpen={showAddAliasModal} onClose={closeAddAliasModal}>
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4">
            <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
              Add Alias
            </Heading>
            <ModalCloseButton className="text-typography-600 dark:text-[#8A94A8]" />
          </ModalHeader>
          <ModalBody className="py-2">
            <VStack className="gap-4">
              <Box>
                <Text size="xs" className="mb-2 text-typography-700 dark:text-[#9AA4B8]">
                  Alias
                </Text>
                <Input size="md" isDisabled={adding} className="rounded-xl border-outline-200 dark:border-[#1E2F47]">
                  <InputField
                    value={formAlias}
                    onChangeText={setFormAlias}
                    placeholder="nas.local"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="text-typography-900 dark:text-[#E8EBF0] placeholder:text-typography-500 dark:placeholder:text-[#9AA4B8]"
                  />
                </Input>
              </Box>

              <Box>
                <Text size="xs" className="mb-2 text-typography-700 dark:text-[#9AA4B8]">
                  IPv4
                </Text>
                <Input size="md" isDisabled={adding} className="rounded-xl border-outline-200 dark:border-[#1E2F47]">
                  <InputField
                    value={formIp}
                    onChangeText={setFormIp}
                    placeholder="192.168.1.10"
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="text-typography-900 dark:text-[#E8EBF0] placeholder:text-typography-500 dark:placeholder:text-[#9AA4B8]"
                  />
                </Input>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter className="pt-5 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="w-full justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-xl border-outline-200 dark:border-[#2A3B52]"
                onPress={closeAddAliasModal}
                isDisabled={adding}
              >
                <ButtonText className="text-typography-700 dark:text-[#E8EBF0]">Cancel</ButtonText>
              </Button>
              <Button
                action="primary"
                className="rounded-xl bg-typography-900 dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
                onPress={handleAddAlias}
                isDisabled={adding}
              >
                {adding ? (
                  <ButtonSpinner className="text-background-0 dark:text-[#0A1628]" />
                ) : (
                  <ButtonIcon as={Plus} className="text-background-0 dark:text-[#0A1628]" />
                )}
                <ButtonText className="text-background-0 dark:text-[#0A1628]">
                  {adding ? "Adding..." : "Add Alias"}
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={Boolean(deleteTarget)} onClose={closeDeleteDialog}>
        <AlertDialogBackdrop className="bg-black/60" />
        <AlertDialogContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828] max-w-md p-6">
          <AlertDialogHeader className="pb-3">
            <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
              Remove alias
            </Heading>
            <AlertDialogCloseButton className="text-typography-600 dark:text-[#8A94A8]" />
          </AlertDialogHeader>
          <AlertDialogBody className="py-2">
            <Text className="text-sm text-typography-600 dark:text-[#9AA4B8]">
              {deleteTarget
                ? `Are you sure you want to remove ${deleteTarget.alias} -> ${deleteTarget.ip}?`
                : "Are you sure you want to remove this alias?"}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="pt-5 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="w-full justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-xl border-outline-200 dark:border-[#2A3B52]"
                onPress={closeDeleteDialog}
                isDisabled={Boolean(deletingKey)}
              >
                <ButtonText className="text-typography-700 dark:text-[#E8EBF0]">Cancel</ButtonText>
              </Button>
              <Button
                action="negative"
                className="rounded-xl"
                onPress={handleConfirmDelete}
                isDisabled={Boolean(deletingKey)}
              >
                {deletingKey ? <ButtonSpinner className="text-white" /> : null}
                <ButtonText className="text-white">{deletingKey ? "Removing..." : "Remove"}</ButtonText>
              </Button>
            </HStack>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
