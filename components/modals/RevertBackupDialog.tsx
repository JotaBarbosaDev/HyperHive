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
import { VStack } from "@/components/ui/vstack";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Checkbox, CheckboxIndicator, CheckboxIcon, CheckboxLabel } from "@/components/ui/checkbox";
import { AlertTriangle, Check } from "lucide-react-native";
import { revertBackup, VmBackup } from "@/services/backups";

export type RevertBackupDialogProps = {
  backup: VmBackup | null;
  vmName: string;
  vmRunning: boolean;
  // Label of the NFS share that receives the safety backup (the backup's own share).
  safetyShareLabel: string;
  onClose: () => void;
  onStarted: (backup: VmBackup) => void;
};

const formatBackupDate = (date: Date) =>
  date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function RevertBackupDialog({
  backup,
  vmName,
  vmRunning,
  safetyShareLabel,
  onClose,
  onStarted,
}: RevertBackupDialogProps) {
  const [confirmName, setConfirmName] = React.useState("");
  const [startAfter, setStartAfter] = React.useState(vmRunning);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset per opened backup; "start after" defaults to the VM's current state.
  React.useEffect(() => {
    setConfirmName("");
    setStartAfter(vmRunning);
    setError(null);
    setSubmitting(false);
  }, [backup?.id, vmRunning]);

  const nameMatches = confirmName === vmName;
  const canSubmit = Boolean(backup) && nameMatches && !submitting;

  const handleSubmit = async () => {
    if (!backup || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await revertBackup(backup.id, { start_after: startAfter });
      onStarted(backup);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start the revert.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={!!backup} onClose={submitting ? () => undefined : onClose} size="md">
      <ModalBackdrop className="bg-black/60" />
      <ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828] shadow-2xl max-w-lg p-6">
        <ModalHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
          <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
            Revert {vmName} to this backup?
          </Heading>
          <ModalCloseButton className="text-typography-600 dark:text-[#8A94A8]" accessibilityLabel="Close revert dialog" />
        </ModalHeader>
        <ModalBody className="pt-5">
          {backup ? (
            <VStack className="gap-4">
              <Text className="text-sm text-typography-700 dark:text-[#8A94A8]">
                The VM disk will be replaced by the backup from{" "}
                <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                  {formatBackupDate(backup.backupDate)}
                </Text>
                . A safety backup of the current disk is taken first on{" "}
                <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                  {safetyShareLabel}
                </Text>
                .
              </Text>
              {vmRunning ? (
                <Box className="flex-row gap-2 rounded-xl border border-warning-300 bg-warning-50 p-3 dark:border-[#5C4A1E] dark:bg-[#2A2414]">
                  <AlertTriangle size={18} color="#D97706" />
                  <Text className="flex-1 text-sm text-typography-800 dark:text-[#E8EBF0]">
                    The VM will be shut down (graceful, up to 5 min). If it does not stop, nothing is changed and you must force-stop it yourself.
                  </Text>
                </Box>
              ) : null}
              <Checkbox
                value="start-after-revert"
                isChecked={startAfter}
                onChange={setStartAfter}
                isDisabled={submitting}
                className="gap-2"
              >
                <CheckboxIndicator className="border-outline-300 dark:border-[#2A3B52]">
                  <CheckboxIcon as={Check} />
                </CheckboxIndicator>
                <CheckboxLabel className="text-typography-700 dark:text-[#8A94A8]">
                  Start VM after revert
                </CheckboxLabel>
              </Checkbox>
              <VStack className="gap-2">
                <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                  Type the VM name to confirm: {vmName}
                </Text>
                <Input
                  variant="outline"
                  isDisabled={submitting}
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]"
                >
                  <InputField
                    value={confirmName}
                    onChangeText={setConfirmName}
                    placeholder={vmName}
                    accessibilityLabel="Confirm VM name"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </VStack>
              {error ? (
                <Text className="text-sm text-error-600 dark:text-[#F87171]">{error}</Text>
              ) : null}
            </VStack>
          ) : null}
        </ModalBody>
        <ModalFooter className="gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
          <Button
            variant="outline"
            className="rounded-xl px-4 py-2 border-outline-200 dark:border-[#2A3B52]"
            onPress={onClose}
            isDisabled={submitting}
          >
            <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
          </Button>
          <Button
            action="negative"
            className="rounded-xl px-4 py-2"
            onPress={handleSubmit}
            isDisabled={!canSubmit}
            accessibilityLabel="Revert VM"
          >
            {submitting ? <ButtonSpinner /> : null}
            <ButtonText>Revert</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default RevertBackupDialog;
