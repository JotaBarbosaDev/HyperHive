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
import {Button, ButtonText} from "@/components/ui/button";
import {Divider} from "@/components/ui/divider";
import {Heading} from "@/components/ui/heading";
import {Text} from "@/components/ui/text";
import {Mount} from "@/types/mount";
import {useRouter} from "expo-router";
import {ScrollView} from "react-native";

export type MountConnectModalProps = {
  isOpen: boolean;
  mount: Mount;
  onClose: () => void;
};

export function MountConnectModal({isOpen, mount, onClose}: MountConnectModalProps) {
  const router = useRouter();
  const shareName = mount.NfsShare.Name?.trim() || "share";
  const source = mount.NfsShare.Source || "SERVER:/path";
  const mountFolder = shareName.replace(/[\\/]/g, "-");

  const linuxMountPoint = `/mnt/hyperhive/${mountFolder}`;
  const macMountPoint = `/Volumes/HyperHive/${mountFolder}`;
  const windowsDrive = "Z:";

  const linuxCommands = `sudo mkdir -p "${linuxMountPoint}"\nsudo mount -t nfs ${source} "${linuxMountPoint}"`;
  const macCommands = `sudo mkdir -p "${macMountPoint}"\nsudo mount -t nfs ${source} "${macMountPoint}"`;
  const windowsCommands = `mount -o anon ${source} ${windowsDrive}`;
  const truncateMiddle = (value: string, maxLength: number = 48) => {
    if (value.length <= maxLength) return value;
    const keep = Math.floor((maxLength - 3) / 2);
    return `${value.slice(0, keep)}...${value.slice(-keep)}`;
  };
  const sourceLabel = truncateMiddle(source);
  const mountPointLabel = truncateMiddle(linuxMountPoint);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalBackdrop className="bg-background-950/50 dark:bg-black/70" />
      <ModalContent className="max-w-[360px] w-full max-h-[90%] web:max-w-[640px] web:max-h-[90vh] p-5 web:p-8 rounded-2xl dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52]">
        <ModalHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
          <Box className="flex flex-col gap-1">
            <Heading
              size="lg"
              className="text-typography-900 dark:text-[#E8EBF0] web:text-2xl"
              style={{fontFamily: "Inter_700Bold"}}
            >
              Connect to {shareName}
            </Heading>
            <Text className="text-typography-500 dark:text-[#8A94A8] text-sm web:text-base">
              Follow the steps below to securely reach the cluster and mount this NFS share.
            </Text>
          </Box>
        </ModalHeader>
        <ModalBody className="pt-6">
          <ScrollView showsVerticalScrollIndicator>
            <Box className="flex flex-col gap-10 pb-2">
              <Box className="flex flex-col gap-4 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
                <Text
                  className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide"
                  style={{fontFamily: "Inter_700Bold"}}
                >
                  Share details
                </Text>
                <Box className="flex flex-col gap-3 web:grid web:grid-cols-2">
                  <Box className="flex flex-col gap-2">
                    <Text
                      className="text-[11px] font-semibold uppercase text-typography-500 dark:text-[#8A94A8] tracking-wide"
                      style={{fontFamily: "Inter_600SemiBold"}}
                    >
                      Source
                    </Text>
                    <Box className="bg-background-100 dark:bg-[#0F172A] border border-outline-200 dark:border-[#1E2F47] rounded-lg p-3">
                      <Text className="font-mono text-xs text-typography-900 dark:text-[#E2E8F0]" selectable>
                        {sourceLabel}
                      </Text>
                    </Box>
                  </Box>
                  <Box className="flex flex-col gap-2">
                    <Text
                      className="text-[11px] font-semibold uppercase text-typography-500 dark:text-[#8A94A8] tracking-wide"
                      style={{fontFamily: "Inter_600SemiBold"}}
                    >
                      Mount point
                    </Text>
                    <Box className="bg-background-100 dark:bg-[#0F172A] border border-outline-200 dark:border-[#1E2F47] rounded-lg p-3">
                      <Text className="font-mono text-xs text-typography-900 dark:text-[#E2E8F0]" selectable>
                        {mountPointLabel}
                      </Text>
                    </Box>
                  </Box>
                </Box>
              </Box>

              <Divider className="bg-outline-100 dark:bg-[#2A3B52] my-2" />

              <Box className="flex flex-col gap-3 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
                <Text
                  className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide"
                  style={{fontFamily: "Inter_700Bold"}}
                >
                  Step 1: WireGuard VPN
                </Text>
                <Text className="text-sm text-typography-900 dark:text-[#E8EBF0]">
                  Make sure your device is connected to the WireGuard VPN to reach the cluster.
                </Text>
                <Button
                  variant="solid"
                  action="primary"
                  size="md"
                  className="rounded-xl self-start dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
                  onPress={() => {
                    onClose();
                    router.push("/wireguard");
                  }}
                >
                  <ButtonText
                    className="web:text-sm web:font-semibold dark:text-[#0D1420]"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    Open WireGuard VPN
                  </ButtonText>
                </Button>
              </Box>

              <Divider className="bg-outline-100 dark:bg-[#2A3B52] my-2" />

              <Box className="flex flex-col gap-4 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
                <Text
                  className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide"
                  style={{fontFamily: "Inter_700Bold"}}
                >
                  Step 2: Mount commands
                </Text>
                <Text className="text-sm text-typography-500 dark:text-[#8A94A8]">
                  Use the commands below for your operating system.
                </Text>
                <Box className="flex flex-col gap-3">
                  <Box className="flex flex-col gap-2">
                    <Text
                      className="text-[11px] font-semibold uppercase text-typography-500 dark:text-[#8A94A8] tracking-wide"
                      style={{fontFamily: "Inter_600SemiBold"}}
                    >
                      Linux
                    </Text>
                    <Box className="bg-background-100 dark:bg-[#0F172A] border border-outline-200 dark:border-[#1E2F47] rounded-lg p-3">
                      <Text className="font-mono text-xs text-typography-900 dark:text-[#E2E8F0]" selectable>
                        {linuxCommands}
                      </Text>
                    </Box>
                  </Box>
                  <Box className="flex flex-col gap-2">
                    <Text
                      className="text-[11px] font-semibold uppercase text-typography-500 dark:text-[#8A94A8] tracking-wide"
                      style={{fontFamily: "Inter_600SemiBold"}}
                    >
                      macOS
                    </Text>
                    <Box className="bg-background-100 dark:bg-[#0F172A] border border-outline-200 dark:border-[#1E2F47] rounded-lg p-3">
                      <Text className="font-mono text-xs text-typography-900 dark:text-[#E2E8F0]" selectable>
                        {macCommands}
                      </Text>
                    </Box>
                  </Box>
                  <Box className="flex flex-col gap-2">
                    <Text
                      className="text-[11px] font-semibold uppercase text-typography-500 dark:text-[#8A94A8] tracking-wide"
                      style={{fontFamily: "Inter_600SemiBold"}}
                    >
                      Windows
                    </Text>
                    <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                      Requires the Windows "Client for NFS" feature.
                    </Text>
                    <Box className="bg-background-100 dark:bg-[#0F172A] border border-outline-200 dark:border-[#1E2F47] rounded-lg p-3">
                      <Text className="font-mono text-xs text-typography-900 dark:text-[#E2E8F0]" selectable>
                        {windowsCommands}
                      </Text>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </ScrollView>
        </ModalBody>
        <ModalFooter className="w-full pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
          <Button
            variant="solid"
            action="secondary"
            className="w-full h-11 rounded-xl"
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
