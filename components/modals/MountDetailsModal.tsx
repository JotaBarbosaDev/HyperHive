import React from "react";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {Badge, BadgeText} from "@/components/ui/badge";
import {Box} from "@/components/ui/box";
import {Button, ButtonIcon, ButtonSpinner, ButtonText} from "@/components/ui/button";
import {Heading} from "@/components/ui/heading";
import {Icon} from "@/components/ui/icon";
import {Text} from "@/components/ui/text";
import {Toast, ToastTitle, useToast} from "@/components/ui/toast";
import {Divider} from "@/components/ui/divider";
import {Mount} from "@/types/mount";
import {RotateCw, Check, AlertCircle} from "lucide-react-native";
import {remountNfs} from "@/services/hyperhive";
import {ScrollView} from "react-native";

export type MountDetailsModalProps = {
  isOpen: boolean;
  mount: Mount;
  onClose: () => void;
};

export function MountDetailsModal({isOpen, mount, onClose}: MountDetailsModalProps) {
  const {
    NfsShare: {MachineName, FolderPath, Source, Target, Name, HostNormalMount, Id},
    Status,
  } = mount;

  const usageUsedGB = Status.spaceOccupiedGB;
  const usageTotalGB = Status.spaceTotalGB;
  const status = Status.working ? "success" : "error";
  
  const toast = useToast();
  const [isRemounting, setIsRemounting] = React.useState(false);
  const [remountError, setRemountError] = React.useState<string | null>(null);

  const handleRemount = React.useCallback(async () => {
    try {
      setRemountError(null);
      setIsRemounting(true);
      await remountNfs(Id);
      
      toast.show({
        placement: "top",
        render: ({id}) => {
          const toastId = "toast-" + id;
          return (
            <Toast
              nativeID={toastId}
              className="px-5 py-3 gap-4 shadow-soft-1 items-center flex-row"
              action="success"
            >
              <Icon as={Check} size="xl" className="stroke-none text-green-500" />
              <Divider orientation="vertical" className="h-[30px] bg-outline-200" />
              <ToastTitle size="sm">Mount remounted successfully!</ToastTitle>
            </Toast>
          );
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error remounting NFS share.";
      setRemountError(message);
      
      toast.show({
        placement: "top",
        render: ({id}) => {
          const toastId = "toast-" + id;
          return (
            <Toast
              nativeID={toastId}
              className="px-5 py-3 gap-4 shadow-soft-1 items-center flex-row"
              action="error"
            >
              <Icon as={AlertCircle} size="xl" className="stroke-none text-red-500" />
              <Divider orientation="vertical" className="h-[30px] bg-outline-200" />
              <ToastTitle size="sm">{message}</ToastTitle>
            </Toast>
          );
        },
      });
    } finally {
      setIsRemounting(false);
    }
  }, [Id, toast]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalBackdrop className="bg-background-950/50 dark:bg-black/70" />
      <ModalContent className="w-[94%] max-w-[560px] max-h-[90%] web:max-h-[90vh] p-4 web:p-5 rounded-xl dark:bg-[#0E1524] border border-outline-200 dark:border-[#2A3B52]">
        <ModalHeader className="pb-3 gap-3 border-b border-outline-200 dark:border-[#2A3B52]">
          <Box className="flex-1 min-w-0 gap-1">
            <Heading className="text-typography-900 dark:text-[#E8EBF0]" style={{fontFamily: "Inter_700Bold"}}>{Name}</Heading>
            <Text className="text-xs text-typography-600 dark:text-[#AAB4C5]">NFS export · ID {Id}</Text>
          </Box>
          <Badge variant="outline" action={status} className="rounded-md shrink-0"><BadgeText>{Status.working ? "Healthy" : "Unhealthy"}</BadgeText></Badge>
        </ModalHeader>
        <ModalBody className="min-h-0 my-0 py-3">
          <ScrollView showsVerticalScrollIndicator contentContainerStyle={{paddingBottom: 4}}>
            <Box className="gap-3">
              <Box className="flex-row flex-wrap justify-between gap-3 p-3 rounded-lg bg-background-50 dark:bg-[#131F30]">
                {[["Used", usageUsedGB], ["Free", Status.spaceFreeGB], ["Total", usageTotalGB]].map(([label, value]) => (
                  <Box key={label} className="gap-1">
                    <Text className="text-xs text-typography-600 dark:text-[#AAB4C5]">{label}</Text>
                    <Text className="text-sm text-typography-900 dark:text-[#E8EBF0]" style={{fontFamily: "Inter_600SemiBold"}}>{Number.isFinite(value) ? Number(value).toFixed(2) : "0.00"} GB</Text>
                  </Box>
                ))}
              </Box>
              {[["Host", MachineName], ["Folder path", FolderPath], ["Source", Source || "Not reported"], ["Target", Target || "Not reported"], ["Host normal mount", HostNormalMount ? "Enabled" : "Disabled"]].map(([label, value]) => (
                <Box key={label} className="gap-1 pb-3 border-b border-outline-100 dark:border-[#243247]">
                  <Text className="text-xs text-typography-600 dark:text-[#AAB4C5]">{label}</Text>
                  <Text selectable className="text-sm text-typography-900 dark:text-[#E8EBF0] web:break-all" style={{fontFamily: "monospace"}}>{value}</Text>
                </Box>
              ))}
              {remountError ? <Text accessibilityRole="alert" className="text-sm text-error-600 dark:text-[#FCA5A5]">{remountError}</Text> : null}
            </Box>
          </ScrollView>
        </ModalBody>
        <ModalFooter className="pt-3 border-t border-outline-200 dark:border-[#2A3B52] gap-2">
          <Button variant="outline" action="secondary" isDisabled={isRemounting} className="h-11 rounded-lg flex-1" onPress={onClose}><ButtonText>Close</ButtonText></Button>
          <Button action="primary" isDisabled={isRemounting} className="h-11 rounded-lg flex-1 dark:bg-[#2DD4BF]" onPress={handleRemount}>
            {isRemounting ? <ButtonSpinner size="small" /> : <ButtonIcon as={RotateCw} size="sm" />}
            <ButtonText>{isRemounting ? "Remounting…" : "Remount"}</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
