import React from "react";
import {ScrollView} from "react-native";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {VStack} from "@/components/ui/vstack";
import {Icon} from "@/components/ui/icon";
import {ShoppingCart} from "lucide-react-native";

export default function OrdersScreen() {
  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 32}}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-4xl web:mx-auto web:w-full">
          {/* Header */}
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-typography-0 mb-6 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            Orders
          </Heading>

          {/* Empty State */}
          <Box className="rounded-2xl border border-outline-100 bg-background-0 p-8 shadow-soft-2 dark:border-[#2A3B52] dark:bg-[#0E1524] web:p-12">
            <VStack className="gap-4 items-center justify-center">
              <Box className="w-20 h-20 rounded-full bg-background-50 dark:bg-[#1A2637] items-center justify-center web:w-24 web:h-24">
                <Icon
                  as={ShoppingCart}
                  size="xl"
                  className="text-typography-400 dark:text-typography-600"
                />
              </Box>
              <VStack className="gap-2 items-center">
                <Heading
                  size="lg"
                  className="text-typography-900 dark:text-typography-0 text-center web:text-2xl"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  No Orders Yet
                </Heading>
                <Text className="text-typography-600 dark:text-typography-400 text-center text-sm web:text-base max-w-md">
                  Your order history will appear here. This feature is coming soon to help you track
                  all your purchases and subscriptions.
                </Text>
              </VStack>
            </VStack>
          </Box>
        </Box>
      </ScrollView>
    </Box>
  );
}
