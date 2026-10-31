import React from "react";
import { RefreshControl, ScrollView, useWindowDimensions } from "react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
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
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { VStack } from "@/components/ui/vstack";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import { NoteEditorModal } from "@/components/notes/note-editor-modal";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "@/services/notes";
import { Note } from "@/types/notes";
import { noteLineCount, noteMatches, notePlainExcerpt } from "@/utils/note-preview";
import {
  AlertTriangle,
  Edit3,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Trash2,
  X,
} from "lucide-react-native";

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
        <Text className="font-mono text-sm leading-6 text-typography-800 dark:text-[#D7DCE5] web:break-words">
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
        <Box key={`quote-${index}`} className="border-l-2 border-outline-300 pl-3 dark:border-[#40516B]">
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
          <Text className="text-base leading-7 text-typography-500 dark:text-[#96A2B8]">-</Text>
          <Text className="flex-1 text-base leading-7 text-typography-800 dark:text-[#D7DCE5]">
            {renderInlineMarkdown(listMatch[1])}
          </Text>
        </HStack>
      );
      return;
    }

    nodes.push(
      <Text key={`paragraph-${index}`} className="text-base leading-7 text-typography-800 dark:text-[#D7DCE5] web:break-words">
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
  const toastRef = React.useRef(toast);
  toastRef.current = toast;
  const { width, height } = useWindowDimensions();
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [search, setSearch] = React.useState("");
  const visibleNotes = React.useMemo(() => notes.filter((note) => noteMatches(note, search)), [notes, search]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [openingId, setOpeningId] = React.useState<number | null>(null);
  const [viewingId, setViewingId] = React.useState<number | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"create" | "edit">("create");
  const [editingNote, setEditingNote] = React.useState<Note | null>(null);
  const [previewNote, setPreviewNote] = React.useState<Note | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Note | null>(null);

  const [gridWidth, setGridWidth] = React.useState(0);
  const contentWidth = gridWidth || Math.min(Math.max(width - 32, 0), 1184);
  const columns = contentWidth >= 1000 ? 3 : contentWidth >= 640 ? 2 : 1;
  const cardGap = 16;
  const cardSize = Math.floor((contentWidth - cardGap * (columns - 1)) / columns);
  const modalWidth = Math.min(Math.max(width - 24, 280), 920);
  const modalMaxHeight = Math.min(Math.max(height - 32, 520), 840);
  const previewHeight = Math.max(modalMaxHeight - 190, 300);

  const showToast = React.useCallback(
    (title: string, description: string, action: "success" | "error" = "success") => {
      toastRef.current.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="flex-row items-start gap-3 rounded-xl px-5 py-3 shadow-soft-1"
            action={action}
          >
            <ToastTitle size="sm">{title}</ToastTitle>
            {description ? <ToastDescription size="sm">{description}</ToastDescription> : null}
          </Toast>
        ),
      });
    },
    []
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
    setModalOpen(true);
  };

  const closeModal = () => {
    if (creating || saving) return;
    setModalOpen(false);
    setEditingNote(null);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewNote(null);
  };

  const handleCreate = async (titulo: string, nota: string) => {
    setCreating(true);
    try {
      const created = await createNote({ titulo, nota });
      setNotes((prev) => [created, ...prev.filter((note) => note.id !== created.id)]);
      setModalOpen(false);
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

  const handleUpdate = async (titulo: string, nota: string) => {
    if (!editingNote) {
      return;
    }

    setSaving(true);
    try {
      const updated = await updateNote(editingNote.id, { titulo, nota });
      setNotes((prev) => prev.map((note) => (note.id === updated.id ? updated : note)));
      setEditingNote(updated);
      setModalOpen(false);
      showToast("Note updated", "Changes saved successfully.");
    } catch (err) {
      console.error("Failed to update note", err);
      showToast("Error saving", "Unable to update note.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeletingId(deleteTarget.id);
    try {
      await deleteNote(deleteTarget.id);
      setNotes((current) => current.filter((note) => note.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("Note deleted", "The note was deleted successfully.");
    } catch (err) {
      console.error("Failed to delete note", err);
      showToast("Error deleting", "Unable to delete the note.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  if (isChecking || !token) {
    return null;
  }

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19]">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadNotes("refresh")} />}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        <Box className="w-full p-4 pt-10 web:mx-auto web:max-w-7xl web:p-10">
          <VStack className="gap-6">
            <HStack className="flex-wrap items-center justify-between gap-4">
              <VStack className="min-w-[220px] flex-1 gap-2">
                <Heading
                  size="2xl"
                  className="text-typography-900 dark:text-[#E8EBF0] web:text-4xl"
                  style={{ fontFamily: "Inter_700Bold" }}
                >
                  Notes
                </Heading>
                <Text className="text-sm leading-5 text-typography-600 dark:text-[#96A2B8]">
                  A quiet place for ideas, commands, and decisions.
                </Text>
              </VStack>
              <HStack className="gap-2">
                <Button
                  variant="outline"
                  action="secondary"
                  className="rounded-xl px-3 dark:border-[#34445D] dark:bg-[#0E1524]"
                  onPress={() => loadNotes("refresh")}
                  isDisabled={refreshing || loading}
                  accessibilityLabel="Refresh notes"
                >
                  {refreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCw} />}
                </Button>
                <Button className="gap-2 rounded-xl" onPress={openCreateModal}>
                  <ButtonIcon as={Plus} />
                  <ButtonText>New note</ButtonText>
                </Button>
              </HStack>
            </HStack>

            <HStack className="flex-wrap items-center gap-3">
              <Input className="h-12 min-w-[220px] flex-1 rounded-xl border-outline-200 bg-background-0 dark:border-[#34445D] dark:bg-[#0E1524]" size="md">
                <InputSlot className="pl-3">
                  <InputIcon as={Search} className="text-typography-400 dark:text-[#8190A8]" />
                </InputSlot>
                <InputField
                  aria-label="Search notes"
                  accessibilityLabel="Search notes"
                  placeholder="Search titles and content"
                  value={search}
                  onChangeText={setSearch}
                  className="text-sm dark:text-[#E8EBF0]"
                />
                {search ? (
                  <InputSlot className="pr-3" onPress={() => setSearch("")} accessibilityLabel="Clear search">
                    <InputIcon as={X} className="text-typography-400 dark:text-[#96A2B8]" />
                  </InputSlot>
                ) : null}
              </Input>
              <Text className="text-xs text-typography-500 dark:text-[#96A2B8]" style={{ fontVariant: ["tabular-nums"] }}>
                {search ? `${visibleNotes.length} of ${notes.length}` : notes.length} {notes.length === 1 && !search ? "note" : "notes"}
              </Text>
            </HStack>

            {loading && notes.length === 0 ? (
              <Box className="items-center rounded-2xl border border-outline-100 bg-background-0 p-12 dark:border-[#263349] dark:bg-[#0E1524]">
                <Text className="text-sm text-typography-600 dark:text-[#96A2B8]">Loading your notes…</Text>
              </Box>
            ) : notes.length === 0 ? (
              <Box className="rounded-2xl border border-outline-100 bg-background-0 p-8 dark:border-[#263349] dark:bg-[#0E1524] web:p-12">
                <VStack className="items-center justify-center gap-5">
                  <Box className="h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 dark:bg-[#15253A]">
                    <Icon as={FileText} size="xl" className="text-primary-600 dark:text-[#8DB7FF]" />
                  </Box>
                  <VStack className="items-center gap-2">
                    <Heading size="lg" className="text-center text-typography-900 dark:text-[#E8EBF0]">
                      No notes yet
                    </Heading>
                    <Text className="max-w-md text-center text-sm leading-6 text-typography-600 dark:text-[#96A2B8]">
                      Create your first note to keep ideas, commands, and decisions in one place.
                    </Text>
                  </VStack>
                  <Button className="gap-2 rounded-xl" onPress={openCreateModal}>
                    <ButtonIcon as={Plus} />
                    <ButtonText>Create your first note</ButtonText>
                  </Button>
                </VStack>
              </Box>
            ) : visibleNotes.length === 0 ? (
              <Box className="items-center rounded-2xl border border-outline-100 bg-background-0 p-10 dark:border-[#263349] dark:bg-[#0E1524]">
                <VStack className="items-center gap-4">
                  <Icon as={SearchX} size="xl" className="text-typography-400 dark:text-[#8190A8]" />
                  <VStack className="items-center gap-2">
                    <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">No matching notes</Heading>
                    <Text className="text-center text-sm text-typography-600 dark:text-[#96A2B8]">
                      Try a different title or phrase, or clear your search.
                    </Text>
                  </VStack>
                  <Button variant="outline" action="secondary" className="rounded-xl dark:border-[#34445D]" onPress={() => setSearch("")}>
                    <ButtonText>Clear search</ButtonText>
                  </Button>
                </VStack>
              </Box>
            ) : (
              <Box
                className="flex-row flex-wrap items-stretch"
                onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
                style={{ gap: cardGap, width: "100%" }}
              >
                {visibleNotes.map((note) => (
                  <Box
                    key={note.id}
                    className="overflow-hidden rounded-2xl border border-outline-200 bg-background-0 dark:border-[#263349] dark:bg-[#0E1524] web:hover:border-outline-300 dark:web:hover:border-[#40516B]"
                    style={{ width: cardSize, maxWidth: "100%" }}
                  >
                    <VStack className="flex-1">
                      <Box className="flex-1 p-5">
                        <HStack className="items-start justify-between gap-3">
                          <Heading size="md" numberOfLines={2} className="flex-1 leading-6 text-typography-900 dark:text-[#E8EBF0]">
                            {note.titulo || `Note #${note.id}`}
                          </Heading>
                          <Button
                            size="sm"
                            variant="link"
                            action="secondary"
                            className="-mr-2 -mt-2 px-2"
                            onPress={() => setDeleteTarget(note)}
                            isDisabled={deletingId !== null}
                            accessibilityLabel={`Delete ${note.titulo || `note ${note.id}`}`}
                          >
                            <ButtonIcon as={Trash2} className="text-typography-400 dark:text-[#8190A8]" />
                          </Button>
                        </HStack>
                        <Box className="mt-4 h-[120px]">
                          <Text numberOfLines={5} className="text-sm leading-6 text-typography-600 dark:text-[#AAB5C7]">
                            {notePlainExcerpt(note.nota) || "Empty note"}
                          </Text>
                        </Box>
                      </Box>
                      <HStack className="items-center justify-between gap-2 border-t border-outline-100 px-4 py-2 dark:border-[#263349] dark:bg-[#0B1220]">
                        <Text className="text-xs text-typography-500 dark:text-[#96A2B8]" style={{ fontVariant: ["tabular-nums"] }}>
                          {noteLineCount(note.nota)} {noteLineCount(note.nota) === 1 ? "line" : "lines"}
                        </Text>
                        <HStack className="gap-1">
                          <Button
                            size="sm"
                            variant="link"
                            action="secondary"
                            className="gap-1 px-2"
                            onPress={() => openPreview(note)}
                            isDisabled={viewingId === note.id}
                          >
                            {viewingId === note.id ? <ButtonSpinner /> : <ButtonIcon as={Eye} />}
                            <ButtonText>View</ButtonText>
                          </Button>
                          <Button
                            size="sm"
                            variant="link"
                            className="gap-1 px-2"
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
          </VStack>
        </Box>
      </ScrollView>

      <NoteEditorModal
        key={`${modalOpen ? "open" : "closed"}-${modalMode}-${editingNote?.id ?? "new"}`}
        isOpen={modalOpen}
        mode={modalMode}
        note={editingNote}
        saving={creating || saving}
        width={modalWidth}
        maxHeight={modalMaxHeight}
        onClose={closeModal}
        onSave={modalMode === "create" ? handleCreate : handleUpdate}
      />

      <AlertDialog
        isOpen={deleteTarget !== null}
        onClose={() => {
          if (deletingId === null) setDeleteTarget(null);
        }}
        size="md"
      >
        <AlertDialogBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <AlertDialogContent className="rounded-2xl border border-outline-100 dark:border-[#263349] dark:bg-[#0E1524]">
          <AlertDialogHeader>
            <HStack className="items-center gap-3">
              <Box className="h-10 w-10 items-center justify-center rounded-xl bg-error-50 dark:bg-[#3A1820]">
                <AlertTriangle size={20} color="#EF4444" />
              </Box>
              <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
                Delete note?
              </Heading>
            </HStack>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-sm leading-6 text-typography-600 dark:text-[#AAB5C7]">
              This will permanently delete “{deleteTarget?.titulo || `Note #${deleteTarget?.id}`}”. This action cannot be undone.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-2">
            <Button variant="outline" action="secondary" className="rounded-xl dark:border-[#34445D]" onPress={() => setDeleteTarget(null)} isDisabled={deletingId !== null}>
              <ButtonText>Keep note</ButtonText>
            </Button>
            <Button action="negative" className="gap-2 rounded-xl bg-red-500" onPress={handleDelete} isDisabled={deletingId !== null}>
              {deletingId !== null ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
              <ButtonText>Delete note</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal isOpen={previewOpen} onClose={closePreview} size="lg">
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent
          className="overflow-hidden rounded-2xl border border-outline-100 bg-background-0 p-0 shadow-soft-3 dark:border-[#263349] dark:bg-[#0E1524]"
          style={{ width: modalWidth, maxHeight: modalMaxHeight }}
        >
          <ModalHeader className="border-b border-outline-100 px-5 py-5 dark:border-[#263349]">
            <HStack className="flex-1 items-center gap-3">
              <Box className="h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-[#15253A]">
                <Icon as={Eye} size="md" className="text-primary-600 dark:text-[#8DB7FF]" />
              </Box>
              <VStack className="flex-1 gap-1">
                <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">Note preview</Heading>
                <Text className="text-xs text-typography-500 dark:text-[#96A2B8]">Formatted Markdown</Text>
              </VStack>
              <ModalCloseButton
                accessibilityLabel="Close note preview"
                className="rounded-lg border border-outline-100 bg-background-0 p-2 dark:border-[#34445D] dark:bg-[#131E30]"
              >
                <Icon as={X} size="sm" className="text-typography-500 dark:text-[#D7DCE5]" />
              </ModalCloseButton>
            </HStack>
          </ModalHeader>
          <ModalBody className="p-0">
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: previewHeight }} contentContainerStyle={{ flexGrow: 1 }}>
              <VStack className="gap-6 px-6 py-6">
                <Heading size="xl" className="text-typography-900 dark:text-[#E8EBF0]" style={{ fontFamily: "Inter_700Bold" }}>
                  {previewNote?.titulo || "Untitled note"}
                </Heading>
                {previewNote?.nota ? (
                  <MarkdownPreview value={previewNote.nota} />
                ) : (
                  <Text className="text-sm text-typography-500 dark:text-[#96A2B8]">This note is empty.</Text>
                )}
              </VStack>
            </ScrollView>
          </ModalBody>
          <ModalFooter className="flex-row flex-wrap items-center justify-between gap-3 border-t border-outline-100 px-5 py-4 dark:border-[#263349] dark:bg-[#0B1220]">
            <Text className="text-xs text-typography-500 dark:text-[#96A2B8]" style={{ fontVariant: ["tabular-nums"] }}>
              {noteLineCount(previewNote?.nota ?? "")} {noteLineCount(previewNote?.nota ?? "") === 1 ? "line" : "lines"} · Markdown
            </Text>
            <HStack className="gap-2">
              <Button variant="outline" action="secondary" className="rounded-xl dark:border-[#34445D]" onPress={closePreview}>
                <ButtonText>Close</ButtonText>
              </Button>
              {previewNote ? (
                <Button
                  className="gap-2 rounded-xl"
                  onPress={() => {
                    const note = previewNote;
                    closePreview();
                    openEditor(note);
                  }}
                >
                  <ButtonIcon as={Edit3} />
                  <ButtonText>Edit note</ButtonText>
                </Button>
              ) : null}
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
