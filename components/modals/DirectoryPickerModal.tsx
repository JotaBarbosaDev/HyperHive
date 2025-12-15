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
  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <ModalBackdrop className="bg-background-950/50 dark:bg-black/70" />
      <ModalContent className="w-full max-w-[520px] web:max-w-[560px] p-5 web:p-6 rounded-2xl dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52] shadow-xl">
        <ModalHeader className="pb-3 border-b border-outline-100 dark:border-[#2A3B52]">
          <Heading
            size="md"
            className="web:text-2xl text-typography-900 dark:text-[#E8EBF0]"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            Choose directory
          </Heading>
        </ModalHeader>
        <ModalBody className="pt-2 max-h-[60vh] overflow-y-auto pr-1 web:pr-2">
          {isLoading ? (
            <VStack className="items-center justify-center py-6 gap-3">
              <Spinner color="#2DD4BF" />
              <Text className="text-typography-500 dark:text-[#8A94A8] text-sm web:text-base">
                Loading directories...
              </Text>
            </VStack>
          ) : directories.length === 0 ? (
            <Text className="text-typography-500 dark:text-[#8A94A8] text-sm web:text-base text-center py-6">
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
                    action="primary"
                    className={`justify-start web:px-4 h-11 web:h-11 rounded-xl transition-all ${isSelected
                      ? "bg-[#2DD4BF] border-[#2DD4BF] dark:bg-[#2DD4BF] dark:border-[#2DD4BF]"
                      : "bg-background-0 dark:bg-[#0E1524] dark:border-[#2A3B52] hover:web:bg-background-100 dark:hover:web:bg-[#1A2637]"
                      }`}
                    onPress={() => onSelect(dir)}
                  >
                    <ButtonText
                      className={`text-sm web:text-base ${isSelected ? "text-[#0D1420] dark:text-[#0D1420] font-semibold" : "text-typography-900 dark:text-[#E8EBF0]"
                        }`}
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
        <ModalFooter className="gap-3 web:gap-4 pt-3 border-t border-outline-100 dark:border-[#2A3B52] mt-3">
          <Button
            variant="outline"
            onPress={onCancel}
            className="flex-1 web:px-5 h-11 web:h-11 rounded-xl dark:border-[#2A3B52] hover:web:bg-background-100 dark:hover:web:bg-[#1A2637]"
          >
            <ButtonText
              className="web:text-base dark:text-[#E8EBF0] font-semibold"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              Cancel
            </ButtonText>
          </Button>
          <Button
            variant="outline"
            onPress={onOk ?? onCancel}
            className="flex-1 web:px-5 h-11 web:h-11 rounded-xl border-outline-200 dark:border-[#2A3B52] hover:web:bg-background-100 dark:hover:web:bg-[#1A2637]"
          >
            <ButtonText
              className="web:text-base dark:text-[#E8EBF0] font-semibold"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              OK
            </ButtonText>
          </Button>
          <Button
            action="primary"
            onPress={onConfirm}
            isDisabled={isLoading || directories.length === 0 || !selectedDirectory}
            className="flex-1 web:px-5 h-11 web:h-11 rounded-xl dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4]"
          >
            <ButtonText
              className="web:text-base dark:text-[#0D1420] font-semibold"
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
