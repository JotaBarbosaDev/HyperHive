import React from "react";
import {RefreshControl, ScrollView} from "react-native";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {VStack} from "@/components/ui/vstack";
import {HStack} from "@/components/ui/hstack";
import {Button, ButtonIcon, ButtonSpinner, ButtonText} from "@/components/ui/button";
import {Input, InputField} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@/components/ui/modal";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogCloseButton,
} from "@/components/ui/alert-dialog";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  FormControlHelper,
  FormControlHelperText,
} from "@/components/ui/form-control";
import {Toast, ToastDescription, ToastTitle, useToast} from "@/components/ui/toast";
import {StreamHost, StreamPayload} from "@/types/stream";
import {createStream, deleteStream, disableStream, editStream, enableStream, listStreams} from "@/services/streams";
import {Skeleton, SkeletonText} from "@/components/ui/skeleton";
import {Badge, BadgeText} from "@/components/ui/badge";
import {Pressable} from "@/components/ui/pressable";
import {
  AlertTriangle,
  ArrowLeftRight,
  Lock,
  Pencil,
  Plus,
  Power,
  Shield,
  Trash2,
} from "lucide-react-native";

type FilterTab = "all" | "active" | "inactive";

const DEFAULT_FORM: StreamPayload = {
  incoming_port: 0,
  forwarding_host: "",
  forwarding_port: 0,
  tcp_forwarding: true,
  udp_forwarding: false,
  certificate_id: 0,
  meta: {
    dns_provider_credentials: "",
    letsencrypt_agree: false,
    dns_challenge: true,
  },
};

const isEnabled = (host: StreamHost) => host.enabled !== false;

export default function StreamsScreen() {
  const toast = useToast();
  const [items, setItems] = React.useState<StreamHost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterTab>("all");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<StreamPayload>(DEFAULT_FORM);
  const [editingHost, setEditingHost] = React.useState<StreamHost | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<StreamHost | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);

  const showToast = React.useCallback(
    (title: string, description: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: ({id}) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-start flex-row"
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

  const loadItems = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await listStreams();
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load streams", err);
        showToast("Erro ao carregar", "Não foi possível obter as streams.", "error");
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [showToast]
  );

  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = React.useMemo(() => {
    if (filter === "active") return items.filter((i) => isEnabled(i));
    if (filter === "inactive") return items.filter((i) => !isEnabled(i));
    return items;
  }, [filter, items]);

  const stats = React.useMemo(() => {
    const active = items.filter((i) => isEnabled(i)).length;
    const inactive = items.length - active;
    return {total: items.length, active, inactive};
  }, [items]);

  const openCreateModal = () => {
    setEditingHost(null);
    setForm(DEFAULT_FORM);
    setModalOpen(true);
  };

  const openEditModal = (host: StreamHost) => {
    setEditingHost(host);
    setForm({
      incoming_port: host.incoming_port,
      forwarding_host: host.forwarding_host,
      forwarding_port: host.forwarding_port,
      tcp_forwarding: Boolean(host.tcp_forwarding),
      udp_forwarding: Boolean(host.udp_forwarding),
      certificate_id: host.certificate_id ?? 0,
      meta: {
        dns_provider_credentials: host.meta?.dns_provider_credentials ?? "",
        letsencrypt_agree: host.meta?.letsencrypt_agree ?? false,
        dns_challenge: host.meta?.dns_challenge ?? true,
      },
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingHost(null);
  };

  const handleSave = async () => {
    if (!form.incoming_port || !form.forwarding_host || !form.forwarding_port) {
      showToast("Campos obrigatórios", "Informe porta de entrada, host e porta de destino.", "error");
      return;
    }
    const payload: StreamPayload = {
      ...form,
      incoming_port: Number(form.incoming_port),
      forwarding_port: Number(form.forwarding_port),
      certificate_id: Number(form.certificate_id) || 0,
    };

    setSaving(true);
    try {
      if (editingHost?.id) {
        await editStream(editingHost.id, payload);
        showToast("Stream atualizada", "Configuração salva.");
      } else {
        await createStream(payload);
        showToast("Stream criada", "Nova stream adicionada.");
      }
      setModalOpen(false);
      setEditingHost(null);
      await loadItems("silent");
    } catch (err) {
      console.error("Failed to save stream", err);
      showToast("Erro ao salvar", "Verifique os dados e tente novamente.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (host: StreamHost) => {
    if (!host.id) return;
    const enabled = isEnabled(host);
    setTogglingId(host.id);
    try {
      if (enabled) {
        await disableStream(host.id);
        showToast("Stream desativada", "Host desativado.");
      } else {
        await enableStream(host.id);
        showToast("Stream ativada", "Host ativado.");
      }
      await loadItems("silent");
    } catch (err) {
      console.error("Failed to toggle stream", err);
      showToast("Erro ao alterar status", "Não foi possível atualizar o host.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteStream(deleteTarget.id);
      showToast("Stream removida", "Host apagado.");
      setDeleteTarget(null);
      await loadItems("silent");
    } catch (err) {
      console.error("Failed to delete stream", err);
      showToast("Erro ao apagar", "Não foi possível remover o host.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const renderLoading = () => (
    <VStack className="gap-3 mt-6">
      {[1, 2, 3].map((idx) => (
        <Box key={idx} className="p-5 rounded-2xl bg-background-0 shadow-soft-1 border border-background-100">
          <Skeleton className="h-5 w-1/2 mb-3" />
          <SkeletonText className="w-1/3" />
          <HStack className="gap-2 mt-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </HStack>
        </Box>
      ))}
    </VStack>
  );

  const renderProtocolChip = (host: StreamHost) => {
    const protocols: string[] = [];
    if (host.tcp_forwarding) protocols.push("TCP");
    if (host.udp_forwarding) protocols.push("UDP");
    return (
      <HStack className="gap-2 flex-wrap mt-2">
        {protocols.map((p) => (
          <Badge key={p} className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
            <BadgeText className="text-xs text-typography-800">{p}</BadgeText>
          </Badge>
        ))}
      </HStack>
    );
  };

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 32}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadItems("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            Streams
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Configure port forwarding TCP/UDP para serviços não-HTTP.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <HStack className="gap-2 flex-wrap">
              {[
                {key: "all" as FilterTab, label: `Todos (${stats.total})`},
                {key: "active" as FilterTab, label: `Ativos (${stats.active})`},
                {key: "inactive" as FilterTab, label: `Inativos (${stats.inactive})`},
              ].map((tab) => {
                const active = filter === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setFilter(tab.key)}
                    className={`px-4 py-2 rounded-full border ${
                      active ? "bg-typography-900 border-typography-900" : "bg-background-0 border-background-200"
                    }`}
                  >
                    <Text
                      className={`text-sm ${active ? "text-background-0" : "text-typography-700"}`}
                      style={{fontFamily: active ? "Inter_700Bold" : "Inter_500Medium"}}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
            <Button action="primary" variant="solid" size="md" onPress={openCreateModal} className="rounded-full px-5">
              <ButtonIcon as={Plus} size="sm" />
              <ButtonText>Adicionar Stream</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            renderLoading()
          ) : filteredItems.length === 0 ? (
            <Box className="mt-10 p-6 border border-dashed border-background-300 rounded-2xl bg-background-0 items-center">
              <Text className="text-typography-700 font-semibold text-base">Nenhuma stream encontrada</Text>
              <Text className="text-typography-500 text-sm mt-1 text-center">
                Clique em &quot;Adicionar Stream&quot; para criar a primeira regra.
              </Text>
            </Box>
          ) : (
            <VStack className="mt-6 gap-4">
              {filteredItems.map((host) => {
                const enabled = isEnabled(host);
                const protocols: string[] = [];
                if (host.tcp_forwarding) protocols.push("TCP");
                if (host.udp_forwarding) protocols.push("UDP");
                return (
                  <Box
                    key={host.id}
                    className={`rounded-2xl p-5 border border-background-100 shadow-soft-1 ${enabled ? "bg-background-0" : "bg-background-50"}`}
                  >
                    <HStack className="items-start justify-between gap-4 flex-wrap">
                      <VStack className="gap-2 flex-1">
                        <HStack className="items-center gap-2 flex-wrap">
                          <Box className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-success-500" : "bg-outline-400"}`} />
                          <Text
                            className={`text-base ${enabled ? "text-typography-900" : "text-typography-500"}`}
                            style={{fontFamily: "Inter_700Bold"}}
                          >
                            Port {host.incoming_port}
                          </Text>
                        </HStack>
                        <HStack className="items-center gap-2 flex-wrap">
                          <ArrowLeftRight size={16} color={enabled ? "#0f172a" : "#9ca3af"} />
                          <Text className={`text-sm ${enabled ? "text-typography-800" : "text-typography-500"}`}>
                            :{host.incoming_port} → {host.forwarding_host}:{host.forwarding_port}
                          </Text>
                        </HStack>
                        <HStack className="gap-2 flex-wrap">
                          {protocols.map((p) => (
                            <Badge key={p} className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                              <BadgeText className="text-xs text-typography-800">{p}</BadgeText>
                            </Badge>
                          ))}
                          {host.certificate_id ? (
                            <HStack className="items-center gap-1">
                              <Lock size={16} color="#16a34a" />
                              <Text className="text-success-600 text-sm">SSL</Text>
                            </HStack>
                          ) : (
                            <HStack className="items-center gap-1">
                              <Shield size={16} color="#9ca3af" />
                              <Text className="text-typography-600 text-sm">Sem SSL</Text>
                            </HStack>
                          )}
                        </HStack>
                      </VStack>

                      <HStack className="gap-2 items-center">
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => handleToggle(host)}
                          isDisabled={togglingId === host.id}
                          className="border-background-300"
                        >
                          {togglingId === host.id ? <ButtonSpinner /> : <ButtonIcon as={Power} size="sm" />}
                          <ButtonText>{enabled ? "Desativar" : "Ativar"}</ButtonText>
                        </Button>
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => openEditModal(host)}
                          className="border-background-300 px-3"
                        >
                          <ButtonIcon as={Pencil} size="sm" />
                        </Button>
                        <Button
                          action="negative"
                          variant="solid"
                          size="sm"
                          onPress={() => setDeleteTarget(host)}
                          className="px-3"
                        >
                          <ButtonIcon as={Trash2} size="sm" />
                        </Button>
                      </HStack>
                    </HStack>
                  </Box>
                );
              })}
            </VStack>
          )}
        </Box>
      </ScrollView>

      <Modal isOpen={modalOpen} onClose={closeModal} size="lg">
        <ModalBackdrop />
        <ModalContent className="max-w-2xl">
          <ModalHeader className="flex-row items-start justify-between">
            <Heading size="md" className="text-typography-900">
              {editingHost ? "Editar Stream" : "Adicionar Stream"}
            </Heading>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4">
            <FormControl isRequired>
              <FormControlLabel>
                <FormControlLabelText>Porta de entrada</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  value={String(form.incoming_port || "")}
                  onChangeText={(val) => setForm((prev) => ({...prev, incoming_port: Number(val) || 0}))}
                  keyboardType="number-pad"
                  placeholder="6060"
                />
              </Input>
            </FormControl>

            <FormControl isRequired>
              <FormControlLabel>
                <FormControlLabelText>Destino</FormControlLabelText>
              </FormControlLabel>
              <HStack className="gap-3">
                <Input className="flex-1">
                  <InputField
                    value={form.forwarding_host}
                    onChangeText={(val) => setForm((prev) => ({...prev, forwarding_host: val}))}
                    autoCapitalize="none"
                    placeholder="10.0.0.3"
                  />
                </Input>
                <Input className="w-24">
                  <InputField
                    value={String(form.forwarding_port || "")}
                    onChangeText={(val) => setForm((prev) => ({...prev, forwarding_port: Number(val) || 0}))}
                    keyboardType="number-pad"
                    placeholder="60"
                  />
                </Input>
              </HStack>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>ID do Certificado</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  value={String(form.certificate_id ?? 0)}
                  onChangeText={(val) => setForm((prev) => ({...prev, certificate_id: Number(val.replace(/[^0-9]/g, "")) || 0}))}
                  keyboardType="number-pad"
                  placeholder="0 (sem certificado)"
                />
              </Input>
            </FormControl>

            <HStack className="flex-wrap gap-4">
              <HStack className="items-center gap-2">
                <Switch
                  value={form.tcp_forwarding}
                  onValueChange={(val) => setForm((prev) => ({...prev, tcp_forwarding: val}))}
                />
                <Text className="text-typography-800">TCP</Text>
              </HStack>
              <HStack className="items-center gap-2">
                <Switch
                  value={form.udp_forwarding}
                  onValueChange={(val) => setForm((prev) => ({...prev, udp_forwarding: val}))}
                />
                <Text className="text-typography-800">UDP</Text>
              </HStack>
            </HStack>
          </ModalBody>
          <ModalFooter className="gap-3">
            <Button variant="outline" action="default" onPress={closeModal} isDisabled={saving}>
              <ButtonText>Cancelar</ButtonText>
            </Button>
            <Button action="primary" onPress={handleSave} isDisabled={saving}>
              {saving ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
              <ButtonText>{editingHost ? "Salvar alterações" : "Criar stream"}</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="md" className="text-typography-900">
              Remover stream?
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-typography-700">
              Esta ação apagará{" "}
              <Text className="font-semibold">
                Port {deleteTarget?.incoming_port}
              </Text>
              . Deseja continuar?
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setDeleteTarget(null)} isDisabled={Boolean(deletingId)}>
              <ButtonText>Cancelar</ButtonText>
            </Button>
            <Button action="negative" onPress={handleDelete} isDisabled={Boolean(deletingId)}>
              {deletingId ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
              <ButtonText>Apagar</ButtonText>
            </Button>
          </AlertDialogFooter>
          <AlertDialogCloseButton />
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
