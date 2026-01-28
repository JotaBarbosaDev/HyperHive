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
import { AccessList, AccessListAuthItem, AccessListClientRule, AccessListPayload } from "@/types/access-list";
import { createAccessList, deleteAccessList, editAccessList, listAccessLists } from "@/services/access-lists";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Pressable } from "@/components/ui/pressable";
import { ChevronDown, Lock, Pencil, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react-native";

const DEFAULT_FORM: AccessListPayload = {
  name: "",
  satisfy_any: false,
  pass_auth: false,
  items: [],
  clients: [],
};

const DEFAULT_USER: AccessListAuthItem = {
  username: "",
  password: "",
};

const DEFAULT_CLIENT: AccessListClientRule = {
  directive: "allow",
  address: "",
};

const TOGGLE_PROPS = {
  size: "sm" as const,
  thumbColor: "#f8fafc",
  trackColor: { false: "#cbd5e1", true: "#0f172a" },
  ios_backgroundColor: "#cbd5e1",
};

const BADGE_TEXT_CLASS = "text-xs text-typography-900 dark:text-white";

const FlagBadge = ({ label, active }: { label: string; active: boolean }) => (
  <Badge className="rounded-full px-3 py-1" size="sm" action={active ? "info" : "muted"} variant="solid">
    <BadgeText className={BADGE_TEXT_CLASS}>{label}</BadgeText>
  </Badge>
);

export default function AccessListsScreen() {
  const toast = useToast();
  const [lists, setLists] = React.useState<AccessList[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<AccessListPayload>(DEFAULT_FORM);
  const [items, setItems] = React.useState<AccessListAuthItem[]>([]);
  const [clients, setClients] = React.useState<AccessListClientRule[]>([]);
  const [editingList, setEditingList] = React.useState<AccessList | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<AccessList | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [selectedList, setSelectedList] = React.useState<AccessList | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  const modalBodyMaxHeight = Math.min(screenHeight * 0.6, 560);
  const [formTab, setFormTab] = React.useState<"details" | "users" | "rules">("details");
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

  const loadLists = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await listAccessLists();
        setLists(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load access lists", err);
        showToast("Error loading", "Unable to fetch access lists.", "error");
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [showToast]
  );

  React.useEffect(() => {
    loadLists();
  }, [loadLists]);

  const openCreateModal = () => {
    setEditingList(null);
    setForm(DEFAULT_FORM);
    setItems([]);
    setClients([]);
    setFormTab("details");
    setModalOpen(true);
  };

  const openEditModal = (list: AccessList) => {
    setEditingList(list);
    setForm({
      name: list.name ?? "",
      satisfy_any: Boolean(list.satisfy_any),
      pass_auth: Boolean(list.pass_auth),
      items: [],
      clients: [],
    });
    setItems(Array.isArray(list.items) ? list.items.map((item) => ({ ...DEFAULT_USER, ...item })) : []);
    setClients(
      Array.isArray(list.clients)
        ? list.clients.map((client) => ({ ...DEFAULT_CLIENT, ...client }))
        : []
    );
    setFormTab("details");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingList(null);
  };

  const addUser = () => setItems((prev) => [...prev, { ...DEFAULT_USER }]);

  const updateUser = (index: number, key: keyof AccessListAuthItem, value: string) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };

  const removeUser = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addClient = () => setClients((prev) => [...prev, { ...DEFAULT_CLIENT }]);

  const updateClient = (index: number, key: keyof AccessListClientRule, value: string) => {
    setClients((prev) => prev.map((client, idx) => (idx === index ? { ...client, [key]: value } : client)));
  };

  const removeClient = (index: number) => {
    setClients((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      showToast("Required fields", "Provide a name for the access list.", "error");
      return;
    }

    const normalizedItems = items
      .map((item) => ({
        ...item,
        username: item.username.trim(),
        password: item.password ?? "",
      }))
      .filter((item) => item.username || item.password);

    const normalizedClients = clients
      .map((client) => ({
        ...client,
        directive: client.directive || "allow",
        address: client.address.trim(),
      }))
      .filter((client) => client.address);

    const payload: AccessListPayload = {
      name,
      satisfy_any: Boolean(form.satisfy_any),
      pass_auth: Boolean(form.pass_auth),
      items: normalizedItems,
      clients: normalizedClients,
    };

    setSaving(true);
    try {
      if (editingList?.id) {
        await editAccessList(editingList.id, payload);
        showToast("Access list updated", "Changes saved successfully.");
      } else {
        await createAccessList(payload);
        showToast("Access list created", "Access list added successfully.");
      }
      setModalOpen(false);
      setEditingList(null);
      await loadLists("silent");
    } catch (err) {
      console.error("Failed to save access list", err);
      showToast("Error saving", "Unable to save access list.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteAccessList(deleteTarget.id);
      showToast("Access list removed", "Access list deleted successfully.");
      setDeleteTarget(null);
      await loadLists("silent");
    } catch (err) {
      console.error("Failed to delete access list", err);
      showToast("Error deleting", "Unable to delete access list.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const renderLoading = () => (
    <VStack className="gap-3 mt-6">
      {[1, 2, 3].map((idx) => (
        <Box
          className="p-5 rounded-2xl bg-background-0 dark:bg-[#0F1A2E] shadow-soft-1 border border-outline-100 dark:border-[#2A3B52]"
          key={idx}
        >
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

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLists("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-20 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            Access Lists
          </Heading>
          <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
            Manage HTTP authentication lists and client allow/deny rules.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <HStack className="gap-2 flex-wrap">
              <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                <BadgeText className={BADGE_TEXT_CLASS}>
                  Total ({lists.length})
                </BadgeText>
              </Badge>
            </HStack>
            <Button
              action="primary"
              variant="solid"
              size="md"
              onPress={openCreateModal}
              className="rounded-xl px-5 bg-typography-900 dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
            >
              <ButtonIcon as={Plus} size="sm" className="text-background-0 dark:text-[#0A1628]" />
              <ButtonText className="text-background-0 dark:text-[#0A1628]">Add Access List</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            renderLoading()
          ) : lists.length === 0 ? (
            <Box className="mt-10 p-6 border border-dashed border-outline-200 dark:border-[#2A3B52] rounded-2xl bg-background-0 dark:bg-[#0A1628] items-center">
              <Text className="text-typography-700 font-semibold text-base">No access lists found</Text>
              <Text className="text-typography-500 text-sm mt-1 text-center">
                Click "Add Access List" to create the first access list.
              </Text>
            </Box>
          ) : isWeb ? (
            <VStack className="mt-6 gap-4">
              {lists.map((list) => {
                const itemsCount = list.items?.length ?? 0;
                const clientsCount = list.clients?.length ?? 0;
                return (
                  <Box
                    className="rounded-2xl p-5 border border-outline-100 dark:border-[#2A3B52] shadow-soft-1 bg-background-0 dark:bg-[#0F1A2E]"
                    key={list.id}
                  >
                    <HStack className="items-start justify-between gap-4 flex-wrap">
                      <VStack className="gap-2 flex-1">
                        <HStack className="items-center gap-2 flex-wrap">
                          <ShieldCheck size={16} color={isDarkMode ? "#E2E8F0" : "#0f172a"} />
                          <Text
                            className="text-base text-typography-900 dark:text-[#E8EBF0]"
                            style={{ fontFamily: "Inter_700Bold" }}
                          >
                            {list.name}
                          </Text>
                        </HStack>
                        <HStack className="gap-2 flex-wrap">
                          <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                            <BadgeText className={BADGE_TEXT_CLASS}>
                              Users {itemsCount}
                            </BadgeText>
                          </Badge>
                          <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                            <BadgeText className={BADGE_TEXT_CLASS}>
                              Clients {clientsCount}
                            </BadgeText>
                          </Badge>
                          <FlagBadge label={list.satisfy_any ? "Satisfy Any" : "Satisfy All"} active={list.satisfy_any} />
                          <FlagBadge label={list.pass_auth ? "Pass Auth" : "Require Auth"} active={list.pass_auth} />
                        </HStack>
                      </VStack>

                      <HStack className="gap-2 items-center">
                        <Button
                          action="default"
                          variant="outline"
                          size="sm"
                          onPress={() => openEditModal(list)}
                          className="border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E] rounded-xl px-3"
                        >
                          <ButtonIcon as={Pencil} size="sm" />
                        </Button>
                        <Button
                          action="negative"
                          variant="solid"
                          size="sm"
                          onPress={() => setDeleteTarget(list)}
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
              {lists.map((list) => {
                const itemsCount = list.items?.length ?? 0;
                const clientsCount = list.clients?.length ?? 0;
                return (
                  <Pressable
                    key={list.id}
                    onPress={() => setSelectedList(list)}
                    className="rounded-2xl p-4 border border-outline-100 dark:border-[#2A3B52] shadow-soft-1 bg-background-0 dark:bg-[#0F1A2E]"
                  >
                    <VStack className="gap-2">
                      <HStack className="items-center gap-2">
                        <ShieldCheck size={16} color={isDarkMode ? "#E2E8F0" : "#0f172a"} />
                        <Text
                          className="text-typography-900 dark:text-[#E8EBF0] text-sm"
                          style={{ fontFamily: "Inter_700Bold" }}
                        >
                          {list.name}
                        </Text>
                      </HStack>
                      <HStack className="gap-2 flex-wrap">
                        <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                          <BadgeText className={BADGE_TEXT_CLASS}>
                            Users {itemsCount}
                          </BadgeText>
                        </Badge>
                        <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                          <BadgeText className={BADGE_TEXT_CLASS}>
                            Clients {clientsCount}
                          </BadgeText>
                        </Badge>
                      </HStack>
                      <HStack className="gap-2 flex-wrap">
                        <FlagBadge label={list.satisfy_any ? "Satisfy Any" : "Satisfy All"} active={list.satisfy_any} />
                        <FlagBadge label={list.pass_auth ? "Pass Auth" : "Require Auth"} active={list.pass_auth} />
                      </HStack>
                      <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
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

      <Modal isOpen={!!selectedList} onClose={() => setSelectedList(null)} size="md">
        <ModalBackdrop className="bg-black/60" />
        <ModalContent className="max-w-lg w-full rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] shadow-2xl">
          <ModalHeader className="flex-row items-start justify-between px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <VStack className="flex-1">
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                Access List
              </Heading>
              <Text className="text-typography-600 dark:text-[#8A94A8] mt-1">
                Details and actions for this access list.
              </Text>
            </VStack>
            <ModalCloseButton className="text-typography-500" />
          </ModalHeader>
          <ModalBody className="px-6 pt-4">
            {selectedList ? (
              <VStack className="gap-4">
                <VStack className="gap-2">
                  <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                    Name
                  </Text>
                  <HStack className="items-center gap-2">
                    <ShieldCheck size={16} color={isDarkMode ? "#E2E8F0" : "#0f172a"} />
                    <Text className="text-typography-700 dark:text-[#8A94A8] text-sm">
                      {selectedList.name}
                    </Text>
                  </HStack>
                </VStack>
                <HStack className="gap-2 flex-wrap">
                  <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                    <BadgeText className={BADGE_TEXT_CLASS}>
                      Users {selectedList.items?.length ?? 0}
                    </BadgeText>
                  </Badge>
                  <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                    <BadgeText className={BADGE_TEXT_CLASS}>
                      Clients {selectedList.clients?.length ?? 0}
                    </BadgeText>
                  </Badge>
                </HStack>
                <HStack className="gap-2 flex-wrap">
                  <FlagBadge label={selectedList.satisfy_any ? "Satisfy Any" : "Satisfy All"} active={selectedList.satisfy_any} />
                  <FlagBadge label={selectedList.pass_auth ? "Pass Auth" : "Require Auth"} active={selectedList.pass_auth} />
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
                  if (!selectedList) return;
                  openEditModal(selectedList);
                  setSelectedList(null);
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
                  if (!selectedList) return;
                  setDeleteTarget(selectedList);
                  setSelectedList(null);
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
                {editingList ? "Edit Access List" : "Add Access List"}
              </Heading>
              <Text className="text-typography-600 dark:text-[#8A94A8] mt-1">
                Configure authentication users and client allow/deny rules.
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
                    { key: "users", label: "Users" },
                    { key: "rules", label: "Rules" },
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
                          className={`text-sm ${active ? "text-background-0 dark:text-[#0A1628]" : "text-typography-700 dark:text-[#8A94A8]"}`}
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
                        <FormControlLabelText>List name</FormControlLabelText>
                      </FormControlLabel>
                      <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]">
                        <InputField
                          value={form.name}
                          onChangeText={(val) => setForm((prev) => ({ ...prev, name: val }))}
                          autoCapitalize="none"
                          placeholder="office-access"
                        />
                      </Input>
                    </FormControl>

                    <FormControl>
                      <FormControlLabel>
                        <FormControlLabelText>Authentication options</FormControlLabelText>
                      </FormControlLabel>
                      <HStack className="flex-wrap gap-4">
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.satisfy_any}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, satisfy_any: val }))}
                          />
                          <Text className="text-typography-800">Satisfy any</Text>
                        </HStack>
                        <HStack className="items-center gap-2">
                          <Switch
                            {...TOGGLE_PROPS}
                            value={form.pass_auth}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, pass_auth: val }))}
                          />
                          <Text className="text-typography-800">Pass auth</Text>
                        </HStack>
                      </HStack>
                      <FormControlHelper>
                        <FormControlHelperText>
                          Use "Satisfy any" to allow access if any rule matches.
                        </FormControlHelperText>
                      </FormControlHelper>
                    </FormControl>
                  </VStack>
                ) : null}

                {formTab === "users" ? (
                  <VStack className="gap-4">
                    <HStack className="items-center justify-between">
                      <HStack className="items-center gap-2">
                        <Users size={16} color={isDarkMode ? "#E2E8F0" : "#0f172a"} />
                        <Text className="text-typography-900 font-semibold">Users</Text>
                      </HStack>
                      <Button className="rounded-xl" action="primary" variant="outline" size="sm" onPress={addUser}>
                        <ButtonText>Add user</ButtonText>
                      </Button>
                    </HStack>
                    {items.length === 0 ? (
                      <Text className="text-typography-600 text-sm">No users defined.</Text>
                    ) : (
                      <VStack className="gap-3">
                        {items.map((item, idx) => (
                          <Box
                            className="p-3 rounded-xl border border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]"
                            key={`user-${idx}`}
                          >
                            <HStack className="gap-3 flex-wrap items-center">
                              <Input className="flex-1 min-w-[140px] rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                                <InputField
                                  value={item.username}
                                  onChangeText={(val) => updateUser(idx, "username", val)}
                                  autoCapitalize="none"
                                  placeholder="username"
                                />
                              </Input>
                              <Input className="flex-1 min-w-[140px] rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                              <InputField
                                value={item.password}
                                onChangeText={(val) => updateUser(idx, "password", val)}
                                autoCapitalize="none"
                                placeholder={editingList ? "*****" : "password"}
                                secureTextEntry
                              />
                              </Input>
                              <Button
                                action="default"
                                variant="outline"
                                size="sm"
                                onPress={() => removeUser(idx)}
                                className="border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E] rounded-xl px-3"
                              >
                                <ButtonIcon as={X} size="sm" />
                              </Button>
                            </HStack>
                          </Box>
                        ))}
                      </VStack>
                    )}
                    <Text className="text-typography-500 dark:text-[#8A94A8] text-xs">
                      Leave password blank to keep it unchanged.
                    </Text>
                  </VStack>
                ) : null}

                {formTab === "rules" ? (
                  <VStack className="gap-4">
                    <HStack className="items-center justify-between">
                      <HStack className="items-center gap-2">
                        <Lock size={16} color={isDarkMode ? "#E2E8F0" : "#0f172a"} />
                        <Text className="text-typography-900 font-semibold">Client rules</Text>
                      </HStack>
                      <Button className="rounded-xl" action="primary" variant="outline" size="sm" onPress={addClient}>
                        <ButtonText>Add rule</ButtonText>
                      </Button>
                    </HStack>
                    {clients.length === 0 ? (
                      <Text className="text-typography-600 text-sm">No client rules defined.</Text>
                    ) : (
                      <VStack className="gap-3">
                        {clients.map((client, idx) => (
                          <Box
                            className="p-3 rounded-xl border border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]"
                            key={`client-${idx}`}
                          >
                            <HStack className="gap-3 flex-wrap items-center">
                              <Select
                                selectedValue={client.directive}
                                onValueChange={(val) => updateClient(idx, "directive", val)}
                              >
                                <SelectTrigger className="flex-1 min-w-[120px] rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                                  <Text className="text-typography-700">
                                    {client.directive === "deny" ? "Deny" : "Allow"}
                                  </Text>
                                  <SelectIcon as={ChevronDown} className="ml-auto text-typography-500" />
                                </SelectTrigger>
                                <SelectPortal>
                                  <SelectBackdropContent />
                                  <SelectContent className="rounded-xl">
                                    <SelectDragIndicatorWrapper>
                                      <SelectDragIndicator />
                                    </SelectDragIndicatorWrapper>
                                    <SelectItem label="Allow" value="allow" />
                                    <SelectItem label="Deny" value="deny" />
                                  </SelectContent>
                                </SelectPortal>
                              </Select>
                              <Input className="flex-1 min-w-[160px] rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]">
                                <InputField
                                  value={client.address}
                                  onChangeText={(val) => updateClient(idx, "address", val)}
                                  autoCapitalize="none"
                                  placeholder="192.168.1.198"
                                />
                              </Input>
                              <Button
                                action="default"
                                variant="outline"
                                size="sm"
                                onPress={() => removeClient(idx)}
                                className="border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E] rounded-xl px-3"
                              >
                                <ButtonIcon as={X} size="sm" />
                              </Button>
                            </HStack>
                          </Box>
                        ))}
                      </VStack>
                    )}
                    <Text className="text-typography-500 dark:text-[#8A94A8] text-xs">
                      Add CIDR ranges or IP addresses that should be allowed or denied.
                    </Text>
                  </VStack>
                ) : null}
              </VStack>
            </ScrollView>
          </ModalBody>
          <ModalFooter className="px-6 pb-6 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <HStack className="gap-3 w-full">
              <Button
                action="default"
                variant="outline"
                size="md"
                onPress={closeModal}
                className="flex-1 rounded-xl border-outline-200 dark:border-[#243247]"
                isDisabled={saving}
              >
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
              </Button>
              <Button
                action="primary"
                variant="solid"
                size="md"
                onPress={handleSave}
                className="flex-1 rounded-xl bg-typography-900 dark:bg-[#2DD4BF]"
                isDisabled={saving}
              >
                {saving ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText className="text-background-0 dark:text-[#0A1628]">
                    {editingList ? "Save changes" : "Create access list"}
                  </ButtonText>
                )}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <AlertDialogBackdrop className="bg-black/60" />
        <AlertDialogContent className="max-w-md w-full rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] shadow-2xl">
          <AlertDialogHeader className="flex-row items-start justify-between px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <VStack className="flex-1">
              <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
                Remove access list?
              </Heading>
              <Text className="text-typography-600 dark:text-[#8A94A8] mt-1">
                This action cannot be undone.
              </Text>
            </VStack>
            <AlertDialogCloseButton className="text-typography-500" />
          </AlertDialogHeader>
          <AlertDialogBody className="px-6 py-4">
            <Text className="text-typography-700 dark:text-[#8A94A8]">
              Delete <Text className="font-semibold">{deleteTarget?.name}</Text>?
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="px-6 pb-6 pt-2">
            <HStack className="gap-3 w-full">
              <Button
                action="default"
                variant="outline"
                size="md"
                onPress={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border-outline-200 dark:border-[#243247]"
                isDisabled={deletingId === deleteTarget?.id}
              >
                <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
              </Button>
              <Button
                action="negative"
                variant="solid"
                size="md"
                onPress={handleDelete}
                className="flex-1 rounded-xl"
                isDisabled={deletingId === deleteTarget?.id}
              >
                {deletingId === deleteTarget?.id ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText className="text-background-0">Delete</ButtonText>
                )}
              </Button>
            </HStack>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
