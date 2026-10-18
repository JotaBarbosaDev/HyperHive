import React from "react";
import { TextInput } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { mutedClassName } from "./shared";
export { FleetOverview } from "./OperationsOverview";
export { FleetRecords } from "./OperationsRecords";

export function Control({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Button size="sm" variant="outline" action="secondary" className="rounded-lg self-start" isDisabled={disabled} onPress={onPress}><ButtonText>{label}</ButtonText></Button>;
}
export function Field({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) {
  return <Box className="gap-1 flex-grow min-w-0" style={{ flexBasis: 140 }}><Text className={mutedClassName}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} maxLength={maxLength} placeholderTextColor="#8290A5" className="border border-outline-200 dark:border-[#2A3B52] rounded-lg p-2 text-typography-900 dark:text-[#E8EBF0]" /></Box>;
}
