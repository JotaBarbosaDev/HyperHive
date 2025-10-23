import React from "react";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {useRouter} from "expo-router";
import {ScrollView} from "react-native";
import Mount, { MountType } from "../components/mount";

export default function Home() {
  const router = useRouter();

  return (
    <Box className="flex min-h-screen flex-col bg-background-50 p-3 dark:bg-[#0D0F14]">
      <Box className="flex">
        <Text
          className="text-2xl text-typography-900 dark:text-typography-900"
          style={{fontFamily: "Inter_700Bold"}}
        >
          Mounts
        </Text>
      </Box>
      <Box className="mt-6 grid flex-1 min-h-0 grid-cols-1 gap-5 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <ScrollView showsVerticalScrollIndicator={false}>
          <Mount
            name="nome"
            path="fwedf"
            usageTotalGB={100}
            usageUsedGB={90}
            host="slave1"
          />
          <Mount
            name="nome2"
            path="fwedf/2"
            usageTotalGB={2024}
            usageUsedGB={980}
            host="slave2"
          />
        </ScrollView>
      </Box>
    </Box>
  );
}
