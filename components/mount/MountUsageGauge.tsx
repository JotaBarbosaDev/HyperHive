import React from "react";
import { Platform } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/hooks/useAppTheme";

export type MountUsageGaugeProps = {
  usagePercent: number;
  usedGB: number;
  totalGB: number;
  freeGB: number;
};

export function MountUsageGauge({
  usagePercent,
  usedGB,
  totalGB,
  freeGB,
}: MountUsageGaugeProps) {
  const { resolvedMode } = useAppTheme();
  const isDark = resolvedMode === "dark";
  const safePercent = Number.isFinite(usagePercent)
    ? Math.max(0, Math.min(100, Number(usagePercent.toFixed(2))))
    : 0;
  const circumference = Math.PI * 70;
  const outlineStroke = isDark ? "#334155" : "#E2E8F0";
  const outlineOpacity = isDark ? 0.55 : 0.25;
  const progressColor =
    isDark
      ? safePercent >= 90
        ? "#F87171"
        : safePercent >= 50
          ? "#FCD34D"
          : "#5EEAD4"
      : safePercent >= 90
        ? "#EF4444"
        : safePercent >= 50
          ? "#FBBF24"
          : "#0F172A";

  const formatCapacity = (gb: number) => {
    if (!Number.isFinite(gb)) return "0.00 GB";
    if (gb >= 1000) return `${(gb / 1024).toFixed(2)} TB`;
    return `${gb.toFixed(2)} GB`;
  };

  return (
    <Box className="items-center gap-2">
      <Text className="text-xs text-typography-600 dark:text-[#AAB4C5]">Storage usage</Text>
      <Box className="relative w-[160px] h-[88px]" accessibilityLabel={`${safePercent}% storage used`}>
        <Svg
          width={160}
          height={88}
          viewBox="0 0 160 88"
          {...(Platform.OS === "web" ? { "aria-hidden": true } : { accessible: false })}
        >
          <G transform="translate(80 80)">
            <Path d="M -70 0 A 70 70 0 0 1 70 0" fill="none" stroke={outlineStroke} strokeWidth={8} opacity={outlineOpacity} />
            <Path d="M -70 0 A 70 70 0 0 1 70 0" fill="none" stroke={progressColor} strokeWidth={8} strokeLinecap="round" strokeDasharray={[circumference]} strokeDashoffset={circumference - (safePercent / 100) * circumference} />
          </G>
        </Svg>
        <Box className="absolute inset-0 items-center justify-end pb-2">
          <Text className="text-xl text-typography-900 dark:text-[#E8EBF0]" style={{fontFamily: "Inter_700Bold"}}>{safePercent}%</Text>
        </Box>
      </Box>
      <Box className="w-full flex-row flex-wrap justify-around gap-x-3 gap-y-2">
        <Box className="items-center">
          <Text className="text-xs text-typography-600 dark:text-[#AAB4C5]">Used</Text>
          <Text className="text-xs text-typography-900 dark:text-[#E8EBF0]">{formatCapacity(usedGB)}</Text>
        </Box>
        <Box className="items-center">
          <Text className="text-xs text-typography-600 dark:text-[#AAB4C5]">Total</Text>
          <Text className="text-xs text-typography-900 dark:text-[#E8EBF0]">{formatCapacity(totalGB)}</Text>
        </Box>
        <Box className="items-center">
          <Text className="text-xs text-typography-600 dark:text-[#AAB4C5]">Free</Text>
          <Text className="text-xs text-typography-900 dark:text-[#E8EBF0]">{formatCapacity(freeGB)}</Text>
        </Box>
      </Box>
    </Box>
  );
}
