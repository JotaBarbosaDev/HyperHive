import React from "react";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Badge, BadgeText} from "@/components/ui/badge";
import {Icon, TrashIcon} from "@/components/ui/icon";
import {Button, ButtonSpinner, ButtonText} from "@/components/ui/button";
import {Toast, ToastTitle, useToast} from "@/components/ui/toast";
import {Divider} from "@/components/ui/divider";
import {Mount, MountShare} from "@/types/mount";
import {deleteMount as deleteMountService} from "@/services/hyperhive";
import {MountUsageGauge} from "./MountUsageGauge";
import {MountDeleteModal} from "@/components/modals/MountDeleteModal";
import {MountDetailsModal} from "@/components/modals/MountDetailsModal";
import {MountConnectModal} from "@/components/modals/MountConnectModal";
export type MountCardProps = Mount & {
  onDelete?: (share: MountShare) => void;
};

export function MountCard({
  NfsShare,
  Status,
  onDelete,
}: MountCardProps) {
  const {MachineName, FolderPath, Name} = NfsShare;
  const {spaceOccupiedGB: usageUsedGB, spaceTotalGB: usageTotalGB} = Status;
  const usagePercent =
    usageTotalGB === 0 ? 0 : (usageUsedGB * 100) / usageTotalGB || 0;
  const status = Status.working ? "success" : "error";
  const toast = useToast();

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);
  const [showConnectModal, setShowConnectModal] = React.useState(false);
  const handleDelete = React.useCallback(async () => {
    try {
      setDeleteError(null);
      setIsDeleting(true);
      await deleteMountService(
        {
          MachineName,
          FolderPath,
        },
        {
          force: false,
        }
      );
      onDelete?.(NfsShare);
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
              <Icon as={TrashIcon} size="xl" className=" stroke-none" />
              <Divider orientation="vertical" className="h-[30px] bg-outline-200" />
              <ToastTitle size="sm">Mount deleted successfully!</ToastTitle>
            </Toast>
          );
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error removing mount.";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }, [MachineName, FolderPath, NfsShare, onDelete, toast]);

  return (
    <>
      <Box className="w-full rounded-xl border border-outline-200 bg-background-0 dark:border-[#2A3B52] dark:bg-[#0E1828] overflow-hidden">
        <Box className="flex-1 p-3 gap-2">
          <Box className="min-w-0 gap-1">
            <Box className="flex-row flex-wrap items-center gap-2">
              <Text className="text-base text-typography-900 dark:text-[#E8EBF0]" style={{fontFamily: "Inter_700Bold"}}>{Name}</Text>
              <Badge action={status} variant="outline" className="rounded-md"><BadgeText>{Status.working ? "Healthy" : "Unhealthy"}</BadgeText></Badge>
            </Box>
            <Text selectable className="text-sm text-typography-700 dark:text-[#E8EBF0]" style={{fontFamily: "monospace"}}>{MachineName}</Text>
            <Text selectable className="text-sm text-typography-600 dark:text-[#AAB4C5] web:break-all" style={{fontFamily: "monospace"}}>{FolderPath}</Text>
          </Box>
          <Box className="py-0">
            <MountUsageGauge usagePercent={usagePercent} usedGB={usageUsedGB} totalGB={usageTotalGB} freeGB={Status.spaceFreeGB} />
          </Box>
          <Box className="flex-row flex-wrap gap-1 mt-auto pt-2 border-t border-outline-200 dark:border-[#2A3B52]">
            <Button variant="outline" action="secondary" className="h-11 rounded-lg px-2 flex-1" onPress={() => setShowConnectModal(true)} accessibilityLabel={`Connect to ${Name}`}><ButtonText className="text-xs">Connect</ButtonText></Button>
            <Button variant="outline" action="secondary" className="h-11 rounded-lg px-2 flex-1" onPress={() => setShowDetailsModal(true)} accessibilityLabel={`Details for ${Name}`}><ButtonText className="text-xs">Details</ButtonText></Button>
            <Button variant="outline" action="negative" className="h-11 rounded-lg px-2 flex-1" isDisabled={isDeleting} onPress={() => setShowDeleteModal(true)} accessibilityLabel={`Unmount ${Name}`}>
              {isDeleting ? <ButtonSpinner /> : null}<ButtonText className="text-xs">{isDeleting ? "Removing…" : "Unmount"}</ButtonText>
            </Button>
          </Box>
        </Box>
        {deleteError ? (
          <Box className="px-4 pb-4">
            <Text
              className="text-[#EF4444]"
              style={{fontFamily: "Inter_400Regular"}}
            >
              {deleteError}
            </Text>
          </Box>
        ) : null}
      </Box>

      <MountDeleteModal
        isOpen={showDeleteModal}
        isDeleting={isDeleting}
        machineName={MachineName}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
      />
      <MountDetailsModal
        isOpen={showDetailsModal}
        mount={{NfsShare, Status}}
        onClose={() => setShowDetailsModal(false)}
      />
      <MountConnectModal
        isOpen={showConnectModal}
        mount={{NfsShare, Status}}
        onClose={() => setShowConnectModal(false)}
      />
    </>
  );
}
