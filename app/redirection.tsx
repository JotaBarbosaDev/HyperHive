import React from "react";
import { RefreshControl, ScrollView, useWindowDimensions, Platform, useColorScheme } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Input, InputField } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import {
  Select,
  SelectBackdrop as SelectBackdropContent,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
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
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { RedirectionHost, RedirectionPayload } from "@/types/redirection";
import {
  createRedirection,
  deleteRedirection,
  disableRedirection,
  editRedirection,
  enableRedirection,
  listRedirections,
} from "@/services/redirection";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import {
  ArrowRight,
  ChevronDown,
  Lock,
  Pencil,
  Plus,
  Power,
  Shield,
  Trash2,
  X,
} from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { useCertificatesOptions } from "@/hooks/useCertificatesOptions";
import { ExternalLink } from "@/components/ExternalLink";

type FilterTab = "all" | "active" | "inactive";

const DEFAULT_FORM: RedirectionPayload = {
  domain_names: [],
  forward_scheme: "https",
  forward_domain_name: "",
  forward_http_code: "302",
  preserve_path: true,
  block_exploits: false,
  certificate_id: 0,
  meta: {
    letsencrypt_agree: false,
    dns_challenge: false,
  },
  advanced_config: "",
  http2_support: false,
  hsts_enabled: false,
  hsts_subdomains: false,
  ssl_forced: false,
};

const parseDomains = (raw: string) =>
  raw
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const isEnabled = (item: RedirectionHost) => item.enabled !== false;

const formatHttpCode = (code: string) => {
  if (code === "301") return "301 Permanent";
  if (code === "302") return "302 Temporary";
  if (code === "307") return "307 Temporary (preserve method)";
  if (code === "308") return "308 Permanent (preserve method)";
  return code;
};

const StatusChip = ({ label, action = "muted" }: { label: string; action?: "muted" | "info" | "success" | "error" }) => (
  <Badge className="rounded-full px-3 py-1" size="sm" action={action} variant="solid">
    <BadgeText className={`text-xs ${action === "muted" ? "text-typography-800 dark:text-typography-200" : ""}`}>{label}</BadgeText>
  </Badge>
);

const TOGGLE_PROPS = {
  size: "sm" as const,
  thumbColor: "#f8fafc",
  trackColor: { false: "#cbd5e1", true: "#0f172a" },
  ios_backgroundColor: "#cbd5e1",
};

export default function RedirectionHostsScreen() {
  const toast = useToast();
  const [items, setItems] = React.useState<RedirectionHost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterTab>("all");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<RedirectionPayload>(DEFAULT_FORM);
  const [domainsInput, setDomainsInput] = React.useState("");
  const [domainsList, setDomainsList] = React.useState<string[]>([]);
  const lastAddAtRef = React.useRef<number>(0);
  const [editingHost, setEditingHost] = React.useState<RedirectionHost | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<RedirectionHost | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [selectedHost, setSelectedHost] = React.useState<RedirectionHost | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  const modalBodyMaxHeight = Math.min(screenHeight * 0.55, 520);
  const [formTab, setFormTab] = React.useState<"details" | "ssl">("details");
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

  const handleCertificatesError = React.useCallback(
    (_error: unknown) => {
      showToast("Error loading certificates", "Unable to fetch SSL certificates.", "error");
    },
    [showToast]
  );

  const { certificateOptions, loadingCertificates, refreshCertificates, resolveCertificateLabel } =
    useCertificatesOptions(handleCertificatesError);
  const selectedCertificateLabel = resolveCertificateLabel(form.certificate_id);

  const loadItems = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await listRedirections();
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load redirections", err);
        showToast("Error loading", "Unable to fetch redirections.", "error");
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
    return { total: items.length, active, inactive };
  }, [items]);

  const openCreateModal = () => {
    setEditingHost(null);
    setForm(DEFAULT_FORM);
    setDomainsInput("");
    setDomainsList([]);
    void refreshCertificates();
    setFormTab("details");
    setModalOpen(true);
  };

  const openEditModal = (host: RedirectionHost) => {
    setEditingHost(host);
    setForm({
      domain_names: host.domain_names ?? [],
      forward_scheme: host.forward_scheme ?? "https",
      forward_domain_name: host.forward_domain_name ?? "",
      forward_http_code: host.forward_http_code ?? "302",
      preserve_path: Boolean(host.preserve_path),
      block_exploits: Boolean(host.block_exploits),
      certificate_id: host.certificate_id ?? 0,
      meta: {
        letsencrypt_agree: host.meta?.letsencrypt_agree ?? false,
        dns_challenge: host.meta?.dns_challenge ?? false,
      },
      advanced_config: host.advanced_config ?? "",
      http2_support: Boolean(host.http2_support),
      hsts_enabled: Boolean(host.hsts_enabled),
      hsts_subdomains: Boolean(host.hsts_subdomains),
      ssl_forced: Boolean(host.ssl_forced),
    });
    setDomainsInput((host.domain_names ?? []).join(", "));
    setDomainsList(host.domain_names ?? []);
    void refreshCertificates();
    setFormTab("details");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingHost(null);
  };

  const addDomainFromInput = React.useCallback(() => {
    const now = Date.now();
    if (now - (lastAddAtRef.current || 0) < 500) return; // prevent double-fire
    lastAddAtRef.current = now;
    const val = (domainsInput || "").trim();
    if (!val) return;
    const parts = parseDomains(val);
    setDomainsList((prev) => Array.from(new Set([...prev, ...parts.filter(Boolean)])));
    setDomainsInput("");
  }, [domainsInput]);

  const removeDomain = React.useCallback((idx: number) => {
    setDomainsList((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSave = async () => {
    // Combine entered tags with any remaining input before validating.
    const combined = [...domainsList, ...parseDomains(domainsInput)];
    const unique = Array.from(new Set(combined.map((d) => d.trim()).filter(Boolean)));
    if (!unique.length) {
      showToast("Domains required", "Provide at least one domain.", "error");
      return;
    }
    if (!form.forward_domain_name) {
      showToast("Destination required", "Provide the destination domain.", "error");
      return;
    }
    const payload: RedirectionPayload = {
      ...form,
      domain_names: unique,
      certificate_id: Number(form.certificate_id) || 0,
      forward_http_code: form.forward_http_code || "302",
    };

    setSaving(true);
    try {
      if (editingHost?.id) {
        await editRedirection(editingHost.id, payload);
        showToast("Redirection updated", "Configuration saved.");
      } else {
        await createRedirection(payload);
        showToast("Redirection created", "Redirection host added.");
      }
      setModalOpen(false);
      setEditingHost(null);
      await loadItems("silent");
    } catch (err) {
      console.error("Failed to save redirection", err);
      showToast("Error saving", "Check the data and try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (host: RedirectionHost) => {
    if (!host.id) return;
    const enabled = isEnabled(host);
    setTogglingId(host.id);
    try {
      if (enabled) {
        await disableRedirection(host.id);
        showToast("Redirection disabled", "Host disabled.");
      } else {
        await enableRedirection(host.id);
        showToast("Redirection enabled", "Host enabled.");
      }
      await loadItems("silent");
    } catch (err) {
      console.error("Failed to toggle redirection", err);
      showToast("Error changing status", "Unable to update the host.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteRedirection(deleteTarget.id);
      showToast("Redirection removed", "Host deleted successfully.");
      setDeleteTarget(null);
      await loadItems("silent");
    } catch (err) {
      console.error("Failed to delete redirection", err);
      showToast("Error deleting", "Unable to remove the host.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const renderLoading = () => (
    <VStack className="gap-3 mt-6">
      {[1, 2].map((idx) => (
        <Box className="p-5 rounded-2xl bg-background-0 dark:bg-[#0F1A2E] shadow-soft-1 border border-outline-100 dark:border-[#2A3B52]" key={idx}>
          <Skeleton className="h-5 w-2/3 mb-3" />
          <SkeletonText className="w-1/2" />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadItems("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            Redirection Hosts
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Configure HTTP redirections for your domains.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <HStack className="gap-2 flex-wrap">
              {[
                { key: "all" as FilterTab, label: `All (${stats.total})` },
                { key: "active" as FilterTab, label: `Active (${stats.active})` },
                { key: "inactive" as FilterTab, label: `Inactive (${stats.inactive})` },
              ].map((tab) => {
                const active = filter === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setFilter(tab.key)}
                    className={`px-4 py-2 rounded-full border ${
                      active
                        ? "bg-typography-900 border-typography-900 dark:bg-[#2DD4BF] dark:border-[#2DD4BF]"
                        : "bg-background-0 border-outline-200 dark:bg-[#0F1A2E] dark:border-[#243247]"
                    }`}
                  >
                    <Text
                      className={`text-sm ${active ? "text-background-0 dark:text-[#0A1628]" : "text-typography-700 dark:text-typography-400"}`}
                      style={{ fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
            <Button
              action="primary"
              variant="solid"
              size="md"
              onPress={openCreateModal}
              className="rounded-xl px-5 bg-typography-900 dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
            >
              <ButtonIcon as={Plus} size="sm" className="text-background-0 dark:text-[#0A1628]" />
              <ButtonText className="text-background-0 dark:text-[#0A1628]">Add Redirection</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            renderLoading()
          ) : filteredItems.length === 0 ? (
            <Box className="mt-10 p-6 border border-dashed border-outline-200 dark:border-[#2A3B52] rounded-2xl bg-background-0 dark:bg-[#0A1628] items-center">
              <Text className="text-typography-700 font-semibold text-base">No redirections found</Text>
              <Text className="text-typography-500 text-sm mt-1 text-center">
                Click "Add Redirection" to create the first redirection host.
              </Text>
            </Box>
          ) : isWeb ? (
            <VStack className="mt-6 gap-4">
              {filteredItems.map((host) => {
                const enabled = isEnabled(host);
                return (
                  <Box className="bg-background-0 dark:bg-[#0F1A2E] rounded-2xl p-5 border border-outline-100 dark:border-[#2A3B52] shadow-soft-1" key={host.id}>
                    <HStack className="items-start justify-between gap-4 flex-wrap">
                      <VStack className="gap-2 flex-1">
                        <HStack className="items-center gap-2 flex-wrap">
                          <Box className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-success-500" : "bg-outline-400"}`} />
                          <HStack className="flex-wrap">
                            {(host.domain_names ?? []).map((d, idx) => (
                              <React.Fragment key={d}>
                                <ExternalLink href={(d.includes("//") ? d : `https://${d}`) as any}>
                                  <Text className="text-typography-900 text-base" style={{ fontFamily: "Inter_700Bold" }}>
                                    {d}
                                  </Text>
                                </ExternalLink>
                                {idx < (host.domain_names ?? []).length - 1 ? <Text className="text-typography-900 text-base">{", "}</Text> : null}
                              </React.Fragment>
                            ))}
                          </HStack>
                        </HStack>
                        <HStack className="items-center gap-3 flex-wrap">
                          <HStack className="items-center gap-1">
                            <ArrowRight size={16} color="#0f172a" />
                            <Text className="text-typography-800 text-sm">
                              {host.forward_domain_name}
                            </Text>
                          </HStack>
                          {host.ssl_forced ? (
                            <HStack className="items-center gap-1">
                              <Lock size={16} color="#16a34a" />
                              <Text className="text-success-600 text-sm">SSL (Forced)</Text>
                            </HStack>
                          ) : (
                            <HStack className="items-center gap-1">
                              <Shield size={16} color="#9ca3af" />
                              <Text className="text-typography-600 text-sm">SSL</Text>
                            </HStack>
                          )}
                        </HStack>
                        <HStack className="gap-2 flex-wrap">
                          <StatusChip label={formatHttpCode(host.forward_http_code)} />
                          {host.preserve_path ? <StatusChip label="Preserve Path" /> : null}
                          {host.block_exploits ? <StatusChip label="Block Exploits" /> : null}
                        </HStack>
                      </VStack>

                      <HStack className="gap-2 items-center">
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => handleToggle(host)}
                          isDisabled={togglingId === host.id}
                          className="border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E] rounded-xl"
                        >
                          {togglingId === host.id ? <ButtonSpinner /> : <ButtonIcon as={Power} size="sm" />}
                          <ButtonText className="text-typography-900">{enabled ? "Disable" : "Enable"}</ButtonText>
                        </Button>
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => openEditModal(host)}
                          className="border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E] px-3 rounded-xl"
                        >
                          <ButtonIcon as={Pencil} size="sm" />
                        </Button>
                        <Button
                          action="negative"
                          variant="solid"
                          size="sm"
                          onPress={() => setDeleteTarget(host)}
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
              {filteredItems.map((host) => {
                const enabled = isEnabled(host);
                return (
                  <Pressable
                    key={host.id}
                    onPress={() => setSelectedHost(host)}
                    className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0F1A2E] p-4 shadow-soft-1"
                  >
                    <VStack className="gap-2">
                      <HStack className="items-center justify-between gap-2">
                        <HStack className="items-center gap-2 flex-1 flex-wrap">
                          <Box className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-success-500" : "bg-outline-400"}`} />
                          <HStack className="flex-wrap">
                            {(host.domain_names ?? []).map((d, idx) => (
                              <React.Fragment key={d}>
                                <Text className="text-typography-900 dark:text-[#E8EBF0] text-sm" style={{ fontFamily: "Inter_700Bold" }}>
                                  {d}
                                </Text>
                                {idx < (host.domain_names ?? []).length - 1 ? (
                                  <Text className="text-typography-900 dark:text-[#E8EBF0] text-sm">{", "}</Text>
                                ) : null}
                              </React.Fragment>
                            ))}
                          </HStack>
                        </HStack>
                        <StatusChip label={enabled ? "Active" : "Inactive"} action={enabled ? "success" : "muted"} />
                      </HStack>
                      <HStack className="items-center gap-2 flex-wrap">
                        <ArrowRight size={16} color={isDarkMode ? "#E2E8F0" : "#0f172a"} />
                        <Text className="text-typography-700 dark:text-typography-300 text-sm">
                          {host.forward_domain_name}
                        </Text>
                      </HStack>
                      <HStack className="gap-2 flex-wrap">
                        <StatusChip label={formatHttpCode(host.forward_http_code)} />
                        {host.preserve_path ? <StatusChip label="Preserve Path" /> : null}
                        {host.block_exploits ? <StatusChip label="Block Exploits" /> : null}
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

      <Modal isOpen={!!selectedHost} onClose={() => setSelectedHost(null)} size="md">
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="max-w-lg w-full rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] shadow-2xl">
          <ModalHeader className="flex-row items-start justify-between px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <VStack className="flex-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                Redirection
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 mt-1">
                Details and actions for this host.
              </Text>
            </VStack>
            <ModalCloseButton className="text-typography-500" />
          </ModalHeader>
          <ModalBody className="px-6 pt-4">
            {selectedHost ? (
              <VStack className="gap-4">
                <VStack className="gap-2">
                  <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-typography-400">
                    Domains
                  </Text>
                  <HStack className="flex-wrap">
                    {(selectedHost.domain_names ?? []).map((d, idx) => (
                      <React.Fragment key={d}>
                        <Text className="text-typography-900 dark:text-[#E8EBF0] text-base" style={{ fontFamily: "Inter_600SemiBold" }}>
                          {d}
                        </Text>
                        {idx < (selectedHost.domain_names ?? []).length - 1 ? (
                          <Text className="text-typography-900 dark:text-[#E8EBF0] text-base">{", "}</Text>
                        ) : null}
                      </React.Fragment>
                    ))}
                  </HStack>
                </VStack>
                <HStack className="items-center gap-2">
                  <ArrowRight size={16} color={isDarkMode ? "#E2E8F0" : "#0f172a"} />
                  <Text className="text-typography-700 dark:text-typography-300 text-sm">
                    {selectedHost.forward_domain_name}
                  </Text>
                </HStack>
                <HStack className="gap-2 flex-wrap">
                  <StatusChip label={formatHttpCode(selectedHost.forward_http_code)} />
                  {selectedHost.preserve_path ? <StatusChip label="Preserve Path" /> : null}
                  {selectedHost.block_exploits ? <StatusChip label="Block Exploits" /> : null}
                  {selectedHost.hsts_enabled ? <StatusChip label="HSTS" /> : null}
                  <StatusChip label={selectedHost.ssl_forced ? "SSL Forced" : "SSL Optional"} action={selectedHost.ssl_forced ? "success" : "muted"} />
                  <StatusChip label={isEnabled(selectedHost) ? "Active" : "Inactive"} action={isEnabled(selectedHost) ? "success" : "muted"} />
                </HStack>
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
                  if (!selectedHost) return;
                  void handleToggle(selectedHost);
                  setSelectedHost(null);
                }}
                isDisabled={selectedHost ? togglingId === selectedHost.id : false}
                className="flex-1 rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
              >
                {selectedHost && togglingId === selectedHost.id ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonIcon as={Power} size="sm" className="text-typography-900 dark:text-[#E8EBF0]" />
                )}
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                  {selectedHost && isEnabled(selectedHost) ? "Disable" : "Enable"}
                </ButtonText>
              </Button>
              <Button
                action="default"
                variant="outline"
                size="sm"
                onPress={() => {
                  if (!selectedHost) return;
                  openEditModal(selectedHost);
                  setSelectedHost(null);
                }}
                className="flex-1 rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
              >
                <ButtonIcon as={Pencil} size="sm" className="text-typography-900 dark:text-[#E8EBF0]" />
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Edit</ButtonText>
              </Button>
              <Button
                action="negative"
                variant="solid"
                size="sm"
                onPress={() => {
                  if (!selectedHost) return;
                  setDeleteTarget(selectedHost);
                  setSelectedHost(null);
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
                {editingHost ? "Edit Redirection" : "Add Redirection"}
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 mt-1">
                Route domains to new destinations with SSL and HSTS options.
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
              <VStack className="gap-5">
                <HStack className="gap-2">
                  {[
                    { key: "details", label: "Details" },
                    { key: "ssl", label: "SSL" },
                  ].map((tab) => {
                    const active = formTab === tab.key;
                    return (
                      <Pressable
                        key={tab.key}
                        onPress={() => setFormTab(tab.key as typeof formTab)}
                        className={`px-4 py-2 rounded-full border ${
                          active
                            ? "bg-typography-900 border-typography-900 dark:bg-[#2DD4BF] dark:border-[#2DD4BF]"
                            : "bg-background-50 border-outline-200 dark:bg-[#0E1524] dark:border-[#243247]"
                        }`}
                      >
                        <Text
                          className={`text-sm ${active ? "text-background-0 dark:text-[#0A1628]" : "text-typography-700 dark:text-typography-400"}`}
                          style={{ fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" }}
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
                        <FormControlLabelText>Domains</FormControlLabelText>
                      </FormControlLabel>
                      <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                        <InputField
                          value={domainsInput}
                          onChangeText={setDomainsInput}
                          placeholder="e.g.: old.hyperhive.local, www.old.hyperhive.local"
                          autoCapitalize="none"
                          onSubmitEditing={() => addDomainFromInput()}
                          onKeyPress={({ nativeEvent }) => {
                            // web/desktop Enter handling
                            if ((nativeEvent as any)?.key === "Enter") addDomainFromInput();
                          }}
                        />
                      </Input>
                      {domainsList.length > 0 ? (
                        <HStack className="gap-2 mt-2 flex-wrap">
                          {domainsList.map((d, idx) => (
                            <Box className="px-3 py-1 rounded-full bg-background-50 dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52] items-center flex-row" key={`${d}-${idx}`}>
                              <Text className="mr-2 text-typography-900">{d}</Text>
                              <Pressable onPress={() => removeDomain(idx)} className="px-1">
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
                        <FormControlLabelText>Destination</FormControlLabelText>
                      </FormControlLabel>
                      <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                        <InputField
                          value={form.forward_domain_name}
                          onChangeText={(val) => setForm((prev) => ({ ...prev, forward_domain_name: val }))}
                          autoCapitalize="none"
                          placeholder="https://new.hyperhive.local"
                        />
                      </Input>
                    </FormControl>

                    <FormControl>
                      <FormControlLabel>
                        <FormControlLabelText>Scheme</FormControlLabelText>
                      </FormControlLabel>
                      <Select
                        selectedValue={form.forward_scheme}
                        onValueChange={(val) => setForm((prev) => ({ ...prev, forward_scheme: String(val) }))}
                      >
                        <SelectTrigger className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] h-11 px-4">
                          <Text className="text-typography-900 dark:text-[#E8EBF0]">{String(form.forward_scheme ?? "https").toUpperCase()}</Text>
                          <SelectIcon as={ChevronDown} className="text-typography-500 dark:text-typography-400" />
                        </SelectTrigger>
                        <SelectPortal>
                          <SelectBackdropContent />
                          <SelectContent className="max-h-40 bg-background-0 dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52] rounded-2xl">
                            <SelectDragIndicatorWrapper>
                              <SelectDragIndicator />
                            </SelectDragIndicatorWrapper>
                            <SelectItem key="https" label="HTTPS" value="https" className="text-base text-typography-900 dark:text-[#E8EBF0]">
                              HTTPS
                            </SelectItem>
                            <SelectItem key="http" label="HTTP" value="http" className="text-base text-typography-900 dark:text-[#E8EBF0]">
                              HTTP
                            </SelectItem>
                          </SelectContent>
                        </SelectPortal>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormControlLabel>
                        <FormControlLabelText>Redirect Type</FormControlLabelText>
                      </FormControlLabel>
                      <Select
                        selectedValue={String(form.forward_http_code ?? "302")}
                        onValueChange={(val) => setForm((prev) => ({ ...prev, forward_http_code: String(val) || "302" }))}
                      >
                        <SelectTrigger className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] h-11 px-4">
                          <Text className="text-typography-900 dark:text-[#E8EBF0]">{formatHttpCode(String(form.forward_http_code ?? "302"))}</Text>
                          <SelectIcon as={ChevronDown} className="text-typography-500 dark:text-typography-400" />
                        </SelectTrigger>
                        <SelectPortal>
                          <SelectBackdropContent />
                          <SelectContent className="max-h-72 bg-background-0 dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52] rounded-2xl">
                            <SelectDragIndicatorWrapper>
                              <SelectDragIndicator />
                            </SelectDragIndicatorWrapper>
                            <SelectItem key="301" label="301 Permanent" value="301" className="text-base text-typography-900 dark:text-[#E8EBF0]">
                              301 — Permanent (Moved Permanently)
                            </SelectItem>
                            <SelectItem key="302" label="302 Temporary" value="302" className="text-base text-typography-900 dark:text-[#E8EBF0]">
                              302 — Temporary (Found)
                            </SelectItem>
                            <SelectItem key="307" label="307 Temporary" value="307" className="text-base text-typography-900 dark:text-[#E8EBF0]">
                              307 — Temporary (Preserve method)
                            </SelectItem>
                            <SelectItem key="308" label="308 Permanent" value="308" className="text-base text-typography-900 dark:text-[#E8EBF0]">
                              308 — Permanent (Preserve method)
                            </SelectItem>
                          </SelectContent>
                        </SelectPortal>
                      </Select>
                      <FormControlHelper>
                        <FormControlHelperText>Choose a common redirect type. Descriptions explain semantics.</FormControlHelperText>
                      </FormControlHelper>
                    </FormControl>

                    <VStack className="gap-3">
                      <Text className="text-typography-800 font-semibold">Additional options</Text>
                      <HStack className="flex-wrap gap-4">
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.preserve_path}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, preserve_path: val }))}
                          />
                          <Text className="text-typography-800">Preserve Path</Text>
                        </HStack>
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.block_exploits}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, block_exploits: val }))}
                          />
                          <Text className="text-typography-800">Block Exploits</Text>
                        </HStack>
                      </HStack>
                    </VStack>
                  </VStack>
                ) : null}

                {formTab === "ssl" ? (
                  <VStack className="gap-4">
                    <FormControl>
                      <HStack className="items-center justify-between">
                        <FormControlLabel>
                          <FormControlLabelText>SSL Certificate</FormControlLabelText>
                        </FormControlLabel>
                        <Button
                          variant="link"
                          action="primary"
                          className="px-0"
                          size="sm"
                          onPress={() => void refreshCertificates()}
                          isDisabled={loadingCertificates}
                        >
                          {loadingCertificates ? <ButtonSpinner /> : <ButtonText>Refresh</ButtonText>}
                        </Button>
                      </HStack>
                      <Select
                        selectedValue={String(form.certificate_id ?? 0)}
                        onValueChange={(val) => setForm((prev) => ({ ...prev, certificate_id: Number(val) }))}
                        isDisabled={loadingCertificates && certificateOptions.length === 0}
                      >
                        <SelectTrigger className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] h-11 px-4">
                          <Text className="text-typography-900 dark:text-[#E8EBF0]">{selectedCertificateLabel}</Text>
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
                        <FormControlHelperText>Choose the certificate to apply or leave without SSL.</FormControlHelperText>
                      </FormControlHelper>
                    </FormControl>

                    <FormControl>
                      <FormControlLabel>
                        <FormControlLabelText>Advanced configuration (optional)</FormControlLabelText>
                      </FormControlLabel>
                      <Textarea className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]" size="md">
                        <TextareaInput
                          value={form.advanced_config}
                          onChangeText={(text) => setForm((prev) => ({ ...prev, advanced_config: text }))}
                          placeholder="Additional Nginx configuration (optional)..."
                        />
                      </Textarea>
                    </FormControl>

                    <VStack className="gap-3">
                      <Text className="text-typography-800 font-semibold">SSL & HSTS</Text>
                      <HStack className="flex-wrap gap-4">
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.ssl_forced}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, ssl_forced: val }))}
                          />
                          <Text className="text-typography-800">Force SSL</Text>
                        </HStack>
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.http2_support}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, http2_support: val }))}
                          />
                          <Text className="text-typography-800">HTTP/2</Text>
                        </HStack>
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.hsts_enabled}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, hsts_enabled: val }))}
                          />
                          <Text className="text-typography-800">HSTS</Text>
                        </HStack>
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.hsts_subdomains}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, hsts_subdomains: val }))}
                            isDisabled={!form.hsts_enabled}
                          />
                          <Text className={`text-typography-800 ${!form.hsts_enabled ? "text-typography-500" : ""}`}>
                            HSTS Subdomains
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
              <Button className="rounded-xl" variant="outline" action="default" onPress={closeModal} isDisabled={saving}>
                <ButtonText className="text-typography-900">Cancel</ButtonText>
              </Button>
              <Button
                className="rounded-xl bg-typography-900 dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
                action="primary"
                onPress={handleSave}
                isDisabled={saving}
              >
                {saving ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" className="text-background-0 dark:text-[#0A1628]" />}
                <ButtonText className="text-background-0 dark:text-[#0A1628]">
                  {editingHost ? "Save changes" : "Create redirection"}
                </ButtonText>
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
              Remove redirection?
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
            <Button variant="outline" action="default" onPress={() => setDeleteTarget(null)} isDisabled={Boolean(deletingId)}>
              <ButtonText>Cancel</ButtonText>
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
