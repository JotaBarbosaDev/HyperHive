import React from "react";
import { ScrollView, RefreshControl, useColorScheme, Alert, Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton } from "@/components/ui/modal";
import { Toast, ToastTitle, useToast } from "@/components/ui/toast";
import { Fab, FabIcon } from "@/components/ui/fab";
import { Shield, Copy, Plus, Trash2, Info } from "lucide-react-native";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useWireguard } from "@/hooks/useWireguard";
import { WireguardPeer } from "@/types/wireguard";

type WireGuardConfig = {
  endpoint: string;
  publicKey: string;
  network: string;
};

const formatAllowedIps = (peer: WireguardPeer) => {
  const allowed = peer.wireguard?.AllowedIPs;
  if (allowed && allowed.length) {
    const labels = allowed.map((item) => item.IP || "").filter(Boolean);
    if (labels.length) {
      return labels.join(", ");
    }
  }
  return peer.client_ip || "—";
};

const buildEndpointLabel = (peer?: WireguardPeer, fallbackEndpoint?: string) => {
  const endpoint = peer?.wireguard?.Endpoint;
  if (endpoint?.IP) {
    return endpoint.Port ? `${endpoint.IP}:${endpoint.Port}` : endpoint.IP;
  }
  return fallbackEndpoint || "Waiting for endpoint";
};

export default function WireGuardScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const { token, isChecking } = useAuthGuard();
  const {
    peers,
    vpnReady,
    isLoading,
    isRefreshing,
    error,
    refresh,
    createVpn,
    addPeer,
    removePeer,
  } = useWireguard({ token });
  const [creatingVpn, setCreatingVpn] = React.useState(false);
  const [creatingPeer, setCreatingPeer] = React.useState(false);
  const [deletingPeerId, setDeletingPeerId] = React.useState<number | string | null>(null);
  const [showCreateVpnModal, setShowCreateVpnModal] = React.useState(false);
  const [showAddPeerModal, setShowAddPeerModal] = React.useState(false);
  const [formPeerName, setFormPeerName] = React.useState("");
  const [formPeerEndpoint, setFormPeerEndpoint] = React.useState("");
  const [formPeerKeepalive, setFormPeerKeepalive] = React.useState("25");

  const downloadConfigFile = React.useCallback(async (configText: string) => {
    const filename = "wg0.conf";

    if (Platform.OS === "web") {
      const blob = new Blob([configText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return filename;
    }

    const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    if (!baseDir) {
      throw new Error("Unable to access the storage directory.");
    }

    const targetPath = `${baseDir}${filename}`;
    await FileSystem.writeAsStringAsync(targetPath, configText, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(targetPath, {
        mimeType: "text/plain",
        dialogTitle: filename,
        UTI: "public.plain-text",
      });
    }

    return targetPath;
  }, []);

  const vpnConfig = React.useMemo<WireGuardConfig | null>(() => {
    if (!vpnReady) {
      return null;
    }
    const firstPeer = peers[0];
    return {
      endpoint: buildEndpointLabel(firstPeer, formPeerEndpoint),
      publicKey: firstPeer?.public_key ?? "Generated after creating peers",
      network: firstPeer?.client_ip ?? "Waiting for peers",
    };
  }, [vpnReady, peers, formPeerEndpoint]);

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    toast.show({
      placement: "top",
      render: ({ id }) => (
        <Toast
          nativeID={"toast-" + id}
          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
          action="success"
        >
          <ToastTitle size="sm">{label} copied!</ToastTitle>
        </Toast>
      ),
    });
  };

  const truncateMiddle = (str: string, maxLength: number = 40): string => {
    if (str.length <= maxLength) return str;
    const half = Math.floor(maxLength / 2);
    return `${str.slice(0, half)}...${str.slice(-half)}`;
  };

  const deletePeer = React.useCallback(
    async (peer: WireguardPeer) => {
      setDeletingPeerId(peer.id);
      try {
        await removePeer(peer.id);
        toast.show({
          placement: "top",
          render: ({ id }) => (
        <Toast
          nativeID={"toast-" + id}
          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
          action="success"
        >
          <ToastTitle size="sm">Peer removed</ToastTitle>
        </Toast>
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to remove the peer.";
        toast.show({
          placement: "top",
          render: ({ id }) => (
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
        setDeletingPeerId(null);
      }
    },
    [removePeer, toast]
  );

  const handleCreateVpn = async () => {
    if (creatingVpn) return;
    setCreatingVpn(true);
    try {
      await createVpn();
      setShowCreateVpnModal(false);
      toast.show({
        placement: "top",
        render: ({ id }) => (
      <Toast
        nativeID={"toast-" + id}
        className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
        action="success"
      >
        <ToastTitle size="sm">VPN created successfully!</ToastTitle>
      </Toast>
    ),
  });
} catch (err) {
  const message = err instanceof Error ? err.message : "Unable to create the VPN.";
      toast.show({
        placement: "top",
        render: ({ id }) => (
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
      setCreatingVpn(false);
    }
  };

  const handleAddPeer = async () => {
    if (!formPeerName.trim() || !formPeerEndpoint.trim()) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action="error"
          >
            <ToastTitle size="sm">Fill in name and endpoint</ToastTitle>
          </Toast>
        ),
      });
      return;
    }

    const keepalive = Number(formPeerKeepalive);
    const keepaliveSeconds = Number.isFinite(keepalive) ? keepalive : undefined;

    setCreatingPeer(true);
    try {
      const configText = await addPeer({
        name: formPeerName.trim(),
        endpoint: formPeerEndpoint.trim(),
        keepalive_seconds: keepaliveSeconds,
      });
      if (!configText) {
        throw new Error("Unable to get the peer configuration.");
      }

      await downloadConfigFile(configText);
      setShowAddPeerModal(false);
      setFormPeerName("");
      setFormPeerEndpoint("");
      setFormPeerKeepalive("25");

      toast.show({
        placement: "top",
        render: ({ id }) => (
        <Toast
          nativeID={"toast-" + id}
          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
          action="success"
        >
          <ToastTitle size="sm">Peer added and wg0.conf generated!</ToastTitle>
        </Toast>
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to add the peer.";
      toast.show({
        placement: "top",
        render: ({ id }) => (
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
      setCreatingPeer(false);
    }
  };

  const handleDeletePeer = (peer: WireguardPeer) => {
    const confirmMessage = `Are you sure you want to remove peer "${peer.name}"?`;

    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined" ? window.confirm(confirmMessage) : true;
      if (confirmed) {
        void deletePeer(peer);
      }
      return;
    }

    Alert.alert("Confirm Deletion", confirmMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void deletePeer(peer);
        },
      },
    ]);
  };

  const handleRefresh = async () => {
    await refresh();
  };

  if (isChecking || !token) {
    return null;
  }

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || (isLoading && peers.length === 0)}
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
            style={{ fontFamily: "Inter_700Bold" }}
          >
            WireGuard VPN
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl mb-6">
            Configure and manage the WireGuard VPN for secure cluster access with end-to-end encryption.
          </Text>

          {error ? (
            <Box className="p-3 mb-4 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1212]">
              <Text
                className="text-[#B91C1C] dark:text-[#FCA5A5]"
                style={{ fontFamily: "Inter_500Medium" }}
              >
                {error}
              </Text>
            </Box>
          ) : null}

          {!vpnConfig ? (
            isLoading ? (
              <Box className="p-6 web:rounded-2xl web:bg-background-0/80 dark:web:bg-[#151F30]/80 mt-6">
                <Text
                  className="text-typography-600 dark:text-typography-400 text-center"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Loading VPN information...
                </Text>
              </Box>
            ) : (
              // Empty State
              <Box className="p-12 web:rounded-2xl web:bg-background-0/80 dark:web:bg-[#151F30]/80 mt-6">
                <VStack className="items-center gap-6">
                  <Shield size={64} className="text-[#CBD5E1] dark:text-[#64748B]" />
                  <Heading
                    size="xl"
                    className="text-typography-900 dark:text-[#E8EBF0] text-center"
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    No VPN Configured
                  </Heading>
                  <Text
                    className="text-typography-600 dark:text-typography-400 text-center max-w-md"
                    style={{ fontFamily: "Inter_400Regular" }}
                  >
                    Set up a WireGuard VPN to securely connect to your cluster from anywhere.
                  </Text>
                  <Button
                    size="lg"
                    className="rounded-lg bg-typography-900 dark:bg-[#E8EBF0] mt-4"
                    onPress={() => setShowCreateVpnModal(true)}
                  >
                    <ButtonIcon as={Plus} className="text-background-0 dark:text-typography-900" />
                    <ButtonText
                      className="text-background-0 dark:text-typography-900"
                      style={{ fontFamily: "Inter_600SemiBold" }}
                    >
                      Create VPN
                    </ButtonText>
                  </Button>
                </VStack>
              </Box>
            )
          ) : (
            // VPN Configurada
            <VStack className="gap-6 mt-6">

              {/* Card de Peers */}
              <Box className="rounded-2xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] overflow-hidden web:shadow-md dark:web:shadow-none">
                {/* Header */}
                <Box className="border-b border-outline-100 dark:border-[#2A3B52] p-6">
                  <HStack className="justify-between items-center">
                    <Heading
                      size="lg"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                      style={{ fontFamily: "Inter_700Bold" }}
                    >
                      Peers ({peers.length})
                    </Heading>
                    <Box className="hidden web:flex">
                      <Button
                        size="md"
                        className="rounded-lg bg-typography-900 dark:bg-[#E8EBF0]"
                        onPress={() => setShowAddPeerModal(true)}
                      >
                        <ButtonIcon as={Plus} className="text-background-0 dark:text-typography-900" />
                        <ButtonText className="text-background-0 dark:text-typography-900">
                          Add Peer
                        </ButtonText>
                      </Button>
                    </Box>
                  </HStack>
                </Box>

                {/* Table */}
                {peers.length === 0 ? (
                  <Box className="p-8">
                    <Text
                      className="text-center text-typography-600 dark:text-typography-400"
                      style={{ fontFamily: "Inter_400Regular" }}
                    >
                      No peers configured
                    </Text>
                  </Box>
                ) : (
                  <Box className="overflow-x-auto">
                    <Box className="min-w-[900px]">
                      {/* Table Header */}
                      <HStack className="bg-background-50 dark:bg-[#0A1628] px-6 py-3 border-b border-outline-100 dark:border-[#1E2F47]">
                        <Text
                          className="flex-1 min-w-[120px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          NAME
                        </Text>
                        <Text
                          className="w-[120px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          IP
                        </Text>
                        <Text
                          className="flex-1 min-w-[200px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          PUBLIC KEY
                        </Text>
                        <Text
                          className="w-[140px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          ALLOWED IPS
                        </Text>
                        <Text
                          className="w-[80px] text-xs text-[#9AA4B8] dark:text-[#8A94A8] text-right"
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          ACTIONS
                        </Text>
                      </HStack>

                      {/* Table Rows */}
                      {peers.map((peer, index) => (
                        <HStack
                          key={peer.id}
                          className={`px-6 py-4 items-center ${index !== peers.length - 1
                              ? "border-b border-outline-100 dark:border-[#1E2F47]"
                              : ""
                            }`}
                        >
                          <Text
                            className="flex-1 min-w-[120px] text-sm text-typography-900 dark:text-[#E8EBF0]"
                            style={{ fontFamily: "Inter_500Medium" }}
                          >
                            {peer.name}
                          </Text>
                          <Text
                            className="w-[120px] text-sm text-typography-600 dark:text-typography-400"
                            style={{ fontFamily: "Inter_400Regular" }}
                          >
                            {peer.client_ip?.split("/")[0] ?? "—"}
                          </Text>
                          <HStack className="flex-1 min-w-[200px] items-center gap-2">
                            <Text
                              className="flex-1 text-sm text-typography-600 dark:text-typography-400"
                              style={{ fontFamily: "Inter_400Regular" }}
                            >
                              {truncateMiddle(peer.public_key, 30)}
                            </Text>
                            <Button
                              variant="link"
                              size="xs"
                              onPress={() => copyToClipboard(peer.public_key, "Public Key")}
                            >
                              <ButtonIcon
                                as={Copy}
                                size="sm"
                                className="text-typography-600 dark:text-typography-400"
                              />
                            </Button>
                          </HStack>
                          <Text
                            className="w-[140px] text-sm text-typography-600 dark:text-typography-400"
                            style={{ fontFamily: "Inter_400Regular" }}
                          >
                            {formatAllowedIps(peer)}
                          </Text>
                          <HStack className="w-[80px] justify-end">
                            <Button
                              variant="outline"
                              size="xs"
                              className="rounded-md border-red-500"
                              onPress={() => handleDeletePeer(peer)}
                              isDisabled={deletingPeerId === peer.id}
                            >
                              {deletingPeerId === peer.id ? (
                                <ButtonSpinner className="text-red-500" />
                              ) : (
                                <ButtonIcon as={Trash2} size="xs" className="text-red-500" />
                              )}
                            </Button>
                          </HStack>
                        </HStack>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </VStack>
          )}
        </Box>
      </ScrollView>

      {/* FAB - Mobile only - Adicionar Peer */}
      {Platform.OS !== "web" && vpnConfig && (
        <Fab
          size="lg"
          placement="bottom right"
          className="bg-typography-900 dark:bg-[#E8EBF0] shadow-lg"
          onPress={() => setShowAddPeerModal(true)}
        >
          <FabIcon as={Plus} className="text-background-0 dark:text-typography-900" />
        </Fab>
      )}

      {/* Modal: Create VPN */}
      <Modal isOpen={showCreateVpnModal} onClose={() => setShowCreateVpnModal(false)}>
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4">
            <Heading
              size="lg"
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              Create WireGuard VPN
            </Heading>
            <ModalCloseButton className="text-typography-600 dark:text-typography-400" />
          </ModalHeader>
          <ModalBody className="py-4">
            <VStack className="gap-5">
              {/* Info Box Azul */}
              <HStack className="bg-[#EFF6FF] dark:bg-[#1E3A8A20] p-4 rounded-lg gap-3 items-start">
                <Info size={20} className="text-[#1E3A8A] dark:text-[#60A5FA] mt-0.5" />
                <Text
                  className="flex-1 text-sm text-[#1E3A8A] dark:text-[#93C5FD]"
                  style={{ fontFamily: "Inter_400Regular" }}
                >
                  Public and private keys will be generated automatically and the WireGuard interface will be initialized.
                </Text>
              </HStack>

              <Text
                className="text-sm text-typography-600 dark:text-typography-400"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                After it is created, use the add peer button to generate client configurations.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter className="pt-6 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="justify-end gap-3 w-full">
              <Button
                variant="outline"
                className="rounded-lg px-6 py-2.5 border-outline-200 dark:border-[#2A3B52]"
                onPress={() => setShowCreateVpnModal(false)}
              >
                <ButtonText
                  className="text-typography-700 dark:text-[#E8EBF0]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Cancel
                </ButtonText>
              </Button>
              <Button
                className="rounded-lg px-6 py-2.5 bg-typography-900 dark:bg-[#E8EBF0]"
                onPress={handleCreateVpn}
                isDisabled={creatingVpn}
              >
                {creatingVpn ? (
                  <ButtonSpinner className="text-background-0 dark:text-typography-900" />
                ) : null}
                <ButtonText
                  className="text-background-0 dark:text-typography-900"
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  {creatingVpn ? "Creating..." : "Create"}
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal: Add Peer */}
      <Modal isOpen={showAddPeerModal} onClose={() => setShowAddPeerModal(false)}>
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4">
            <Heading
              size="lg"
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              Add Peer
            </Heading>
            <ModalCloseButton className="text-typography-600 dark:text-typography-400" />
          </ModalHeader>
          <ModalBody className="py-4">
            <VStack className="gap-5">
              {/* Info Box Azul */}
              <HStack className="bg-[#EFF6FF] dark:bg-[#1E3A8A20] p-4 rounded-lg gap-3 items-start">
                <Info size={20} className="text-[#1E3A8A] dark:text-[#60A5FA] mt-0.5" />
                <Text
                  className="flex-1 text-sm text-[#1E3A8A] dark:text-[#93C5FD]"
                  style={{ fontFamily: "Inter_400Regular" }}
                >
                  A key pair will be generated automatically for this peer.
                </Text>
              </HStack>

              <Text
                className="text-sm text-typography-600 dark:text-typography-400"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                The IP will be assigned automatically when generating the peer.
              </Text>

              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Peer Name <Text className="text-red-500 dark:text-[#f87171]">*</Text>
                </Text>
                <Input
                  variant="outline"
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                >
                  <InputField
                    placeholder="peer-laptop"
                    value={formPeerName}
                    onChangeText={setFormPeerName}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </VStack>

              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Server endpoint <Text className="text-red-500 dark:text-[#f87171]">*</Text>
                </Text>
                <Input
                  variant="outline"
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                >
                  <InputField
                    placeholder="e.g.: vpn.yourdomain.com:51820"
                    value={formPeerEndpoint}
                    onChangeText={setFormPeerEndpoint}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </VStack>

              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Keepalive (seconds)
                </Text>
                <Input
                  variant="outline"
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                >
                  <InputField
                    placeholder="25"
                    value={formPeerKeepalive}
                    onChangeText={setFormPeerKeepalive}
                    keyboardType="numeric"
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
                <Text
                  className="text-xs text-typography-500 dark:text-typography-400"
                  style={{ fontFamily: "Inter_400Regular" }}
                >
                  Use 0 to disable or leave blank to use the recommended default.
                </Text>
              </VStack>
            </VStack>
          </ModalBody>
          <ModalFooter className="pt-6 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="justify-end gap-3 w-full">
              <Button
                variant="outline"
                className="rounded-lg px-6 py-2.5 border-outline-200 dark:border-[#2A3B52]"
                onPress={() => setShowAddPeerModal(false)}
              >
                <ButtonText
                  className="text-typography-700 dark:text-[#E8EBF0]"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Cancel
                </ButtonText>
              </Button>
              <Button
                className="rounded-lg px-6 py-2.5 bg-typography-900 dark:bg-[#E8EBF0]"
                onPress={handleAddPeer}
                isDisabled={creatingPeer}
              >
                {creatingPeer ? (
                  <ButtonSpinner className="text-background-0 dark:text-typography-900" />
                ) : null}
                <ButtonText
                  className="text-background-0 dark:text-typography-900"
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  {creatingPeer ? "Adding..." : "Add"}
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
