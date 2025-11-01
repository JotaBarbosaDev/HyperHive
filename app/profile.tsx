import React from "react";
import {ScrollView} from "react-native";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {Avatar, AvatarFallbackText, AvatarImage} from "@/components/ui/avatar";
import {VStack} from "@/components/ui/vstack";
import {HStack} from "@/components/ui/hstack";
import {Icon} from "@/components/ui/icon";
import {Mail, Phone, MapPin, Calendar} from "lucide-react-native";
import {Divider} from "@/components/ui/divider";

export default function ProfileScreen() {
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
            Profile
          </Heading>

          {/* Profile Card */}
          <Box className="rounded-2xl border border-outline-100 bg-background-0 p-6 shadow-soft-2 dark:border-[#2A3B52] dark:bg-[#0E1524] web:p-8">
            <VStack className="gap-6">
              {/* Avatar Section */}
              <Box className="items-center">
                <Avatar
                  size="2xl"
                  className="border-4 border-outline-100 dark:border-[#2A3B52] web:w-32 web:h-32"
                >
                  <AvatarFallbackText className="text-typography-900 dark:text-typography-0 web:text-4xl">
                    User
                  </AvatarFallbackText>
                  <AvatarImage
                    source={{
                      uri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=687&q=80",
                    }}
                  />
                </Avatar>
                <Heading
                  size="xl"
                  className="text-typography-900 dark:text-typography-0 mt-4 web:text-3xl"
                  style={{fontFamily: "Inter_700Bold"}}
                >
                  User Name
                </Heading>
                <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base">
                  Administrator
                </Text>
              </Box>

              <Divider className="bg-outline-100 dark:bg-[#2A3B52]" />

              {/* Contact Information */}
              <VStack className="gap-4">
                <Text
                  className="text-typography-900 dark:text-typography-0 text-lg font-semibold web:text-xl"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Contact Information
                </Text>

                <HStack className="gap-3 items-center">
                  <Box className="w-10 h-10 rounded-full bg-background-50 dark:bg-[#1A2637] items-center justify-center">
                    <Icon
                      as={Mail}
                      size="sm"
                      className="text-typography-600 dark:text-typography-400"
                    />
                  </Box>
                  <VStack className="flex-1">
                    <Text
                      className="text-typography-500 dark:text-typography-400 text-xs web:text-sm"
                      style={{fontFamily: "Inter_500Medium"}}
                    >
                      Email
                    </Text>
                    <Text
                      className="text-typography-900 dark:text-typography-0 text-sm web:text-base"
                      style={{fontFamily: "Inter_400Regular"}}
                    >
                      abc@gmail.com
                    </Text>
                  </VStack>
                </HStack>

                <HStack className="gap-3 items-center">
                  <Box className="w-10 h-10 rounded-full bg-background-50 dark:bg-[#1A2637] items-center justify-center">
                    <Icon
                      as={Phone}
                      size="sm"
                      className="text-typography-600 dark:text-typography-400"
                    />
                  </Box>
                  <VStack className="flex-1">
                    <Text
                      className="text-typography-500 dark:text-typography-400 text-xs web:text-sm"
                      style={{fontFamily: "Inter_500Medium"}}
                    >
                      Phone
                    </Text>
                    <Text
                      className="text-typography-900 dark:text-typography-0 text-sm web:text-base"
                      style={{fontFamily: "Inter_400Regular"}}
                    >
                      +351 123 456 789
                    </Text>
                  </VStack>
                </HStack>

                <HStack className="gap-3 items-center">
                  <Box className="w-10 h-10 rounded-full bg-background-50 dark:bg-[#1A2637] items-center justify-center">
                    <Icon
                      as={MapPin}
                      size="sm"
                      className="text-typography-600 dark:text-typography-400"
                    />
                  </Box>
                  <VStack className="flex-1">
                    <Text
                      className="text-typography-500 dark:text-typography-400 text-xs web:text-sm"
                      style={{fontFamily: "Inter_500Medium"}}
                    >
                      Location
                    </Text>
                    <Text
                      className="text-typography-900 dark:text-typography-0 text-sm web:text-base"
                      style={{fontFamily: "Inter_400Regular"}}
                    >
                      Porto, Portugal
                    </Text>
                  </VStack>
                </HStack>

                <HStack className="gap-3 items-center">
                  <Box className="w-10 h-10 rounded-full bg-background-50 dark:bg-[#1A2637] items-center justify-center">
                    <Icon
                      as={Calendar}
                      size="sm"
                      className="text-typography-600 dark:text-typography-400"
                    />
                  </Box>
                  <VStack className="flex-1">
                    <Text
                      className="text-typography-500 dark:text-typography-400 text-xs web:text-sm"
                      style={{fontFamily: "Inter_500Medium"}}
                    >
                      Member Since
                    </Text>
                    <Text
                      className="text-typography-900 dark:text-typography-0 text-sm web:text-base"
                      style={{fontFamily: "Inter_400Regular"}}
                    >
                      Janeiro 2025
                    </Text>
                  </VStack>
                </HStack>
              </VStack>
            </VStack>
          </Box>
        </Box>
      </ScrollView>
    </Box>
  );
}
