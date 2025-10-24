import React from "react";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Badge, BadgeText, BadgeIcon} from "@/components/ui/badge";
import {Icon} from "@/components/ui/icon";
import {Laptop, Download, HardDrive} from "lucide-react-native";
import {Progress, ProgressFilledTrack} from "@/components/ui/progress";
import {GlobeIcon} from "@/components/ui/icon";
import {Button, ButtonText} from "@/components/ui/button";
import { NativeEventEmitter } from "react-native";

export type MountType = {
  name: string;
  host: string;
  path: string;
  usageUsedGB: number;
  usageTotalGB: number;
  working: boolean;
};

export default function Mount({name, path, usageUsedGB, usageTotalGB, host, working}:MountType) {
let usagePercent = Number(((usageUsedGB*100) / usageTotalGB).toFixed(2));

const status = (working) ? "success" : "error";
       
    return (
      <Box className="flex flex-col justify-between rounded-2xl border border-outline-100 bg-background-0 dark:border-[#222937] dark:bg-[#11141a39] mb-6">
        <Box className="p-3">
          <Box className="flex flex-row justify-between">
            <Text
              className="text-typography-900 flex-1"
              style={{fontFamily: "Inter_700Bold"}}
            >
              {name}
            </Text>
            <Badge
              size="sm"
              variant="outline"
              action={status}
              className={`rounded-full border ${
                status === "error"
                  ? "bg-[#ef444419] border-[#EF4444]"
                  : "bg-[#2dd4be19] border-[#2DD4BF]"
              }`}
            >
              <BadgeText
                className={
                  status === "error" ? "text-[#EF4444]" : "text-[#2DD4BF]"
                }
              >
                {status === "error" ? "Unhealthy" : "Healthy"}
              </BadgeText>

              <BadgeIcon
                as={GlobeIcon}
                className={`ml-2 ${
                  status === "error" ? "text-[#EF4444]" : "text-[#2DD4BF]"
                }`}
              />
            </Badge>
          </Box>
          <Box className="flex">
            <Text
              className="color-[#9AA4B8]"
              style={{fontFamily: "Inter_400Regular"}}
            >
              {path}
            </Text>
          </Box>
          <Box className="flex flex-row justify-between mt-4">
            <Text
              className="color-[#9AA4B8]"
              style={{fontFamily: "Inter_400Regular"}}
            >
              Usage
            </Text>
            <Text
              className="color-[#9AA4B8]"
              style={{fontFamily: "Inter_400Regular"}}
            >
              {usagePercent}%
            </Text>
          </Box>
          <Box className="flex">
            <Progress
              value={usagePercent}
              size="md"
              orientation="horizontal"
              className={`w-full h-2 ${
                usagePercent >= 90
                  ? "bg-[#ef444419]"
                  : usagePercent >= 50
                  ? "bg-[#facc1524]"
                  : "bg-[#2dd4be19]"
              }`}
            >
              <ProgressFilledTrack
                className={`h-2 ${
                  usagePercent >= 90
                    ? "bg-[#EF4444]"
                    : usagePercent >= 50
                    ? "bg-[#FBBF24]"
                    : "bg-[#2DD4BF]"
                }`}
              />
            </Progress>
          </Box>
          <Box className="flex mt-4 flex-row items-center">
            <Icon className="text-typography-500 mr-2" as={HardDrive} />
            <Text
              className="color-[#9AA4B8]"
              style={{fontFamily: "Inter_400Regular"}}
            >
              Used / Total:{" "}
            </Text>
            <Text
              className="text-typography-900"
              style={{fontFamily: "Inter_700Bold"}}
            >
              {usageUsedGB} GB / {usageTotalGB} GB{" "}
            </Text>
          </Box>
          <Box className="flex flex-row mt-2 items-center">
            <Icon className="text-typography-500 mr-2" as={Download} />
            <Text
              className="color-[#9AA4B8]"
              style={{fontFamily: "Inter_400Regular"}}
            >
              Free:{" "}
            </Text>
            <Text
              className="text-typography-900"
              style={{fontFamily: "Inter_700Bold"}}
            >
              {usageTotalGB - usageUsedGB} GB{" "}
            </Text>

            <Box className="ml-9 flex flex-row items-center">
              <Icon className="text-typography-500 mr-2" as={Laptop} />
              <Text
                className="color-[#9AA4B8]"
                style={{fontFamily: "Inter_400Regular"}}
              >
                Host:{"  "}
                <Text
                  className="text-typography-900"
                  style={{fontFamily: "Inter_700Bold"}}
                >
                  {host}{" "}
                </Text>
              </Text>
            </Box>
          </Box>
        </Box>
        <Box className="rounded-b-2xl flex flex-col gap-3 border-t border-outline-100 bg-background-50 p-3 dark:border-[#222937] dark:bg-[#0D0F14] md:flex-row md:justify-end md:gap-4">
          <Button
            variant="solid"
            size="md"
            action="secondary"
            className="w-full rounded-lg md:w-auto"
          >
            <ButtonText>See Details</ButtonText>
          </Button>
          <Button
            variant="solid"
            size="md"
            action="primary"
            className="w-full rounded-lg md:w-auto"
          >
            <ButtonText>UMount</ButtonText>
          </Button>
        </Box>
      </Box>
    );
}
