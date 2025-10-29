import React from "react";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Badge, BadgeText, BadgeIcon} from "@/components/ui/badge";
import {Icon, TrashIcon, GlobeIcon} from "@/components/ui/icon";
import {Laptop, Download, HardDrive} from "lucide-react-native";
import {Progress, ProgressFilledTrack} from "@/components/ui/progress";
import {Button, ButtonText, ButtonSpinner} from "@/components/ui/button";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import {Heading} from "@/components/ui/heading";

export type MountType = {
  NfsShare: {
    Id: number;
    MachineName: string;
    FolderPath: string;
    Source: string;
    Target: string;
    Name: string;
    HostNormalMount: boolean;
  };
  Status: {
    working: boolean;
    spaceOccupiedGB: number;
    spaceFreeGB: number;
    spaceTotalGB: number;
  };
};

export type MountProps = MountType & {
  onDelete?: (share: MountType["NfsShare"]) => void;
};

export default function Mount({NfsShare, Status, onDelete}: MountProps) {
  const {MachineName, FolderPath, Name, HostNormalMount} = NfsShare;
  const {spaceOccupiedGB: usageUsedGB, spaceTotalGB: usageTotalGB} = Status;

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const deleteMount = React.useCallback(async () => {
    try {
      setDeleteError(null);
      setIsDeleting(true);

      const response = await fetch("https://hyperhive.maruqes.com/nfs/delete?force=false", {
        method: "DELETE",
        headers: {
          Authorization:
            "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcGkiLCJhdHRycyI6eyJpZCI6Mn0sInNjb3BlIjpbInVzZXIiXSwiZXhwaXJlc0luIjoiMWQiLCJqdGkiOiJVNWpLYm0xMHZhdEMxaFduIiwiaWF0IjoxNzYxNzMyNjk4LCJleHAiOjE3NjE4MTkwOTh9.bvAmlfqYkd8gbZevHPexzDl7LIpDbZocjWGxsiFAknkumclFaf6oK05KThbQEJ-olOg0M-5LSMl4207633dFs6iZ4bSStCuaX8ZfaR1FeG95ajcqBNDiUIaEoq904YaZt5DOTDyPjXdNkssTzvhOVFqlJLulvXU5-iZgcIF5LGGfOYusUbKFNHv-wtCV80B70oUUUaPdhwX822ISyxs5TOdotVSk6CzOByAjaWZlpkU1ULmfK5syOBqNZMmgn-vUxGSfob7nccwFzjTqZuIeDdudYpgc0DidgUpRT9tWXuDCccD17kiu4dbAzCg9MpMADNK9F9CEpBEK4hz-qk0WHA",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          machine_name: MachineName,
          folder_path: FolderPath,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      onDelete?.(NfsShare);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao remover mount.";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  }, [FolderPath, MachineName, NfsShare, onDelete]);
  

  let usagePercent = Number(((usageUsedGB * 100) / usageTotalGB).toFixed(2));
  const status = Status.working ? "success" : "error";

  const [showModal, setShowModal] = React.useState(false);


  return (
    <Box className="flex flex-col justify-between rounded-2xl border border-outline-100 bg-background-0 dark:border-[#1F2A44] dark:bg-[#101A2E] mb-6">
      <Box className="p-3">
        <Box className="flex flex-row justify-between">
          <Text
            className="text-typography-900 flex-1"
            style={{fontFamily: "Inter_700Bold"}}
          >
            {Name}
          </Text>
          <Badge
            size="sm"
            variant="outline"
            action={status}
            className={`rounded-full border ${
              status === "error"
                ? "bg-[#ef444419] border-[#EF4444]"
                : "bg-[#2dd4be19] border-[#2DD4BF]"
            }`}
          >
            <BadgeText
              className={
                status === "error" ? "text-[#EF4444]" : "text-[#2DD4BF]"
              }
            >
              {status === "error" ? "Unhealthy" : "Healthy"}
            </BadgeText>

            <BadgeIcon
              as={GlobeIcon}
              className={`ml-2 ${
                status === "error" ? "text-[#EF4444]" : "text-[#2DD4BF]"
              }`}
            />
          </Badge>
        </Box>
        <Box className="flex">
          <Text
            className="color-[#9AA4B8]"
            style={{fontFamily: "Inter_400Regular"}}
          >
            {FolderPath}
          </Text>
        </Box>
        <Box className="flex flex-row justify-between mt-4">
          <Text
            className="color-[#9AA4B8]"
            style={{fontFamily: "Inter_400Regular"}}
          >
            Usage
          </Text>
          <Text
            className="color-[#9AA4B8]"
            style={{fontFamily: "Inter_400Regular"}}
          >
            {usagePercent}%
          </Text>
        </Box>
        <Box className="flex">
          <Progress
            value={usagePercent}
            size="md"
            orientation="horizontal"
            className={`w-full h-2 ${
              usagePercent >= 90
                ? "bg-[#ef444419]"
                : usagePercent >= 50
                ? "bg-[#facc1524]"
                : "bg-[#2dd4be19]"
            }`}
          >
            <ProgressFilledTrack
              className={`h-2 ${
                usagePercent >= 90
                  ? "bg-[#EF4444]"
                  : usagePercent >= 50
                  ? "bg-[#FBBF24]"
                  : "bg-[#2DD4BF]"
              }`}
            />
          </Progress>
        </Box>
        <Box className="flex mt-4 flex-row items-center">
          <Icon className="text-typography-500 mr-2" as={HardDrive} />
          <Text
            className="color-[#9AA4B8]"
            style={{fontFamily: "Inter_400Regular"}}
          >
            Used / Total:{" "}
          </Text>
          <Text
            className="text-typography-900"
            style={{fontFamily: "Inter_700Bold"}}
          >
            {usageUsedGB} GB / {usageTotalGB} GB{" "}
          </Text>
        </Box>
        <Box className="flex flex-row mt-2 items-center">
          <Icon className="text-typography-500 mr-2" as={Download} />
          <Text
            className="color-[#9AA4B8]"
            style={{fontFamily: "Inter_400Regular"}}
          >
            Free:{" "}
          </Text>
          <Text
            className="text-typography-900"
            style={{fontFamily: "Inter_700Bold"}}
          >
            {usageTotalGB - usageUsedGB} GB{" "}
          </Text>

          <Box className="ml-9 flex flex-row items-center">
            <Icon className="text-typography-500 mr-2" as={Laptop} />
            <Text
              className="color-[#9AA4B8]"
              style={{fontFamily: "Inter_400Regular"}}
            >
              Host:{"  "}
              <Text
                className="text-typography-900"
                style={{fontFamily: "Inter_700Bold"}}
              >
                {MachineName}{" "}
              </Text>
            </Text>
          </Box>
        </Box>
      </Box>
      <Box className="rounded-b-2xl flex flex-col gap-3 border-t border-outline-100 bg-background-50 p-3 dark:border-[#1F2A44] dark:bg-[#0E1524] md:flex-row md:justify-end md:gap-4">
        <Button
          variant="solid"
          size="md"
          action="secondary"
          className="w-full rounded-lg md:w-auto"
        >
          <ButtonText>See Details</ButtonText>
        </Button>
        {!isDeleting ? (
          <Button
            variant="solid"
            size="md"
            action="primary"
            className="w-full rounded-lg md:w-auto"
            onPress={() => setShowModal(true)}
            isDisabled={false}
          >
            <ButtonText>UMount</ButtonText>
          </Button>
        ) : (
          <Button className="p-3" isDisabled={true}>
            <ButtonSpinner color="gray" />
            <ButtonText className="font-medium text-sm ml-2">
              Removing...
            </ButtonText>
          </Button>
        )}
        {deleteError ? (
          <Box className="w-full">
            <Text
              className="text-[#EF4444]"
              style={{fontFamily: "Inter_400Regular"}}
            >
              {deleteError}
            </Text>
          </Box>
        ) : null}
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
          }}
        >
          <ModalBackdrop />
          <ModalContent className="max-w-[305px] items-center">
            <ModalHeader>
              <Box className="w-[56px] h-[56px] rounded-full bg-background-error items-center justify-center">
                <Icon as={TrashIcon} className="stroke-error-600" size="xl" />
              </Box>
            </ModalHeader>
            <ModalBody className="mt-0 mb-4">
              <Heading
                size="md"
                className="text-typography-950 mb-2 text-center"
              >
                Delete {MachineName}
              </Heading>
              <Text size="sm" className="text-typography-500 text-center">
                Are you sure you want to delete this mount? This action cannot
                be undone.
              </Text>
            </ModalBody>
            <ModalFooter className="w-full">
              <Button
                variant="outline"
                action="secondary"
                size="sm"
                onPress={() => {
                  setShowModal(false);
                }}
                className="flex-grow"
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
              {!isDeleting ? (
                <Button
                  onPress={async () => {
                    setShowModal(false);
                    await deleteMount();
                  }}
                  size="sm"
                  action="negative"
                  className="flex-grow"
                >
                  <ButtonText>Delete</ButtonText>
                </Button>
              ) : (
                <Button className="p-3" isDisabled={true} disabled={true}>
                  <ButtonSpinner color="gray" />
                  <ButtonText className="font-medium text-sm ml-2">
                    Removing...
                  </ButtonText>
                </Button>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </Box>
  );
}
