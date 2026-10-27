import React from "react";
import { Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Action, ink, muted } from "./support-ui";

export function SupportSidePanel({ title, subtitle, children, onClose }: { title: string; subtitle: string; children: React.ReactNode; onClose: () => void }) {
  return <Modal visible animationType="none" onRequestClose={onClose}><SafeAreaView className="flex-1 bg-background-0 dark:bg-[#101B2B]">
    <Box className="flex-row items-center gap-3 border-b border-outline-200 dark:border-[#26364A] p-4"><Box className="flex-1"><Text className={ink + " font-semibold text-lg"}>{title}</Text><Text className={muted}>{subtitle}</Text></Box><Action label="Close side panel" onPress={onClose} /></Box>
    <Box style={{ flex: 1, minHeight: 0, padding: 16, gap: 12 }}>{children}</Box>
  </SafeAreaView></Modal>;
}
