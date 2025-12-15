import React from "react";
import {
	Modal,
	ModalBackdrop,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
	ModalCloseButton,
} from "@/components/ui/modal";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react-native";

export type ConfirmDialogProps = {
	isOpen: boolean;
	title: string;
	description?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onClose: () => void;
	bodyContent?: React.ReactNode;
};

export function ConfirmDialog({
	isOpen,
	title,
	description,
	confirmLabel = "Delete",
	cancelLabel = "Cancel",
	onConfirm,
	onClose,
	bodyContent,
}: ConfirmDialogProps) {
	return (
		<Modal isOpen={isOpen} onClose={onClose} size="md">
			<ModalBackdrop />
			<ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
				<ModalHeader className="flex-row items-center gap-3">
					<Button size="sm" variant="outline" action="negative" className="rounded-xl" isDisabled>
						<ButtonIcon as={AlertTriangle} />
					</Button>
					<Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">
						{title}
					</Heading>
					<ModalCloseButton onPress={onClose} />
				</ModalHeader>
				<ModalBody>
					{description ? (
						<Text className="text-typography-600 dark:text-typography-400">{description}</Text>
					) : null}
					{bodyContent ? <>{bodyContent}</> : null}
				</ModalBody>
				<ModalFooter className="flex-row gap-3">
					<Button variant="outline" action="secondary" className="flex-1 rounded-xl" onPress={onClose}>
						<ButtonText>{cancelLabel}</ButtonText>
					</Button>
					<Button action="negative" className="flex-1 rounded-xl" onPress={onConfirm}>
						<ButtonText>{confirmLabel}</ButtonText>
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export default ConfirmDialog;
