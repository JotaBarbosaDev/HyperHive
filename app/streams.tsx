import React from "react";
import { RefreshControl, ScrollView, useWindowDimensions, Platform, useColorScheme } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
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
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { StreamHost, StreamPayload } from "@/types/stream";
import { createStream, deleteStream, disableStream, editStream, enableStream, listStreams } from "@/services/streams";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/pressable";
import {
  ArrowLeftRight,
  ChevronDown,
  Lock,
  Pencil,
  Plus,
  Power,
  Shield,
  Trash2,
} from "lucide-react-native";
import { useCertificatesOptions } from "@/hooks/useCertificatesOptions";

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

const TOGGLE_PROPS = {
  size: "sm" as const,
  thumbColor: "#f8fafc",
  trackColor: { false: "#cbd5e1", true: "#0f172a" },
  ios_backgroundColor: "#cbd5e1",
};

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
  const [selectedHost, setSelectedHost] = React.useState<StreamHost | null>(null);
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
        const data = await listStreams();
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load streams", err);
        showToast("Error loading", "Unable to fetch streams.", "error");
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
    void refreshCertificates();
    setFormTab("details");
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
    void refreshCertificates();
    setFormTab("details");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingHost(null);
  };

  const handleSave = async () => {
    if (!form.incoming_port || !form.forwarding_host || !form.forwarding_port) {
      showToast("Required fields", "Provide incoming port, host, and destination port.", "error");
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
        showToast("Stream updated", "Configuration saved.");
      } else {
        await createStream(payload);
        showToast("Stream created", "New stream added.");
      }
      setModalOpen(false);
      setEditingHost(null);
      await loadItems("silent");
    } catch (err) {
      console.error("Failed to save stream", err);
      showToast("Error saving", "Check the data and try again.", "error");
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
        showToast("Stream disabled", "Host disabled.");
      } else {
        await enableStream(host.id);
        showToast("Stream enabled", "Host enabled.");
      }
      await loadItems("silent");
    } catch (err) {
      console.error("Failed to toggle stream", err);
      showToast("Error changing status", "Unable to update the host.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteStream(deleteTarget.id);
      showToast("Stream removed", "Host deleted.");
      setDeleteTarget(null);
      await loadItems("silent");
    } catch (err) {
      console.error("Failed to delete stream", err);
      showToast("Error deleting", "Unable to remove the host.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const renderLoading = () => (
    <VStack className="gap-3 mt-6">
      {[1, 2, 3].map((idx) => (
        <Box className="p-5 rounded-2xl bg-background-0 dark:bg-[#0F1A2E] shadow-soft-1 border border-outline-100 dark:border-[#2A3B52]" key={idx}>
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
            Streams
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Configure TCP/UDP port forwarding for non-HTTP services.
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
              <ButtonText className="text-background-0 dark:text-[#0A1628]">Add Stream</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            renderLoading()
          ) : filteredItems.length === 0 ? (
            <Box className="mt-10 p-6 border border-dashed border-outline-200 dark:border-[#2A3B52] rounded-2xl bg-background-0 dark:bg-[#0A1628] items-center">
              <Text className="text-typography-700 font-semibold text-base">No streams found</Text>
              <Text className="text-typography-500 text-sm mt-1 text-center">
                Click "Add Stream" to create the first rule.
              </Text>
            </Box>
          ) : isWeb ? (
            <VStack className="mt-6 gap-4">
              {filteredItems.map((host) => {
                const enabled = isEnabled(host);
                const protocols: string[] = [];
                if (host.tcp_forwarding) protocols.push("TCP");
                if (host.udp_forwarding) protocols.push("UDP");
                return (
                  <Box className={`rounded-2xl p-5 border border-outline-100 dark:border-[#2A3B52] shadow-soft-1 ${enabled ? "bg-background-0 dark:bg-[#0F1A2E]" : "bg-background-50 dark:bg-[#0E1524]"}`} key={host.id}>
                    <HStack className="items-start justify-between gap-4 flex-wrap">
                      <VStack className="gap-2 flex-1">
                        <HStack className="items-center gap-2 flex-wrap">
                          <Box className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-success-500" : "bg-outline-400"}`} />
                          <Text
                            className={`text-base ${enabled ? "text-typography-900" : "text-typography-500"}`}
                            style={{ fontFamily: "Inter_700Bold" }}
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
                              <Text className="text-typography-600 text-sm">No SSL</Text>
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
                          className="border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E] rounded-xl px-3"
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
                const protocols: string[] = [];
                if (host.tcp_forwarding) protocols.push("TCP");
                if (host.udp_forwarding) protocols.push("UDP");
                return (
                  <Pressable
                    key={host.id}
                    onPress={() => setSelectedHost(host)}
                    className={`rounded-2xl p-4 border border-outline-100 dark:border-[#2A3B52] shadow-soft-1 ${enabled ? "bg-background-0 dark:bg-[#0F1A2E]" : "bg-background-50 dark:bg-[#0E1524]"}`}
                  >
                    <VStack className="gap-2">
                      <HStack className="items-center justify-between gap-2">
                        <HStack className="items-center gap-2 flex-1">
                          <Box className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-success-500" : "bg-outline-400"}`} />
                          <Text
                            className="text-typography-900 dark:text-[#E8EBF0] text-sm"
                            style={{ fontFamily: "Inter_700Bold" }}
                          >
                            Port {host.incoming_port}
                          </Text>
                        </HStack>
                      </HStack>
                      <HStack className="items-center gap-2 flex-wrap">
                        <ArrowLeftRight size={16} color={isDarkMode ? "#E2E8F0" : "#0f172a"} />
                        <Text className="text-typography-700 dark:text-typography-300 text-sm">
                          :{host.incoming_port} → {host.forwarding_host}:{host.forwarding_port}
                        </Text>
                      </HStack>
                      <HStack className="gap-2 flex-wrap">
                        {protocols.map((p) => (
                          <Badge key={p} className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                            <BadgeText className="text-xs text-typography-800 dark:text-typography-200">{p}</BadgeText>
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
                            <Text className="text-typography-600 dark:text-typography-400 text-sm">No SSL</Text>
                          </HStack>
                        )}
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
                Stream
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 mt-1">
                Details and actions for this stream.
              </Text>
            </VStack>
            <ModalCloseButton className="text-typography-500" />
          </ModalHeader>
          <ModalBody className="px-6 pt-4">
            {selectedHost ? (
              <VStack className="gap-4">
                <VStack className="gap-2">
                  <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-typography-400">
                    Ports
                  </Text>
                  <HStack className="items-center gap-2">
                    <ArrowLeftRight size={16} color={isDarkMode ? "#E2E8F0" : "#0f172a"} />
                    <Text className="text-typography-700 dark:text-typography-300 text-sm">
                      :{selectedHost.incoming_port} → {selectedHost.forwarding_host}:{selectedHost.forwarding_port}
                    </Text>
                  </HStack>
                </VStack>
                <HStack className="gap-2 flex-wrap">
                  {selectedHost.tcp_forwarding ? (
                    <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                      <BadgeText className="text-xs text-typography-800 dark:text-typography-200">TCP</BadgeText>
                    </Badge>
                  ) : null}
                  {selectedHost.udp_forwarding ? (
                    <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                      <BadgeText className="text-xs text-typography-800 dark:text-typography-200">UDP</BadgeText>
                    </Badge>
                  ) : null}
                  {selectedHost.certificate_id ? (
                    <HStack className="items-center gap-1">
                      <Lock size={16} color="#16a34a" />
                      <Text className="text-success-600 text-sm">SSL</Text>
                    </HStack>
                  ) : (
                    <HStack className="items-center gap-1">
                      <Shield size={16} color="#9ca3af" />
                      <Text className="text-typography-600 dark:text-typography-400 text-sm">No SSL</Text>
                    </HStack>
                  )}
                </HStack>
                <HStack className="gap-2 flex-wrap">
                  <Badge className="rounded-full px-3 py-1" size="sm" action={isEnabled(selectedHost) ? "success" : "muted"} variant="solid">
                    <BadgeText className="text-xs text-typography-800 dark:text-typography-200">
                      {isEnabled(selectedHost) ? "Active" : "Inactive"}
                    </BadgeText>
                  </Badge>
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
                {editingHost ? "Edit Stream" : "Add Stream"}
              </Heading>
              <Text className="text-typography-600 dark:text-typography-400 mt-1">
                TCP/UDP port forwarding with optional SNI certificate.
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
                        <FormControlLabelText>Incoming port</FormControlLabelText>
                      </FormControlLabel>
                      <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                        <InputField
                          value={String(form.incoming_port || "")}
                          onChangeText={(val) => setForm((prev) => ({ ...prev, incoming_port: Number(val) || 0 }))}
                          keyboardType="number-pad"
                          placeholder="6060"
                        />
                      </Input>
                    </FormControl>

                    <FormControl isRequired>
                      <FormControlLabel>
                        <FormControlLabelText>Destination</FormControlLabelText>
                      </FormControlLabel>
                      <HStack className="gap-3 flex-wrap">
                        <Input className="flex-1 min-w-[160px] rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                          <InputField
                            value={form.forwarding_host}
                            onChangeText={(val) => setForm((prev) => ({ ...prev, forwarding_host: val }))}
                            autoCapitalize="none"
                            placeholder="10.0.0.3"
                          />
                        </Input>
                        <Input className="w-24 rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                          <InputField
                            value={String(form.forwarding_port || "")}
                            onChangeText={(val) => setForm((prev) => ({ ...prev, forwarding_port: Number(val) || 0 }))}
                            keyboardType="number-pad"
                            placeholder="60"
                          />
                        </Input>
                      </HStack>
                    </FormControl>

                    <VStack className="gap-3">
                      <Text className="text-typography-800 font-semibold">Protocols</Text>
                      <HStack className="flex-wrap gap-4">
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.tcp_forwarding}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, tcp_forwarding: val }))}
                          />
                          <Text className="text-typography-800">TCP</Text>
                        </HStack>
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.udp_forwarding}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, udp_forwarding: val }))}
                          />
                          <Text className="text-typography-800">UDP</Text>
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
                      <FormControlHelperText>Select a certificate for TLS or leave it as "No Certificate".</FormControlHelperText>
                      </FormControlHelper>
                    </FormControl>
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
                  {editingHost ? "Save changes" : "Create stream"}
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <AlertDialogBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <AlertDialogContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0F1A2E] shadow-soft-2">
          <AlertDialogHeader className="border-b border-outline-100 dark:border-[#2A3B52]">
            <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
              Remove stream?
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody className="py-4">
            <Text className="text-typography-700 dark:text-typography-300">
              This action will delete{" "}
              <Text className="font-semibold">
                Port {deleteTarget?.incoming_port}
              </Text>
              . Do you want to continue?
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3 border-t border-outline-100 dark:border-[#2A3B52] pt-3">
            <Button
              className="rounded-xl"
              variant="outline"
              action="default"
              onPress={() => setDeleteTarget(null)}
              isDisabled={Boolean(deletingId)}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>
            <Button
              action="negative"
              className="rounded-xl bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
              onPress={handleDelete}
              isDisabled={Boolean(deletingId)}
            >
              {deletingId ? (
                <ButtonSpinner />
              ) : (
                <ButtonIcon as={Trash2} size="sm" className="text-background-0 dark:text-[#0A1628]" />
              )}
              <ButtonText className="text-background-0 dark:text-[#0A1628]">Delete</ButtonText>
            </Button>
          </AlertDialogFooter>
          <AlertDialogCloseButton />
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
