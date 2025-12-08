import React from "react";
import {ScrollView} from "react-native";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {VStack} from "@/components/ui/vstack";

export default function ProfileScreen() {
  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 32}}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            Streams
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Browse all ISOs available for your VMs and add new images by
            downloading them straight to the cluster.
          </Text>

          <VStack className="mt-6 gap-4 web:flex-row web:items-end"></VStack>
        </Box>
      </ScrollView>
    </Box>
  );
}
