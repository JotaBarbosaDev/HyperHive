import React from "react";
import { RefreshControl, ScrollView, useWindowDimensions } from "react-native";
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
import { ProxyHost, ProxyPayload, ProxyLocation } from "@/types/proxy";
import {
  createProxyHost,
  deleteProxyHost,
  disableProxyHost,
  editProxyHost,
  enableProxyHost,
  setupFrontEnd,
  listProxyHosts,
} from "@/services/proxy";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Badge as IconBadge } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/pressable";
import { ExternalLink } from "@/components/ExternalLink";
import {
  ChevronDown,
  Globe,
  Lock,
  Pencil,
  Plus,
  Power,
  Shield,
  Trash2,
  X,
} from "lucide-react-native";
import { useCertificatesOptions } from "@/hooks/useCertificatesOptions";

type FilterTab = "all" | "active" | "inactive";

const DEFAULT_LOCATION: ProxyLocation = {
  path: "/",
  forward_scheme: "http",
  forward_host: "",
  forward_port: 80,
};

const DEFAULT_FORM: ProxyPayload = {
  domain_names: [],
  forward_scheme: "http",
  forward_host: "",
  forward_port: 80,
  caching_enabled: false,
  block_exploits: false,
  allow_websocket_upgrade: true,
  access_list_id: "0",
  certificate_id: 0,
  meta: {},
  advanced_config: "",
  locations: [],
  http2_support: true,
  hsts_enabled: false,
  hsts_subdomains: false,
  ssl_forced: false,
  enabled: true,
};

const parseDomains = (raw: string) =>
  raw
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const isEnabled = (host: ProxyHost) => host.enabled !== false;

const StatusChip = ({ label, action = "muted" }: { label: string; action?: "muted" | "info" | "success" | "error" }) => (
  <Badge className="rounded-full px-3 py-1" size="sm" action={action} variant="solid">
    <BadgeText className={`text-xs ${action === "muted" ? "text-typography-800" : ""}`}>{label}</BadgeText>
  </Badge>
);

const TOGGLE_PROPS = {
  size: "sm" as const,
  thumbColor: "#f8fafc",
  trackColor: { false: "#cbd5e1", true: "#0f172a" },
  ios_backgroundColor: "#cbd5e1",
};

export default function ProxyHostsScreen() {
  const toast = useToast();
  const [hosts, setHosts] = React.useState<ProxyHost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterTab>("all");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<ProxyPayload>(DEFAULT_FORM);
  const [domainsInput, setDomainsInput] = React.useState("");
  const [domainsList, setDomainsList] = React.useState<string[]>([]);
  const [locations, setLocations] = React.useState<ProxyLocation[]>([]);
  const [editingHost, setEditingHost] = React.useState<ProxyHost | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ProxyHost | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [setupModalOpen, setSetupModalOpen] = React.useState(false);
  const [setupDomain, setSetupDomain] = React.useState("");
  const [setupCertificateId, setSetupCertificateId] = React.useState<number>(0);
  const [setupSaving, setSetupSaving] = React.useState(false);
  const { height: screenHeight } = useWindowDimensions();
  const modalBodyMaxHeight = Math.min(screenHeight * 0.55, 520);
  const [formTab, setFormTab] = React.useState<"details" | "locations" | "ssl">("details");

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
  const setupCertificateLabel = resolveCertificateLabel(setupCertificateId);

  const loadHosts = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await listProxyHosts();
        setHosts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load proxy hosts", err);
        showToast("Error loading", "Unable to fetch proxies.", "error");
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

  const filteredHosts = React.useMemo(() => {
    if (filter === "active") return hosts.filter((h) => isEnabled(h));
    if (filter === "inactive") return hosts.filter((h) => !isEnabled(h));
    return hosts;
  }, [filter, hosts]);

  const stats = React.useMemo(() => {
    const active = hosts.filter((h) => isEnabled(h)).length;
    const inactive = hosts.length - active;
    return { total: hosts.length, active, inactive };
  }, [hosts]);

  const openCreateModal = () => {
    setEditingHost(null);
    setForm(DEFAULT_FORM);
    setDomainsInput("");
    setDomainsList([]);
    setLocations([]);
    void refreshCertificates();
    setFormTab("details");
    setModalOpen(true);
  };

  const openSetupModal = () => {
    setSetupDomain("");
    setSetupCertificateId(0);
    void refreshCertificates();
    setSetupModalOpen(true);
  };

  const openEditModal = (host: ProxyHost) => {
    setEditingHost(host);
    setForm({
      domain_names: host.domain_names ?? [],
      forward_scheme: host.forward_scheme ?? "http",
      forward_host: host.forward_host ?? "",
      forward_port: host.forward_port ?? 80,
      caching_enabled: Boolean(host.caching_enabled),
      block_exploits: Boolean(host.block_exploits),
      allow_websocket_upgrade: Boolean(host.allow_websocket_upgrade),
      access_list_id: host.access_list_id ?? "0",
      certificate_id: host.certificate_id ?? 0,
      meta: host.meta ?? {},
      advanced_config: host.advanced_config ?? "",
      locations: host.locations ?? [],
      http2_support: Boolean(host.http2_support),
      hsts_enabled: Boolean(host.hsts_enabled),
      hsts_subdomains: Boolean(host.hsts_subdomains),
      ssl_forced: Boolean(host.ssl_forced),
      enabled: isEnabled(host),
    });
    setDomainsInput((host.domain_names ?? []).join(", "));
    setDomainsList(host.domain_names ?? []);
    setLocations(host.locations ?? []);
    void refreshCertificates();
    setFormTab("details");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingHost(null);
  };

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

  const removeDomain = React.useCallback((idx: number) => {
    setDomainsList((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSave = async () => {
    const combined = [...domainsList, ...parseDomains(domainsInput)];
    const unique = Array.from(new Set(combined.map((d) => d.trim()).filter(Boolean)));
    if (!unique.length) {
      showToast("Domains required", "Provide at least one domain.", "error");
      return;
    }
    if (!form.forward_host) {
      showToast("Destination host required", "Provide the destination host.", "error");
      return;
    }
    const payload: ProxyPayload = {
      ...form,
      domain_names: unique,
      locations,
      access_list_id: "0",
      certificate_id: Number(form.certificate_id) || 0,
      forward_port: Number(form.forward_port) || 80,
    };

    setSaving(true);
    try {
      if (editingHost?.id) {
        await editProxyHost(editingHost.id, payload);
        showToast("Proxy updated", "Configuration updated.");
      } else {
        await createProxyHost(payload);
        showToast("Proxy created", "Proxy host added.");
      }
      setModalOpen(false);
      setEditingHost(null);
      await loadHosts("silent");
    } catch (err) {
      console.error("Failed to save proxy", err);
      showToast("Error saving", "Check the data and try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (host: ProxyHost) => {
    if (!host.id) return;
    const enabled = isEnabled(host);
    setTogglingId(host.id);
    try {
      if (enabled) {
        await disableProxyHost(host.id);
        showToast("Proxy disabled", "Host disabled.");
      } else {
        await enableProxyHost(host.id);
        showToast("Proxy enabled", "Host enabled.");
      }
      await loadHosts("silent");
    } catch (err) {
      console.error("Failed to toggle proxy", err);
      showToast("Error changing status", "Unable to update the host.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteProxyHost(deleteTarget.id);
      showToast("Proxy removed", "Host removed.");
      setDeleteTarget(null);
      await loadHosts("silent");
    } catch (err) {
      console.error("Failed to delete proxy", err);
      showToast("Error deleting", "Unable to remove the host.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const addLocation = () => {
    setLocations((prev) => [...prev, { ...DEFAULT_LOCATION }]);
  };

  const updateLocation = (index: number, key: keyof ProxyLocation, value: string) => {
    setLocations((prev) =>
      prev.map((loc, idx) => (idx === index ? { ...loc, [key]: key === "forward_port" ? Number(value) || 0 : value } : loc))
    );
  };

  const removeLocation = (index: number) => {
    setLocations((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSetupSave = async () => {
    const domain = setupDomain.trim();
    if (!domain) {
      showToast("Domain required", "Provide the domain to configure the front-end page.", "error");
      return;
    }
    setSetupSaving(true);
    try {
      await setupFrontEnd({ domain, certificateId: Number(setupCertificateId) || 0 });
      showToast("Front-end ready", "Setup completed for the provided domain.");
      setSetupModalOpen(false);
    } catch (err) {
      console.error("Failed to setup front-end", err);
      showToast("Setup failed", "Unable to configure the front-end page.", "error");
    } finally {
      setSetupSaving(false);
    }
  };

  const renderLoading = () => (
    <VStack className="gap-3 mt-6">
      {[1, 2].map((idx) => (
        <Box key={idx} className="p-5 rounded-2xl bg-background-0 shadow-soft-1 border border-background-100">
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
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadHosts("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            Proxy Hosts
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Manage reverse proxy hosts to route traffic to your internal services.
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
                    className={`px-4 py-2 rounded-full border ${active ? "bg-typography-900 border-typography-900" : "bg-background-0 border-background-200"
                      }`}
                  >
                    <Text
                      className={`text-sm ${active ? "text-background-0" : "text-typography-700"}`}
                      style={{ fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
            <HStack className="gap-3 items-center flex-wrap justify-end">
              <HStack className="items-center gap-2 flex-wrap">
                <Button
                  action="primary"
                  variant="solid"
                  size="md"
                  onPress={openSetupModal}
                  className="rounded-full px-5"
                >
                  <ButtonIcon as={Shield} size="sm" />
                  <ButtonText>Setup FrontEnd Page</ButtonText>
                </Button>
                <Text className="text-typography-600 text-xs max-w-xs">
                  Configure this to ensure the application front-end is fully available.
                </Text>
              </HStack>
              <Button action="primary" variant="solid" size="md" onPress={openCreateModal} className="rounded-full px-5">
                <ButtonIcon as={Plus} size="sm" />
                <ButtonText>Add Proxy Host</ButtonText>
              </Button>
            </HStack>
          </HStack>

          {loading ? (
            renderLoading()
          ) : filteredHosts.length === 0 ? (
            <Box className="mt-10 p-6 border border-dashed border-background-300 rounded-2xl bg-background-0 items-center">
              <Text className="text-typography-700 font-semibold text-base">No proxies found</Text>
              <Text className="text-typography-500 text-sm mt-1 text-center">
                Click "Add Proxy Host" to create the first reverse proxy host.
              </Text>
            </Box>
          ) : (
            <VStack className="mt-6 gap-4">
              {filteredHosts.map((host) => {
                const enabled = isEnabled(host);
                return (
                  <Box
                    key={host.id}
                    className="bg-background-0 rounded-2xl p-5 border border-background-100 shadow-soft-1"
                  >
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
                            <Globe size={16} color="#0f172a" />
                            <Text className="text-typography-800 text-sm">
                              {host.forward_scheme}://{host.forward_host}:{host.forward_port}
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
                          {host.certificate_id ? <StatusChip label="Certificate" /> : null}
                          {host.block_exploits ? <StatusChip label="Block Exploits" /> : null}
                          {host.allow_websocket_upgrade ? <StatusChip label="WebSockets" /> : null}
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
                          <ButtonText>{enabled ? "Disable" : "Enable"}</ButtonText>
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

      <Modal isOpen={setupModalOpen} onClose={() => setSetupModalOpen(false)} size="md">
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="max-w-xl w-full rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] shadow-2xl">
          <ModalHeader className="flex-row items-start justify-between px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <VStack className="flex-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                Setup FrontEnd Page
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 mt-1">
                Provide the public domain and optional certificate to finish the front-end setup.
              </Text>
            </VStack>
            <ModalCloseButton className="text-typography-500" />
          </ModalHeader>
          <ModalBody className="px-6 pt-4 pb-2">
            <VStack className="gap-4">
              <FormControl isRequired>
                <FormControlLabel>
                  <FormControlLabelText>Domain</FormControlLabelText>
                </FormControlLabel>
                <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                  <InputField
                    value={setupDomain}
                    onChangeText={setSetupDomain}
                    placeholder="yourdomain.com"
                    autoCapitalize="none"
                  />
                </Input>
                <FormControlHelper>
                  <FormControlHelperText>Domain that will serve the application front-end.</FormControlHelperText>
                </FormControlHelper>
              </FormControl>

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
                  selectedValue={String(setupCertificateId ?? 0)}
                  onValueChange={(val) => setSetupCertificateId(Number(val))}
                  isDisabled={loadingCertificates && certificateOptions.length === 0}
                >
                  <SelectTrigger className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] h-11 px-4">
                    <Text className="text-typography-900 dark:text-[#E8EBF0]">{setupCertificateLabel}</Text>
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
                  <FormControlHelperText>Leave as "No Certificate" to use HTTP only.</FormControlHelperText>
                </FormControlHelper>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter className="px-6 pb-6 pt-2 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="gap-3 justify-end w-full">
              <Button variant="outline" action="default" onPress={() => setSetupModalOpen(false)} isDisabled={setupSaving}>
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
              </Button>
              <Button action="primary" onPress={handleSetupSave} isDisabled={setupSaving}>
                {setupSaving ? <ButtonSpinner /> : <ButtonIcon as={Shield} size="sm" />}
                <ButtonText>Confirm Setup</ButtonText>
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
                {editingHost ? "Edit Proxy Host" : "Add Proxy Host"}
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 mt-1">
                Domains, destination, and SSL for the selected proxy.
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
                    { key: "locations", label: "Custom Locations" },
                    { key: "ssl", label: "SSL" },
                  ].map((tab) => {
                    const active = formTab === tab.key;
                    return (
                      <Pressable
                        key={tab.key}
                        onPress={() => setFormTab(tab.key as typeof formTab)}
                        className={`px-4 py-2 rounded-full border ${active ? "bg-typography-900 border-typography-900" : "bg-background-50 border-outline-200"
                          }`}
                      >
                        <Text
                          className={`text-sm ${active ? "text-background-0" : "text-typography-700"}`}
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
                          placeholder="e.g.: app.hyperhive.local, www.app.hyperhive.local"
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
                            <Box key={`${d}-${idx}`} className="px-3 py-1 rounded-full bg-background-50 border border-background-100 items-center flex-row">
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
                      <HStack className="gap-3 flex-wrap">
                        <Input className="flex-1 min-w-[120px] rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                          <InputField
                            value={form.forward_scheme}
                            onChangeText={(val) => setForm((prev) => ({ ...prev, forward_scheme: val || "http" }))}
                            autoCapitalize="none"
                            placeholder="http"
                          />
                        </Input>
                        <Input className="flex-1 min-w-[180px] rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                          <InputField
                            value={form.forward_host}
                            onChangeText={(val) => setForm((prev) => ({ ...prev, forward_host: val }))}
                            autoCapitalize="none"
                            placeholder="192.168.1.100"
                          />
                        </Input>
                        <Input className="w-24 rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                          <InputField
                            value={String(form.forward_port)}
                            onChangeText={(val) => setForm((prev) => ({ ...prev, forward_port: Number(val) || 0 }))}
                            keyboardType="number-pad"
                            placeholder="80"
                          />
                        </Input>
                      </HStack>
                    </FormControl>

                    <VStack className="gap-3">
                      <Text className="text-typography-800 font-semibold">Quick options</Text>
                      <HStack className="flex-wrap gap-4">
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.allow_websocket_upgrade}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, allow_websocket_upgrade: val }))}
                          />
                          <Text className="text-typography-800">WebSockets</Text>
                        </HStack>
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.block_exploits}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, block_exploits: val }))}
                          />
                          <Text className="text-typography-800">Block Exploits</Text>
                        </HStack>
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.caching_enabled}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, caching_enabled: val }))}
                          />
                          <Text className="text-typography-800">Caching</Text>
                        </HStack>
                      </HStack>
                    </VStack>
                  </VStack>
                ) : null}

                {formTab === "locations" ? (
                  <VStack className="gap-4">
                    <HStack className="items-center justify-between">
                      <Text className="text-typography-900 font-semibold">Custom locations</Text>
                      <Button action="primary" variant="outline" size="sm" onPress={addLocation}>
                        <ButtonText>Add Location</ButtonText>
                      </Button>
                    </HStack>
                    {locations.length === 0 ? (
                      <Text className="text-typography-600 text-sm">No locations defined.</Text>
                    ) : (
                      locations.map((loc, idx) => (
                        <Box key={`${loc.path}-${idx}`} className="p-3 rounded-xl border border-background-200 bg-background-50 gap-3">
                          <FormControl>
                            <FormControlLabel>
                              <FormControlLabelText>Path</FormControlLabelText>
                            </FormControlLabel>
                            <Input className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                              <InputField
                                value={loc.path}
                                onChangeText={(val) => updateLocation(idx, "path", val)}
                                autoCapitalize="none"
                                placeholder="/api"
                              />
                            </Input>
                          </FormControl>
                          <HStack className="gap-3 flex-wrap">
                            <Input className="flex-1 min-w-[120px] rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                              <InputField
                                value={loc.forward_scheme}
                                onChangeText={(val) => updateLocation(idx, "forward_scheme", val)}
                                autoCapitalize="none"
                                placeholder="http"
                              />
                            </Input>
                            <Input className="flex-1 min-w-[160px] rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                              <InputField
                                value={loc.forward_host}
                                onChangeText={(val) => updateLocation(idx, "forward_host", val)}
                                autoCapitalize="none"
                                placeholder="192.168.1.100"
                              />
                            </Input>
                            <Input className="w-24 rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                              <InputField
                                value={String(loc.forward_port)}
                                onChangeText={(val) => updateLocation(idx, "forward_port", val)}
                                keyboardType="number-pad"
                                placeholder="8080"
                              />
                            </Input>
                          </HStack>
                          <HStack className="justify-end">
                            <Button
                              action="negative"
                              size="sm"
                              className="rounded-lg bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
                              onPress={() => removeLocation(idx)}
                            >
                              <ButtonText className="text-background-0 dark:text-[#0A1628]">Remove</ButtonText>
                            </Button>
                          </HStack>
                        </Box>
                      ))
                    )}
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
                        <FormControlHelperText>Shows the available certificates. Leave blank for HTTP.</FormControlHelperText>
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
              <Button variant="outline" action="default" onPress={closeModal} isDisabled={saving}>
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
              </Button>
              <Button action="primary" onPress={handleSave} isDisabled={saving}>
                {saving ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
                <ButtonText>{editingHost ? "Save changes" : "Create proxy"}</ButtonText>
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
              Remove proxy?
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
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
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
