import React from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
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
import { VStack } from "@/components/ui/vstack";
import { Note } from "@/types/notes";
import { noteLineCount } from "@/utils/note-preview";
import { FilePenLine, X } from "lucide-react-native";

type NoteEditorModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  note: Note | null;
  saving: boolean;
  width: number;
  maxHeight: number;
  onClose: () => void;
  onSave: (title: string, text: string) => void;
};

export function NoteEditorModal({
  isOpen,
  mode,
  note,
  saving,
  width,
  maxHeight,
  onClose,
  onSave,
}: NoteEditorModalProps) {
  const [title, setTitle] = React.useState(note?.titulo ?? "");
  const [text, setText] = React.useState(note?.nota ?? "");
  const [validationError, setValidationError] = React.useState("");
  const editorHeight = Math.max(maxHeight - 278, 240);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const trimmedText = text.trim();
    if (!trimmedTitle) {
      setValidationError("Add a title before saving this note.");
      return;
    }
    if (!trimmedText) {
      setValidationError("Write something in the note before saving.");
      return;
    }
    setValidationError("");
    onSave(trimmedTitle, trimmedText);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
      <ModalContent
        className="overflow-hidden rounded-2xl border border-outline-100 bg-background-0 p-0 shadow-soft-3 dark:border-[#263349] dark:bg-[#0E1524]"
        style={{ width, maxHeight }}
      >
        <ModalHeader className="border-b border-outline-100 px-5 py-5 dark:border-[#263349]">
          <HStack className="flex-1 items-center gap-3">
            <Box className="h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-[#15253A]">
              <Icon as={FilePenLine} size="md" className="text-primary-600 dark:text-[#8DB7FF]" />
            </Box>
            <VStack className="flex-1 gap-1">
              <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
                {mode === "create" ? "New note" : "Edit note"}
              </Heading>
              <Text className="text-xs text-typography-500 dark:text-[#96A2B8]">
                Write and format with Markdown
              </Text>
            </VStack>
            <ModalCloseButton
              accessibilityLabel="Close note editor"
              className="rounded-lg border border-outline-100 bg-background-0 p-2 dark:border-[#34445D] dark:bg-[#131E30]"
            >
              <Icon as={X} size="sm" className="text-typography-500 dark:text-[#D7DCE5]" />
            </ModalCloseButton>
          </HStack>
        </ModalHeader>

        <ModalBody className="p-0">
          <VStack className="gap-0">
            <Box className="border-b border-outline-100 px-5 py-4 dark:border-[#263349]">
              <Text className="mb-1 text-xs font-medium text-typography-600 dark:text-[#AAB5C7]">Title</Text>
              <Input className="h-10 rounded-none border-0 bg-transparent" size="lg">
                <InputField
                  aria-label="Note title"
                  accessibilityLabel="Note title"
                  value={title}
                  onChangeText={(value) => {
                    setTitle(value);
                    if (validationError) setValidationError("");
                  }}
                  placeholder="Give your note a clear title"
                  className="px-0 text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]"
                />
              </Input>
            </Box>
            <Box className="px-5 pt-4">
              <Text className="text-xs font-medium text-typography-600 dark:text-[#AAB5C7]">Note</Text>
            </Box>
            <Textarea
              className="rounded-none border-0 bg-background-0 dark:bg-[#0E1524]"
              style={{ height: editorHeight }}
            >
              <TextareaInput
                aria-label="Note content"
                accessibilityLabel="Note content"
                value={text}
                onChangeText={(value) => {
                  setText(value);
                  if (validationError) setValidationError("");
                }}
                placeholder="# Start writing...\n\nUse Markdown for headings, lists, quotes, and code."
                multiline
                scrollEnabled
                className="px-5 py-3 font-mono text-sm leading-6 text-typography-900 dark:text-[#E8EBF0]"
              />
            </Textarea>
          </VStack>
        </ModalBody>

        <ModalFooter className="flex-row flex-wrap items-center justify-between gap-3 border-t border-outline-100 px-5 py-4 dark:border-[#263349] dark:bg-[#0B1220]">
          <VStack className="gap-1">
            <Text className="text-xs text-typography-500 dark:text-[#96A2B8]">
              {noteLineCount(text)} {noteLineCount(text) === 1 ? "line" : "lines"} · {text.length} characters
            </Text>
            {validationError ? (
              <Text className="text-xs text-error-600 dark:text-[#FCA5A5]">{validationError}</Text>
            ) : null}
          </VStack>
          <HStack className="gap-2">
            <Button variant="outline" action="secondary" className="rounded-xl dark:border-[#34445D]" onPress={onClose} isDisabled={saving}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button className="gap-2 rounded-xl" onPress={handleSave} isDisabled={saving}>
              {saving ? <ButtonSpinner /> : null}
              <ButtonText>{mode === "create" ? "Create note" : "Save changes"}</ButtonText>
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
