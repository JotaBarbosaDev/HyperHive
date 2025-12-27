import React from "react";
import { RefreshControl, ScrollView, useWindowDimensions } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { ExternalLink } from "@/components/ExternalLink";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Input, InputField } from "@/components/ui/input";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Pressable } from "@/components/ui/pressable";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { NotFoundHost, NotFoundHostPayload } from "@/types/nginx";
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
  X,
} from "lucide-react-native";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { useCertificatesOptions } from "@/hooks/useCertificatesOptions";

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
    className={`rounded-full px-3 py-1 border ${
      active
        ? "bg-background-100 dark:bg-[#0E1524] border-outline-200 dark:border-[#243247]"
        : "bg-background-50 dark:bg-[#0E1524] border-outline-200 dark:border-[#243247]"
    }`}
    size="sm"
    action={active ? "info" : "muted"}
    variant="solid"
  >
    <BadgeText
      className={`text-xs ${active ? "text-typography-800 dark:text-typography-200" : "text-typography-600 dark:text-typography-400"}`}
    >
      {label}
    </BadgeText>
  </Badge>
);

const TOGGLE_PROPS = {
  size: "sm" as const,
  thumbColor: "#f8fafc",
  trackColor: { false: "#cbd5e1", true: "#0f172a" },
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
  const [domainsList, setDomainsList] = React.useState<string[]>([]);
  const lastAddAtRef = React.useRef<number>(0);
  const [togglingId, setTogglingId] = React.useState<number | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  const modalBodyMaxHeight = Math.min(screenHeight * 0.55, 520);
  const [formTab, setFormTab] = React.useState<"details" | "ssl">("details");

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
      showToast("Error loading certificates", "Could not fetch SSL certificates.", "error");
    },
    [showToast]
  );

  const { certificateOptions, loadingCertificates, refreshCertificates, resolveCertificateLabel } =
    useCertificatesOptions(handleCertificatesError);
  const selectedCertificateLabel = resolveCertificateLabel(form.certificate_id);

  const loadHosts = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await listNotFoundHosts();
        setHosts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load 404 hosts", err);
        showToast("Error loading", "Could not fetch the 404 hosts.", "error");
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
    setDomainsList([]);
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

  const handleSaveHost = async () => {
    const combined = [...domainsList, ...parseDomains(domainsInput)];
    const unique = Array.from(new Set(combined.map((d) => d.trim()).filter(Boolean)));
    if (!unique.length) {
      showToast("Domains required", "Provide at least one domain.", "error");
      return;
    }
    const payload: NotFoundHostPayload = {
      ...form,
      domain_names: unique,
      certificate_id: Number(form.certificate_id) || 0,
      advanced_config: form.advanced_config ?? "",
    };

    setSaving(true);
    try {
      if (editingHost?.id) {
        await updateNotFoundHost(editingHost.id, payload);
        showToast("404 Host updated", "Configuration edited successfully.");
      } else {
        await createNotFoundHost(payload);
        showToast("404 Host created", "New 404 error host added.");
      }
      setModalOpen(false);
      setEditingHost(null);
      await loadHosts("silent");
    } catch (err) {
      console.error("Failed to persist 404 host", err);
      showToast("Error saving", "Check the data and try again.", "error");
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
        showToast("Host disabled", "The 404 host was disabled.");
      } else {
        await enableNotFoundHost(host.id);
        showToast("Host enabled", "The 404 host was enabled.");
      }
      await loadHosts("silent");
    } catch (err) {
      console.error("Failed to toggle 404 host", err);
      showToast("Error changing status", "Could not update the host.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteNotFoundHost(deleteTarget.id);
      showToast("Host removed", "404 host deleted successfully.");
      setDeleteTarget(null);
      await loadHosts("silent");
    } catch (err) {
      console.error("Failed to delete 404 host", err);
      showToast("Error deleting", "Could not remove the host.", "error");
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
    return { total: hosts.length, active, inactive };
  }, [hosts]);

  const renderLoading = () => (
    <VStack className="gap-3 mt-6">
      {[1, 2].map((idx) => (
        <Box className="p-5 rounded-2xl bg-background-0 dark:bg-[#0F1A2E] shadow-soft-1 border border-outline-100 dark:border-[#2A3B52]" key={idx}>
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
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadHosts("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            404 Hosts
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Domains that will return 404 - Not Found for every request.
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
              <ButtonText className="text-background-0 dark:text-[#0A1628]">Add 404 Host</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            renderLoading()
          ) : filteredHosts.length === 0 ? (
            <Box className="mt-10 p-6 border border-dashed border-outline-200 dark:border-[#2A3B52] rounded-2xl bg-background-0 dark:bg-[#0A1628] items-center">
              <Text className="text-typography-700 font-semibold text-base">No 404 hosts found</Text>
              <Text className="text-typography-500 text-sm mt-1 text-center">
                Click "Add 404 Host" to create the first 404 response domain.
              </Text>
            </Box>
          ) : (
            <VStack className="mt-6 gap-4">
              {filteredHosts.map((host) => {
                const enabled = isHostEnabled(host);
                return (
                  <Box className="bg-background-0 dark:bg-[#0F1A2E] rounded-2xl p-5 border border-outline-100 dark:border-[#2A3B52] shadow-soft-1" key={host.id}>
                    <HStack className="items-start justify-between gap-4 flex-wrap">
                      <HStack className="items-center gap-2 flex-1 flex-wrap">
                        <Box
                          className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-success-500" : "bg-outline-400"}`}
                        />
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
                      <HStack className="gap-2">
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => handleToggle(host)}
                          isDisabled={togglingId === host.id}
                          className="border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E] rounded-xl"
                        >
                          {togglingId === host.id ? (
                            <ButtonSpinner />
                          ) : (
                            <ButtonIcon as={Power} size="sm" />
                          )}
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
                          SSL {host.ssl_forced ? "(Forced)" : "(Optional)"}
                        </Text>
                      </HStack>
                      {host.certificate_id ? <StatusChip label="SSL enabled" /> : null}
                      {host.http2_support ? <StatusChip label="HTTP/2" /> : null}
                      {host.hsts_enabled ? (
                        <StatusChip label={`HSTS${host.hsts_subdomains ? " + Subdomains" : ""}`} />
                      ) : null}
                    </HStack>

                    <HStack className="mt-3 gap-2 flex-wrap">
                      {host.meta?.letsencrypt_agree ? <StatusChip label="Let's Encrypt" /> : null}
                      {host.meta?.dns_challenge ? <StatusChip label="DNS Challenge" /> : null}
                      <StatusChip label={enabled ? "Active" : "Inactive"} active={enabled} />
                    </HStack>

                    {host.advanced_config ? (
                      <Box className="mt-3 p-3 rounded-xl bg-background-50 dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52]">
                        <HStack className="items-center gap-2 mb-2">
                          <Shield size={16} color="#0f172a" />
                          <Text className="text-typography-800 font-semibold text-sm">Advanced configuration</Text>
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
                {editingHost ? "Edit 404 Host" : "Add 404 Host"}
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 mt-1">
                Block domains by returning 404 responses with optional SSL and HSTS headers.
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
                          placeholder="ex: blocked.hyperhive.local, spam.hyperhive.local"
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
                              <Pressable onPress={() => removeDomain(idx)} className="px-1">
                                <X size={14} color="#6b7280" />
                              </Pressable>
                            </Box>
                          ))}
                        </HStack>
                      ) : null}
                      <FormControlHelper>
                        <FormControlHelperText>Separate with commas or line breaks. Press Enter to add to the list.</FormControlHelperText>
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
                          placeholder="Optional Nginx configuration block..."
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
                        <FormControlHelperText>Use an issued certificate or leave without SSL.</FormControlHelperText>
                      </FormControlHelper>
                    </FormControl>

                    <VStack className="gap-3">
                      <Text className="text-typography-800 font-semibold">Connection options</Text>
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
              <Button variant="outline" action="default" onPress={closeModal} isDisabled={saving} className="rounded-xl">
                <ButtonText className="text-typography-900">Cancel</ButtonText>
              </Button>
              <Button
                action="primary"
                onPress={handleSaveHost}
                isDisabled={saving}
                className="rounded-xl bg-typography-900 dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
              >
                {saving ? <ButtonSpinner /> : null}
                <ButtonText className="text-background-0 dark:text-[#0A1628]">
                  {editingHost ? "Save changes" : "Create host"}
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
              Remove 404 host?
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-typography-700">
              This action will remove{" "}
              <Text className="font-semibold">
                {(deleteTarget?.domain_names ?? []).join(", ")}
              </Text>
              . Continue?
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setDeleteTarget(null)} isDisabled={Boolean(deletingId)}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button action="negative" onPress={handleDelete} isDisabled={Boolean(deletingId)}>
              {deletingId ? <ButtonSpinner /> : null}
              <ButtonText>Remove</ButtonText>
            </Button>
          </AlertDialogFooter>
          <AlertDialogCloseButton />
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
