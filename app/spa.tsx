import React from "react";
import {RefreshControl, ScrollView} from "react-native";
import * as Clipboard from "expo-clipboard";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {VStack} from "@/components/ui/vstack";
import {HStack} from "@/components/ui/hstack";
import {Input, InputField} from "@/components/ui/input";
import {Button, ButtonIcon, ButtonSpinner, ButtonText} from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import {Toast, ToastDescription, ToastTitle, useToast} from "@/components/ui/toast";
import {Divider} from "@/components/ui/divider";
import {useAuthGuard} from "@/hooks/useAuthGuard";
import {SpaPort} from "@/types/spa";
import {createSpaPort, deleteSpaPort, listSpaPorts} from "@/services/spa";
import {Plus, ShieldCheck, Trash2, Copy} from "lucide-react-native";
import {getApiBaseUrl} from "@/config/apiConfig";

const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function SpaScreen() {
  const {isChecking} = useAuthGuard("/");
  const toast = useToast();
  const [ports, setPorts] = React.useState<SpaPort[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [portInput, setPortInput] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<SpaPort | null>(null);
  const [deletingPort, setDeletingPort] = React.useState<number | null>(null);

  const showToast = React.useCallback(
    (title: string, description: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: ({id}) => (
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
      await createSpaPort({port: parsedPort, password});
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

  return (
    <ScrollView
      className="flex-1 bg-background-0"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadPorts("refresh")} />
      }
    >
      <Box className="w-full max-w-5xl self-center px-4 md:px-6 py-8 gap-6">
        <VStack space="md">
          <HStack className="items-center justify-between">
            <HStack className="items-center gap-3">
              <Box className="bg-primary-500/10 rounded-2xl p-3">
                <ShieldCheck size={22} color="#0f172a" />
              </Box>
              <VStack space="xs">
                <Heading size="xl">Single Packet Authorization</Heading>
                <Text size="sm" className="text-typography-500">
                  Manage SPA ports: create password-protected access and remove it when no longer
                  needed. IMPORTANT: ports may be open for everyone for some seconds or when hyperhive crashes, do not use this as a unique authorization
                </Text>
              </VStack>
            </HStack>
          </HStack>

          <Box className="bg-background-50 border border-outline-200 rounded-2xl p-4 md:p-5 gap-4">
            <Heading size="md">New SPA port</Heading>
            <VStack space="md">
              <HStack className="gap-3 flex-wrap">
                <Box className="flex-1 min-w-[180px]">
                  <Text size="xs" className="mb-2 text-typography-500">
                    Port
                  </Text>
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
                  <Text size="xs" className="mb-2 text-typography-500">
                    Password
                  </Text>
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
              <Button
                action="primary"
                className="self-start rounded-full"
                onPress={handleCreate}
                isDisabled={saving}
              >
                {saving ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonIcon as={Plus} className="mr-1" />
                )}
                <ButtonText>{saving ? "Saving..." : "Create SPA access"}</ButtonText>
              </Button>
            </VStack>
          </Box>

          <Divider />

          <VStack space="sm">
            <HStack className="items-center justify-between">
              <Heading size="md">Configured ports</Heading>
              {loading ? <Text size="sm">Loading...</Text> : null}
            </HStack>
            {loading ? (
              <VStack space="md" className="mt-2">
                {[1, 2, 3].map((item) => (
                  <Box
                    key={item}
                    className="h-16 rounded-2xl bg-background-100 border border-outline-200"
                  />
                ))}
              </VStack>
            ) : ports.length === 0 ? (
              <Box className="border border-dashed border-outline-200 rounded-2xl p-6 items-start gap-2 bg-background-50">
                <Heading size="sm">No SPA ports</Heading>
                <Text size="sm" className="text-typography-500">
                  Add a port to generate protected access.
                </Text>
              </Box>
            ) : (
              <VStack space="md" className="mt-1">
                {ports.map((item) => (
                  <HStack
                    key={item.port}
                    className="items-center justify-between bg-background-50 border border-outline-200 rounded-2xl px-4 py-3"
                  >
                    <VStack space="xs">
                      <Heading size="sm">Porta {item.port}</Heading>
                      <Text size="xs" className="text-typography-500">
                        Criada em {formatDate(item.created_at)}
                      </Text>
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
                        {deletingPort === item.port ? (
                          <ButtonSpinner />
                        ) : (
                          <ButtonIcon as={Trash2} />
                        )}
                        <ButtonText>Remover</ButtonText>
                      </Button>
                    </HStack>
                  </HStack>
                ))}
              </VStack>
            )}
          </VStack>
        </VStack>
      </Box>

      <AlertDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Text className="font-semibold text-lg">Remove SPA port</Text>
            <AlertDialogCloseButton />
          </AlertDialogHeader>
          <AlertDialogBody className="gap-2">
            <Text size="sm">
              Are you sure you want to remove port {deleteTarget?.port}? SPA access will be revoked.
            </Text>
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
    </ScrollView>
  );
}
