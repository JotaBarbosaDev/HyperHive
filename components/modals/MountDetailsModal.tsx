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
import {Button, ButtonText} from "@/components/ui/button";
import {Heading} from "@/components/ui/heading";
import {Icon} from "@/components/ui/icon";
import {Text} from "@/components/ui/text";
import {Mount} from "@/types/mount";
import {Laptop, Download, HardDrive} from "lucide-react-native";

export type MountDetailsModalProps = {
  isOpen: boolean;
  mount: Mount;
  onClose: () => void;
};

export function MountDetailsModal({isOpen, mount, onClose}: MountDetailsModalProps) {
  const {
    NfsShare: {MachineName, FolderPath, Source, Target, Name, HostNormalMount},
    Status,
  } = mount;

  const usageUsedGB = Status.spaceOccupiedGB;
  const usageTotalGB = Status.spaceTotalGB;
  const status = Status.working ? "success" : "error";

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalBackdrop className="bg-background-950/50 dark:bg-black/70" />
      <ModalContent className="max-w-[340px] web:max-w-[540px] p-5 web:p-8 rounded-2xl dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52]">
        <ModalHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
          <Box className="flex flex-row items-start justify-between w-full">
            <Box className="flex-1 min-w-0 pr-3">
              <Heading
                size="lg"
                className="text-typography-900 dark:text-[#E8EBF0] web:text-2xl truncate"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {Name}
              </Heading>
              <Text
                size="sm"
                className="text-typography-500 dark:text-[#8A94A8] web:text-base mt-1"
              >
                Mount details and configuration
              </Text>
            </Box>
            <Badge
              size="sm"
              variant="outline"
              action={status}
              className={`rounded-full border px-2.5 py-1 ${
                status === "error"
                  ? "bg-[#ef444419] border-[#EF4444] dark:bg-[#EF444425] dark:border-[#F87171]"
                  : "bg-[#2dd4be19] border-[#2DD4BF] dark:bg-[#2DD4BF25] dark:border-[#5EEAD4]"
              }`}
              style={{flexShrink: 0, alignSelf: "flex-start"}}
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
            </Badge>
          </Box>
        </ModalHeader>
        <ModalBody className="pt-6 space-y-5">
          <Box className="flex flex-col gap-3 mb-4 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
            <Text
              className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide"
              style={{fontFamily: "Inter_700Bold"}}
            >
              Machine
            </Text>
            <Box className="flex items-center gap-2">
              <Icon
                className="text-typography-600 dark:text-[#8A94A8]"
                as={Laptop}
                size="sm"
              />
              <Text
                className="text-sm text-typography-900 dark:text-[#E8EBF0] font-semibold web:text-base"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                {MachineName}
              </Text>
            </Box>
          </Box>
          <Box className="flex flex-col gap-3 mb-4 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
            <Text
              className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide"
              style={{fontFamily: "Inter_700Bold"}}
            >
              Folder Path
            </Text>
            <Text
              className="text-sm text-typography-900 dark:text-[#E8EBF0] web:text-base break-all"
              style={{fontFamily: "Inter_400Regular"}}
            >
              {FolderPath}
            </Text>
          </Box>
          <Box className="grid grid-cols-1 web:grid-cols-2 gap-4">
            <Box className="flex flex-col gap-3 mb-4 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
              <Text
                className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide"
                style={{fontFamily: "Inter_700Bold"}}
              >
                Source
              </Text>
              <Text
                className="text-sm text-typography-900 dark:text-[#E8EBF0] web:text-base break-all"
                style={{fontFamily: "Inter_400Regular"}}
              >
                {Source || "-"}
              </Text>
            </Box>
            <Box className="flex flex-col gap-3 mb-4 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
              <Text
                className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide"
                style={{fontFamily: "Inter_700Bold"}}
              >
                Target
              </Text>
              <Text
                className="text-sm text-typography-900 dark:text-[#E8EBF0] web:text-base break-all"
                style={{fontFamily: "Inter_400Regular"}}
              >
                {Target || "-"}
              </Text>
            </Box>
          </Box>
          <Box className="flex flex-col gap-3 mb-4 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
            <Text
              className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide"
              style={{fontFamily: "Inter_700Bold"}}
            >
              Storage Information
            </Text>
            <Box className="grid grid-cols-3 gap-4 flex-row justify-between">
              <Box className="flex flex-col items-center gap-1.5">
                <Icon
                  className="text-typography-500 dark:text-[#8A94A8]"
                  as={HardDrive}
                  size="sm"
                />
                <Text
                  className="text-[9px] font-medium uppercase text-typography-500 dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Used
                </Text>
                <Text
                  className="text-sm text-typography-900 dark:text-[#E8EBF0] font-bold"
                  style={{fontFamily: "Inter_700Bold"}}
                >
                  {isNaN(usageUsedGB) ? "0" : usageUsedGB} GB
                </Text>
              </Box>
              <Box className="flex flex-col items-center gap-1.5">
                <Icon
                  className="text-typography-500 dark:text-[#8A94A8]"
                  as={Download}
                  size="sm"
                />
                <Text
                  className="text-[9px] font-medium uppercase text-typography-500 dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Free
                </Text>
                <Text
                  className="text-sm text-typography-900 dark:text-[#E8EBF0] font-bold"
                  style={{fontFamily: "Inter_700Bold"}}
                >
                  {isNaN(Status.spaceFreeGB)
                    ? "0"
                    : Status.spaceFreeGB.toFixed(2)}{" "}
                  GB
                </Text>
              </Box>
              <Box className="flex flex-col items-center gap-1.5">
                <Icon
                  className="text-typography-500 dark:text-[#8A94A8]"
                  as={HardDrive}
                  size="sm"
                />
                <Text
                  className="text-[9px] font-medium uppercase text-typography-500 dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_500Medium"}}
                >
                  Total
                </Text>
                <Text
                  className="text-sm text-typography-900 dark:text-[#E8EBF0] font-bold"
                  style={{fontFamily: "Inter_700Bold"}}
                >
                  {isNaN(usageTotalGB) ? "0" : usageTotalGB} GB
                </Text>
              </Box>
            </Box>
          </Box>
          <Box className="flex flex-col gap-3 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
            <Text
              className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide"
              style={{fontFamily: "Inter_700Bold"}}
            >
              Host Normal Mount
            </Text>
            <Text
              className="text-sm text-typography-900 dark:text-[#E8EBF0] font-semibold web:text-base"
              style={{fontFamily: "Inter_600SemiBold"}}
            >
              {HostNormalMount ? "Enabled" : "Disabled"}
            </Text>
          </Box>
        </ModalBody>
        <ModalFooter className="w-full pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
          <Button
            variant="solid"
            action="secondary"
            className="w-full h-12 rounded-xl"
            onPress={onClose}
          >
            <ButtonText
              className="font-semibold web:text-base"
              style={{fontFamily: "Inter_600SemiBold"}}
            >
              Close
            </ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
