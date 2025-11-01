import React from "react";
import Svg, {G, Path} from "react-native-svg";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {useColorScheme} from "@/components/useColorScheme";

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
  const colorScheme = useColorScheme();
  const safePercent = Number.isFinite(usagePercent)
    ? Math.max(0, Math.min(100, Number(usagePercent.toFixed(2))))
    : 0;
  const mobileGaugeCircumference = Math.PI * 70;
  const desktopGaugeCircumference = Math.PI * 80;
  const outlineStroke = colorScheme === "dark" ? "#2A3B52" : "rgb(221, 220, 219)";
  const progressColor =
    safePercent >= 90 ? "#EF4444" : safePercent >= 50 ? "#FBBF24" : "#2DD4BF";

  return (
    <Box className="relative flex flex-col items-center" style={{height: 135}}>
      <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium uppercase tracking-wide mb-1" style={{fontFamily: "Inter_500Medium"}}>
        Storage Usage
      </Text>

      <Box className="block web:hidden">
        <Svg width={180} height={100} viewBox="0 0 180 100">
          <G transform="translate(90 90)">
            <Path
              d="M -70 0 A 70 70 0 0 1 70 0"
              fill="none"
              stroke={outlineStroke}
              strokeWidth={9}
              opacity={colorScheme === "dark" ? 0.4 : 0.1}
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
      </Box>

      <Box className="hidden web:block">
        <Svg width={200} height={110} viewBox="0 0 200 110">
          <G transform="translate(100 100)">
            <Path
              d="M -80 0 A 80 80 0 0 1 80 0"
              fill="none"
              stroke={outlineStroke}
              strokeWidth={10}
              opacity={colorScheme === "dark" ? 0.4 : 0.3}
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

      <Box className="absolute top-[54px] web:top-[62px] left-1/2 -translate-x-1/2 flex flex-col items-center">
        <Text className="text-typography-900 dark:text-[#E8EBF0] text-xl web:text-2xl font-bold leading-none" style={{fontFamily: "Inter_700Bold"}}>
          {safePercent}%
        </Text>
      </Box>

      <Box className="absolute bottom-[12px] web:bottom-[14px] left-[8px] web:left-[10px] flex flex-col items-start">
        <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium uppercase" style={{fontFamily: "Inter_500Medium"}}>
          Used
        </Text>
        <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] web:text-xs font-bold leading-tight" style={{fontFamily: "Inter_700Bold"}}>
          {Number.isFinite(usedGB) ? usedGB : 0} GB
        </Text>
      </Box>

      <Box className="absolute bottom-[12px] web:bottom-[14px] right-[8px] web:right-[10px] flex flex-col items-end">
        <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium uppercase" style={{fontFamily: "Inter_500Medium"}}>
          Total
        </Text>
        <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] web:text-xs font-bold leading-tight" style={{fontFamily: "Inter_700Bold"}}>
          {Number.isFinite(totalGB) ? totalGB : 0} GB
        </Text>
      </Box>

      <Box className="absolute bottom-[12px] web:bottom-[14px] left-1/2 -translate-x-1/2 flex items-center gap-1">
        <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium" style={{fontFamily: "Inter_500Medium"}}>
          Free:
        </Text>
        <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] web:text-xs font-semibold" style={{fontFamily: "Inter_600SemiBold"}}>
          {Number.isFinite(freeGB) ? freeGB.toFixed(2) : "0.00"} GB
        </Text>
      </Box>
    </Box>
  );
}
