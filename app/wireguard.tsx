import React from "react";
import { ScrollView, RefreshControl, useColorScheme, Platform } from "react-native";
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
import { Shield, Copy, Plus, Trash2, Info } from "lucide-react-native";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useWireguard } from "@/hooks/useWireguard";
import { WireguardPeer } from "@/types/wireguard";

type WireGuardConfig = {
  endpoint: string;
  publicKey: string;
  network: string;
};

const isRealDomainHost = (hostname: string) => {
  const host = hostname.trim().toLowerCase();
  if (!host || host === "localhost") {
    return false;
  }
  if (!host.includes(".") || !/[a-z]/.test(host)) {
    return false;
  }
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return false;
  }
  if (host.includes(":")) {
    return false;
  }
  return true;
};

const getApexDomain = (hostname: string) => {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) {
    return host;
  }
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  const commonSecondLevel = new Set(["co", "com", "net", "org", "gov", "edu"]);
  if (last.length === 2 && commonSecondLevel.has(secondLast) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
};

const getSuggestedEndpoint = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return "";
  }
  const hostname = window.location.hostname;
  if (!hostname || !isRealDomainHost(hostname)) {
    return "";
  }
  const apexDomain = getApexDomain(hostname);
  return apexDomain ? `${apexDomain}:51512` : "";
};

const localPeerBefore = `[Peer]
PublicKey = Qx7k9Lm2vP4n...
Endpoint = domain.com:51512
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`;

const localPeerAfter = `[Peer]
PublicKey = Qx7k9Lm2vP4n...
Endpoint = 192.168.1.198:51512
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`;

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
  const { resolvedMode } = useAppTheme();
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
  const [confirmDeletePeer, setConfirmDeletePeer] = React.useState<WireguardPeer | null>(null);
  const [showCreateVpnModal, setShowCreateVpnModal] = React.useState(false);
  const [showAddPeerModal, setShowAddPeerModal] = React.useState(false);
  const [showLocalConnectModal, setShowLocalConnectModal] = React.useState(false);
  const [formPeerName, setFormPeerName] = React.useState("");
  const [formPeerEndpoint, setFormPeerEndpoint] = React.useState("");
  const [formPeerKeepalive, setFormPeerKeepalive] = React.useState("25");
  const suggestedEndpoint = React.useMemo(() => getSuggestedEndpoint(), []);

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

  React.useEffect(() => {
    if (showAddPeerModal && suggestedEndpoint && !formPeerEndpoint.trim()) {
      setFormPeerEndpoint(suggestedEndpoint);
    }
  }, [showAddPeerModal, suggestedEndpoint, formPeerEndpoint]);

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
        return true;
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
        return false;
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
    setConfirmDeletePeer(peer);
  };

  const handleCloseDeleteModal = () => {
    if (deletingPeerId) {
      return;
    }
    setConfirmDeletePeer(null);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeletePeer || deletingPeerId) return;
    const didDelete = await deletePeer(confirmDeletePeer);
    if (didDelete) {
      setConfirmDeletePeer(null);
    }
  };

  const handleRefresh = async () => {
    await refresh();
  };

  if (isChecking || !token) {
    return null;
  }

  const isWeb = Platform.OS === "web";
  const isDarkMode = colorScheme === "dark";
  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";
  const primaryButtonClass =
    isWeb ? "bg-typography-900 dark:bg-[#2DD4BF]" : resolvedMode === "dark" ? "bg-[#2DD4BF]" : "bg-typography-900";
  const primaryButtonTextClass =
    isWeb ? "text-background-0 dark:text-[#0A1628]" : resolvedMode === "dark" ? "text-[#0A1628]" : "text-background-0";

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 100}}
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
        <Box className="p-4 pt-16 web:p-20 web:max-w-7xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            WireGuard VPN
          </Heading>
          <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl mb-3">
            Configure and manage the WireGuard VPN for secure cluster access
            with end-to-end encryption.
          </Text>
          <Button
            size="xs"
            className="self-start rounded-xl bg-typography-900 dark:bg-[#0A1628] dark:border dark:border-[#2A3B52] mb-6"
            style={
              isDarkMode
                ? {backgroundColor: "#0A1628", borderColor: "#2A3B52"}
                : undefined
            }
            onPress={() => setShowLocalConnectModal(true)}
          >
            <ButtonText
              className="text-background-0 dark:text-[#E8EBF0]"
              style={{fontFamily: "Inter_600SemiBold"}}
            >
              Connect locally
            </ButtonText>
          </Button>

          {error ? (
            <Box className="p-3 mb-4 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1212]">
              <Text
                className="text-[#B91C1C] dark:text-[#FCA5A5]"
                style={{fontFamily: "Inter_500Medium"}}
              >
                {error}
              </Text>
            </Box>
          ) : null}

          {!vpnConfig ? (
            isLoading ? (
              <Box className="p-6 web:rounded-2xl web:bg-background-0/80 dark:web:bg-[#151F30]/80 mt-6">
                <Text
                  className="text-typography-600 dark:text-[#8A94A8] text-center"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Loading VPN information...
                </Text>
              </Box>
            ) : (
              // Empty State
              <Box className="p-12 web:rounded-2xl web:bg-background-0/80 dark:web:bg-[#151F30]/80 mt-6">
                <VStack className="items-center gap-6">
                  <Shield
                    size={64}
                    className="text-[#CBD5E1] dark:text-[#64748B]"
                  />
                  <Heading
                    size="xl"
                    className="text-typography-900 dark:text-[#E8EBF0] text-center"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    No VPN Configured
                  </Heading>
                  <Text
                    className="text-typography-600 dark:text-[#8A94A8] text-center max-w-md"
                    style={{fontFamily: "Inter_400Regular"}}
                  >
                    Set up a WireGuard VPN to securely connect to your cluster
                    from anywhere.
                  </Text>
                  <Button
                    size="lg"
                    className={`rounded-xl mt-4 ${primaryButtonClass}`}
                    onPress={() => setShowCreateVpnModal(true)}
                  >
                    <ButtonIcon as={Plus} className={primaryButtonTextClass} />
                    <ButtonText
                      className={primaryButtonTextClass}
                      style={{fontFamily: "Inter_600SemiBold"}}
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
              <Box className="rounded-2xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#0E1828] overflow-hidden web:shadow-md dark:web:shadow-none">
                {/* Header */}
                <Box className="border-b border-outline-100 dark:border-[#2A3B52] p-6">
                  <HStack className="justify-between items-start gap-4 flex-col web:flex-row web:items-center">
                    <Heading
                      size="lg"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                      style={{fontFamily: "Inter_700Bold"}}
                    >
                      Peers ({peers.length})
                    </Heading>
                    <Button
                      size="md"
                      className={`rounded-xl w-full web:w-auto ${primaryButtonClass}`}
                      onPress={() => setShowAddPeerModal(true)}
                    >
                      <ButtonIcon
                        as={Plus}
                        className={primaryButtonTextClass}
                      />
                      <ButtonText
                        className={primaryButtonTextClass}
                        style={{fontFamily: "Inter_600SemiBold"}}
                      >
                        Add Peer
                      </ButtonText>
                    </Button>
                  </HStack>
                </Box>

                {/* Table */}
                {peers.length === 0 ? (
                  <Box className="p-8">
                    <Text
                      className="text-center text-typography-600 dark:text-[#8A94A8]"
                      style={{fontFamily: "Inter_400Regular"}}
                    >
                      No peers configured
                    </Text>
                  </Box>
                ) : isWeb ? (
                  <Box className="overflow-x-auto">
                    <Box className="min-w-[900px]">
                      {/* Table Header */}
                      <HStack className="bg-background-50 dark:bg-[#0A1628] px-6 py-3 border-b border-outline-100 dark:border-[#1E2F47]">
                        <Text
                          className="flex-1 min-w-[120px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                          style={{fontFamily: "Inter_600SemiBold"}}
                        >
                          NAME
                        </Text>
                        <Text
                          className="w-[120px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                          style={{fontFamily: "Inter_600SemiBold"}}
                        >
                          IP
                        </Text>
                        <Text
                          className="flex-1 min-w-[200px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                          style={{fontFamily: "Inter_600SemiBold"}}
                        >
                          PUBLIC KEY
                        </Text>
                        <Text
                          className="w-[140px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                          style={{fontFamily: "Inter_600SemiBold"}}
                        >
                          ALLOWED IPS
                        </Text>
                        <Text
                          className="w-[80px] text-xs text-[#9AA4B8] dark:text-[#8A94A8] text-right"
                          style={{fontFamily: "Inter_600SemiBold"}}
                        >
                          ACTIONS
                        </Text>
                      </HStack>

                      {/* Table Rows */}
                      {peers.map((peer, index) => (
                        <HStack
                          key={peer.id}
                          className={`px-6 py-4 items-center ${
                            index !== peers.length - 1
                              ? "border-b border-outline-100 dark:border-[#1E2F47]"
                              : ""
                          }`}
                        >
                          <Text
                            className="flex-1 min-w-[120px] text-sm text-typography-900 dark:text-[#E8EBF0]"
                            style={{fontFamily: "Inter_500Medium"}}
                          >
                            {peer.name}
                          </Text>
                          <Text
                            className="w-[120px] text-sm text-typography-600 dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_400Regular"}}
                          >
                            {peer.client_ip?.split("/")[0] ?? "—"}
                          </Text>
                          <HStack className="flex-1 min-w-[200px] items-center gap-2">
                            <Text
                              className="flex-1 text-sm text-typography-600 dark:text-[#8A94A8]"
                              style={{fontFamily: "Inter_400Regular"}}
                            >
                              {truncateMiddle(peer.public_key, 30)}
                            </Text>
                            <Button
                              variant="link"
                              size="xs"
                              onPress={() =>
                                copyToClipboard(peer.public_key, "Public Key")
                              }
                              className="mr-2"
                            >
                              <ButtonIcon
                                as={Copy}
                                size="sm"
                                className="text-typography-600 dark:text-[#8A94A8]"
                              />
                            </Button>
                          </HStack>
                          <Text
                            className="w-[140px] text-sm text-typography-600 dark:text-[#8A94A8]"
                            style={{fontFamily: "Inter_400Regular"}}
                          >
                            {formatAllowedIps(peer)}
                          </Text>
                          <HStack className="w-[80px] justify-end">
                            <Button
                              variant="outline"
                              size="xs"
                              className="rounded-xl border-error-300 dark:border-error-700 bg-background-0 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                              onPress={() => handleDeletePeer(peer)}
                              isDisabled={deletingPeerId === peer.id}
                            >
                              {deletingPeerId === peer.id ? (
                                <ButtonSpinner className="text-red-500" />
                              ) : (
                                <ButtonIcon
                                  as={Trash2}
                                  size="xs"
                                  className="text-error-600 dark:text-error-700"
                                />
                              )}
                            </Button>
                          </HStack>
                        </HStack>
                      ))}
                    </Box>
                  </Box>
                ) : (
                  <VStack className="gap-4 p-4">
                    {peers.map((peer) => (
                      <Box
                        key={peer.id}
                        className="rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0A1628] p-4"
                      >
                        <VStack className="gap-3">
                          <HStack className="items-start justify-between gap-3">
                            <VStack className="gap-1 flex-1">
                              <Text
                                className="text-base text-typography-900 dark:text-[#E8EBF0]"
                                style={{fontFamily: "Inter_600SemiBold"}}
                              >
                                {peer.name}
                              </Text>
                              <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                                {peer.client_ip?.split("/")[0] ?? "—"}
                              </Text>
                            </VStack>
                            <Button
                              variant="outline"
                              size="xs"
                              className="rounded-xl border-red-500"
                              onPress={() => handleDeletePeer(peer)}
                              isDisabled={deletingPeerId === peer.id}
                            >
                              {deletingPeerId === peer.id ? (
                                <ButtonSpinner className="text-red-500" />
                              ) : (
                                <>
                                  <ButtonIcon
                                    as={Trash2}
                                    size="xs"
                                    className="text-red-500"
                                  />
                                  <ButtonText className="text-red-500 text-xs">
                                    Delete
                                  </ButtonText>
                                </>
                              )}
                            </Button>
                          </HStack>
                          <VStack className="gap-2">
                            <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                              Public key
                            </Text>
                            <HStack className="items-center gap-2">
                              <Text
                                className="flex-1 text-sm text-typography-700 dark:text-[#8A94A8]"
                                numberOfLines={2}
                              >
                                {truncateMiddle(peer.public_key, 36)}
                              </Text>
                              <Button
                                variant="outline"
                                size="xs"
                                className="rounded-xl"
                                onPress={() =>
                                  copyToClipboard(peer.public_key, "Public Key")
                                }
                              >
                                <ButtonIcon
                                  as={Copy}
                                  size="xs"
                                  className="text-typography-700 dark:text-[#8A94A8]"
                                />
                              </Button>
                            </HStack>
                          </VStack>
                          <VStack className="gap-1">
                            <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                              Allowed IPs
                            </Text>
                            <Text className="text-sm text-typography-700 dark:text-[#8A94A8]">
                              {formatAllowedIps(peer)}
                            </Text>
                          </VStack>
                        </VStack>
                      </Box>
                    ))}
                  </VStack>
                )}
              </Box>
            </VStack>
          )}
        </Box>
      </ScrollView>

      {/* Modal: Create VPN */}
      <Modal
        isOpen={showCreateVpnModal}
        onClose={() => setShowCreateVpnModal(false)}
      >
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4">
            <Heading
              size="lg"
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{fontFamily: "Inter_700Bold"}}
            >
              Create WireGuard VPN
            </Heading>
            <ModalCloseButton className="text-typography-600 dark:text-[#8A94A8]" />
          </ModalHeader>
          <ModalBody className="py-4">
            <VStack className="gap-5">
              {/* Info Box Azul */}
              <HStack className="bg-[#EFF6FF] dark:bg-[#1E3A8A20] p-4 rounded-lg gap-3 items-start">
                <Info
                  size={20}
                  className="text-[#1E3A8A] dark:text-[#60A5FA] mt-0.5"
                />
                <Text
                  className="flex-1 text-sm text-[#1E3A8A] dark:text-[#93C5FD]"
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  Public and private keys will be generated automatically and
                  the WireGuard interface will be initialized.
                </Text>
              </HStack>

              <Text
                className="text-sm text-typography-600 dark:text-[#8A94A8]"
                style={{fontFamily: "Inter_400Regular"}}
              >
                After it is created, use the add peer button to generate client
                configurations.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter className="pt-6 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="justify-end gap-3 w-full">
              <Button
                variant="outline"
                className="rounded-xl px-6 py-2.5 border-outline-200 dark:border-[#2A3B52]"
                onPress={() => setShowCreateVpnModal(false)}
              >
                <ButtonText
                  className="text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Cancel
                </ButtonText>
              </Button>
              <Button
                className={`rounded-xl px-6 py-2.5 ${primaryButtonClass}`}
                onPress={handleCreateVpn}
                isDisabled={creatingVpn}
              >
                {creatingVpn ? (
                  <ButtonSpinner className={primaryButtonTextClass} />
                ) : null}
                <ButtonText
                  className={primaryButtonTextClass}
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  {creatingVpn ? "Creating..." : "Create"}
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal: Add Peer */}
      <Modal
        isOpen={showAddPeerModal}
        onClose={() => setShowAddPeerModal(false)}
      >
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4">
            <Heading
              size="lg"
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{fontFamily: "Inter_700Bold"}}
            >
              Add Peer
            </Heading>
            <ModalCloseButton className="text-typography-600 dark:text-[#8A94A8]" />
          </ModalHeader>
          <ModalBody className="py-4">
            <VStack className="gap-5">
              {/* Info Box Azul */}
              <HStack className="bg-[#EFF6FF] dark:bg-[#1E3A8A20] p-4 rounded-lg gap-3 items-start">
                <Info
                  size={20}
                  className="text-[#1E3A8A] dark:text-[#60A5FA] mt-0.5"
                />
                <Text
                  className="flex-1 text-sm text-[#1E3A8A] dark:text-[#93C5FD]"
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  A key pair will be generated automatically for this peer.
                </Text>
              </HStack>

              <Text
                className="text-sm text-typography-600 dark:text-[#8A94A8]"
                style={{fontFamily: "Inter_400Regular"}}
              >
                The IP will be assigned automatically when generating the peer.
              </Text>

              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Peer Name{" "}
                  <Text className="text-red-500 dark:text-[#f87171]">*</Text>
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
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Server endpoint{" "}
                  <Text className="text-red-500 dark:text-[#f87171]">*</Text>
                </Text>
                <Input
                  variant="outline"
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                >
                  <InputField
                    placeholder={
                      suggestedEndpoint || "e.g.: yourdomain.com:51512"
                    }
                    value={formPeerEndpoint}
                    onChangeText={setFormPeerEndpoint}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </VStack>

              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
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
                  className="text-xs text-typography-500 dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  Use 0 to disable or leave blank to use the recommended
                  default.
                </Text>
              </VStack>
            </VStack>
          </ModalBody>
          <ModalFooter className="pt-6 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="justify-end gap-3 w-full">
              <Button
                variant="outline"
                className="rounded-xl px-6 py-2.5 border-outline-200 dark:border-[#2A3B52] items-center justify-center"
                onPress={() => setShowAddPeerModal(false)}
              >
                <ButtonText
                  className="text-typography-700 dark:text-[#E8EBF0] text-center"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Cancel
                </ButtonText>
              </Button>
              <Button
                className={`rounded-xl px-6 py-2.5 items-center justify-center ${primaryButtonClass}`}
                onPress={handleAddPeer}
                isDisabled={creatingPeer}
              >
                {creatingPeer ? (
                  <ButtonSpinner className={primaryButtonTextClass} />
                ) : null}
                <ButtonText
                  className={`${primaryButtonTextClass} text-center`}
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  {creatingPeer ? "Adding..." : "Add"}
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal: Confirm delete peer */}
      <Modal
        isOpen={!!confirmDeletePeer}
        onClose={handleCloseDeleteModal}
        size="md"
      >
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-5">
          <ModalHeader className="flex-row items-center gap-3 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <Box className="h-10 w-10 rounded-2xl bg-error-500/10 dark:bg-error-900/20 items-center justify-center">
              <Trash2
                size={18}
                className="text-error-600 dark:text-error-400"
              />
            </Box>
            <VStack className="flex-1">
              <Heading
                size="lg"
                className="text-typography-900 dark:text-[#E8EBF0]"
              >
                Delete peer?
              </Heading>
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                This removes the peer permanently.
              </Text>
            </VStack>
            <ModalCloseButton onPress={handleCloseDeleteModal} />
          </ModalHeader>
          <ModalBody className="pt-5">
            {confirmDeletePeer ? (
              <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] p-4">
                <VStack className="gap-2">
                  <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                    Peer
                  </Text>
                  <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                    {confirmDeletePeer.name}
                  </Text>
                  <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                    IP: {confirmDeletePeer.client_ip?.split("/")[0] ?? "—"}
                  </Text>
                  <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                    Allowed IPs: {formatAllowedIps(confirmDeletePeer)}
                  </Text>
                </VStack>
              </Box>
            ) : null}
          </ModalBody>
          <ModalFooter className="flex-row gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <Button
              variant="outline"
              action="secondary"
              className="flex-1 rounded-xl"
              onPress={handleCloseDeleteModal}
              isDisabled={Boolean(deletingPeerId)}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                Cancel
              </ButtonText>
            </Button>
            <Button
              action="negative"
              className="flex-1 rounded-xl bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
              onPress={handleConfirmDelete}
              isDisabled={Boolean(deletingPeerId)}
            >
              {deletingPeerId ? (
                <ButtonSpinner />
              ) : (
                <ButtonText className="text-background-0 dark:text-[#0A1628]">
                  Delete
                </ButtonText>
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal: Local Connection Instructions */}
      <Modal
        isOpen={showLocalConnectModal}
        onClose={() => setShowLocalConnectModal(false)}
      >
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828] shadow-2xl max-w-2xl p-6">
          <ModalHeader className="pb-4">
            <Heading
              size="lg"
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{fontFamily: "Inter_700Bold"}}
            >
              Connect locally
            </Heading>
            <ModalCloseButton className="text-typography-600 dark:text-[#8A94A8]" />
          </ModalHeader>
          <ModalBody className="py-4">
            <VStack className="gap-5">
              <HStack className="bg-[#EFF6FF] dark:bg-[#1E3A8A20] p-4 rounded-lg gap-3 items-start">
                <Info
                  size={20}
                  className="text-[#1E3A8A] dark:text-[#60A5FA] mt-0.5"
                />
                <Text
                  className="flex-1 text-sm text-[#1E3A8A] dark:text-[#93C5FD]"
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  If you are on the local network, open wg0.conf and replace
                  domain.com with the master's local IP (e.g., 192.168.1.198).
                </Text>
              </HStack>

              <Box className="flex flex-col gap-4 web:grid web:grid-cols-2">
                <Box className="flex flex-col gap-2">
                  <Text
                    className="text-[11px] font-semibold uppercase text-typography-500 dark:text-[#8A94A8] tracking-wide"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    Before
                  </Text>
                  <Box className="bg-background-100 dark:bg-[#0F172A] border border-outline-200 dark:border-[#1E2F47] rounded-lg p-3">
                    <Text
                      className="font-mono text-xs text-typography-900 dark:text-[#E2E8F0]"
                      selectable
                    >
                      {localPeerBefore}
                    </Text>
                  </Box>
                </Box>
                <Box className="flex flex-col gap-2">
                  <Text
                    className="text-[11px] font-semibold uppercase text-typography-500 dark:text-[#8A94A8] tracking-wide"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    After
                  </Text>
                  <Box className="bg-background-100 dark:bg-[#0F172A] border border-outline-200 dark:border-[#1E2F47] rounded-lg p-3">
                    <Text
                      className="font-mono text-xs text-typography-900 dark:text-[#E2E8F0]"
                      selectable
                    >
                      {localPeerAfter}
                    </Text>
                  </Box>
                </Box>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter className="pt-6 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="justify-end w-full">
              <Button
                className="rounded-xl px-6 py-2.5 bg-typography-900 dark:bg-[#0A1628] dark:border dark:border-[#2A3B52]"
                style={
                  isDarkMode
                    ? {backgroundColor: "#0A1628", borderColor: "#2A3B52"}
                    : undefined
                }
                onPress={() => setShowLocalConnectModal(false)}
              >
                <ButtonText
                  className="text-background-0 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Close
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
