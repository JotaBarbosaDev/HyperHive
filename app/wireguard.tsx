import React from "react";
import {ScrollView, RefreshControl, useColorScheme, Alert, Platform} from "react-native";
import * as Clipboard from "expo-clipboard";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {VStack} from "@/components/ui/vstack";
import {HStack} from "@/components/ui/hstack";
import {Button, ButtonText, ButtonIcon} from "@/components/ui/button";
import {Input, InputField} from "@/components/ui/input";
import {Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton} from "@/components/ui/modal";
import {Toast, ToastTitle, useToast} from "@/components/ui/toast";
import {Fab, FabIcon} from "@/components/ui/fab";
import {Shield, Copy, Plus, Trash2, Info} from "lucide-react-native";

// Interfaces TypeScript
interface WireGuardConfig {
  endpoint: string;
  publicKey: string;
  network: string;
  port: number;
}

interface WireGuardPeer {
  id: string;
  name: string;
  ip: string;
  publicKey: string;
  allowedIPs: string;
}

// Mock Data
const MOCK_VPN_CONFIG: WireGuardConfig = {
  endpoint: "192.168.1.100:51820",
  publicKey: "wG8S7xK3mN9vB2qL5pR4tY6uI8oP0aS1dF3gH7jK9lTnQ4bP2Yc=",
  network: "10.0.0.0/24",
  port: 51820,
};

const MOCK_PEERS: WireGuardPeer[] = [
  {
    id: "peer-001",
    name: "peer-laptop",
    ip: "10.0.0.2",
    publicKey: "aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF6gH7=",
    allowedIPs: "10.0.0.2/32",
  },
  {
    id: "peer-002",
    name: "peer-mobile",
    ip: "10.0.0.3",
    publicKey: "xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0eD9cB8aZ7yX6wV5uT4sR3=",
    allowedIPs: "10.0.0.3/32",
  },
];

export default function WireGuardScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const [vpnConfig, setVpnConfig] = React.useState<WireGuardConfig | null>(MOCK_VPN_CONFIG);
  const [peers, setPeers] = React.useState<WireGuardPeer[]>(MOCK_PEERS);
  const [loading, setLoading] = React.useState(false);
  const [showCreateVpnModal, setShowCreateVpnModal] = React.useState(false);
  const [showAddPeerModal, setShowAddPeerModal] = React.useState(false);

  // Form state - Criar VPN
  const [formPort, setFormPort] = React.useState("51820");
  const [formNetwork, setFormNetwork] = React.useState("10.0.0.0/24");

  // Form state - Adicionar Peer
  const [formPeerName, setFormPeerName] = React.useState("");
  const [formPeerIp, setFormPeerIp] = React.useState("");
  const [formPeerAllowedIPs, setFormPeerAllowedIPs] = React.useState("");

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    toast.show({
      placement: "top",
      render: ({id}) => (
        <Toast
          nativeID={"toast-" + id}
          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
          action="success"
        >
          <ToastTitle size="sm">{label} copiado!</ToastTitle>
        </Toast>
      ),
    });
  };

  const truncateMiddle = (str: string, maxLength: number = 40): string => {
    if (str.length <= maxLength) return str;
    const half = Math.floor(maxLength / 2);
    return `${str.slice(0, half)}...${str.slice(-half)}`;
  };

  const handleCreateVpn = () => {
    const newConfig: WireGuardConfig = {
      endpoint: `192.168.1.100:${formPort}`,
      publicKey: "wG8S7xK3mN9vB2qL5pR4tY6uI8oP0aS1dF3gH7jK9lTnQ4bP2Yc=",
      network: formNetwork,
      port: Number(formPort),
    };
    setVpnConfig(newConfig);
    setShowCreateVpnModal(false);
    toast.show({
      placement: "top",
      render: ({id}) => (
        <Toast
          nativeID={"toast-" + id}
          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
          action="success"
        >
          <ToastTitle size="sm">VPN criada com sucesso!</ToastTitle>
        </Toast>
      ),
    });
  };

  const handleAddPeer = () => {
    if (!formPeerName || !formPeerIp) {
      toast.show({
        placement: "top",
        render: ({id}) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
            action="error"
          >
            <ToastTitle size="sm">Preencha todos os campos obrigatórios</ToastTitle>
          </Toast>
        ),
      });
      return;
    }

    const newPeer: WireGuardPeer = {
      id: `peer-${Date.now()}`,
      name: formPeerName,
      ip: formPeerIp,
      publicKey: `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}=`,
      allowedIPs: formPeerAllowedIPs || `${formPeerIp}/32`,
    };

    setPeers((prev) => [...prev, newPeer]);
    setShowAddPeerModal(false);
    setFormPeerName("");
    setFormPeerIp("");
    setFormPeerAllowedIPs("");

    toast.show({
      placement: "top",
      render: ({id}) => (
        <Toast
          nativeID={"toast-" + id}
          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
          action="success"
        >
          <ToastTitle size="sm">Peer adicionado com sucesso!</ToastTitle>
        </Toast>
      ),
    });
  };

  const handleDeletePeer = (peer: WireGuardPeer) => {
    Alert.alert("Confirmar Exclusão", `Tem certeza que deseja remover o peer "${peer.name}"?`, [
      {text: "Cancelar", style: "cancel"},
      {
        text: "Remover",
        style: "destructive",
        onPress: () => {
          setPeers((prev) => prev.filter((p) => p.id !== peer.id));
          toast.show({
            placement: "top",
            render: ({id}) => (
              <Toast
                nativeID={"toast-" + id}
                className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
                action="success"
              >
                <ToastTitle size="sm">Peer removido</ToastTitle>
              </Toast>
            ),
          });
        },
      },
    ]);
  };

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise((res) => setTimeout(res, 800));
    setLoading(false);
    toast.show({
      placement: "top",
      render: ({id}) => (
        <Toast
          nativeID={"toast-" + id}
          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
          action="success"
        >
          <ToastTitle size="sm">Atualizado</ToastTitle>
        </Toast>
      ),
    });
  };

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 100}}
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
            WireGuard VPN
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl mb-6">
            Configure e gerencie a VPN WireGuard para acesso seguro ao cluster com criptografia de ponta a ponta.
          </Text>

          {!vpnConfig ? (
            // Empty State
            <Box className="p-12 web:rounded-2xl web:bg-background-0/80 dark:web:bg-[#151F30]/80 mt-6">
              <VStack className="items-center gap-6">
                <Shield size={64} className="text-[#CBD5E1] dark:text-[#64748B]" />
                <Heading
                  size="xl"
                  className="text-typography-900 dark:text-[#E8EBF0] text-center"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Nenhuma VPN Configurada
                </Heading>
                <Text
                  className="text-typography-600 dark:text-typography-400 text-center max-w-md"
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  Configure uma VPN WireGuard para conectar-se de forma segura ao seu cluster de qualquer lugar.
                </Text>
                <Button
                  size="lg"
                  className="rounded-lg bg-typography-900 dark:bg-[#E8EBF0] mt-4"
                  onPress={() => setShowCreateVpnModal(true)}
                >
                  <ButtonIcon as={Plus} className="text-background-0 dark:text-typography-900" />
                  <ButtonText
                    className="text-background-0 dark:text-typography-900"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    Criar VPN
                  </ButtonText>
                </Button>
              </VStack>
            </Box>
          ) : (
            // VPN Configurada
            <VStack className="gap-6 mt-6">
              {/* Card de Configuração */}
              <Box className="rounded-2xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] p-6 web:shadow-md dark:web:shadow-none">
                <Heading
                  size="lg"
                  className="text-typography-900 dark:text-[#E8EBF0] mb-4"
                  style={{fontFamily: "Inter_700Bold"}}
                >
                  Configuração da VPN
                </Heading>

                <VStack className="gap-4 web:flex-row web:gap-6">
                  {/* Endpoint */}
                  <VStack className="flex-1 gap-2">
                    <Text
                      className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                      style={{fontFamily: "Inter_500Medium"}}
                    >
                      ENDPOINT
                    </Text>
                    <HStack className="items-center justify-between bg-background-50 dark:bg-[#0A1628] p-3 rounded-lg">
                      <Text
                        className="text-sm text-typography-900 dark:text-[#E8EBF0] flex-1"
                        style={{fontFamily: "Inter_400Regular"}}
                      >
                        {vpnConfig.endpoint}
                      </Text>
                      <Button
                        variant="link"
                        size="xs"
                        onPress={() => copyToClipboard(vpnConfig.endpoint, "Endpoint")}
                      >
                        <ButtonIcon as={Copy} size="sm" className="text-typography-600 dark:text-typography-400" />
                      </Button>
                    </HStack>
                  </VStack>

                  {/* Public Key */}
                  <VStack className="flex-1 gap-2">
                    <Text
                      className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                      style={{fontFamily: "Inter_500Medium"}}
                    >
                      PUBLIC KEY
                    </Text>
                    <HStack className="items-center justify-between bg-background-50 dark:bg-[#0A1628] p-3 rounded-lg">
                      <Text
                        className="text-sm text-typography-900 dark:text-[#E8EBF0] flex-1"
                        style={{fontFamily: "Inter_400Regular"}}
                        numberOfLines={1}
                      >
                        {truncateMiddle(vpnConfig.publicKey)}
                      </Text>
                      <Button
                        variant="link"
                        size="xs"
                        onPress={() => copyToClipboard(vpnConfig.publicKey, "Public Key")}
                      >
                        <ButtonIcon as={Copy} size="sm" className="text-typography-600 dark:text-typography-400" />
                      </Button>
                    </HStack>
                  </VStack>

                  {/* Rede */}
                  <VStack className="flex-1 gap-2">
                    <Text
                      className="text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                      style={{fontFamily: "Inter_500Medium"}}
                    >
                      REDE
                    </Text>
                    <Box className="bg-background-50 dark:bg-[#0A1628] p-3 rounded-lg">
                      <Text
                        className="text-sm text-typography-900 dark:text-[#E8EBF0]"
                        style={{fontFamily: "Inter_400Regular"}}
                      >
                        {vpnConfig.network}
                      </Text>
                    </Box>
                  </VStack>
                </VStack>
              </Box>

              {/* Card de Peers */}
              <Box className="rounded-2xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] overflow-hidden web:shadow-md dark:web:shadow-none">
                {/* Header */}
                <Box className="border-b border-outline-100 dark:border-[#2A3B52] p-6">
                  <HStack className="justify-between items-center">
                    <Heading
                      size="lg"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                      style={{fontFamily: "Inter_700Bold"}}
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
                          Adicionar Peer
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
                      style={{fontFamily: "Inter_400Regular"}}
                    >
                      Nenhum peer configurado
                    </Text>
                  </Box>
                ) : (
                  <Box className="overflow-x-auto">
                    <Box className="min-w-[900px]">
                      {/* Table Header */}
                      <HStack className="bg-background-50 dark:bg-[#0A1628] px-6 py-3 border-b border-outline-100 dark:border-[#1E2F47]">
                        <Text
                          className="flex-1 min-w-[120px] text-xs text-[#9AA4B8] dark:text-[#8A94A8]"
                          style={{fontFamily: "Inter_600SemiBold"}}
                        >
                          NOME
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
                          AÇÕES
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
                            className="w-[120px] text-sm text-typography-600 dark:text-typography-400"
                            style={{fontFamily: "Inter_400Regular"}}
                          >
                            {peer.ip}
                          </Text>
                          <HStack className="flex-1 min-w-[200px] items-center gap-2">
                            <Text
                              className="flex-1 text-sm text-typography-600 dark:text-typography-400"
                              style={{fontFamily: "Inter_400Regular"}}
                              numberOfLines={1}
                            >
                              {truncateMiddle(peer.publicKey, 30)}
                            </Text>
                            <Button
                              variant="link"
                              size="xs"
                              onPress={() => copyToClipboard(peer.publicKey, "Public Key")}
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
                            style={{fontFamily: "Inter_400Regular"}}
                          >
                            {peer.allowedIPs}
                          </Text>
                          <HStack className="w-[80px] justify-end">
                            <Button
                              variant="outline"
                              size="xs"
                              className="rounded-md border-red-500"
                              onPress={() => handleDeletePeer(peer)}
                            >
                              <ButtonIcon as={Trash2} size="xs" className="text-red-500" />
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

      {/* Modal: Criar VPN */}
      <Modal isOpen={showCreateVpnModal} onClose={() => setShowCreateVpnModal(false)}>
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4">
            <Heading
              size="lg"
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{fontFamily: "Inter_700Bold"}}
            >
              Criar VPN WireGuard
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
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  As chaves públicas e privadas serão geradas automaticamente
                </Text>
              </HStack>

              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Porta
                </Text>
                <Input
                  variant="outline"
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                >
                  <InputField
                    placeholder="51820"
                    keyboardType="numeric"
                    value={formPort}
                    onChangeText={setFormPort}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </VStack>

              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Rede VPN
                </Text>
                <Input
                  variant="outline"
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                >
                  <InputField
                    placeholder="10.0.0.0/24"
                    value={formNetwork}
                    onChangeText={setFormNetwork}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </VStack>
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
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Cancelar
                </ButtonText>
              </Button>
              <Button
                className="rounded-lg px-6 py-2.5 bg-typography-900 dark:bg-[#E8EBF0]"
                onPress={handleCreateVpn}
              >
                <ButtonText
                  className="text-background-0 dark:text-typography-900"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Criar
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal: Adicionar Peer */}
      <Modal isOpen={showAddPeerModal} onClose={() => setShowAddPeerModal(false)}>
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] shadow-2xl max-w-lg p-6">
          <ModalHeader className="pb-4">
            <Heading
              size="lg"
              className="text-typography-900 dark:text-[#E8EBF0]"
              style={{fontFamily: "Inter_700Bold"}}
            >
              Adicionar Peer
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
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  Um par de chaves será gerado automaticamente para este peer
                </Text>
              </HStack>

              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Nome do Peer <Text className="text-red-500 dark:text-[#f87171]">*</Text>
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
                  IP na VPN <Text className="text-red-500 dark:text-[#f87171]">*</Text>
                </Text>
                <Input
                  variant="outline"
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                >
                  <InputField
                    placeholder="10.0.0.2"
                    value={formPeerIp}
                    onChangeText={setFormPeerIp}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </VStack>

              <VStack className="gap-2">
                <Text
                  className="text-sm text-typography-700 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Allowed IPs
                </Text>
                <Input
                  variant="outline"
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
                >
                  <InputField
                    placeholder="10.0.0.2/32"
                    value={formPeerAllowedIPs}
                    onChangeText={setFormPeerAllowedIPs}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
                <Text
                  className="text-xs text-typography-500 dark:text-typography-400"
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  Deixe vazio para usar o IP/32 automaticamente
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
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Cancelar
                </ButtonText>
              </Button>
              <Button
                className="rounded-lg px-6 py-2.5 bg-typography-900 dark:bg-[#E8EBF0]"
                onPress={handleAddPeer}
              >
                <ButtonText
                  className="text-background-0 dark:text-typography-900"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Adicionar
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
