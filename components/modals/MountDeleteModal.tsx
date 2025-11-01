import React from "react";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {Box} from "@/components/ui/box";
import {Button, ButtonSpinner, ButtonText} from "@/components/ui/button";
import {Heading} from "@/components/ui/heading";
import {Icon, TrashIcon} from "@/components/ui/icon";
import {Text} from "@/components/ui/text";

export type MountDeleteModalProps = {
  isOpen: boolean;
  isDeleting: boolean;
  machineName: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
};

export function MountDeleteModal({
  isOpen,
  isDeleting,
  machineName,
  onClose,
  onConfirm,
}: MountDeleteModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalBackdrop className="bg-background-950/50 dark:bg-black/70" />
      <ModalContent className="max-w-[320px] items-center web:max-w-[440px] web:items-stretch web:p-7 dark:bg-[#0E1524] rounded-2xl border border-outline-100 dark:border-[#2A3B52]">
        <ModalHeader className="pt-2">
          <Box className="w-[64px] h-[64px] rounded-full bg-background-error dark:bg-[#EF444425] items-center justify-center web:mx-auto web:w-[72px] web:h-[72px] border-2 border-error-200 dark:border-error-800">
            <Icon
              as={TrashIcon}
              className="stroke-error-600 dark:stroke-[#F87171]"
              size="xl"
            />
          </Box>
        </ModalHeader>
        <ModalBody className="mt-4 mb-6 web:mt-6 web:mb-8">
          <Heading
            size="md"
            className="text-typography-950 dark:text-[#E8EBF0] mb-3 text-center web:text-2xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            Delete {machineName}
          </Heading>
          <Text className="text-typography-500 dark:text-[#8A94A8] text-center text-sm web:text-base leading-relaxed">
            Are you sure you want to delete this mount? This action cannot be undone and all
            associated data will be permanently removed.
          </Text>
        </ModalBody>
        <ModalFooter className="w-full web:gap-4 gap-3">
          <Button
            variant="outline"
            action="secondary"
            size="md"
            onPress={onClose}
            className="flex-grow web:flex-grow-0 web:w-1/2 web:px-6 h-11 web:h-12 rounded-xl dark:border-[#2A3B52] dark:bg-transparent dark:hover:bg-[#1A2637]"
          >
            <ButtonText
              className="web:text-base dark:text-[#E8EBF0] font-semibold"
              style={{fontFamily: "Inter_600SemiBold"}}
            >
              Cancel
            </ButtonText>
          </Button>
          {!isDeleting ? (
            <Button
              onPress={onConfirm}
              size="md"
              action="negative"
              className="flex-grow web:flex-grow-0 web:w-1/2 web:px-6 h-11 web:h-12 rounded-xl dark:bg-[#EF4444] dark:hover:bg-[#F87171] dark:active:bg-[#DC2626]"
            >
              <ButtonText
                className="web:text-base font-semibold"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                Delete
              </ButtonText>
            </Button>
          ) : (
            <Button
              className="p-3 web:w-1/2 h-11 web:h-12 rounded-xl dark:bg-[#2A3B52]"
              isDisabled
            >
              <ButtonSpinner color="gray" />
              <ButtonText
                className="font-semibold text-sm ml-2 web:text-base dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                Removing...
              </ButtonText>
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
