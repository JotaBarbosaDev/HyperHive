import React from "react";
import {RefreshControl, ScrollView, useWindowDimensions} from "react-native";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {VStack} from "@/components/ui/vstack";
import {HStack} from "@/components/ui/hstack";
import {Button, ButtonIcon, ButtonSpinner, ButtonText} from "@/components/ui/button";
import {Badge, BadgeText} from "@/components/ui/badge";
import {Input, InputField} from "@/components/ui/input";
import {Textarea, TextareaInput} from "@/components/ui/textarea";
import {Switch} from "@/components/ui/switch";
import {
  Select,
  SelectBackdrop as SelectBackdropContent,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@/components/ui/select";
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
import {Pressable} from "@/components/ui/pressable";
import {Toast, ToastDescription, ToastTitle, useToast} from "@/components/ui/toast";
import {NotFoundHost, NotFoundHostPayload} from "@/types/nginx";
import {
  createNotFoundHost,
  deleteNotFoundHost,
  disableNotFoundHost,
  enableNotFoundHost,
  listNotFoundHosts,
  updateNotFoundHost,
} from "@/services/nginx404";
import {
  AlertTriangle,
  ChevronDown,
  Lock,
  Pencil,
  Plus,
  Power,
  Shield,
  ShieldOff,
  Trash2,
} from "lucide-react-native";
import {Skeleton, SkeletonText} from "@/components/ui/skeleton";
import {useCertificatesOptions} from "@/hooks/useCertificatesOptions";

type FilterTab = "all" | "active" | "inactive";

const DEFAULT_PAYLOAD: NotFoundHostPayload = {
  domain_names: [],
  certificate_id: 0,
  meta: {
    letsencrypt_agree: false,
    dns_challenge: false,
  },
  advanced_config: "",
  hsts_enabled: false,
  hsts_subdomains: false,
  http2_support: false,
  ssl_forced: false,
};

const parseDomains = (raw: string) =>
  raw
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const isHostEnabled = (host: NotFoundHost) => host.enabled !== false;

const StatusChip = ({
  label,
  active = true,
}: {
  label: string;
  active?: boolean;
}) => (
  <Badge
    className={`rounded-full px-3 py-1 ${active ? "bg-background-100" : "bg-background-50 border border-background-200"}`}
    size="sm"
    action={active ? "info" : "muted"}
    variant="solid"
  >
    <BadgeText
      className={`text-xs ${active ? "text-typography-800" : "text-typography-600"}`}
    >
      {label}
    </BadgeText>
  </Badge>
);

const TOGGLE_PROPS = {
  size: "sm" as const,
  thumbColor: "#f8fafc",
  trackColor: {false: "#cbd5e1", true: "#0f172a"},
  ios_backgroundColor: "#cbd5e1",
};

export default function NotFoundHostsScreen() {
  const toast = useToast();
  const [hosts, setHosts] = React.useState<NotFoundHost[]>([]);
  const [filter, setFilter] = React.useState<FilterTab>("all");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingHost, setEditingHost] = React.useState<NotFoundHost | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<NotFoundHost | null>(null);
  const [form, setForm] = React.useState<NotFoundHostPayload>(DEFAULT_PAYLOAD);
  const [domainsInput, setDomainsInput] = React.useState("");
  const [togglingId, setTogglingId] = React.useState<number | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const {height: screenHeight} = useWindowDimensions();
  const modalBodyMaxHeight = Math.min(screenHeight * 0.55, 520);
  const [formTab, setFormTab] = React.useState<"details" | "ssl">("details");

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
            {description ? (
              <ToastDescription size="sm">{description}</ToastDescription>
            ) : null}
          </Toast>
        ),
      });
    },
    [toast]
  );

  const handleCertificatesError = React.useCallback(
    (_error: unknown) => {
      showToast("Erro ao carregar certificados", "Não foi possível obter os certificados SSL.", "error");
    },
    [showToast]
  );

  const {certificateOptions, loadingCertificates, refreshCertificates} = useCertificatesOptions(handleCertificatesError);
  const selectedCertificateLabel =
    certificateOptions.find((option) => option.value === String(form.certificate_id ?? 0))?.label || "Sem certificado";

  const loadHosts = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await listNotFoundHosts();
        setHosts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load 404 hosts", err);
        showToast("Erro ao carregar", "Não foi possível obter os 404 hosts.", "error");
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [showToast]
  );

  React.useEffect(() => {
    loadHosts();
  }, [loadHosts]);

  const openCreateModal = () => {
    setEditingHost(null);
    setForm(DEFAULT_PAYLOAD);
    setDomainsInput("");
    void refreshCertificates();
    setFormTab("details");
    setModalOpen(true);
  };

  const openEditModal = (host: NotFoundHost) => {
    setEditingHost(host);
    setForm({
      domain_names: host.domain_names ?? [],
      certificate_id: host.certificate_id ?? 0,
      meta: {
        letsencrypt_agree: host.meta?.letsencrypt_agree ?? false,
        dns_challenge: host.meta?.dns_challenge ?? false,
      },
      advanced_config: host.advanced_config ?? "",
      hsts_enabled: host.hsts_enabled ?? false,
      hsts_subdomains: host.hsts_subdomains ?? false,
      http2_support: host.http2_support ?? false,
      ssl_forced: host.ssl_forced ?? false,
    });
    setDomainsInput((host.domain_names ?? []).join(", "));
    void refreshCertificates();
    setFormTab("details");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingHost(null);
  };

  const handleSaveHost = async () => {
    const domain_names = parseDomains(domainsInput);
    if (!domain_names.length) {
      showToast("Domínios obrigatórios", "Informe ao menos um domínio.", "error");
      return;
    }
    const payload: NotFoundHostPayload = {
      ...form,
      domain_names,
      certificate_id: Number(form.certificate_id) || 0,
      advanced_config: form.advanced_config ?? "",
    };

    setSaving(true);
    try {
      if (editingHost?.id) {
        await updateNotFoundHost(editingHost.id, payload);
        showToast("404 Host atualizado", "Configuração editada com sucesso.");
      } else {
        await createNotFoundHost(payload);
        showToast("404 Host criado", "Novo host de erro 404 adicionado.");
      }
      setModalOpen(false);
      setEditingHost(null);
      await loadHosts("silent");
    } catch (err) {
      console.error("Failed to persist 404 host", err);
      showToast("Erro ao salvar", "Verifique os dados e tente novamente.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (host: NotFoundHost) => {
    if (!host.id) return;
    const enabled = isHostEnabled(host);
    setTogglingId(host.id);
    try {
      if (enabled) {
        await disableNotFoundHost(host.id);
        showToast("Host desativado", "O host 404 foi desativado.");
      } else {
        await enableNotFoundHost(host.id);
        showToast("Host ativado", "O host 404 foi ativado.");
      }
      await loadHosts("silent");
    } catch (err) {
      console.error("Failed to toggle 404 host", err);
      showToast("Erro ao alterar status", "Não foi possível atualizar o host.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteNotFoundHost(deleteTarget.id);
      showToast("Host removido", "404 Host apagado com sucesso.");
      setDeleteTarget(null);
      await loadHosts("silent");
    } catch (err) {
      console.error("Failed to delete 404 host", err);
      showToast("Erro ao apagar", "Não foi possível remover o host.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredHosts = React.useMemo(() => {
    if (filter === "active") {
      return hosts.filter((host) => isHostEnabled(host));
    }
    if (filter === "inactive") {
      return hosts.filter((host) => !isHostEnabled(host));
    }
    return hosts;
  }, [filter, hosts]);

  const stats = React.useMemo(() => {
    const active = hosts.filter((h) => isHostEnabled(h)).length;
    const inactive = hosts.length - active;
    return {total: hosts.length, active, inactive};
  }, [hosts]);

  const renderLoading = () => (
    <VStack className="gap-3 mt-6">
      {[1, 2].map((idx) => (
        <Box key={idx} className="p-5 rounded-2xl bg-background-0 shadow-soft-1 border border-background-100">
          <Skeleton className="h-5 w-2/3 mb-3" />
          <SkeletonText className="w-1/2" />
          <HStack className="gap-2 mt-4">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-16" />
          </HStack>
        </Box>
      ))}
    </VStack>
  );

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 32}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadHosts("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            404 Hosts
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Domínios que retornarão erro 404 - Not Found para todas as requisições.
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
              <ButtonText>Adicionar 404 Host</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            renderLoading()
          ) : filteredHosts.length === 0 ? (
            <Box className="mt-10 p-6 border border-dashed border-background-300 rounded-2xl bg-background-0 items-center">
              <Text className="text-typography-700 font-semibold text-base">Nenhum host 404 encontrado</Text>
              <Text className="text-typography-500 text-sm mt-1 text-center">
                Clique em &quot;Adicionar 404 Host&quot; para criar o primeiro domínio de resposta 404.
              </Text>
            </Box>
          ) : (
            <VStack className="mt-6 gap-4">
              {filteredHosts.map((host) => {
                const enabled = isHostEnabled(host);
                return (
                  <Box
                    key={host.id}
                    className="bg-background-0 rounded-2xl p-5 border border-background-100 shadow-soft-1"
                  >
                    <HStack className="items-start justify-between gap-4 flex-wrap">
                      <HStack className="items-center gap-2 flex-1 flex-wrap">
                        <Box
                          className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-success-500" : "bg-outline-400"}`}
                        />
                        <Text
                          className="text-typography-900 text-base"
                          style={{fontFamily: "Inter_700Bold"}}
                        >
                          {(host.domain_names ?? []).join(", ")}
                        </Text>
                      </HStack>
                      <HStack className="gap-2">
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => handleToggle(host)}
                          isDisabled={togglingId === host.id}
                          className="border-background-300"
                        >
                          {togglingId === host.id ? (
                            <ButtonSpinner />
                          ) : (
                            <ButtonIcon as={Power} size="sm" />
                          )}
                          <ButtonText>{enabled ? "Desativar" : "Ativar"}</ButtonText>
                        </Button>
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => openEditModal(host)}
                          className="border-background-300"
                        >
                          <ButtonIcon as={Pencil} size="sm" />
                        </Button>
                        <Button
                          action="negative"
                          variant="solid"
                          size="sm"
                          onPress={() => setDeleteTarget(host)}
                        >
                          <ButtonIcon as={Trash2} size="sm" />
                        </Button>
                      </HStack>
                    </HStack>

                    <HStack className="mt-3 items-center gap-4 flex-wrap">
                      <HStack className="items-center gap-2">
                        <AlertTriangle size={18} color="#ef4444" />
                        <Text className="text-error-600 font-semibold text-sm">404 Not Found</Text>
                      </HStack>
                      <HStack className="items-center gap-2">
                        {host.ssl_forced ? (
                          <Lock size={18} color="#16a34a" />
                        ) : (
                          <ShieldOff size={18} color="#9ca3af" />
                        )}
                        <Text className={`text-sm ${host.ssl_forced ? "text-success-600" : "text-typography-600"}`}>
                          SSL {host.ssl_forced ? "(Forçado)" : "(Opcional)"}
                        </Text>
                      </HStack>
                      {host.certificate_id ? <StatusChip label="Com SSL" /> : null}
                      {host.http2_support ? <StatusChip label="HTTP/2" /> : null}
                      {host.hsts_enabled ? (
                        <StatusChip label={`HSTS${host.hsts_subdomains ? " + Subdomínios" : ""}`} />
                      ) : null}
                    </HStack>

                    <HStack className="mt-3 gap-2 flex-wrap">
                      {host.meta?.letsencrypt_agree ? <StatusChip label="Let's Encrypt" /> : null}
                      {host.meta?.dns_challenge ? <StatusChip label="DNS Challenge" /> : null}
                      <StatusChip label={enabled ? "Ativo" : "Inativo"} active={enabled} />
                    </HStack>

                    {host.advanced_config ? (
                      <Box className="mt-3 p-3 rounded-xl bg-background-50 border border-background-100">
                        <HStack className="items-center gap-2 mb-2">
                          <Shield size={16} color="#0f172a" />
                          <Text className="text-typography-800 font-semibold text-sm">Configuração avançada</Text>
                        </HStack>
                        <Text className="text-typography-600 text-xs leading-5">
                          {host.advanced_config}
                        </Text>
                      </Box>
                    ) : null}
                  </Box>
                );
              })}
            </VStack>
      )}
        </Box>
      </ScrollView>

      <Modal isOpen={modalOpen} onClose={closeModal} size="lg">
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="max-w-3xl w-full rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] shadow-2xl">
          <ModalHeader className="flex-row items-start justify-between px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <VStack className="flex-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                {editingHost ? "Editar 404 Host" : "Adicionar 404 Host"}
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 mt-1">
                Bloqueie domínios devolvendo 404, com SSL opcional e cabeçalhos HSTS.
              </Text>
            </VStack>
            <ModalCloseButton className="text-typography-500" />
          </ModalHeader>
          <ModalBody className="px-6 pt-4">
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={{maxHeight: modalBodyMaxHeight}}
              contentContainerStyle={{paddingBottom: 8}}
            >
              <VStack className="gap-5">
                <HStack className="gap-2">
                  {[
                    {key: "details", label: "Details"},
                    {key: "ssl", label: "SSL"},
                  ].map((tab) => {
                    const active = formTab === tab.key;
                    return (
                      <Pressable
                        key={tab.key}
                        onPress={() => setFormTab(tab.key as typeof formTab)}
                        className={`px-4 py-2 rounded-full border ${
                          active ? "bg-typography-900 border-typography-900" : "bg-background-50 border-outline-200"
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

                {formTab === "details" ? (
                  <VStack className="gap-4">
                    <FormControl isRequired>
                      <FormControlLabel>
                        <FormControlLabelText>Domínios</FormControlLabelText>
                      </FormControlLabel>
                      <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                        <InputField
                          value={domainsInput}
                          onChangeText={setDomainsInput}
                          placeholder="ex: blocked.hyperhive.local, spam.hyperhive.local"
                          autoCapitalize="none"
                        />
                      </Input>
                      <FormControlHelper>
                        <FormControlHelperText>Separe por vírgula ou quebra de linha.</FormControlHelperText>
                      </FormControlHelper>
                    </FormControl>

                    <FormControl>
                      <FormControlLabel>
                        <FormControlLabelText>Configuração avançada (opcional)</FormControlLabelText>
                      </FormControlLabel>
                      <Textarea className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]" size="md">
                        <TextareaInput
                          value={form.advanced_config}
                          onChangeText={(text) => setForm((prev) => ({...prev, advanced_config: text}))}
                          placeholder="Bloco de configuração Nginx opcional..."
                        />
                      </Textarea>
                    </FormControl>
                  </VStack>
                ) : null}

                {formTab === "ssl" ? (
                  <VStack className="gap-4">
                    <FormControl>
                      <HStack className="items-center justify-between">
                        <FormControlLabel>
                          <FormControlLabelText>Certificado SSL</FormControlLabelText>
                        </FormControlLabel>
                        <Button
                          variant="link"
                          action="primary"
                          className="px-0"
                          size="sm"
                          onPress={() => void refreshCertificates()}
                          isDisabled={loadingCertificates}
                        >
                          {loadingCertificates ? <ButtonSpinner /> : <ButtonText>Atualizar</ButtonText>}
                        </Button>
                      </HStack>
                      <Select
                        selectedValue={String(form.certificate_id ?? 0)}
                        onValueChange={(val) => setForm((prev) => ({...prev, certificate_id: Number(val)}))}
                        isDisabled={loadingCertificates && certificateOptions.length === 0}
                      >
                        <SelectTrigger className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] h-11 px-4">
                          <SelectInput
                            placeholder={loadingCertificates ? "A carregar certificados..." : selectedCertificateLabel}
                            className="text-typography-900 dark:text-[#E8EBF0]"
                          />
                          <SelectIcon as={ChevronDown} className="text-typography-500 dark:text-typography-400" />
                        </SelectTrigger>
                        <SelectPortal>
                          <SelectBackdropContent />
                          <SelectContent className="max-h-72 bg-background-0 dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52] rounded-2xl">
                            <SelectDragIndicatorWrapper>
                              <SelectDragIndicator />
                            </SelectDragIndicatorWrapper>
                            {certificateOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                label={option.label}
                                value={option.value}
                                className="text-base text-typography-900 dark:text-[#E8EBF0]"
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </SelectPortal>
                      </Select>
                      <FormControlHelper>
                        <FormControlHelperText>Use um certificado emitido ou deixe sem SSL.</FormControlHelperText>
                      </FormControlHelper>
                    </FormControl>

                    <VStack className="gap-3">
                      <Text className="text-typography-800 font-semibold">Opções de ligação</Text>
                      <HStack className="flex-wrap gap-4">
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.ssl_forced}
                            onValueChange={(val) => setForm((prev) => ({...prev, ssl_forced: val}))}
                          />
                          <Text className="text-typography-800">Forçar SSL</Text>
                        </HStack>
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.http2_support}
                            onValueChange={(val) => setForm((prev) => ({...prev, http2_support: val}))}
                          />
                          <Text className="text-typography-800">HTTP/2</Text>
                        </HStack>
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.hsts_enabled}
                            onValueChange={(val) => setForm((prev) => ({...prev, hsts_enabled: val}))}
                          />
                          <Text className="text-typography-800">HSTS</Text>
                        </HStack>
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.hsts_subdomains}
                            onValueChange={(val) => setForm((prev) => ({...prev, hsts_subdomains: val}))}
                            isDisabled={!form.hsts_enabled}
                          />
                          <Text className={`text-typography-800 ${!form.hsts_enabled ? "text-typography-500" : ""}`}>
                            HSTS Subdomínios
                          </Text>
                        </HStack>
                      </HStack>
                    </VStack>
                  </VStack>
                ) : null}
              </VStack>
            </ScrollView>
          </ModalBody>
          <ModalFooter className="px-6 pb-6 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="gap-3 justify-end w-full">
              <Button variant="outline" action="default" onPress={closeModal} isDisabled={saving}>
                <ButtonText>Cancelar</ButtonText>
              </Button>
              <Button action="primary" onPress={handleSaveHost} isDisabled={saving}>
                {saving ? <ButtonSpinner /> : null}
                <ButtonText>{editingHost ? "Salvar alterações" : "Criar host"}</ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="md" className="text-typography-900">
              Remover host 404?
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-typography-700">
              Esta ação apagará{" "}
              <Text className="font-semibold">
                {(deleteTarget?.domain_names ?? []).join(", ")}
              </Text>
              . Deseja continuar?
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setDeleteTarget(null)} isDisabled={Boolean(deletingId)}>
              <ButtonText>Cancelar</ButtonText>
            </Button>
            <Button action="negative" onPress={handleDelete} isDisabled={Boolean(deletingId)}>
              {deletingId ? <ButtonSpinner /> : null}
              <ButtonText>Apagar</ButtonText>
            </Button>
          </AlertDialogFooter>
          <AlertDialogCloseButton />
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
