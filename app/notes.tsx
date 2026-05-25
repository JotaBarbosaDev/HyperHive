import React from "react";
import { RefreshControl, ScrollView, useWindowDimensions } from "react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Input, InputField } from "@/components/ui/input";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { VStack } from "@/components/ui/vstack";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { createNote, getNote, listNotes, updateNote } from "@/services/notes";
import { Note } from "@/types/notes";
import { Edit3, Eye, FileText, Plus, RefreshCw, Save, X } from "lucide-react-native";

const summarizeNote = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
};

const countLines = (value: string) => {
  if (!value) {
    return 0;
  }
  return value.split(/\r\n|\r|\n/).length;
};

const renderInlineMarkdown = (value: string) => {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={`${part}-${index}`} className="font-semibold text-typography-900 dark:text-[#E8EBF0]">
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <Text
          key={`${part}-${index}`}
          className="rounded bg-background-100 px-1 font-mono text-typography-900 dark:bg-[#162033] dark:text-[#E8EBF0]"
        >
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <Text key={`${part}-${index}`} className="italic text-typography-800 dark:text-[#D7DCE5]">
          {part.slice(1, -1)}
        </Text>
      );
    }
    return part;
  });
};

const MarkdownPreview = ({ value }: { value: string }) => {
  const lines = value.split(/\r\n|\r|\n/);
  const nodes: React.ReactNode[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  const flushCodeBlock = (key: string) => {
    nodes.push(
      <Box key={key} className="rounded-xl bg-background-100 p-4 dark:bg-[#0B1220]">
        <Text className="font-mono text-sm leading-6 text-typography-800 dark:text-[#D7DCE5]">
          {codeLines.join("\n")}
        </Text>
      </Box>
    );
    codeLines = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock(`code-${index}`);
      }
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (!trimmed) {
      nodes.push(<Box key={`space-${index}`} className="h-2" />);
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      nodes.push(
        <Heading
          key={`heading-${index}`}
          size={level === 1 ? "xl" : level === 2 ? "lg" : "md"}
          className="text-typography-900 dark:text-[#E8EBF0]"
          style={{ fontFamily: "Inter_700Bold" }}
        >
          {headingMatch[2]}
        </Heading>
      );
      return;
    }

    const quoteMatch = trimmed.match(/^>\s?(.+)$/);
    if (quoteMatch) {
      nodes.push(
        <Box key={`quote-${index}`} className="border-l-4 border-outline-300 pl-3 dark:border-[#2A3B52]">
          <Text className="text-base leading-7 text-typography-700 dark:text-[#D7DCE5]">
            {renderInlineMarkdown(quoteMatch[1])}
          </Text>
        </Box>
      );
      return;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.+)$/) ?? trimmed.match(/^\d+\.\s+(.+)$/);
    if (listMatch) {
      nodes.push(
        <HStack key={`list-${index}`} className="items-start gap-3">
          <Text className="text-base leading-7 text-typography-500 dark:text-[#8A94A8]">-</Text>
          <Text className="flex-1 text-base leading-7 text-typography-800 dark:text-[#D7DCE5]">
            {renderInlineMarkdown(listMatch[1])}
          </Text>
        </HStack>
      );
      return;
    }

    nodes.push(
      <Text key={`paragraph-${index}`} className="text-base leading-7 text-typography-800 dark:text-[#D7DCE5]">
        {renderInlineMarkdown(trimmed)}
      </Text>
    );
  });

  if (inCodeBlock && codeLines.length > 0) {
    flushCodeBlock("code-open");
  }

  return <VStack className="gap-3">{nodes}</VStack>;
};

export default function NotesScreen() {
  const { token, isChecking } = useAuthGuard();
  const toast = useToast();
  const { width, height } = useWindowDimensions();
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [openingId, setOpeningId] = React.useState<number | null>(null);
  const [viewingId, setViewingId] = React.useState<number | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"create" | "edit">("create");
  const [editingNote, setEditingNote] = React.useState<Note | null>(null);
  const [previewNote, setPreviewNote] = React.useState<Note | null>(null);
  const [formTitle, setFormTitle] = React.useState("");
  const [formText, setFormText] = React.useState("");

  const contentWidth = Math.min(width - 32, 1104);
  const columns = contentWidth >= 960 ? 4 : contentWidth >= 700 ? 3 : contentWidth >= 460 ? 2 : 1;
  const cardGap = 16;
  const cardSize = Math.floor((contentWidth - cardGap * (columns - 1)) / columns);
  const modalWidth = Math.min(Math.max(width - 32, 320), 1280);
  const modalMaxHeight = Math.min(Math.max(height - 48, 520), 900);
  const editorHeight = Math.max(modalMaxHeight - 156, 360);
  const previewHeight = Math.max(modalMaxHeight - 170, 360);

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

  const loadNotes = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await listNotes();
        setNotes(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load notes", err);
        showToast("Error loading", "Unable to fetch notes.", "error");
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [showToast]
  );

  React.useEffect(() => {
    if (token) {
      loadNotes();
    }
  }, [loadNotes, token]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingNote(null);
    setFormTitle("");
    setFormText("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (creating || saving) return;
    setModalOpen(false);
    setEditingNote(null);
    setFormTitle("");
    setFormText("");
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewNote(null);
  };

  const handleCreate = async () => {
    const titulo = formTitle.trim();
    const nota = formText.trim();
    if (!titulo) {
      showToast("Required field", "Write the note title before saving.", "error");
      return;
    }
    if (!nota) {
      showToast("Required field", "Write the note text before saving.", "error");
      return;
    }

    setCreating(true);
    try {
      const created = await createNote({ titulo, nota });
      setNotes((prev) => [created, ...prev.filter((note) => note.id !== created.id)]);
      setModalOpen(false);
      setFormTitle("");
      setFormText("");
      showToast("Note created", "The note was saved successfully.");
    } catch (err) {
      console.error("Failed to create note", err);
      showToast("Error saving", "Unable to create note.", "error");
    } finally {
      setCreating(false);
    }
  };

  const openEditor = async (note: Note) => {
    setOpeningId(note.id);
    try {
      const fullNote = await getNote(note.id);
      setModalMode("edit");
      setEditingNote(fullNote);
      setFormTitle(fullNote.titulo ?? "");
      setFormText(fullNote.nota ?? "");
      setModalOpen(true);
    } catch (err) {
      console.error("Failed to open note", err);
      showToast("Error opening", "Unable to fetch the selected note.", "error");
    } finally {
      setOpeningId(null);
    }
  };

  const openPreview = async (note: Note) => {
    setViewingId(note.id);
    try {
      const fullNote = await getNote(note.id);
      setPreviewNote(fullNote);
      setPreviewOpen(true);
    } catch (err) {
      console.error("Failed to open note preview", err);
      showToast("Error opening", "Unable to fetch the selected note.", "error");
    } finally {
      setViewingId(null);
    }
  };

  const handleUpdate = async () => {
    if (!editingNote) {
      return;
    }
    const titulo = formTitle.trim();
    const nota = formText.trim();
    if (!titulo) {
      showToast("Required field", "Note title cannot be empty.", "error");
      return;
    }
    if (!nota) {
      showToast("Required field", "Note text cannot be empty.", "error");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateNote(editingNote.id, { titulo, nota });
      setNotes((prev) => prev.map((note) => (note.id === updated.id ? updated : note)));
      setEditingNote(updated);
      setFormTitle(updated.titulo ?? "");
      setFormText(updated.nota ?? "");
      setModalOpen(false);
      showToast("Note updated", "Changes saved successfully.");
    } catch (err) {
      console.error("Failed to update note", err);
      showToast("Error saving", "Unable to update note.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (isChecking || !token) {
    return null;
  }

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadNotes("refresh")} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <HStack className="items-center justify-between gap-3 mb-6">
            <Box className="flex-1">
              <Heading
                size="2xl"
                className="text-typography-900 dark:text-[#E8EBF0] web:text-4xl"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                Notes
              </Heading>
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8] mt-1">
                {notes.length} {notes.length === 1 ? "note" : "notes"}
              </Text>
            </Box>
            <Button className="rounded-xl gap-2" onPress={openCreateModal}>
              <ButtonIcon as={Plus} />
              <ButtonText>Create Note</ButtonText>
            </Button>
            <Button
              variant="outline"
              action="secondary"
              className="rounded-xl gap-2 dark:border-[#2A3B52]"
              onPress={() => loadNotes("refresh")}
              isDisabled={refreshing || loading}
            >
              {refreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCw} />}
              <ButtonText>Refresh</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            <Box className="rounded-2xl border border-outline-100 bg-background-0 p-8 shadow-soft-2 dark:border-[#2A3B52] dark:bg-[#0E1524]">
              <Text className="text-center text-typography-600 dark:text-[#8A94A8]">Loading notes...</Text>
            </Box>
          ) : notes.length === 0 ? (
            <Box className="rounded-2xl border border-outline-100 bg-background-0 p-8 shadow-soft-2 dark:border-[#2A3B52] dark:bg-[#0E1524] web:p-12">
              <VStack className="gap-4 items-center justify-center">
                <Box className="w-20 h-20 rounded-full bg-background-50 dark:bg-[#1A2637] items-center justify-center web:w-24 web:h-24">
                  <Icon as={FileText} size="xl" className="text-typography-400 dark:text-typography-600" />
                </Box>
                <VStack className="gap-2 items-center">
                  <Heading
                    size="lg"
                    className="text-typography-900 dark:text-[#E8EBF0] text-center web:text-2xl"
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    No notes yet
                  </Heading>
                  <Text className="text-typography-600 dark:text-[#8A94A8] text-center text-sm web:text-base max-w-md">
                    Created notes will appear here.
                  </Text>
                </VStack>
              </VStack>
            </Box>
          ) : (
            <Box
              className="flex-row flex-wrap"
              style={{ gap: cardGap }}
            >
              {notes.map((note) => (
                <Box
                  key={note.id}
                  className="rounded-xl border border-outline-100 bg-background-0 p-4 shadow-soft-1 dark:border-[#2A3B52] dark:bg-[#0E1524]"
                  style={{ width: cardSize, height: cardSize }}
                >
                  <VStack className="h-full justify-between gap-3">
                    <VStack className="gap-2 flex-1">
                      <Box className="flex-1">
                        <Heading
                          size="sm"
                          numberOfLines={2}
                          className="text-typography-900 dark:text-[#E8EBF0]"
                        >
                          {note.titulo || `Note #${note.id}`}
                        </Heading>
                        <Text
                          numberOfLines={4}
                          className="text-sm text-typography-600 dark:text-[#8A94A8] mt-2"
                        >
                          {summarizeNote(note.nota) || "Empty note"}
                        </Text>
                      </Box>
                    </VStack>
                    <HStack className="items-center justify-between gap-2">
                      <Text className="text-xs text-typography-500 dark:text-[#6F7A8D]">
                        {countLines(note.nota)} {countLines(note.nota) === 1 ? "line" : "lines"}
                      </Text>
                      <HStack className="gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          action="secondary"
                          className="rounded-lg gap-2 dark:border-[#2A3B52]"
                          onPress={() => openPreview(note)}
                          isDisabled={viewingId === note.id}
                        >
                          {viewingId === note.id ? <ButtonSpinner /> : <ButtonIcon as={Eye} />}
                          <ButtonText>Ver</ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          action="secondary"
                          className="rounded-lg gap-2 dark:border-[#2A3B52]"
                          onPress={() => openEditor(note)}
                          isDisabled={openingId === note.id}
                        >
                          {openingId === note.id ? <ButtonSpinner /> : <ButtonIcon as={Edit3} />}
                          <ButtonText>Edit</ButtonText>
                        </Button>
                      </HStack>
                    </HStack>
                  </VStack>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </ScrollView>

      <Modal isOpen={modalOpen} onClose={closeModal} size="lg">
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent
          className="overflow-hidden bg-background-0 dark:bg-[#1E1E1E] rounded-xl border border-outline-200 dark:border-[#3C3C3C] shadow-soft-2"
          style={{ width: modalWidth, maxHeight: modalMaxHeight }}
        >
          <ModalHeader className="h-12 flex-row items-center justify-between gap-3 px-3 py-0 border-b border-outline-100 bg-background-50 dark:border-[#333333] dark:bg-[#252526]">
            <HStack className="items-center gap-2 flex-1">
              <Box className="w-3 h-3 rounded-full bg-[#EF4444]" />
              <Box className="w-3 h-3 rounded-full bg-[#F59E0B]" />
              <Box className="w-3 h-3 rounded-full bg-[#22C55E]" />
              <Box className="ml-3 rounded-t-md border border-b-0 border-outline-100 bg-background-0 px-3 py-2 dark:border-[#3C3C3C] dark:bg-[#1E1E1E]">
                <Text
                  className="text-xs font-semibold text-typography-700 dark:text-[#D4D4D4]"
                  numberOfLines={1}
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  {modalMode === "create" ? "new-note.md" : `${formTitle || "note"}.md`}
                </Text>
              </Box>
            </HStack>
            <ModalCloseButton className="rounded-md border border-outline-100 bg-background-0 dark:border-[#3C3C3C] dark:bg-[#1E1E1E]" />
          </ModalHeader>
          <ModalBody className="p-0">
            <VStack className="gap-0">
              <Box className="border-b border-outline-100 bg-background-0 px-5 py-4 dark:border-[#333333] dark:bg-[#1E1E1E]">
                <Input className="h-12 rounded-md border-outline-100 bg-background-50 dark:border-[#3C3C3C] dark:bg-[#252526]" size="lg">
                  <InputField
                    value={formTitle}
                    onChangeText={setFormTitle}
                    placeholder="Note title"
                    className="text-lg text-typography-900 dark:text-[#D4D4D4]"
                  />
                </Input>
              </Box>
              <Textarea
                className="rounded-none border-0 bg-background-0 dark:bg-[#1E1E1E]"
                style={{ height: editorHeight }}
              >
                <TextareaInput
                  value={formText}
                  onChangeText={setFormText}
                  placeholder="# Write markdown here..."
                  multiline
                  className="px-5 py-4 font-mono text-sm leading-6 text-typography-900 dark:text-[#D4D4D4]"
                />
              </Textarea>
            </VStack>
          </ModalBody>
          <ModalFooter className="h-12 flex-row items-center justify-between gap-3 px-4 py-0 border-t border-outline-100 bg-background-50 dark:border-[#333333] dark:bg-[#007ACC]">
            <HStack className="items-center gap-4">
              <Text className="text-xs text-typography-600 dark:text-white">
                {modalMode === "create" ? "Create" : `Note #${editingNote?.id ?? ""}`}
              </Text>
              <Text className="text-xs text-typography-600 dark:text-white">
                Lines {countLines(formText)}
              </Text>
              <Text className="text-xs text-typography-600 dark:text-white">
                Markdown
              </Text>
            </HStack>
            <HStack className="gap-2">
              <Button variant="outline" action="secondary" size="sm" className="rounded-md gap-2 dark:border-white/60" onPress={closeModal}>
                <ButtonIcon as={X} />
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button
                size="sm"
                className="rounded-md gap-2 bg-background-950 dark:bg-white"
                onPress={modalMode === "create" ? handleCreate : handleUpdate}
                isDisabled={creating || saving}
              >
                {creating || saving ? <ButtonSpinner /> : <ButtonIcon as={Save} className="dark:text-[#1E1E1E]" />}
                <ButtonText className="dark:text-[#1E1E1E]">
                  {modalMode === "create" ? "Create Note" : "Save Changes"}
                </ButtonText>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={previewOpen} onClose={closePreview} size="lg">
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent
          className="overflow-hidden bg-background-0 dark:bg-[#1E1E1E] rounded-xl border border-outline-200 dark:border-[#3C3C3C] shadow-soft-2"
          style={{ width: modalWidth, maxHeight: modalMaxHeight }}
        >
          <ModalHeader className="h-12 flex-row items-center justify-between gap-3 px-3 py-0 border-b border-outline-100 bg-background-50 dark:border-[#333333] dark:bg-[#252526]">
            <HStack className="items-center gap-2 flex-1">
              <Box className="w-3 h-3 rounded-full bg-[#EF4444]" />
              <Box className="w-3 h-3 rounded-full bg-[#F59E0B]" />
              <Box className="w-3 h-3 rounded-full bg-[#22C55E]" />
              <Box className="ml-3 rounded-t-md border border-b-0 border-outline-100 bg-background-0 px-3 py-2 dark:border-[#3C3C3C] dark:bg-[#1E1E1E]">
                <Text
                  className="text-xs font-semibold text-typography-700 dark:text-[#D4D4D4]"
                  numberOfLines={1}
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  {`${previewNote?.titulo || "note"}.preview.md`}
                </Text>
              </Box>
            </HStack>
            <ModalCloseButton className="rounded-md border border-outline-100 bg-background-0 dark:border-[#3C3C3C] dark:bg-[#1E1E1E]" />
          </ModalHeader>
          <ModalBody className="p-0">
            <Box className="border-b border-outline-100 bg-background-0 px-5 py-4 dark:border-[#333333] dark:bg-[#1E1E1E]">
              <Heading size="lg" className="text-typography-900 dark:text-[#D4D4D4]">
                {previewNote?.titulo || "Note"}
              </Heading>
            </Box>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: previewHeight }}>
              <Box className="px-5 py-5">
                <MarkdownPreview value={previewNote?.nota ?? ""} />
              </Box>
            </ScrollView>
          </ModalBody>
          <ModalFooter className="h-12 flex-row items-center justify-between gap-3 px-4 py-0 border-t border-outline-100 bg-background-50 dark:border-[#333333] dark:bg-[#007ACC]">
            <HStack className="items-center gap-4">
              <Text className="text-xs text-typography-600 dark:text-white">
                Preview
              </Text>
              <Text className="text-xs text-typography-600 dark:text-white">
                Lines {countLines(previewNote?.nota ?? "")}
              </Text>
              <Text className="text-xs text-typography-600 dark:text-white">
                Markdown
              </Text>
            </HStack>
            <HStack className="gap-2">
              <Button variant="outline" action="secondary" size="sm" className="rounded-md gap-2 dark:border-white/60" onPress={closePreview}>
                <ButtonIcon as={X} />
                <ButtonText>Close</ButtonText>
              </Button>
              {previewNote ? (
                <Button
                  size="sm"
                  className="rounded-md gap-2 bg-background-950 dark:bg-white"
                  onPress={() => {
                    const note = previewNote;
                    closePreview();
                    openEditor(note);
                  }}
                >
                  <ButtonIcon as={Edit3} className="dark:text-[#1E1E1E]" />
                  <ButtonText className="dark:text-[#1E1E1E]">Edit</ButtonText>
                </Button>
              ) : null}
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
