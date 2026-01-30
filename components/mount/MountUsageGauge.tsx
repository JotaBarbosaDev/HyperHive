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
  const isAndroid = Platform.OS === "android";
  const { resolvedMode } = useAppTheme();
  const isDark = resolvedMode === "dark";
  const safePercent = Number.isFinite(usagePercent)
    ? Math.max(0, Math.min(100, Number(usagePercent.toFixed(2))))
    : 0;
  const mobileGaugeCircumference = Math.PI * 70;
  const desktopGaugeCircumference = Math.PI * 80;
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
    <Box className="flex flex-col items-center">
      <Box className="relative flex flex-col items-center h-[120px] web:h-[150px]">
        <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium uppercase tracking-wide mb-2" style={{ fontFamily: "Inter_500Medium" }}>
          Storage Usage
        </Text>

      <Box className="block web:hidden">
        <Box
          className={isAndroid ? "relative" : undefined}
          style={isAndroid ? { width: 180, height: 100 } : undefined}
        >
          <Svg width={180} height={100} viewBox="0 0 180 100">
            <G transform="translate(90 90)">
              <Path
                d="M -70 0 A 70 70 0 0 1 70 0"
                fill="none"
                stroke={outlineStroke}
                strokeWidth={9}
                opacity={outlineOpacity}
              />
              <Path
                d="M -70 0 A 70 70 0 0 1 70 0"
                fill="none"
                stroke={progressColor}
                strokeWidth={9}
                strokeLinecap="round"
                strokeDasharray={[mobileGaugeCircumference]}
                strokeDashoffset={
                  mobileGaugeCircumference - (safePercent / 100) * mobileGaugeCircumference
                }
              />
            </G>
          </Svg>
          {isAndroid ? (
            <Box className="absolute inset-0 items-center justify-center mt-5">
              <Text
                className="text-typography-900 dark:text-[#E8EBF0] text-xl font-bold leading-none"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {safePercent}%
              </Text>
            </Box>
          ) : null}
        </Box>
      </Box>

      <Box className="hidden web:block">
        <Svg width={200} height={110} viewBox="0 0 200 110">
          <G transform="translate(100 100)">
            <Path
              d="M -80 0 A 80 80 0 0 1 80 0"
              fill="none"
              stroke={outlineStroke}
              strokeWidth={10}
              opacity={outlineOpacity}
            />
            <Path
              d="M -80 0 A 80 80 0 0 1 80 0"
              fill="none"
              stroke={progressColor}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={[desktopGaugeCircumference]}
              strokeDashoffset={
                desktopGaugeCircumference - (safePercent / 100) * desktopGaugeCircumference
              }
            />
          </G>
        </Svg>
      </Box>

      {!isAndroid ? (
        <Box className="absolute top-[60px] web:top-[68px] left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
          <Text className="text-typography-900 dark:text-[#E8EBF0] text-xl web:text-2xl font-bold leading-none" style={{ fontFamily: "Inter_700Bold" }}>
            {safePercent}%
          </Text>
        </Box>
      ) : null}

        <Box className="hidden web:flex absolute bottom-[18px] web:bottom-[-10px] left-[8px] web:left-[10px] flex-col items-start">
          <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium uppercase" style={{ fontFamily: "Inter_500Medium" }}>
            Used
          </Text>
          <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] web:text-xs font-bold leading-tight" style={{ fontFamily: "Inter_700Bold" }}>
            {formatCapacity(Number.isFinite(usedGB) ? usedGB : 0)}
          </Text>
        </Box>

        <Box className="hidden web:flex absolute bottom-[18px] web:bottom-[-10px] right-[8px] web:right-[10px] flex-col items-end">
          <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium uppercase" style={{ fontFamily: "Inter_500Medium" }}>
            Total
          </Text>
          <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] web:text-xs font-bold leading-tight" style={{ fontFamily: "Inter_700Bold" }}>
            {formatCapacity(Number.isFinite(totalGB) ? totalGB : 0)}
          </Text>
        </Box>

        <Box className="hidden web:flex absolute bottom-[2px] web:bottom-[15px] left-1/2 -translate-x-1/2 items-center">
          <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium" style={{ fontFamily: "Inter_500Medium" }}>
            Free:
          </Text>
          <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] web:text-xs font-semibold" style={{ fontFamily: "Inter_600SemiBold" }}>
            {formatCapacity(Number.isFinite(freeGB) ? freeGB : 0)}
          </Text>
        </Box>
      </Box>

      <Box className="-mt-1 w-full px-3 web:hidden">
        <Box className="flex-row justify-between">
          <Box className="items-start">
            <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] font-medium uppercase" style={{ fontFamily: "Inter_500Medium" }}>
              Used
            </Text>
            <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] font-bold leading-tight" style={{ fontFamily: "Inter_700Bold" }}>
              {formatCapacity(Number.isFinite(usedGB) ? usedGB : 0)}
            </Text>
          </Box>
          <Box className="items-end">
            <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] font-medium uppercase" style={{ fontFamily: "Inter_500Medium" }}>
              Total
            </Text>
            <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] font-bold leading-tight" style={{ fontFamily: "Inter_700Bold" }}>
              {formatCapacity(Number.isFinite(totalGB) ? totalGB : 0)}
            </Text>
          </Box>
        </Box>
        <Box className="mt-0.5 flex-row items-center justify-center">
          <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] font-medium" style={{ fontFamily: "Inter_500Medium" }}>
            Free:
          </Text>
          <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] font-semibold ml-1" style={{ fontFamily: "Inter_600SemiBold" }}>
            {formatCapacity(Number.isFinite(freeGB) ? freeGB : 0)}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
