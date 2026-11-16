import React from "react";
import { ScrollView } from "react-native";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import EnergyCard from "@/components/EnergyCard";
import PowerScheduleCard from "@/components/PowerScheduleCard";
import PowerTimelineCard from "@/components/PowerTimelineCard";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function PowerScreen() {
  const { token } = useAuthGuard();
  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Box className="p-4 pt-16 web:px-10 web:pb-10 web:pt-20 web:max-w-7xl web:mx-auto web:w-full gap-6">
          <Box className="gap-3">
            <Heading size="2xl" className="text-typography-900 dark:text-[#E8EBF0] web:text-4xl" style={{ fontFamily: "Inter_700Bold" }}>
              Power
            </Heading>
            <Text className="text-typography-600 dark:text-[#9AA4B8] text-sm web:text-base max-w-3xl">
              Estimated power, energy cost and the power schedule of the cluster.
            </Text>
          </Box>
          <EnergyCard token={token} />
          <PowerTimelineCard token={token} />
          <PowerScheduleCard token={token} />
        </Box>
      </ScrollView>
    </Box>
  );
}
