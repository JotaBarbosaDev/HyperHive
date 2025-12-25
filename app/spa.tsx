import React from "react";
import { RefreshControl, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
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
import { SpaAllowResponse, SpaPort } from "@/types/spa";
import { createSpaPort, deleteSpaPort, getSpaAllow, listSpaPorts } from "@/services/spa";
import { Copy, Plus, ShieldCheck, Trash2 } from "lucide-react-native";
import { getApiBaseUrl } from "@/config/apiConfig";

const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRemainingSeconds = (value: number) => {
  if (!Number.isFinite(value)) return String(value);
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

export default function SpaScreen() {
  const { isChecking } = useAuthGuard("/");
  const toast = useToast();
  const [ports, setPorts] = React.useState<SpaPort[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [portInput, setPortInput] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<SpaPort | null>(null);
  const [deletingPort, setDeletingPort] = React.useState<number | null>(null);
  const [allowTarget, setAllowTarget] = React.useState<SpaPort | null>(null);
  const [allowInfo, setAllowInfo] = React.useState<SpaAllowResponse | null>(null);
  const [allowLoading, setAllowLoading] = React.useState(false);
  const [allowError, setAllowError] = React.useState<string | null>(null);
  const [allowCountdown, setAllowCountdown] = React.useState<SpaAllowResponse | null>(null);
  const modalBackdropClass = "bg-background-950/60 dark:bg-black/70";
  const modalShellClass = "w-full rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]";
  const modalHeaderClass = "flex-row items-start justify-between px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#1E2F47]";
  const modalBodyClass = "px-6 pt-5 pb-6 max-h-[70vh] overflow-y-auto";
  const modalFooterClass = "gap-3 px-6 pt-4 pb-6 border-t border-outline-100 dark:border-[#1E2F47]";
  const alertBodyClass = "px-6 pt-4 pb-6 gap-2";
  const alertFooterClass = "gap-2 px-6 pt-4 pb-6 border-t border-outline-100 dark:border-[#1E2F47]";
  const cardShellClass = "rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E] shadow-soft-1";
  const softCardShellClass = "rounded-xl border border-outline-100 bg-background-50 dark:border-[#1E2F47] dark:bg-[#132038]";
  const outlineButtonClass = "border-outline-200 rounded-xl dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] hover:bg-background-50 dark:hover:bg-[#0A1628]";
  const outlineButtonTextClass = "text-typography-900 dark:text-[#E8EBF0]";
  const outlineButtonIconClass = "text-typography-900 dark:text-[#E8EBF0]";
  const dangerOutlineTextClass = "text-error-600 dark:text-error-400";
  const dangerOutlineIconClass = "text-error-600 dark:text-error-400";
  const inputShellClass = "rounded-xl border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E]";
  const inputFieldClass = "text-typography-900 dark:text-[#E8EBF0] placeholder:text-typography-500 dark:placeholder:text-[#9AA4B8]";

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

  const loadPorts = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await listSpaPorts();
        setPorts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load SPA ports", err);
        showToast("Load error", "Could not fetch SPA ports.", "error");
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [showToast]
  );

  React.useEffect(() => {
    if (!isChecking) {
      loadPorts();
    }
  }, [isChecking, loadPorts]);

  const handleCreate = async () => {
    const parsedPort = Number(portInput);
    if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      showToast("Invalid port", "Enter a port number between 1 and 65535.", "error");
      return;
    }
    if (!password.trim()) {
      showToast("Password missing", "Set a password for the SPA port.", "error");
      return;
    }
    setSaving(true);
    try {
      await createSpaPort({ port: parsedPort, password });
      showToast("SPA created", `Port ${parsedPort} authorized successfully.`);
      setPortInput("");
      setPassword("");
      await loadPorts("silent");
    } catch (err) {
      console.error("Failed to create SPA port", err);
      showToast("Create error", "Could not create SPA port.", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingPort(deleteTarget.port);
    try {
      await deleteSpaPort(deleteTarget.port);
      showToast("SPA removed", `Port ${deleteTarget.port} has been removed.`);
      setDeleteTarget(null);
      await loadPorts("silent");
    } catch (err) {
      console.error("Failed to delete SPA port", err);
      showToast("Delete error", "Could not remove the port.", "error");
    } finally {
      setDeletingPort(null);
    }
  };

  const copyAccessLink = async (port: number) => {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) {
      showToast("API not configured", "Set the API domain before copying the link.", "error");
      return;
    }
    const link = `${baseUrl.replace(/\/+$/, "")}/spa/pageallow/${port}`;
    try {
      await Clipboard.setStringAsync(link);
      showToast("Link copied", "SPA access link copied.");
    } catch (err) {
      console.error("Failed to copy SPA link", err);
      showToast("Copy error", "Could not copy the link.", "error");
    }
  };

  React.useEffect(() => {
    if (!allowTarget) {
      setAllowInfo(null);
      setAllowError(null);
      setAllowLoading(false);
      setAllowCountdown(null);
      return;
    }

    let isActive = true;
    const loadAllow = async (mode: "full" | "silent" = "full") => {
      if (mode === "full") {
        setAllowLoading(true);
        setAllowError(null);
      }
      try {
        const data = await getSpaAllow(allowTarget.port);
        if (!isActive) return;
        setAllowInfo(data);
        setAllowCountdown(data);
      } catch (err) {
        if (!isActive) return;
        console.error("Failed to load SPA allow list", err);
        setAllowError("Could not fetch SPA allow list.");
      } finally {
        if (!isActive) return;
        if (mode === "full") setAllowLoading(false);
      }
    };

    loadAllow("full");
    const interval = setInterval(() => {
      loadAllow("silent");
    }, 5000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [allowTarget]);

  React.useEffect(() => {
    if (!allowTarget || !allowCountdown?.allows?.length) {
      return;
    }

    const interval = setInterval(() => {
      setAllowCountdown((current) => {
        if (!current) return current;
        const updated = current.allows
          .map((entry) => ({
            ...entry,
            remaining_seconds: Math.max(0, entry.remaining_seconds - 1),
          }))
          .filter((entry) => entry.remaining_seconds > 0);
        return { ...current, allows: updated };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [allowTarget, allowCountdown?.allows?.length]);

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPorts("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <VStack className="gap-2 mb-6">
            <Heading
              size="2xl"
              className="text-typography-900 dark:text-[#E8EBF0] mb-1 web:text-4xl"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              Single Packet Authorization
            </Heading>
            <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
              Create password-protected ports for temporary access. Don't rely on SPA as your only line of defense.
            </Text>
          </VStack>

          <VStack space="lg">
            <Box className={`p-4 md:p-5 gap-5 ${cardShellClass}`}>
              <VStack space="sm">
                <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">New port</Heading>
                <Text size="sm" className="text-typography-600 dark:text-[#9AA4B8]">
                  Choose a port and set a password to open access while the token remains valid.
                </Text>
              </VStack>

              <VStack space="md">
                <HStack className="gap-3 flex-wrap">
                  <Box className="flex-1 min-w-[180px]">
                    <Text size="xs" className="mb-2 text-typography-700 dark:text-[#9AA4B8]">Port</Text>
                    <Input size="md" isDisabled={saving} className={inputShellClass}>
                      <InputField
                        keyboardType="numeric"
                        placeholder="25565"
                        value={portInput}
                        onChangeText={setPortInput}
                        className={inputFieldClass}
                      />
                    </Input>
                  </Box>
                  <Box className="flex-1 min-w-[200px]">
                    <Text size="xs" className="mb-2 text-typography-700 dark:text-[#9AA4B8]">Password</Text>
                    <Input size="md" isDisabled={saving} className={inputShellClass}>
                      <InputField
                        secureTextEntry
                        placeholder="SPA password"
                        value={password}
                        onChangeText={setPassword}
                        className={inputFieldClass}
                      />
                    </Input>
                  </Box>
                </HStack>
                <HStack className="items-center gap-3 flex-wrap">
                  <Button
                    action="primary"
                    className="rounded-xl px-5"
                    onPress={handleCreate}
                    isDisabled={saving}
                  >
                    {saving ? <ButtonSpinner /> : <ButtonIcon as={Plus} className="mr-1" />}
                    <ButtonText style={{ fontFamily: "Inter_600SemiBold" }}>{saving ? "Saving..." : "Create port"}</ButtonText>
                  </Button>
                  <Text size="xs" className="text-typography-600 dark:text-[#9AA4B8]">
                    Once created, you can copy the link to share access.
                  </Text>
                </HStack>
              </VStack>
            </Box>

            <Box className={`p-4 md:p-5 gap-4 ${cardShellClass}`}>
              <HStack className="items-center justify-between flex-wrap gap-3">
                <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">Configured ports</Heading>
                {loading ? <Text size="sm" className="text-typography-600 dark:text-[#9AA4B8]">Loading...</Text> : null}
              </HStack>

              {loading ? (
                <VStack space="md" className="mt-2">
                  {[1, 2, 3].map((item) => (
                    <Box
                      key={item}
                      className={`h-16 ${softCardShellClass}`}
                    />
                  ))}
                </VStack>
              ) : ports.length === 0 ? (
                <Box className={`border border-dashed p-6 gap-2 ${softCardShellClass}`}>
                  <Heading size="sm" className="text-typography-900 dark:text-[#E8EBF0]">No SPA ports</Heading>
                  <Text size="sm" className="text-typography-600 dark:text-[#9AA4B8]">Create a port to generate an access link.</Text>
                </Box>
              ) : (
                <VStack space="md" className="mt-1">
                  {ports.map((item) => (
                    <Pressable
                      key={item.port}
                      className="rounded-xl active:opacity-80"
                      onPress={() => setAllowTarget(item)}
                    >
                      <HStack className={`items-center justify-between px-4 py-3 ${softCardShellClass}`}>
                        <VStack space="xs">
                          <Heading size="sm" className="text-typography-900 dark:text-[#E8EBF0]">Port {item.port}</Heading>
                          <Text size="xs" className="text-typography-600 dark:text-[#9AA4B8]">Created at {formatDate(item.created_at)}</Text>
                          <Text size="xs" className="text-typography-600 dark:text-[#9AA4B8]">Tap to view allow list</Text>
                        </VStack>
                        <HStack space="sm" className="items-center">
                          <Button
                            variant="outline"
                            action="default"
                            size="sm"
                            className={outlineButtonClass}
                            onPress={() => copyAccessLink(item.port)}
                          >
                            <ButtonIcon as={Copy} className={outlineButtonIconClass} />
                            <ButtonText className={outlineButtonTextClass}>Copy link</ButtonText>
                          </Button>
                          <Button
                            action="negative"
                            variant="outline"
                            size="sm"
                            className={outlineButtonClass}
                            onPress={() => setDeleteTarget(item)}
                          >
                            {deletingPort === item.port ? <ButtonSpinner /> : <ButtonIcon as={Trash2} className={dangerOutlineIconClass} />}
                            <ButtonText className={dangerOutlineTextClass}>Remove</ButtonText>
                          </Button>
                        </HStack>
                      </HStack>
                    </Pressable>
                  ))}
                </VStack>
              )}
            </Box>
          </VStack>
        </Box>

        <AlertDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
          <AlertDialogBackdrop className={modalBackdropClass} />
          <AlertDialogContent className={`max-w-lg ${modalShellClass}`}>
            <AlertDialogHeader className={modalHeaderClass}>
              <Text className="font-semibold text-lg text-typography-900 dark:text-[#E8EBF0]">Remove port</Text>
              <AlertDialogCloseButton className="text-typography-500 dark:text-[#9AA4B8]" />
            </AlertDialogHeader>
            <AlertDialogBody className={alertBodyClass}>
              <Text size="sm" className="text-typography-700 dark:text-[#9AA4B8]">
                Confirm removing port {deleteTarget?.port}? Access will be revoked.
              </Text>
            </AlertDialogBody>
            <AlertDialogFooter className={alertFooterClass}>
              <Button
                variant="outline"
                action="default"
                className={`flex-1 ${outlineButtonClass}`}
                onPress={() => setDeleteTarget(null)}
              >
                <ButtonText className={outlineButtonTextClass}>Cancel</ButtonText>
              </Button>
              <Button
                action="negative"
                variant="outline"
                className={`flex-1 ${outlineButtonClass}`}
                onPress={confirmDelete}
                isDisabled={deletingPort !== null}
              >
                {deletingPort ? <ButtonSpinner /> : <ButtonIcon as={Trash2} className={dangerOutlineIconClass} />}
                <ButtonText className={dangerOutlineTextClass}>Remove</ButtonText>
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Modal isOpen={Boolean(allowTarget)} onClose={() => setAllowTarget(null)}>
          <ModalBackdrop className={modalBackdropClass} />
          <ModalContent className={`max-w-2xl max-h-[90vh] ${modalShellClass}`}>
            <ModalHeader className={modalHeaderClass}>
              <VStack space="xs">
                <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
                  SPA allow list
                </Heading>
              </VStack>
              <ModalCloseButton className="text-typography-500 dark:text-[#9AA4B8]" />
            </ModalHeader>
            <ModalBody className={`${modalBodyClass} gap-3`}>
              {allowLoading ? (
                <HStack className="items-center gap-2">
                  <ButtonSpinner />
                  <Text size="sm" className="text-typography-600 dark:text-[#9AA4B8]">Loading allow list...</Text>
                </HStack>
              ) : allowError ? (
                <Text size="sm" className="text-typography-600 dark:text-[#9AA4B8]">{allowError}</Text>
              ) : allowCountdown?.allows?.length ? (
                <VStack space="sm">
                  {allowCountdown.allows.map((entry) => (
                    <HStack
                      key={`${entry.ip}-${entry.remaining_seconds}`}
                      className={`items-center justify-between px-3 py-2 ${softCardShellClass}`}
                    >
                      <Text size="sm" className="text-typography-900 dark:text-[#E8EBF0]">{entry.ip}</Text>
                      <Text size="sm" className="text-typography-600 dark:text-[#9AA4B8]">
                        {formatRemainingSeconds(entry.remaining_seconds)}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              ) : (
                <Text size="sm" className="text-typography-600 dark:text-[#9AA4B8]">
                  No active allows for this port.
                </Text>
              )}
            </ModalBody>
            <ModalFooter className={modalFooterClass}>
              <Button variant="outline" action="default" className={outlineButtonClass} onPress={() => setAllowTarget(null)}>
                <ButtonText className={outlineButtonTextClass}>Close</ButtonText>
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </ScrollView>
    </Box>
  );
}
