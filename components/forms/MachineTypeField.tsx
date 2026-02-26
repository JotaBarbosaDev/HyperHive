import React from "react";
import { Box } from "@/components/ui/box";
import { Input, InputField } from "@/components/ui/input";
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

const MACHINE_TYPE_DEFAULT_VALUE = "__machine_type_default__";
const MACHINE_TYPE_CUSTOM_VALUE = "__machine_type_custom__";

type MachineTypeCategory = {
  id: string;
  label: string;
  description: string;
  items: string[];
};

const X86_VERSION_SUFFIXES = [
  "2.4",
  "2.5",
  "2.6",
  "2.7",
  "2.8",
  "2.9",
  "2.10",
  "2.11",
  "2.12",
  "3.0",
  "3.1",
  "4.0",
  "4.1",
  "4.2",
  "5.0",
  "5.1",
  "5.2",
  "6.0",
  "6.1",
  "6.2",
  "7.0",
  "7.1",
  "7.2",
  "8.0",
  "8.1",
  "8.2",
  "9.0",
  "9.1",
  "9.2",
] as const;

const MACHINE_TYPE_CATEGORIES: MachineTypeCategory[] = [
  {
    id: "x86-aliases",
    label: "x86_64 / i386 (aliases)",
    description: "Short aliases. `q35` and `pc` usually resolve to a host-specific machine version.",
    items: ["q35", "pc"],
  },
  {
    id: "x86-q35",
    label: "x86_64 / i386 (pc-q35-* modern PCIe)",
    description: "Recommended family for modern x86 VMs. Uses Q35 chipset / PCIe. Pick an exact version for compatibility.",
    items: X86_VERSION_SUFFIXES.map((version) => `pc-q35-${version}`),
  },
  {
    id: "x86-i440fx",
    label: "x86_64 / i386 (pc-i440fx-* legacy/compat)",
    description: "Legacy/compatibility x86 family (i440fx chipset). Useful for older guests or migrations from older setups.",
    items: X86_VERSION_SUFFIXES.map((version) => `pc-i440fx-${version}`),
  },
  {
    id: "x86-other",
    label: "Other x86 (advanced / less common)",
    description: "x86 machine types that may be available on Fedora/QEMU builds but are less common for standard libvirt VMs.",
    items: ["isapc", "microvm", "none"],
  },
];

const MACHINE_TYPE_OPTION_CATEGORY_MAP = new Map<
  string,
  Pick<MachineTypeCategory, "label" | "description">
>();

for (const category of MACHINE_TYPE_CATEGORIES) {
  for (const item of category.items) {
    if (!MACHINE_TYPE_OPTION_CATEGORY_MAP.has(item)) {
      MACHINE_TYPE_OPTION_CATEGORY_MAP.set(item, {
        label: category.label,
        description: category.description,
      });
    }
  }
}

export const MACHINE_TYPE_PRESET_OPTIONS: readonly string[] = Array.from(
  new Set(MACHINE_TYPE_CATEGORIES.flatMap((category) => category.items))
);

type MachineTypeFieldProps = {
  value: string;
  onChangeValue: (value: string) => void;
  label?: string;
  className?: string;
  helperText?: string;
  customPlaceholder?: string;
};

export default function MachineTypeField({
  value,
  onChangeValue,
  label = "Machine type (optional)",
  className = "gap-2",
  helperText = "Leave empty to use the backend default.",
  customPlaceholder = "pc-q35-...",
}: MachineTypeFieldProps) {
  const trimmedValue = value.trim();
  const isPreset = MACHINE_TYPE_PRESET_OPTIONS.includes(trimmedValue);
  const selectedCategoryMeta = MACHINE_TYPE_OPTION_CATEGORY_MAP.get(trimmedValue);

  const selectedValue = trimmedValue
    ? isPreset
      ? trimmedValue
      : MACHINE_TYPE_CUSTOM_VALUE
    : MACHINE_TYPE_DEFAULT_VALUE;

  const handleSelectChange = (selected: string) => {
    if (selected === MACHINE_TYPE_DEFAULT_VALUE) {
      onChangeValue("");
      return;
    }
    if (selected === MACHINE_TYPE_CUSTOM_VALUE) {
      if (isPreset) {
        onChangeValue("");
      }
      return;
    }
    onChangeValue(selected);
  };

  const showCustomInput = selectedValue === MACHINE_TYPE_CUSTOM_VALUE;
  const selectDisplayValue =
    selectedValue === MACHINE_TYPE_DEFAULT_VALUE
      ? '"" (Auto / host default)'
      : selectedValue === MACHINE_TYPE_CUSTOM_VALUE
        ? "Custom value"
        : trimmedValue;

  return (
    <VStack className={className}>
      <Text className="text-sm text-typography-700 dark:text-[#8A94A8]">{label}</Text>
      <Select selectedValue={selectedValue} onValueChange={handleSelectChange}>
        <SelectTrigger className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
          <SelectInput
            placeholder='"" (Auto / host default)'
            value={selectDisplayValue}
            className="text-typography-900 dark:text-[#E8EBF0]"
          />
          <SelectIcon className="mr-3" />
        </SelectTrigger>
        <SelectPortal>
          <SelectBackdrop />
          <SelectContent className="max-h-[72vh] bg-background-0 dark:bg-[#0E1828]">
            <SelectDragIndicatorWrapper>
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>
            <Box className="px-3 pt-2 pb-3 border-b border-outline-100 dark:border-[#1E2F47]">
              <Text className="text-xs font-semibold text-typography-700 dark:text-[#E8EBF0]">
                Machine type presets
              </Text>
              <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                x86/Fedora-focused presets. Availability can still vary slightly by QEMU/libvirt version on the host.
              </Text>
            </Box>
            <SelectItem
              label='"" (Auto / host default)'
              value={MACHINE_TYPE_DEFAULT_VALUE}
              className="text-typography-900 dark:text-[#E8EBF0]"
            />
            {MACHINE_TYPE_CATEGORIES.map((category) => (
              <React.Fragment key={category.id}>
                <Box className="px-3 pt-3 pb-2 border-t border-outline-50 dark:border-[#162338]">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-typography-700 dark:text-[#E8EBF0]">
                    {category.label}
                  </Text>
                  <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                    {category.description}
                  </Text>
                </Box>
                {category.items.map((machineType) => (
                  <SelectItem
                    key={`${category.id}-${machineType}`}
                    label={machineType}
                    value={machineType}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                ))}
              </React.Fragment>
            ))}
            <Box className="px-3 pt-3 pb-2 border-t border-outline-50 dark:border-[#162338]">
              <Text className="text-xs font-semibold uppercase tracking-wide text-typography-700 dark:text-[#E8EBF0]">
                Custom
              </Text>
              <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                Send any x86 machine type string supported by your Fedora host/QEMU build (for example a specific `pc-q35-*` or `pc-i440fx-*` not listed).
              </Text>
            </Box>
            <SelectItem
              label="Custom..."
              value={MACHINE_TYPE_CUSTOM_VALUE}
              className="text-typography-900 dark:text-[#E8EBF0]"
            />
          </SelectContent>
        </SelectPortal>
      </Select>
      {showCustomInput ? (
        <Input
          variant="outline"
          className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]"
        >
          <InputField
            value={value}
            onChangeText={onChangeValue}
            placeholder={customPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            className="text-typography-900 dark:text-[#E8EBF0]"
          />
        </Input>
      ) : null}
      {helperText ? (
        <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">{helperText}</Text>
      ) : null}
      {trimmedValue ? (
        <Box className="rounded-md border border-outline-100 dark:border-[#1E2F47] bg-background-50 dark:bg-[#0A1628] px-3 py-2">
          {selectedCategoryMeta ? (
            <>
              <Text className="text-xs font-semibold text-typography-700 dark:text-[#E8EBF0]">
                Category: {selectedCategoryMeta.label}
              </Text>
              <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                {selectedCategoryMeta.description}
              </Text>
            </>
          ) : (
            <>
              <Text className="text-xs font-semibold text-typography-700 dark:text-[#E8EBF0]">
                Category: Custom
              </Text>
              <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                This value will be sent as-is to the API. Ensure it exists on the destination host/QEMU build.
              </Text>
            </>
          )}
        </Box>
      ) : null}
    </VStack>
  );
}
