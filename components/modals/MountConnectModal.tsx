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
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalBackdrop className="bg-background-950/50 dark:bg-black/70" />
      <ModalContent className="w-[94%] max-w-[640px] max-h-[90%] web:max-h-[90vh] p-4 web:p-5 rounded-xl dark:bg-[#0E1524] border border-outline-200 dark:border-[#2A3B52]">
        <ModalHeader className="pb-3 border-b border-outline-200 dark:border-[#2A3B52]">
          <Box className="flex-1 min-w-0 gap-1">
            <Heading className="text-typography-900 dark:text-[#E8EBF0]" style={{fontFamily: "Inter_700Bold"}}>Connect to {shareName}</Heading>
            <Text className="text-sm text-typography-600 dark:text-[#AAB4C5]">Mount this export on your device.</Text>
          </Box>
        </ModalHeader>
        <ModalBody className="min-h-0 my-0 py-3">
          <ScrollView showsVerticalScrollIndicator contentContainerStyle={{paddingBottom: 4}}>
            <Box className="gap-4">
              <Box className="gap-1">
                <Text className="text-xs text-typography-600 dark:text-[#AAB4C5]">Export source</Text>
                <Text selectable className="text-sm text-typography-900 dark:text-[#E8EBF0] web:break-all" style={{fontFamily: "monospace"}}>{source}</Text>
              </Box>
              <Box className="gap-2 p-3 rounded-lg bg-background-50 dark:bg-[#131F30]">
                <Text className="text-sm text-typography-900 dark:text-[#E8EBF0]" style={{fontFamily: "Inter_600SemiBold"}}>1. Connect to the cluster</Text>
                <Text className="text-sm text-typography-600 dark:text-[#AAB4C5]">Connect your device to the WireGuard VPN before mounting.</Text>
                <Button variant="outline" action="secondary" className="h-11 rounded-lg self-start" onPress={() => { onClose(); router.push("/wireguard"); }}><ButtonText>Open WireGuard VPN</ButtonText></Button>
              </Box>
              <Box className="gap-3">
                <Text className="text-sm text-typography-900 dark:text-[#E8EBF0]" style={{fontFamily: "Inter_600SemiBold"}}>2. Run your mount commands</Text>
                {[["Linux", linuxCommands], ["macOS", macCommands], ["Windows", windowsCommands]].map(([label, commands]) => (
                  <Box key={label} className="gap-2">
                    <Text className="text-xs text-typography-600 dark:text-[#AAB4C5]">{label}</Text>
                    {label === "Windows" ? <Text className="text-xs text-typography-600 dark:text-[#AAB4C5]">Requires Windows Client for NFS.</Text> : null}
                    <Box className="p-3 rounded-lg border border-outline-200 bg-background-50 dark:border-[#243247] dark:bg-[#090F1C]">
                      <Text selectable className="text-xs leading-5 text-typography-900 dark:text-[#E8EBF0] web:break-all" style={{fontFamily: "monospace"}}>{commands}</Text>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </ScrollView>
        </ModalBody>
        <ModalFooter className="pt-3 border-t border-outline-200 dark:border-[#2A3B52]">
          <Button variant="outline" action="secondary" className="h-11 rounded-lg w-full" onPress={onClose}><ButtonText>Close</ButtonText></Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
