import React from "react";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Spinner } from "@/components/ui/spinner";

export type DirectoryPickerModalProps = {
  isOpen: boolean;
  directories: string[];
  selectedDirectory: string | null;
  onSelect: (directory: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onOk?: () => void;
  isLoading?: boolean;
};

const getDirectoryLabel = (entry: string) => {
  const trimmed = entry.replace(/\/+$/g, "");
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? trimmed;
};

export function DirectoryPickerModal({
  isOpen,
  directories,
  selectedDirectory,
  onSelect,
  onCancel,
  onConfirm,
  onOk,
  isLoading = false,
}: DirectoryPickerModalProps) {
  const modalBackdropClass = "bg-background-950/60 dark:bg-black/70";
  const modalShellClass = "w-full rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1E2F47] dark:bg-[#0F1A2E]";
  const modalHeaderClass = "px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#1E2F47]";
  const modalBodyClass = "px-6 pt-3 pb-4 max-h-[60vh] overflow-y-auto";
  const modalFooterClass = "gap-3 px-6 pt-4 pb-6 border-t border-outline-100 dark:border-[#1E2F47]";
  const outlineButtonClass = "border-outline-200 rounded-xl dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] hover:bg-background-50 dark:hover:bg-[#0A1628]";
  const outlineButtonTextClass = "text-typography-900 dark:text-[#E8EBF0]";
  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <ModalBackdrop className={modalBackdropClass} />
      <ModalContent className={`w-full max-w-[520px] web:max-w-[560px] ${modalShellClass}`}>
        <ModalHeader className={modalHeaderClass}>
          <Heading
            size="md"
            className="web:text-2xl text-typography-900 dark:text-[#E8EBF0]"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            Choose directory
          </Heading>
        </ModalHeader>
        <ModalBody className={`${modalBodyClass} pr-1 web:pr-2`}>
          {isLoading ? (
            <VStack className="items-center justify-center py-6 gap-3">
              <Spinner className="text-primary-500" />
              <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm web:text-base">
                Loading directories...
              </Text>
            </VStack>
          ) : directories.length === 0 ? (
            <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm web:text-base text-center py-6">
              No directories available.
            </Text>
          ) : (
            <VStack className="gap-2 web:gap-2.5">
              {directories.map((dir) => {
                const isSelected = selectedDirectory === dir;
                const label = getDirectoryLabel(dir);
                return (
                  <Button
                    key={dir}
                    variant={isSelected ? "solid" : "outline"}
                    action={isSelected ? "primary" : "default"}
                    className={`justify-start web:px-4 h-11 web:h-11 rounded-xl ${isSelected ? "" : outlineButtonClass}`}
                    onPress={() => onSelect(dir)}
                  >
                    <ButtonText
                      className={`text-sm web:text-base ${isSelected ? "font-semibold" : outlineButtonTextClass}`}
                      style={{ fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular" }}
                    >
                      {label}
                    </ButtonText>
                  </Button>
                );
              })}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter className={`${modalFooterClass} web:gap-4`}>
          <Button
            variant="outline"
            onPress={onCancel}
            className={`flex-1 web:px-5 h-11 web:h-11 ${outlineButtonClass}`}
          >
            <ButtonText
              className={`web:text-base font-semibold ${outlineButtonTextClass}`}
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              Cancel
            </ButtonText>
          </Button>
          <Button
            variant="outline"
            onPress={onOk ?? onCancel}
            className={`flex-1 web:px-5 h-11 web:h-11 ${outlineButtonClass}`}
          >
            <ButtonText
              className={`web:text-base font-semibold ${outlineButtonTextClass}`}
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              OK
            </ButtonText>
          </Button>
          <Button
            action="primary"
            onPress={onConfirm}
            isDisabled={isLoading || directories.length === 0 || !selectedDirectory}
            className="flex-1 web:px-5 h-11 web:h-11 rounded-xl"
          >
            <ButtonText
              className="web:text-base font-semibold"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              Add
            </ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
