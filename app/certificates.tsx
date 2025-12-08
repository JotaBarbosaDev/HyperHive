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
import {Badge, BadgeText} from "@/components/ui/badge";
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
import {Certificate, CreateLetsEncryptPayload} from "@/types/certificate";
import {
  createLetsEncryptCertificate,
  deleteCertificate,
  downloadCertificate,
  listCertificates,
  renewCertificate,
} from "@/services/certificates";
import {Skeleton, SkeletonText} from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CloudLightning,
  Download,
  Calendar,
  Plus,
  RefreshCcw,
  Shield,
  Trash2,
} from "lucide-react-native";

const DEFAULT_FORM: CreateLetsEncryptPayload = {
  provider: "letsencrypt",
  domain_names: [],
  meta: {
    letsencrypt_email: "",
    letsencrypt_agree: true,
    dns_challenge: false,
    dns_provider: "",
    dns_provider_credentials: "",
  },
};

const parseDomains = (raw: string) =>
  raw
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseDateValue = (value?: string | number | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const direct = new Date(value);
    if (!isNaN(direct.getTime())) return direct;
    const normalized = value.replace(" ", "T");
    const withZ = normalized.includes("Z") ? normalized : `${normalized}Z`;
    const fallback = new Date(withZ);
    if (!isNaN(fallback.getTime())) return fallback;
  }
  return null;
};

const formatDate = (value?: string | number | Date | null) => {
  const date = parseDateValue(value);
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return typeof value === "string" ? value : String(value);
  }
};

const resolveExpiry = (cert: Certificate) => {
  return (
    (cert.expires_at as string | number | undefined) ??
    (cert.expires_on as string | number | undefined) ??
    (cert.expires as string | number | undefined)
  );
};

const isExpired = (cert: Certificate) => {
  const expiry = resolveExpiry(cert);
  if (!expiry) return false;
  const parsed = parseDateValue(expiry);
  if (!parsed) return false;
  const expires = parsed.getTime();
  const now = Date.now();
  return expires < now;
};

const resolveCreated = (cert: Certificate) => {
  return (
    (cert.created_at as string | number | undefined) ??
    (cert.created_on as string | number | undefined) ??
    (cert.created as string | number | undefined)
  );
};

const StatusChip = ({label, action = "info"}: {label: string; action?: "info" | "muted" | "success" | "error"}) => (
  <Badge className="rounded-full px-3 py-1" size="sm" action={action === "muted" ? "muted" : action} variant="solid">
    <BadgeText className={`text-xs ${action === "muted" ? "text-typography-700" : ""}`}>{label}</BadgeText>
  </Badge>
);

export default function CertificatesScreen() {
  const toast = useToast();
  const [certs, setCerts] = React.useState<Certificate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<CreateLetsEncryptPayload>(DEFAULT_FORM);
  const [domainsInput, setDomainsInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [renewingId, setRenewingId] = React.useState<number | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Certificate | null>(null);
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

  const loadCerts = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await listCertificates();
        setCerts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load certificates", err);
        showToast("Erro ao carregar", "Não foi possível obter os certificados.", "error");
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [showToast]
  );

  React.useEffect(() => {
    loadCerts();
  }, [loadCerts]);

  const openCreateModal = () => {
    setForm(DEFAULT_FORM);
    setDomainsInput("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleCreate = async () => {
    const domain_names = parseDomains(domainsInput);
    if (!domain_names.length) {
      showToast("Domínios obrigatórios", "Informe ao menos um domínio.", "error");
      return;
    }
    if (!form.meta.letsencrypt_email) {
      showToast("Email obrigatório", "Preencha o email para Let's Encrypt.", "error");
      return;
    }
    if (!form.meta.letsencrypt_agree) {
      showToast("Aceite os termos", "É necessário aceitar os termos do Let's Encrypt.", "error");
      return;
    }

    const payload: CreateLetsEncryptPayload = {
      ...form,
      domain_names,
      meta: {
        ...form.meta,
      },
    };

    setSaving(true);
    try {
      await createLetsEncryptCertificate(payload);
      showToast("Certificado criado", "Let's Encrypt em andamento.");
      setModalOpen(false);
      await loadCerts("silent");
    } catch (err) {
      console.error("Failed to create certificate", err);
      showToast("Erro ao criar", "Não foi possível criar o certificado.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRenew = async (cert: Certificate) => {
    if (!cert.id) return;
    setRenewingId(cert.id);
    try {
      await renewCertificate(cert.id);
      showToast("Renovação iniciada", "O certificado está sendo renovado.");
      await loadCerts("silent");
    } catch (err) {
      console.error("Failed to renew certificate", err);
      showToast("Erro ao renovar", "Tente novamente mais tarde.", "error");
    } finally {
      setRenewingId(null);
    }
  };

  const handleDownload = async (cert: Certificate) => {
    if (!cert.id) return;
    setDownloadingId(cert.id);
    try {
      await downloadCertificate(cert.id);
      showToast("Download gerado", "O certificado foi solicitado para download.");
    } catch (err) {
      console.error("Failed to download certificate", err);
      showToast("Erro ao baixar", "Não foi possível gerar o download.", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteCertificate(deleteTarget.id);
      showToast("Certificado removido", "Certificado apagado com sucesso.");
      setDeleteTarget(null);
      await loadCerts("silent");
    } catch (err) {
      console.error("Failed to delete certificate", err);
      showToast("Erro ao apagar", "Não foi possível remover o certificado.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const renderLoading = () => (
    <VStack className="gap-3 mt-6">
      {[1, 2].map((idx) => (
        <Box key={idx} className="p-5 rounded-2xl bg-background-0 shadow-soft-1 border border-background-100">
          <Skeleton className="h-5 w-2/3 mb-3" />
          <SkeletonText className="w-1/3" />
          <HStack className="gap-2 mt-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCerts("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            SSL Certificates
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Gerencie certificados SSL para seus proxy hosts.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <Box className="flex-row items-center gap-3 px-4 py-3 rounded-xl bg-background-0 border border-background-200 shadow-soft-1">
              <Shield size={20} color="#0f172a" />
              <Text className="text-typography-900 font-semibold text-base">
                {certs.length} certificado{certs.length === 1 ? "" : "s"} total
              </Text>
            </Box>
            <Button action="primary" variant="solid" size="md" onPress={openCreateModal} className="rounded-full px-5">
              <ButtonIcon as={Plus} size="sm" />
              <ButtonText>Adicionar Certificado</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            renderLoading()
          ) : certs.length === 0 ? (
            <Box className="mt-10 p-6 border border-dashed border-background-300 rounded-2xl bg-background-0 items-center">
              <Text className="text-typography-700 font-semibold text-base">Nenhum certificado encontrado</Text>
              <Text className="text-typography-500 text-sm mt-1 text-center">
                Clique em &quot;Novo Certificado&quot; para emitir via Let's Encrypt.
              </Text>
            </Box>
          ) : (
            <VStack className="mt-6 gap-4">
              {certs.map((cert) => {
                const expired = isExpired(cert);
                return (
                  <Box
                    key={cert.id}
                    className="bg-background-0 rounded-2xl p-5 border border-background-100 shadow-soft-1"
                  >
                    <HStack className="items-start justify-between gap-4 flex-wrap">
                      <VStack className="gap-2 flex-1">
                        <HStack className="items-center gap-2 flex-wrap">
                          <Shield size={18} color={expired ? "#ef4444" : "#16a34a"} />
                          <Text
                            className="text-typography-900 text-base"
                            style={{fontFamily: "Inter_700Bold"}}
                          >
                            {cert.nice_name ?? (cert.domain_names ?? [])[0] ?? "-"}
                          </Text>
                          <StatusChip
                            label={cert.provider?.toLowerCase() === "letsencrypt" ? "Let's Encrypt" : "Custom"}
                            action="muted"
                          />
                        </HStack>
                        <HStack className="gap-2 flex-wrap">
                          {(cert.domain_names ?? []).slice(0, 3).map((domain) => (
                            <Badge key={domain} className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                              <BadgeText className="text-xs text-typography-800">{domain}</BadgeText>
                            </Badge>
                          ))}
                          {(cert.domain_names?.length ?? 0) > 3 ? (
                            <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                              <BadgeText className="text-xs text-typography-800">
                                +{(cert.domain_names?.length ?? 0) - 3} domínios
                              </BadgeText>
                            </Badge>
                          ) : null}
                        </HStack>
                        <HStack className="items-center gap-3 flex-wrap">
                          <HStack className="items-center gap-2">
                            <Calendar color={expired ? "#ef4444" : "#0f172a"} size={16} />
                            <Text className={`text-sm ${expired ? "text-error-600 font-semibold" : "text-typography-800"}`}>
                              Expira: {formatDate(resolveExpiry(cert))}
                            </Text>
                          </HStack>
                          <StatusChip label={expired ? "Expirado" : "Válido"} action={expired ? "error" : "success"} />
                          {cert.meta?.dns_challenge ? (
                            <StatusChip
                              label={`DNS Challenge - ${cert.meta?.dns_provider || "provider"}`}
                              action="muted"
                            />
                          ) : (
                            <StatusChip label="HTTP Challenge" action="muted" />
                          )}
                          <StatusChip label={`Criado: ${formatDate(resolveCreated(cert))}`} action="muted" />
                        </HStack>
                        {expired ? (
                          <HStack className="items-center gap-2">
                            <AlertTriangle size={16} color="#ef4444" />
                            <Text className="text-error-600 text-sm font-semibold">
                              Este certificado expirou e precisa ser renovado
                            </Text>
                          </HStack>
                        ) : null}
                      </VStack>

                      <HStack className="gap-2 items-center">
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => handleRenew(cert)}
                          isDisabled={renewingId === cert.id}
                          className="border-background-300"
                        >
                          {renewingId === cert.id ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                          <ButtonText>Renovar</ButtonText>
                        </Button>
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => handleDownload(cert)}
                          isDisabled={downloadingId === cert.id}
                          className="border-background-300 px-3"
                        >
                          {downloadingId === cert.id ? <ButtonSpinner /> : <ButtonIcon as={Download} size="sm" />}
                        </Button>
                        <Button
                          action="negative"
                          variant="solid"
                          size="sm"
                          onPress={() => setDeleteTarget(cert)}
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
              Emitir Let's Encrypt
            </Heading>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4">
            <FormControl isRequired>
              <FormControlLabel>
                <FormControlLabelText>Domínios</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  value={domainsInput}
                  onChangeText={setDomainsInput}
                  placeholder="ex: *.marques.com, marques.com"
                  autoCapitalize="none"
                />
              </Input>
              <FormControlHelper>
                <FormControlHelperText>Separe por vírgula ou quebra de linha.</FormControlHelperText>
              </FormControlHelper>
            </FormControl>

            <FormControl isRequired>
              <FormControlLabel>
                <FormControlLabelText>Email</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  value={form.meta.letsencrypt_email}
                  onChangeText={(val) => setForm((prev) => ({...prev, meta: {...prev.meta, letsencrypt_email: val}}))}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="seu-email@dominio.com"
                />
              </Input>
            </FormControl>

            <HStack className="items-center gap-2">
              <Switch
                value={form.meta.letsencrypt_agree ?? false}
                onValueChange={(val) => setForm((prev) => ({...prev, meta: {...prev.meta, letsencrypt_agree: val}}))}
              />
              <Text className="text-typography-800">Aceito os termos do Let's Encrypt</Text>
            </HStack>

            <HStack className="items-center gap-2 flex-wrap">
              <Switch
                value={form.meta.dns_challenge ?? false}
                onValueChange={(val) => setForm((prev) => ({...prev, meta: {...prev.meta, dns_challenge: val}}))}
              />
              <Text className="text-typography-800">Usar DNS Challenge</Text>
            </HStack>

            {form.meta.dns_challenge ? (
              <VStack className="gap-3">
                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>Provedor DNS</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      value={form.meta.dns_provider ?? ""}
                      onChangeText={(val) => setForm((prev) => ({...prev, meta: {...prev.meta, dns_provider: val}}))}
                      autoCapitalize="none"
                      placeholder="dynu, cloudflare, route53..."
                    />
                  </Input>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>Credenciais DNS</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      value={form.meta.dns_provider_credentials ?? ""}
                      onChangeText={(val) =>
                        setForm((prev) => ({...prev, meta: {...prev.meta, dns_provider_credentials: val}}))
                      }
                      autoCapitalize="none"
                      placeholder="dns_dynu_auth_token = SEU_TOKEN..."
                    />
                  </Input>
                  <FormControlHelper>
                    <FormControlHelperText>Use o formato esperado pelo lego/ACME do provider.</FormControlHelperText>
                  </FormControlHelper>
                </FormControl>
              </VStack>
            ) : null}
          </ModalBody>
          <ModalFooter className="gap-3">
            <Button variant="outline" action="default" onPress={closeModal} isDisabled={saving}>
              <ButtonText>Cancelar</ButtonText>
            </Button>
            <Button action="primary" onPress={handleCreate} isDisabled={saving}>
              {saving ? <ButtonSpinner /> : <ButtonIcon as={CloudLightning} size="sm" />}
              <ButtonText>Emitir</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="md" className="text-typography-900">
              Remover certificado?
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
