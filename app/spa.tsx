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
          <VStack space="lg">
            <VStack space="xs">
              <HStack className="items-center gap-3">
                <Box className="rounded-2xl bg-background-0 border border-background-100 shadow-soft-1 p-3">
                  <ShieldCheck size={24} color="#0f172a" />
                </Box>
                <VStack space="xs">
                  <Heading size="2xl" className="text-typography-900">Single Packet Authorization</Heading>
                  <Text size="sm" className="text-typography-600 max-w-3xl">
                    Create password-protected ports for temporary access. Don't rely on SPA as your only line of defense.
                  </Text>
                </VStack>
              </HStack>
            </VStack>

            <Box className="rounded-2xl bg-background-0 border border-background-100 shadow-soft-1 p-4 md:p-5 gap-5">
              <VStack space="sm">
                <Heading size="lg" className="text-typography-900">New port</Heading>
                <Text size="sm" className="text-typography-500">
                  Choose a port and set a password to open access while the token remains valid.
                </Text>
              </VStack>

              <VStack space="md">
                <HStack className="gap-3 flex-wrap">
                  <Box className="flex-1 min-w-[180px]">
                    <Text size="xs" className="mb-2 text-typography-500">Port</Text>
                    <Input size="md" variant="rounded" isDisabled={saving}>
                      <InputField
                        keyboardType="numeric"
                        placeholder="25565"
                        value={portInput}
                        onChangeText={setPortInput}
                      />
                    </Input>
                  </Box>
                  <Box className="flex-1 min-w-[200px]">
                    <Text size="xs" className="mb-2 text-typography-500">Password</Text>
                    <Input size="md" variant="rounded" isDisabled={saving}>
                      <InputField
                        secureTextEntry
                        placeholder="SPA password"
                        value={password}
                        onChangeText={setPassword}
                      />
                    </Input>
                  </Box>
                </HStack>
                <HStack className="items-center gap-3 flex-wrap">
                  <Button
                    action="primary"
                    className="rounded-full"
                    onPress={handleCreate}
                    isDisabled={saving}
                  >
                    {saving ? <ButtonSpinner /> : <ButtonIcon as={Plus} className="mr-1" />}
                    <ButtonText>{saving ? "Saving..." : "Create port"}</ButtonText>
                  </Button>
                  <Text size="xs" className="text-typography-500">
                    Once created, you can copy the link to share access.
                  </Text>
                </HStack>
              </VStack>
            </Box>

            <Box className="rounded-2xl bg-background-0 border border-background-100 shadow-soft-1 p-4 md:p-5 gap-4">
              <HStack className="items-center justify-between flex-wrap gap-3">
                <Heading size="lg" className="text-typography-900">Configured ports</Heading>
                {loading ? <Text size="sm" className="text-typography-500">Loading...</Text> : null}
              </HStack>

              {loading ? (
                <VStack space="md" className="mt-2">
                  {[1, 2, 3].map((item) => (
                    <Box
                      key={item}
                      className="h-16 rounded-2xl bg-background-50 border border-background-100"
                    />
                  ))}
                </VStack>
              ) : ports.length === 0 ? (
                <Box className="border border-dashed border-background-100 rounded-2xl p-6 bg-background-50 gap-2">
                  <Heading size="sm" className="text-typography-900">No SPA ports</Heading>
                  <Text size="sm" className="text-typography-600">Create a port to generate an access link.</Text>
                </Box>
              ) : (
                <VStack space="md" className="mt-1">
                  {ports.map((item) => (
                    <Pressable
                      key={item.port}
                      className="rounded-2xl active:opacity-80"
                      onPress={() => setAllowTarget(item)}
                    >
                      <HStack className="items-center justify-between bg-background-50 border border-background-100 rounded-2xl px-4 py-3">
                        <VStack space="xs">
                          <Heading size="sm" className="text-typography-900">Port {item.port}</Heading>
                          <Text size="xs" className="text-typography-600">Created at {formatDate(item.created_at)}</Text>
                          <Text size="xs" className="text-typography-500">Tap to view allow list</Text>
                        </VStack>
                        <HStack space="sm" className="items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onPress={() => copyAccessLink(item.port)}
                          >
                            <ButtonIcon as={Copy} />
                            <ButtonText>Copy link</ButtonText>
                          </Button>
                          <Button
                            action="negative"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onPress={() => setDeleteTarget(item)}
                          >
                            {deletingPort === item.port ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
                            <ButtonText>Remove</ButtonText>
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
          <AlertDialogBackdrop />
          <AlertDialogContent>
            <AlertDialogHeader>
              <Text className="font-semibold text-lg">Remove port</Text>
              <AlertDialogCloseButton />
            </AlertDialogHeader>
            <AlertDialogBody className="gap-2">
              <Text size="sm">Confirm removing port {deleteTarget?.port}? Access will be revoked.</Text>
            </AlertDialogBody>
            <AlertDialogFooter className="gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onPress={() => setDeleteTarget(null)}
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button
                action="negative"
                className="flex-1 rounded-full"
                onPress={confirmDelete}
                isDisabled={deletingPort !== null}
              >
                {deletingPort ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
                <ButtonText>Remove</ButtonText>
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Modal isOpen={Boolean(allowTarget)} onClose={() => setAllowTarget(null)}>
          <ModalBackdrop />
          <ModalContent>
            <ModalHeader>
              <VStack space="xs">
                <Heading size="md" className="text-typography-900">
                  SPA allow list
                </Heading>
              </VStack>
              <ModalCloseButton />
            </ModalHeader>
            <ModalBody className="gap-3">
              {allowLoading ? (
                <HStack className="items-center gap-2">
                  <ButtonSpinner />
                  <Text size="sm" className="text-typography-500">Loading allow list...</Text>
                </HStack>
              ) : allowError ? (
                <Text size="sm" className="text-typography-600">{allowError}</Text>
              ) : allowCountdown?.allows?.length ? (
                <VStack space="sm">
                  {allowCountdown.allows.map((entry) => (
                    <HStack
                      key={`${entry.ip}-${entry.remaining_seconds}`}
                      className="items-center justify-between bg-background-50 border border-background-100 rounded-xl px-3 py-2"
                    >
                      <Text size="sm" className="text-typography-900">{entry.ip}</Text>
                      <Text size="sm" className="text-typography-600">
                        {formatRemainingSeconds(entry.remaining_seconds)}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              ) : (
                <Text size="sm" className="text-typography-500">
                  No active allows for this port.
                </Text>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" className="rounded-full" onPress={() => setAllowTarget(null)}>
                <ButtonText>Close</ButtonText>
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </ScrollView>
    </Box>
  );
}
