import React from "react";
import { RefreshControl, ScrollView, useColorScheme } from "react-native";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Divider } from "@/components/ui/divider";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { ApiError } from "@/services/api-client";
import {
  XmlTemplate,
  createXmlTemplate,
  deleteXmlTemplate,
  getXmlTemplate,
  listXmlTemplates,
  updateXmlTemplate,
} from "@/services/xml-templates-client";
import { Database, FileText, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react-native";

type LoadMode = "initial" | "refresh" | "silent";
type EditorMode = "create" | "edit";

const PLACEHOLDER_REGEX = /\$[A-Za-z_][A-Za-z0-9_]*/g;

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (typeof error.data === "string" && error.data.trim()) {
      return error.data;
    }
    if (error.message?.trim()) {
      return error.message;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Request failed.";
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const extractPlaceholders = (xml: string) => {
  const matches = xml.match(PLACEHOLDER_REGEX) ?? [];
  return Array.from(new Set(matches)).sort((a, b) => a.localeCompare(b));
};

const compactXmlPreview = (xml: string) => {
  const compact = xml.replace(/\s+/g, " ").trim();
  if (!compact) return "No XML content";
  return compact.length > 260 ? `${compact.slice(0, 260)}...` : compact;
};

export default function VmXmlTemplatesScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const { token, isChecking } = useAuthGuard();

  const [templates, setTemplates] = React.useState<XmlTemplate[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editorMode, setEditorMode] = React.useState<EditorMode>("create");
  const [editingTemplateId, setEditingTemplateId] = React.useState<number | null>(null);
  const [isEditorLoading, setIsEditorLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [formName, setFormName] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");
  const [formXml, setFormXml] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const editorRequestVersionRef = React.useRef(0);

  const [deleteTarget, setDeleteTarget] = React.useState<XmlTemplate | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  const showToast = React.useCallback(
    (
      title: string,
      description?: string,
      action: "success" | "error" | "warning" | "info" | "muted" = "success"
    ) => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={`toast-${id}`} action={action}>
            <ToastTitle size="sm">{title}</ToastTitle>
            {description ? <ToastDescription size="sm">{description}</ToastDescription> : null}
          </Toast>
        ),
      });
    },
    [toast]
  );

  const loadTemplates = React.useCallback(
    async (mode: LoadMode = "initial") => {
      if (!token) return;

      if (mode === "initial") setIsLoading(true);
      if (mode === "refresh") setIsRefreshing(true);

      try {
        const list = await listXmlTemplates();
        setTemplates(Array.isArray(list) ? list : []);
        setError(null);
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        if (mode !== "silent") {
          showToast("Error loading XML templates", message, "error");
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showToast, token]
  );

  React.useEffect(() => {
    if (isChecking || !token) return;
    loadTemplates("initial");
  }, [isChecking, loadTemplates, token]);

  const resetEditorForm = React.useCallback(() => {
    setFormName("");
    setFormDescription("");
    setFormXml("");
    setFormError(null);
    setIsEditorLoading(false);
    setEditingTemplateId(null);
    setEditorMode("create");
  }, []);

  const closeEditor = React.useCallback(() => {
    if (isSaving) return;
    editorRequestVersionRef.current += 1;
    setIsEditorOpen(false);
    resetEditorForm();
  }, [isSaving, resetEditorForm]);

  const openCreateEditor = React.useCallback(() => {
    editorRequestVersionRef.current += 1;
    resetEditorForm();
    setEditorMode("create");
    setIsEditorOpen(true);
  }, [resetEditorForm]);

  const openEditEditor = React.useCallback(
    async (template: XmlTemplate) => {
      const requestVersion = editorRequestVersionRef.current + 1;
      editorRequestVersionRef.current = requestVersion;
      setEditorMode("edit");
      setEditingTemplateId(template.id);
      setFormName(template.name);
      setFormDescription(template.description ?? "");
      setFormXml(template.xml ?? "");
      setFormError(null);
      setIsEditorLoading(true);
      setIsEditorOpen(true);

      try {
        const fullTemplate = await getXmlTemplate(template.id);
        if (editorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setFormName(fullTemplate.name);
        setFormDescription(fullTemplate.description ?? "");
        setFormXml(fullTemplate.xml ?? "");
      } catch (err) {
        if (editorRequestVersionRef.current !== requestVersion) {
          return;
        }
        const message = getErrorMessage(err);
        setFormError(message);
        showToast("Could not load template details", message, "error");
      } finally {
        if (editorRequestVersionRef.current === requestVersion) {
          setIsEditorLoading(false);
        }
      }
    },
    [showToast]
  );

  const handleSave = React.useCallback(async () => {
    const normalizedName = formName.trim();
    const normalizedDescription = formDescription.trim();
    const normalizedXml = formXml.trim();

    if (!normalizedName) {
      setFormError("Template name is required.");
      return;
    }
    if (!normalizedXml) {
      setFormError("XML content is required.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (editorMode === "create") {
        await createXmlTemplate({
          name: normalizedName,
          description: normalizedDescription,
          xml: normalizedXml,
        });
        showToast("XML template created");
      } else {
        if (!editingTemplateId) {
          throw new Error("Template ID is missing.");
        }
        await updateXmlTemplate(editingTemplateId, {
          name: normalizedName,
          description: normalizedDescription,
          xml: normalizedXml,
        });
        showToast("XML template updated");
      }

      setIsEditorOpen(false);
      resetEditorForm();
      await loadTemplates("silent");
    } catch (err) {
      const message = getErrorMessage(err);
      setFormError(message);
      showToast(
        editorMode === "create" ? "Error creating template" : "Error updating template",
        message,
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    editorMode,
    editingTemplateId,
    formDescription,
    formName,
    formXml,
    loadTemplates,
    resetEditorForm,
    showToast,
  ]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setDeleteError(null);
    try {
      await deleteXmlTemplate(deleteTarget.id);
      showToast("XML template deleted");
      setDeleteTarget(null);
      await loadTemplates("silent");
    } catch (err) {
      const message = getErrorMessage(err);
      setDeleteError(message);
      showToast("Error deleting template", message, "error");
    } finally {
      setDeletingId(null);
    }
  }, [deleteTarget, loadTemplates, showToast]);

  const filteredTemplates = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) => {
      const haystack = [
        template.name,
        template.description,
        template.xml,
        String(template.id),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [search, templates]);

  const totalPlaceholders = React.useMemo(
    () =>
      templates.reduce((sum, template) => sum + extractPlaceholders(template.xml).length, 0),
    [templates]
  );
  const templatesWithPlaceholders = React.useMemo(
    () => templates.filter((template) => extractPlaceholders(template.xml).length > 0).length,
    [templates]
  );
  const totalXmlCharacters = React.useMemo(
    () => templates.reduce((sum, template) => sum + (template.xml?.length ?? 0), 0),
    [templates]
  );

  if (isChecking) {
    return (
      <Box className="flex-1 items-center justify-center bg-background-50 dark:bg-[#020817]">
        <Spinner size="large" />
      </Box>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <>
      <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 64 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadTemplates("refresh")}
              tintColor={refreshControlTint}
              colors={[refreshControlTint]}
              progressBackgroundColor={refreshControlBackground}
            />
          }
        >
          <Box className="p-4 pt-16 web:p-20 web:max-w-7xl web:mx-auto web:w-full">
            <Heading
              size="2xl"
              className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              XML Templates
            </Heading>

            <HStack className="items-start justify-between flex-wrap gap-3 mb-6">
              <VStack className="gap-2 flex-1 min-w-[240px]">
                <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
                  Manage reusable libvirt domain XML templates with placeholders such as
                  {" "}
                  <Text className="font-mono">$qcow2</Text>
                  {" "}and{" "}
                  <Text className="font-mono">$name</Text>.
                </Text>
                <Text className="text-xs text-typography-500 dark:text-[#6B7B95]">
                  Edit loads the latest content from <Text className="font-mono">GET /virsh/xmltemplates/:id</Text>.
                </Text>
              </VStack>

              <HStack className="gap-2 flex-wrap">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onPress={() => loadTemplates("refresh")}
                  isDisabled={isLoading || isRefreshing || isSaving}
                >
                  {isRefreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCw} />}
                  <ButtonText>Refresh</ButtonText>
                </Button>
                <Button className="rounded-xl" onPress={openCreateEditor} isDisabled={isSaving}>
                  <ButtonIcon as={Plus} />
                  <ButtonText>New Template</ButtonText>
                </Button>
              </HStack>
            </HStack>

            <HStack className="mb-6 gap-4 flex-wrap web:grid web:grid-cols-4">
              <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#0E1828] p-4">
                <HStack className="items-center gap-2 mb-2">
                  <Database size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                  <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Total Templates</Text>
                </HStack>
                <Text className="text-2xl font-bold text-typography-900 dark:text-[#E8EBF0]">
                  {templates.length}
                </Text>
              </Box>

              <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#0E1828] p-4">
                <HStack className="items-center gap-2 mb-2">
                  <Search size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                  <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Visible</Text>
                </HStack>
                <Text className="text-2xl font-bold text-typography-900 dark:text-[#E8EBF0]">
                  {filteredTemplates.length}
                </Text>
              </Box>

              <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#0E1828] p-4">
                <HStack className="items-center gap-2 mb-2">
                  <FileText size={16} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                  <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Placeholders</Text>
                </HStack>
                <Text className="text-2xl font-bold text-typography-900 dark:text-[#E8EBF0]">
                  {totalPlaceholders}
                </Text>
              </Box>

              <Box className="flex-1 min-w-[140px] rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#0E1828] p-4">
                <HStack className="items-center gap-2 mb-2">
                  <Icon as={Database} className="text-[#9AA4B8] dark:text-[#8A94A8]" />
                  <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">With Placeholders</Text>
                </HStack>
                <Text className="text-2xl font-bold text-typography-900 dark:text-[#E8EBF0]">
                  {templatesWithPlaceholders}
                </Text>
              </Box>
            </HStack>

            <Box className="rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#0E1828] p-4 mb-6">
              <VStack className="gap-2">
                <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                  Search Templates
                </Text>
                <Input
                  variant="outline"
                  className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]"
                >
                  <InputSlot className="pl-3">
                    <InputIcon as={Search} className="text-typography-500 dark:text-[#8A94A8]" />
                  </InputSlot>
                  <InputField
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search by name, description, XML content, placeholder, or ID..."
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
                <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                  Total XML size across templates: {totalXmlCharacters.toLocaleString()} characters
                </Text>
              </VStack>
            </Box>

            {error ? (
              <Box className="rounded-xl border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/20 p-4 mb-6">
                <Text className="text-sm text-error-700 dark:text-error-200">{error}</Text>
              </Box>
            ) : null}

            <Box className="rounded-xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#0E1828] p-4">
              <HStack className="items-center justify-between flex-wrap gap-3 mb-3">
                <VStack className="gap-1">
                  <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
                    Template Library
                  </Heading>
                  <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                    Create, review, and maintain reusable XML domain definitions.
                  </Text>
                </VStack>

                <HStack className="gap-2 flex-wrap">
                  <Badge variant="outline" className="border-outline-300 dark:border-[#243247]">
                    <BadgeText>{templates.length} total</BadgeText>
                  </Badge>
                  <Badge variant="outline" className="border-outline-300 dark:border-[#243247]">
                    <BadgeText>{filteredTemplates.length} shown</BadgeText>
                  </Badge>
                </HStack>
              </HStack>

              <Divider className="mb-4 bg-outline-200 dark:bg-[#243247]" />

              {isLoading ? (
                <Box className="py-12 items-center justify-center">
                  <Spinner />
                  <Text className="mt-3 text-sm text-typography-500 dark:text-[#8A94A8]">
                    Loading XML templates...
                  </Text>
                </Box>
              ) : filteredTemplates.length === 0 ? (
                <VStack className="py-10 items-center gap-2">
                  <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                    {templates.length === 0 ? "No XML templates yet" : "No templates match the current search"}
                  </Text>
                  <Text className="text-sm text-center text-typography-500 dark:text-[#8A94A8] max-w-xl">
                    {templates.length === 0
                      ? "Create your first template to reuse domain XML with placeholders and speed up VM workflows."
                      : "Try a different keyword or clear the search field to see all templates."}
                  </Text>
                  {templates.length === 0 ? (
                    <Button className="rounded-xl mt-2" onPress={openCreateEditor}>
                      <ButtonIcon as={Plus} />
                      <ButtonText>Create Template</ButtonText>
                    </Button>
                  ) : null}
                </VStack>
              ) : (
                <VStack className="gap-4">
                  {filteredTemplates.map((template) => {
                    const placeholders = extractPlaceholders(template.xml);
                    const updatedLabel = formatDateLabel(template.updatedAt);
                    const createdLabel = formatDateLabel(template.createdAt);
                    const isDeletingThis = deletingId === template.id;

                    return (
                      <Box
                        key={template.id}
                        className="rounded-xl border border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] p-4 shadow-sm"
                      >
                        <HStack className="items-start justify-between gap-4 flex-wrap">
                          <VStack className="gap-3 flex-1 min-w-[240px]">
                            <HStack className="items-center gap-2 flex-wrap">
                              <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                                {template.name}
                              </Text>
                              <Badge variant="outline" className="border-outline-300 dark:border-[#243247]">
                                <BadgeText>ID #{template.id}</BadgeText>
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-outline-300 dark:border-[#243247]"
                              >
                                <BadgeText>{template.xml.length.toLocaleString()} chars</BadgeText>
                              </Badge>
                              {placeholders.length > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="border-outline-300 dark:border-[#243247]"
                                >
                                  <BadgeText>{placeholders.length} placeholders</BadgeText>
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-outline-300 dark:border-[#243247]"
                                >
                                  <BadgeText>No placeholders</BadgeText>
                                </Badge>
                              )}
                            </HStack>

                            <Text className="text-sm text-typography-600 dark:text-[#CBD5E1]">
                              {template.description?.trim() || "No description provided."}
                            </Text>

                            {(updatedLabel || createdLabel) && (
                              <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                                {updatedLabel ? `Updated: ${updatedLabel}` : `Created: ${createdLabel}`}
                              </Text>
                            )}

                            {placeholders.length > 0 ? (
                              <HStack className="gap-2 flex-wrap">
                                {placeholders.map((placeholder) => (
                                  <Badge
                                    key={`${template.id}-${placeholder}`}
                                    variant="outline"
                                    className="border-outline-300 dark:border-[#243247]"
                                  >
                                    <BadgeText>{placeholder}</BadgeText>
                                  </Badge>
                                ))}
                              </HStack>
                            ) : null}

                            <Box className="rounded-lg border border-outline-200 dark:border-[#1E2F47] overflow-hidden bg-background-50 dark:bg-[#081122]">
                              <Box className="px-3 py-2 border-b border-outline-200 dark:border-[#1E2F47] bg-background-0 dark:bg-[#0E1828]">
                                <Text className="text-xs text-typography-500 dark:text-[#8A94A8] font-mono">
                                  XML Preview
                                </Text>
                              </Box>
                              <Box className="px-3 py-2">
                                <Text
                                  numberOfLines={4}
                                  className="text-xs font-mono text-typography-700 dark:text-[#D6E0EE]"
                                >
                                  {compactXmlPreview(template.xml)}
                                </Text>
                              </Box>
                            </Box>
                          </VStack>

                          <VStack className="gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
                              onPress={() => openEditEditor(template)}
                              isDisabled={isDeletingThis || isSaving}
                            >
                              <ButtonIcon as={Pencil} />
                              <ButtonText>Edit</ButtonText>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              action="negative"
                              className="rounded-xl"
                              onPress={() => {
                                setDeleteError(null);
                                setDeleteTarget(template);
                              }}
                              isDisabled={isSaving || isDeletingThis}
                            >
                              {isDeletingThis ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
                              <ButtonText>Delete</ButtonText>
                            </Button>
                          </VStack>
                        </HStack>
                      </Box>
                    );
                  })}
                </VStack>
              )}
            </Box>
          </Box>
        </ScrollView>
      </Box>

      <Modal
        isOpen={isEditorOpen}
        onClose={closeEditor}
        size="full"
      >
        <ModalBackdrop />
        <ModalContent className="max-w-[90%] max-h-[90%] web:max-w-4xl rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
          <ModalHeader className="border-b border-outline-100 dark:border-[#2A3B52]">
            <VStack className="gap-1 flex-1">
              <Heading
                size="md"
                className="text-typography-900 dark:text-[#E8EBF0]"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {editorMode === "create" ? "Create XML Template" : "Edit XML Template"}
              </Heading>
              <Text className="text-xs text-typography-500 dark:text-[#94A3B8]">
                {editorMode === "create"
                  ? "POST /virsh/xmltemplates/"
                  : `PUT /virsh/xmltemplates/${editingTemplateId ?? ""}`}
              </Text>
            </VStack>
            <ModalCloseButton>
              <X className="text-typography-700 dark:text-[#E8EBF0]" />
            </ModalCloseButton>
          </ModalHeader>

          <ModalBody className="bg-background-50 dark:bg-[#0A1628]">
            <ScrollView showsVerticalScrollIndicator>
              <Box className="p-4 web:p-6">
                <VStack className="gap-4">
                  {isEditorLoading ? (
                    <Box className="rounded-xl border border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0E1828] px-3 py-2">
                      <HStack className="items-center gap-2">
                        <Spinner />
                        <Text className="text-sm text-typography-600 dark:text-[#CBD5E1]">
                          Loading template details...
                        </Text>
                      </HStack>
                    </Box>
                  ) : null}

                  <FormControl isInvalid={Boolean(formError) && !formName.trim()}>
                    <FormControlLabel>
                      <FormControlLabelText>Name</FormControlLabelText>
                    </FormControlLabel>
                    <Input variant="outline" className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
                      <InputField
                        value={formName}
                        onChangeText={(value) => {
                          setFormName(value);
                          if (formError) setFormError(null);
                        }}
                        placeholder="ubuntu-qcow2-base"
                        className="text-typography-900 dark:text-[#E8EBF0]"
                      />
                    </Input>
                  </FormControl>

                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>Description</FormControlLabelText>
                    </FormControlLabel>
                    <Input variant="outline" className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
                      <InputField
                        value={formDescription}
                        onChangeText={setFormDescription}
                        placeholder="Complete template with a $qcow2 placeholder"
                        className="text-typography-900 dark:text-[#E8EBF0]"
                      />
                    </Input>
                  </FormControl>

                  <FormControl isInvalid={Boolean(formError) && !formXml.trim()}>
                    <FormControlLabel>
                      <FormControlLabelText>XML</FormControlLabelText>
                    </FormControlLabel>
                    <Textarea className="rounded-xl min-h-[280px] border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
                      <TextareaInput
                        value={formXml}
                        onChangeText={(value) => {
                          setFormXml(value);
                          if (formError) setFormError(null);
                        }}
                        multiline
                        placeholder="<domain type='kvm'>...</domain>"
                        className="font-mono text-typography-900 dark:text-[#E8EBF0]"
                      />
                    </Textarea>
                    <FormControlHelper>
                      <FormControlHelperText>
                        Use placeholders such as `$qcow2` and `$name`. XML is sent to the backend as-is.
                      </FormControlHelperText>
                    </FormControlHelper>
                  </FormControl>

                  {formError ? (
                    <FormControl isInvalid>
                      <FormControlError>
                        <FormControlErrorText>{formError}</FormControlErrorText>
                      </FormControlError>
                    </FormControl>
                  ) : null}
                </VStack>
              </Box>
            </ScrollView>
          </ModalBody>

          <ModalFooter className="gap-2 flex-wrap border-t border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
            <Button
              variant="outline"
              className="rounded-xl border-outline-200 dark:border-[#2A3B52]"
              onPress={closeEditor}
              isDisabled={isSaving}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>
            <Button
              className="rounded-xl bg-typography-900 dark:bg-[#2DD4BF]"
              onPress={handleSave}
              isDisabled={isSaving || isEditorLoading}
            >
              {isSaving ? <ButtonSpinner /> : null}
              <ButtonText className="text-background-0 dark:text-[#0A1628]">
                {editorMode === "create" ? "Create" : "Save"}
              </ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (deletingId) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      >
        <AlertDialogBackdrop />
        <AlertDialogContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828] shadow-2xl max-w-lg p-6">
          <AlertDialogHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <HStack className="items-center gap-3">
              <Box className="h-10 w-10 rounded-2xl bg-error-500/10 dark:bg-error-900/20 items-center justify-center">
                <Trash2 size={18} className="text-error-600 dark:text-error-400" />
              </Box>
              <VStack>
                <Heading
                  size="md"
                  className="text-typography-900 dark:text-[#E8EBF0]"
                  style={{ fontFamily: "Inter_700Bold" }}
                >
                  Delete XML template?
                </Heading>
                <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                  This cannot be undone.
                </Text>
              </VStack>
            </HStack>
          </AlertDialogHeader>
          <AlertDialogBody className="pt-5">
            <VStack className="gap-3">
              <Text className="text-sm text-typography-700 dark:text-[#CBD5E1]">
                {deleteTarget ? `Delete template "${deleteTarget.name}" (ID ${deleteTarget.id})?` : ""}
              </Text>
              <Text className="text-xs text-typography-500 dark:text-[#94A3B8]">
                Request: `DELETE /virsh/xmltemplates/:id`
              </Text>
              {deleteError ? (
                <Text className="text-sm text-error-700 dark:text-[#FCA5A5]">{deleteError}</Text>
              ) : null}
            </VStack>
          </AlertDialogBody>
          <AlertDialogFooter className="pt-5">
            <Button
              variant="outline"
              className="rounded-xl border-outline-200 dark:border-[#2A3B52]"
              onPress={() => {
                if (deletingId) return;
                setDeleteTarget(null);
                setDeleteError(null);
              }}
              isDisabled={Boolean(deletingId)}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>
            <Button
              action="negative"
              className="rounded-xl"
              onPress={handleDelete}
              isDisabled={Boolean(deletingId)}
            >
              {deletingId ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
              <ButtonText>Delete</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
