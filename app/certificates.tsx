import React from "react";
import { RefreshControl, ScrollView, useWindowDimensions, Platform, useColorScheme } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge, BadgeText } from "@/components/ui/badge";
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
import { Pressable } from "@/components/ui/pressable";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { Certificate, CreateLetsEncryptPayload } from "@/types/certificate";
import {
  createLetsEncryptCertificate,
  deleteCertificate,
  listCertificates,
  renewCertificate,
  listDnsProviders,
  DnsProvider,
} from "@/services/certificates";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CloudLightning,
  Calendar,
  Plus,
  RefreshCcw,
  Shield,
  Trash2,
  X,
} from "lucide-react-native";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectItem,
  SelectIcon,
  SelectPortal,
  SelectBackdrop as SelectBackdropContent,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
} from "@/components/ui/select";
import { ChevronDown } from "lucide-react-native";

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

const StatusChip = ({ label, action = "info" }: { label: string; action?: "info" | "muted" | "success" | "error" }) => (
  <Badge className="rounded-full px-3 py-1" size="sm" action={action === "muted" ? "muted" : action} variant="solid">
    <BadgeText className={`text-xs ${action === "muted" ? "text-typography-700" : ""}`}>{label}</BadgeText>
  </Badge>
);

const TOGGLE_PROPS = {
  size: "sm" as const,
  thumbColor: "#f8fafc",
  trackColor: { false: "#cbd5e1", true: "#0f172a" },
  ios_backgroundColor: "#cbd5e1",
};

export default function CertificatesScreen() {
  const toast = useToast();
  const [certs, setCerts] = React.useState<Certificate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<CreateLetsEncryptPayload>(DEFAULT_FORM);
  const [domainsInput, setDomainsInput] = React.useState("");
  const [domainsList, setDomainsList] = React.useState<string[]>([]);
  const lastAddAtRef = React.useRef<number>(0);
  const addDomainFromInput = React.useCallback(() => {
    const now = Date.now();
    if (now - (lastAddAtRef.current || 0) < 500) return;
    lastAddAtRef.current = now;
    const val = (domainsInput || "").trim();
    if (!val) return;
    const parts = parseDomains(val);
    setDomainsList((prev) => Array.from(new Set([...prev, ...parts.filter(Boolean)])));
    setDomainsInput("");
  }, [domainsInput]);
  const [saving, setSaving] = React.useState(false);
  const [dnsProviders, setDnsProviders] = React.useState<DnsProvider[]>([]);
  const [dnsLoading, setDnsLoading] = React.useState(false);
  const [selectedDnsProviderId, setSelectedDnsProviderId] = React.useState<string | null>(null);
  const [renewingId, setRenewingId] = React.useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Certificate | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [selectedCert, setSelectedCert] = React.useState<Certificate | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  const modalBodyMaxHeight = Math.min(screenHeight * 0.7, 720);
  const isWeb = Platform.OS === "web";
  const isDarkMode = useColorScheme() === "dark";

  const showToast = React.useCallback(
    (title: string, description: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
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
        showToast("Error loading", "Unable to fetch certificates.", "error");
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
    setDomainsList([]);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const loadDnsProviders = React.useCallback(async () => {
    if (dnsProviders.length) return;
    setDnsLoading(true);
    try {
      const data = await listDnsProviders();
      setDnsProviders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load dns providers", err);
      showToast("Error loading", "Unable to fetch DNS providers.", "error");
    } finally {
      setDnsLoading(false);
    }
  }, [dnsProviders.length, showToast]);

  React.useEffect(() => {
    if (modalOpen && form.meta.dns_challenge) {
      loadDnsProviders();
      if (form.meta.dns_provider) setSelectedDnsProviderId(form.meta.dns_provider || null);
    }
  }, [modalOpen, form.meta.dns_challenge, form.meta.dns_provider, loadDnsProviders]);

  const handleCreate = async () => {
    const combined = [...domainsList, ...parseDomains(domainsInput)];
    const unique = Array.from(new Set(combined.map((d) => d.trim()).filter(Boolean)));
    if (!unique.length) {
      showToast("Domains required", "Provide at least one domain.", "error");
      return;
    }
    if (!form.meta.letsencrypt_email) {
      showToast("Email required", "Enter the email for Let's Encrypt.", "error");
      return;
    }
    if (!form.meta.letsencrypt_agree) {
      showToast("Accept the terms", "You must accept Let's Encrypt terms.", "error");
      return;
    }

    const payload: CreateLetsEncryptPayload = {
      ...form,
      domain_names: unique,
      meta: (() => {
        const { letsencrypt_email, letsencrypt_agree, ...rest } = form.meta ?? {};
        return {
          ...rest,
        } as typeof form.meta;
      })(),
    };

    setSaving(true);
    try {
      await createLetsEncryptCertificate(payload);
      showToast("Certificate created", "Let's Encrypt in progress.");
      setModalOpen(false);
      await loadCerts("silent");
    } catch (err) {
      console.error("Failed to create certificate", err);
      showToast("Error creating", "Unable to create the certificate.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRenew = async (cert: Certificate) => {
    if (!cert.id) return;
    setRenewingId(cert.id);
    try {
      await renewCertificate(cert.id);
      showToast("Renewal started", "The certificate is being renewed.");
      await loadCerts("silent");
    } catch (err) {
      console.error("Failed to renew certificate", err);
      showToast("Error renewing", "Try again later.", "error");
    } finally {
      setRenewingId(null);
    }
  };



  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteCertificate(deleteTarget.id);
      showToast("Certificate removed", "Certificate deleted successfully.");
      setDeleteTarget(null);
      await loadCerts("silent");
    } catch (err) {
      console.error("Failed to delete certificate", err);
      showToast("Error deleting", "Unable to remove the certificate.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const renderLoading = () => (
    <VStack className="gap-3 mt-6">
      {[1, 2].map((idx) => (
        <Box className="p-5 rounded-2xl bg-background-0 dark:bg-[#0F1A2E] shadow-soft-1 border border-outline-100 dark:border-[#2A3B52]" key={idx}>
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
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCerts("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            SSL Certificates
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Manage SSL certificates for your proxy hosts.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <Box className="flex-row items-center gap-3 px-4 py-3 rounded-xl bg-background-0 dark:bg-[#0F1A2E] border border-outline-200 dark:border-[#2A3B52] shadow-soft-1">
              <Shield size={20} color="#0f172a" />
              <Text className="text-typography-900 font-semibold text-base">
                {certs.length} certificate{certs.length === 1 ? "" : "s"} total
              </Text>
            </Box>
            <Button
              action="primary"
              variant="solid"
              size="md"
              onPress={openCreateModal}
              className="rounded-xl px-5 bg-typography-900 dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
            >
              <ButtonIcon as={Plus} size="sm" className="text-background-0 dark:text-[#0A1628]" />
              <ButtonText className="text-background-0 dark:text-[#0A1628]">Add Certificate</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            renderLoading()
          ) : certs.length === 0 ? (
            <Box className="mt-10 p-6 border border-dashed border-outline-200 dark:border-[#2A3B52] rounded-2xl bg-background-0 dark:bg-[#0A1628] items-center">
              <Text className="text-typography-700 font-semibold text-base">No certificates found</Text>
              <Text className="text-typography-500 text-sm mt-1 text-center">
                Click "New Certificate" to issue via Let's Encrypt.
              </Text>
            </Box>
          ) : isWeb ? (
            <VStack className="mt-6 gap-4">
              {certs.map((cert) => {
                const expired = isExpired(cert);
                return (
                  <Box className="bg-background-0 dark:bg-[#0F1A2E] rounded-2xl p-5 border border-outline-100 dark:border-[#2A3B52] shadow-soft-1" key={cert.id}>
                    <HStack className="items-start justify-between gap-4 flex-wrap">
                      <VStack className="gap-2 flex-1">
                        <HStack className="items-center gap-2 flex-wrap">
                          <Shield size={18} color={expired ? "#ef4444" : "#16a34a"} />
                          <Text
                            className="text-typography-900 text-base"
                            style={{ fontFamily: "Inter_700Bold" }}
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
                                +{(cert.domain_names?.length ?? 0) - 3} domains
                              </BadgeText>
                            </Badge>
                          ) : null}
                        </HStack>
                        <HStack className="items-center gap-3 flex-wrap">
                          <HStack className="items-center gap-2">
                            <Calendar color={expired ? "#ef4444" : "#0f172a"} size={16} />
                            <Text className={`text-sm ${expired ? "text-error-600 font-semibold" : "text-typography-800"}`}>
                              Expires: {formatDate(resolveExpiry(cert))}
                            </Text>
                          </HStack>
                          <StatusChip label={expired ? "Expired" : "Valid"} action={expired ? "error" : "success"} />
                          {cert.meta?.dns_challenge ? (
                            <StatusChip
                              label={`DNS Challenge - ${cert.meta?.dns_provider || "provider"}`}
                              action="muted"
                            />
                          ) : (
                            <StatusChip label="HTTP Challenge" action="muted" />
                          )}
                          <StatusChip label={`Created: ${formatDate(resolveCreated(cert))}`} action="muted" />
                        </HStack>
                        {expired ? (
                          <HStack className="items-center gap-2">
                            <AlertTriangle size={16} color="#ef4444" />
                            <Text className="text-error-600 text-sm font-semibold">
                              This certificate has expired and needs to be renewed
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
                          className="border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E] rounded-xl"
                        >
                          {renewingId === cert.id ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                          <ButtonText className="text-typography-900">Renew</ButtonText>
                        </Button>
                        {/* Download removed per request */}
                        <Button
                          action="negative"
                          variant="solid"
                          size="sm"
                          onPress={() => setDeleteTarget(cert)}
                          className="px-3 rounded-xl"
                        >
                          <ButtonIcon as={Trash2} size="sm" />
                        </Button>
                      </HStack>
                    </HStack>
                  </Box>
                );
              })}
            </VStack>
          ) : (
            <VStack className="mt-6 gap-3">
              {certs.map((cert) => {
                const expired = isExpired(cert);
                const title = cert.nice_name ?? (cert.domain_names ?? [])[0] ?? "-";
                return (
                  <Pressable
                    key={cert.id}
                    onPress={() => setSelectedCert(cert)}
                    className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0F1A2E] p-4 shadow-soft-1"
                  >
                    <VStack className="gap-2">
                      <HStack className="items-center justify-between gap-2">
                        <HStack className="items-center gap-2 flex-1 flex-wrap">
                          <Shield size={16} color={expired ? "#ef4444" : isDarkMode ? "#22c55e" : "#16a34a"} />
                          <Text className="text-typography-900 dark:text-[#E8EBF0] text-sm" style={{ fontFamily: "Inter_700Bold" }}>
                            {title}
                          </Text>
                        </HStack>
                        <StatusChip label={expired ? "Expired" : "Valid"} action={expired ? "error" : "success"} />
                      </HStack>
                      <HStack className="gap-2 flex-wrap">
                        <StatusChip
                          label={cert.provider?.toLowerCase() === "letsencrypt" ? "Let's Encrypt" : "Custom"}
                          action="muted"
                        />
                        {cert.meta?.dns_challenge ? (
                          <StatusChip label="DNS Challenge" action="muted" />
                        ) : (
                          <StatusChip label="HTTP Challenge" action="muted" />
                        )}
                      </HStack>
                      <HStack className="items-center gap-2 flex-wrap">
                        <Calendar color={expired ? "#ef4444" : isDarkMode ? "#E2E8F0" : "#0f172a"} size={14} />
                        <Text className={`text-xs ${expired ? "text-error-600" : "text-typography-600 dark:text-typography-400"}`}>
                          Expires {formatDate(resolveExpiry(cert))}
                        </Text>
                      </HStack>
                      <Text className="text-xs text-typography-500 dark:text-typography-400">
                        Tap for details & actions
                      </Text>
                    </VStack>
                  </Pressable>
                );
              })}
            </VStack>
          )}
        </Box>
      </ScrollView>

      <Modal isOpen={!!selectedCert} onClose={() => setSelectedCert(null)} size="md">
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="max-w-lg w-full rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] shadow-2xl">
          <ModalHeader className="flex-row items-start justify-between px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <VStack className="flex-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                Certificate
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 mt-1">
                Details and actions for this certificate.
              </Text>
            </VStack>
            <ModalCloseButton className="text-typography-500" />
          </ModalHeader>
          <ModalBody className="px-6 pt-4">
            {selectedCert ? (
              <VStack className="gap-4">
                <VStack className="gap-2">
                  <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-typography-400">
                    Domains
                  </Text>
                  <HStack className="flex-wrap gap-2">
                    {(selectedCert.domain_names ?? []).map((domain) => (
                      <Badge key={domain} className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                        <BadgeText className="text-xs text-typography-800 dark:text-typography-200">{domain}</BadgeText>
                      </Badge>
                    ))}
                  </HStack>
                </VStack>
                <HStack className="items-center gap-2 flex-wrap">
                  <StatusChip
                    label={selectedCert.provider?.toLowerCase() === "letsencrypt" ? "Let's Encrypt" : "Custom"}
                    action="muted"
                  />
                  <StatusChip label={isExpired(selectedCert) ? "Expired" : "Valid"} action={isExpired(selectedCert) ? "error" : "success"} />
                  {selectedCert.meta?.dns_challenge ? (
                    <StatusChip label={`DNS Challenge - ${selectedCert.meta?.dns_provider || "provider"}`} action="muted" />
                  ) : (
                    <StatusChip label="HTTP Challenge" action="muted" />
                  )}
                </HStack>
                <VStack className="gap-2">
                  <HStack className="items-center gap-2">
                    <Calendar color={isExpired(selectedCert) ? "#ef4444" : isDarkMode ? "#E2E8F0" : "#0f172a"} size={16} />
                    <Text className={`text-sm ${isExpired(selectedCert) ? "text-error-600 font-semibold" : "text-typography-800 dark:text-typography-200"}`}>
                      Expires: {formatDate(resolveExpiry(selectedCert))}
                    </Text>
                  </HStack>
                  <HStack className="items-center gap-2">
                    <Calendar color={isDarkMode ? "#E2E8F0" : "#0f172a"} size={16} />
                    <Text className="text-sm text-typography-700 dark:text-typography-300">
                      Created: {formatDate(resolveCreated(selectedCert))}
                    </Text>
                  </HStack>
                </VStack>
                {isExpired(selectedCert) ? (
                  <HStack className="items-center gap-2">
                    <AlertTriangle size={16} color="#ef4444" />
                    <Text className="text-error-600 text-sm font-semibold">
                      This certificate has expired and needs to be renewed
                    </Text>
                  </HStack>
                ) : null}
              </VStack>
            ) : null}
          </ModalBody>
          <ModalFooter className="px-6 pb-6 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="gap-2 w-full">
              <Button
                action="default"
                variant="outline"
                size="sm"
                onPress={() => {
                  if (!selectedCert) return;
                  void handleRenew(selectedCert);
                  setSelectedCert(null);
                }}
                isDisabled={selectedCert ? renewingId === selectedCert.id : false}
                className="flex-1 rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
              >
                {selectedCert && renewingId === selectedCert.id ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonIcon as={RefreshCcw} size="sm" className="text-typography-900 dark:text-[#E8EBF0]" />
                )}
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Renew</ButtonText>
              </Button>
              <Button
                action="negative"
                variant="solid"
                size="sm"
                onPress={() => {
                  if (!selectedCert) return;
                  setDeleteTarget(selectedCert);
                  setSelectedCert(null);
                }}
                className="flex-1 rounded-xl bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
              >
                <ButtonIcon as={Trash2} size="sm" className="text-background-0 dark:text-[#0A1628]" />
                <ButtonText className="text-background-0 dark:text-[#0A1628]">Delete</ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={modalOpen} onClose={closeModal} size="lg">
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="max-w-3xl w-full rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] shadow-2xl">
          <ModalHeader className="flex-row items-start justify-between px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <VStack className="flex-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                Issue Let's Encrypt
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 mt-1">
                Generate SSL certificates via ACME with HTTP or DNS challenge.
              </Text>
            </VStack>
            <ModalCloseButton className="text-typography-500" />
          </ModalHeader>
          <ModalBody className="px-6 pt-4">
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={{ maxHeight: modalBodyMaxHeight }}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <VStack className="gap-4">
                <FormControl isRequired>
                  <FormControlLabel>
                    <FormControlLabelText>Domains</FormControlLabelText>
                  </FormControlLabel>
                  <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                    <InputField
                      value={domainsInput}
                      onChangeText={setDomainsInput}
                      placeholder="e.g.: *.marques.com, marques.com"
                      autoCapitalize="none"
                      onSubmitEditing={() => addDomainFromInput()}
                      onKeyPress={({ nativeEvent }) => {
                        if ((nativeEvent as any)?.key === "Enter") addDomainFromInput();
                      }}
                    />
                  </Input>
                  {domainsList.length > 0 ? (
                    <HStack className="gap-2 mt-2 flex-wrap">
                      {domainsList.map((d, idx) => (
                        <Box className="px-3 py-1 rounded-full bg-background-50 dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52] items-center flex-row" key={`${d}-${idx}`}>
                          <Text className="mr-2 text-typography-900">{d}</Text>
                          <Pressable onPress={() => setDomainsList((prev) => prev.filter((_, i) => i !== idx))} className="px-1">
                            <X size={14} color="#6b7280" />
                          </Pressable>
                        </Box>
                      ))}
                    </HStack>
                  ) : null}
                  <FormControlHelper>
                    <FormControlHelperText>Separate by comma or line break. Press Enter to add to the list.</FormControlHelperText>
                  </FormControlHelper>
                </FormControl>

                <FormControl isRequired>
                  <FormControlLabel>
                    <FormControlLabelText>Email</FormControlLabelText>
                  </FormControlLabel>
                  <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                    <InputField
                      value={form.meta.letsencrypt_email}
                      onChangeText={(val) => setForm((prev) => ({ ...prev, meta: { ...prev.meta, letsencrypt_email: val } }))}
                      autoCapitalize="none"
                      placeholder="your-email@domain.com"
                    />
                  </Input>
                </FormControl>

                <VStack className="gap-3">
                  <Text className="text-typography-800 font-semibold">Validation</Text>
                  <HStack className="items-center gap-2">
                    <Switch
                      {...TOGGLE_PROPS}
                      value={form.meta.letsencrypt_agree ?? false}
                      onValueChange={(val) => setForm((prev) => ({ ...prev, meta: { ...prev.meta, letsencrypt_agree: val } }))}
                    />
                    <Text className="text-typography-800">I accept the Let's Encrypt terms</Text>
                  </HStack>

                  <HStack className="items-center gap-2 flex-wrap">
                    <Switch
                      {...TOGGLE_PROPS}
                      value={form.meta.dns_challenge ?? false}
                      onValueChange={(val) => setForm((prev) => ({ ...prev, meta: { ...prev.meta, dns_challenge: val } }))}
                    />
                    <Text className="text-typography-800">Use DNS Challenge</Text>
                  </HStack>
                </VStack>

                {form.meta.dns_challenge ? (
                  <VStack className="gap-3">
                    <FormControl>
                      <FormControlLabel>
                        <FormControlLabelText>DNS Provider</FormControlLabelText>
                      </FormControlLabel>
                      <Select
                        selectedValue={selectedDnsProviderId ?? ""}
                        onValueChange={(val) => {
                          const v = String(val ?? "");
                          setSelectedDnsProviderId(v || null);
                          const provider = dnsProviders.find((d) => d.id === v);
                          setForm((prev) => ({
                            ...prev,
                            meta: {
                              ...prev.meta,
                              dns_provider: v || "",
                              dns_provider_credentials: provider?.credentials ?? prev.meta.dns_provider_credentials ?? "",
                            },
                          }));
                        }}
                        isDisabled={dnsLoading && dnsProviders.length === 0}
                      >
                        <SelectTrigger className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] h-11 px-4">
                          <SelectInput
                            placeholder={dnsLoading ? "Loading providers..." : dnsProviders.find((d) => d.id === selectedDnsProviderId)?.name ?? "Select provider"}
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
                            {dnsLoading && dnsProviders.length === 0 ? (
                              <SelectItem label="Loading..." value="" isDisabled />
                            ) : dnsProviders.length === 0 ? (
                              <SelectItem label="No providers available" value="" isDisabled />
                            ) : (
                              dnsProviders.map((p) => (
                                <SelectItem key={p.id} label={p.name} value={p.id} className="text-base text-typography-900 dark:text-[#E8EBF0]">
                                  {p.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </SelectPortal>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormControlLabel>
                        <FormControlLabelText>DNS Credentials</FormControlLabelText>
                      </FormControlLabel>
                      <Textarea className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                        <TextareaInput
                          value={form.meta.dns_provider_credentials ?? ""}
                          onChangeText={(val) =>
                            setForm((prev) => ({ ...prev, meta: { ...prev.meta, dns_provider_credentials: val } }))
                          }
                          autoCapitalize="none"
                          placeholder="dns_dynu_auth_token = YOUR_TOKEN..."
                        />
                      </Textarea>
                      <FormControlHelper>
                        <FormControlHelperText>Use the format expected by the provider's lego/ACME.</FormControlHelperText>
                      </FormControlHelper>
                    </FormControl>
                  </VStack>
                ) : null}
              </VStack>
            </ScrollView>
          </ModalBody>
          <ModalFooter className="px-6 pb-6 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="gap-3 justify-end w-full">
              <Button variant="outline" action="default" onPress={closeModal} isDisabled={saving} className="rounded-xl">
                <ButtonText className="text-typography-900">Cancel</ButtonText>
              </Button>
              <Button
                action="primary"
                onPress={handleCreate}
                isDisabled={saving}
                className="rounded-xl bg-typography-900 dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
              >
                {saving ? <ButtonSpinner /> : <ButtonIcon as={CloudLightning} size="sm" className="text-background-0 dark:text-[#0A1628]" />}
                <ButtonText className="text-background-0 dark:text-[#0A1628]">Issue</ButtonText>
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
              Remove certificate?
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-typography-700">
              This action will delete{" "}
              <Text className="font-semibold">
                {(deleteTarget?.domain_names ?? []).join(", ")}
              </Text>
              . Do you want to continue?
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setDeleteTarget(null)} isDisabled={Boolean(deletingId)} className="rounded-xl">
              <ButtonText className="text-typography-900">Cancel</ButtonText>
            </Button>
            <Button
              action="negative"
              className="rounded-xl bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
              onPress={handleDelete}
              isDisabled={Boolean(deletingId)}
            >
              {deletingId ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
              <ButtonText className="text-background-0 dark:text-[#0A1628]">Delete</ButtonText>
            </Button>
          </AlertDialogFooter>
          <AlertDialogCloseButton />
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
