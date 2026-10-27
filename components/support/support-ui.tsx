import React from "react";
import { TextInput } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";

export const surface = "p-5 rounded-2xl border border-outline-100 dark:border-[#26364A] bg-background-0 dark:bg-[#101B2B]";
export const muted = "text-sm text-typography-600 dark:text-[#8A94A8]";
export const ink = "text-typography-900 dark:text-[#E8EBF0]";
export function Action({ label, onPress, disabled = false, primary = false, selected = false, compact = false }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean; selected?: boolean; compact?: boolean }) {
  return <Button size={compact ? "xs" : "sm"} variant={primary ? "solid" : "outline"} action={primary ? "primary" : "secondary"} className={"rounded-lg self-start " + (compact ? "h-6 min-h-6 px-2 " : "min-h-9 ") + (primary ? "bg-[#147D78] border-[#147D78]" : selected ? "border-[#147D78] bg-[#E7F6F2] dark:bg-[#153B3B]" : "")} isDisabled={disabled} accessibilityLabel={label} onPress={onPress}><ButtonText className={primary ? "text-white" : selected ? "text-[#147D78] dark:text-[#6ED5C4]" : ""}>{label}</ButtonText></Button>;
}
export function Field({ label, value, onChange, secure = false, error }: { label: string; value: string; onChange: (value: string) => void; secure?: boolean; error?: string }) {
  return <Box className="gap-1 flex-grow min-w-0"><Text className={muted}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} secureTextEntry={secure} autoCapitalize="none" className={"border rounded-lg p-2 text-typography-900 dark:text-[#E8EBF0] " + (error ? "border-red-600" : "border-outline-200 dark:border-[#2A3B52]")} />{error ? <Text accessibilityLiveRegion="polite" className="text-sm text-red-700 dark:text-red-300">{error}</Text> : null}</Box>;
}
export function Failure({ message }: { message?: string | null }) { return message ? <Box role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-[#2A1212]"><Text selectable className="text-sm text-red-700 dark:text-red-300">{message}</Text></Box> : null; }
export function State({ value }: { value: string }) { return <Box className={"self-start px-2 py-1 rounded-md " + (["online", "healthy", "live"].includes(value) ? "bg-[#E7F6F2] dark:bg-[#153B3B]" : ["offline", "unhealthy", "error", "fatal"].includes(value) ? "bg-[#FFF0EC] dark:bg-[#3C2629]" : "bg-[#FFF5DF] dark:bg-[#38321F]")}><Text className={"text-xs font-semibold capitalize " + (["online", "healthy", "live"].includes(value) ? "text-[#147D78] dark:text-[#6ED5C4]" : ["offline", "unhealthy", "error", "fatal"].includes(value) ? "text-[#BA4F3D] dark:text-[#F4A293]" : "text-[#946A18] dark:text-[#F0CC80]")}>{value}</Text></Box>; }
