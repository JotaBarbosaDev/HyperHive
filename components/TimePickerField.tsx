import React from "react";
import { Platform } from "react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalHeader } from "@/components/ui/modal";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

type Props = {
  label: string;
  value: string; // HH:MM
  onChange: (value: string) => void;
};

// HH:MM picker: the browser's own clock picker on web, an hour/minute sheet on native.
export default function TimePickerField({ label, value, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const [hour, minute] = value.split(":");

  if (Platform.OS === "web") {
    return <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-typography-600 dark:text-[#94A3B8]">
      {label}
      <input
        type="time"
        step={300}
        aria-label={label}
        value={value}
        onChange={(event) => { if (event.target.value) onChange(event.target.value); }}
        className="min-h-[48px] w-full rounded-xl border border-outline-200 dark:border-[#2A3B52] bg-transparent px-3 text-2xl font-semibold tabular-nums text-typography-900 dark:text-[#E8EBF0] [color-scheme:light] dark:[color-scheme:dark]"
      />
    </label>;
  }

  const chip = (selected: boolean) => `min-w-[48px] min-h-[44px] items-center justify-center rounded-lg border ${selected ? "border-primary-500 bg-primary-500" : "border-outline-200 dark:border-[#2A3B52]"}`;
  const chipText = (selected: boolean) => `text-sm tabular-nums ${selected ? "font-semibold text-white" : "text-typography-800 dark:text-[#E8EBF0]"}`;

  return <Box className="flex-1 min-w-0 gap-1">
    <Text className="text-xs font-medium text-typography-600 dark:text-[#94A3B8]">{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Change time`} onPress={() => setOpen(true)} className="min-h-[48px] justify-center rounded-xl border border-outline-200 dark:border-[#2A3B52] px-3">
      <Text className="text-2xl font-semibold tabular-nums text-typography-900 dark:text-[#E8EBF0]">{value}</Text>
    </Pressable>
    <Modal isOpen={open} onClose={() => setOpen(false)}>
      <ModalBackdrop />
      <ModalContent className="rounded-2xl">
        <ModalHeader><Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">{label} · {value}</Text></ModalHeader>
        <ModalBody>
          <Text className="mb-2 text-xs text-typography-600 dark:text-[#94A3B8]">Hour</Text>
          <Box className="flex-row flex-wrap gap-2">
            {HOURS.map((h) => <Pressable key={h} accessibilityRole="button" accessibilityLabel={`Hour ${h}`} accessibilityState={{ selected: h === hour }} onPress={() => onChange(`${h}:${minute}`)} className={chip(h === hour)}>
              <Text className={chipText(h === hour)}>{h}</Text>
            </Pressable>)}
          </Box>
          <Text className="mb-2 mt-4 text-xs text-typography-600 dark:text-[#94A3B8]">Minute</Text>
          <Box className="flex-row flex-wrap gap-2">
            {MINUTES.map((m) => <Pressable key={m} accessibilityRole="button" accessibilityLabel={`Minute ${m}`} accessibilityState={{ selected: m === minute }} onPress={() => onChange(`${hour}:${m}`)} className={chip(m === minute)}>
              <Text className={chipText(m === minute)}>{m}</Text>
            </Pressable>)}
          </Box>
          <Button className="mt-4 rounded-xl" style={{ minHeight: 44 }} onPress={() => setOpen(false)}><ButtonText>Done</ButtonText></Button>
        </ModalBody>
      </ModalContent>
    </Modal>
  </Box>;
}
