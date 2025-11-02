import React from "react";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Badge, BadgeIcon, BadgeText} from "@/components/ui/badge";
import {Icon, GlobeIcon, TrashIcon} from "@/components/ui/icon";
import {Button, ButtonSpinner, ButtonText} from "@/components/ui/button";
import {Toast, ToastTitle, useToast} from "@/components/ui/toast";
import {Divider} from "@/components/ui/divider";
import {Mount, MountShare} from "@/types/mount";
import {deleteMount as deleteMountService} from "@/services/hyperhive";
import {MountUsageGauge} from "./MountUsageGauge";
import {MountDeleteModal} from "@/components/modals/MountDeleteModal";
import {MountDetailsModal} from "@/components/modals/MountDetailsModal";
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
      const message = err instanceof Error ? err.message : "Erro ao remover mount.";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }, [MachineName, FolderPath, NfsShare, onDelete, toast]);

  return (
    <>
      <Box className="flex w-full flex-col justify-between rounded-2xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] mb-6 overflow-hidden web:mb-0 web:max-w-[380px] web:min-h-[340px] web:shadow-md dark:web:shadow-none">
        <Box className="flex flex-1 flex-col gap-2 p-3 web:p-4 web:gap-2">
          <Box className="flex flex-row justify-between items-center gap-3">
            <Box className="flex-1 min-w-0">
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] truncate web:text-lg"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {Name}
              </Text>
              <Text
                className="text-[#9AA4B8] dark:text-[#8A94A8] text-xs mt-1 truncate"
                style={{fontFamily: "Inter_400Regular"}}
              >
                {FolderPath}
              </Text>
            </Box>
            <Badge
              size="sm"
              variant="outline"
              action={status}
              className={`rounded-full border shrink-0 px-2.5 py-1 ${
                status === "error"
                  ? "bg-[#ef444419] border-[#EF4444] dark:bg-[#EF444425] dark:border-[#F87171]"
                  : "bg-[#2dd4be19] border-[#2DD4BF] dark:bg-[#2DD4BF25] dark:border-[#5EEAD4]"
              }`}
            >
              <BadgeText
                className={`${
                  status === "error"
                    ? "text-[#EF4444] dark:text-[#FCA5A5]"
                    : "text-[#2DD4BF] dark:text-[#5EEAD4]"
                } text-[10px] font-semibold`}
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                {status === "error" ? "Unhealthy" : "Healthy"}
              </BadgeText>

              <BadgeIcon
                as={GlobeIcon}
                className={`ml-1 ${
                  status === "error"
                    ? "text-[#EF4444] dark:text-[#FCA5A5]"
                    : "text-[#2DD4BF] dark:text-[#5EEAD4]"
                }`}
                size="sm"
              />
            </Badge>
          </Box>

          <Box className="mt-3 web:mt-4 flex flex-col gap-3">
            <MountUsageGauge
              usagePercent={usagePercent}
              usedGB={usageUsedGB}
              totalGB={usageTotalGB}
              freeGB={Status.spaceFreeGB}
            />
            <Box className="w-full h-px bg-outline-100 dark:bg-[#2A3B52]" />
            <Box className="flex items-center justify-center gap-2 pb-1">
              <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-xs" style={{fontFamily: "Inter_500Medium"}}>
                Host:
              </Text>
              <Text className="text-typography-900 dark:text-[#E8EBF0] text-sm font-semibold truncate" style={{fontFamily: "Inter_600SemiBold"}}>
                {MachineName}
              </Text>
            </Box>
          </Box>
        </Box>
        <Box className="rounded-b-2xl flex flex-col gap-2 border-t border-outline-100 bg-background-50 p-3 dark:border-[#2A3B52] dark:bg-[#0E1828] md:flex-row md:justify-end md:gap-3 web:flex-row web:gap-3 web:p-3 web:mt-auto">
          <Button
            variant="solid"
            size="md"
            action="secondary"
            className="w-full rounded-xl md:w-auto web:flex-1 web:h-11 dark:bg-[#2A3B52] dark:hover:bg-[#34445E] dark:active:bg-[#3D4F6A]"
            onPress={() => setShowDetailsModal(true)}
          >
            <ButtonText
              className="web:text-sm web:font-semibold dark:text-[#E8EBF0]"
              style={{fontFamily: "Inter_600SemiBold"}}
            >
              See Details
            </ButtonText>
          </Button>

          {!isDeleting ? (
            <Button
              variant="solid"
              size="md"
              action="primary"
              className="w-full rounded-xl md:w-auto web:flex-1 web:h-11 dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
              onPress={() => setShowDeleteModal(true)}
            >
              <ButtonText
                className="web:text-sm web:font-semibold dark:text-[#0D1420]"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                UMount
              </ButtonText>
            </Button>
          ) : (
            <Button className="p-3 rounded-xl web:flex-1 dark:bg-[#2A3B52]" isDisabled>
              <ButtonSpinner color="gray" />
              <ButtonText
                className="font-semibold text-sm ml-2 web:text-sm dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                Removing...
              </ButtonText>
            </Button>
          )}
        </Box>
        {deleteError ? (
          <Box className="px-4 pb-4">
            <Text className="text-[#EF4444]" style={{fontFamily: "Inter_400Regular"}}>
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
    </>
  );
}
