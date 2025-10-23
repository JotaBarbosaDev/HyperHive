import React from "react";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Badge, BadgeText, BadgeIcon} from "@/components/ui/badge";
import {Icon} from "@/components/ui/icon";
import {Laptop, Download, HardDrive} from "lucide-react-native";
import {Progress, ProgressFilledTrack} from "@/components/ui/progress";
import {GlobeIcon} from "@/components/ui/icon";
import {Button, ButtonText} from "@/components/ui/button";



export default function Mount() {
       
    return (
      <Box className="flex flex-col justify-between rounded-2xl border border-outline-100 bg-background-0 dark:border-[#222937] dark:bg-[#11141a39] mb-6">
        <Box className="p-3">
          <Box className="flex flex-row justify-between">
            <Text
              className="text-typography-900 flex-1"
              style={{fontFamily: "Inter_700Bold"}}
            >
              backup-main
            </Text>
            <Badge
              size="sm"
              variant="outline"
              action="success"
              className="rounded-full bg-[#2dd4be19] border-[#2DD4BF]"
            >
              <BadgeText className="text-[#2DD4BF]">Healthy</BadgeText>
              <BadgeIcon as={GlobeIcon} className="ml-2 text-[#2DD4BF]" />
            </Badge>
          </Box>
          <Box className="flex">
            <Text
              className="color-[#9AA4B8]"
              style={{fontFamily: "Inter_700Regular"}}
            >
              /mnt/512SvMan/shared/slave1_aa
            </Text>
          </Box>
          <Box className="flex flex-row justify-between mt-4">
            <Text
              className="color-[#9AA4B8]"
              style={{fontFamily: "Inter_700Regular"}}
            >
              Usage
            </Text>
            <Text
              className="color-[#9AA4B8]"
              style={{fontFamily: "Inter_700Regular"}}
            >
              30%
            </Text>
          </Box>
          <Box className="flex">
            <Progress
              value={30}
              size="md"
              orientation="horizontal"
              className="w-full h-2 bg-[#2dd4be19]"
            >
              <ProgressFilledTrack className="h-2 bg-[#2DD4BF]" />
            </Progress>
          </Box>
          <Box className="flex mt-4 flex-row items-center">
            <Icon className="text-typography-500 mr-2" as={HardDrive} />
            <Text
              className="color-[#9AA4B8]"
              style={{fontFamily: "Inter_700Regular"}}
            >
              Usado / Total:{" "}
            </Text>
            <Text
              className="text-typography-900"
              style={{fontFamily: "Inter_700Bold"}}
            >
              304 GB / 1024 GB
            </Text>
          </Box>
          <Box className="flex flex-row mt-2 items-center">
            <Icon className="text-typography-500 mr-2" as={Download} />
            <Text
              className="color-[#9AA4B8]"
              style={{fontFamily: "Inter_700Regular"}}
            >
              Livre:{" "}
            </Text>
            <Text
              className="text-typography-900"
              style={{fontFamily: "Inter_700Bold"}}
            >
              720 GB
            </Text>

            <Box className="ml-9 flex flex-row items-center">
              <Icon className="text-typography-500 mr-2" as={Laptop} />
              <Text
                className="color-[#9AA4B8]"
                style={{fontFamily: "Inter_700Regular"}}
              >
                Host:{" "}
                <Text
                  className="text-typography-900"
                  style={{fontFamily: "Inter_700Bold"}}
                >
                  slave2{" "}
                </Text>
              </Text>
            </Box>
          </Box>
        </Box>
        <Box className="rounded-b-2xl flex flex-col gap-3 border-t border-outline-100 bg-background-50 p-3 dark:border-[#222937] dark:bg-[#0D0F14] md:flex-row md:justify-end md:gap-4">
          <Button
            variant="solid"
            size="md"
            action="primary"
            className="w-full rounded-lg md:w-auto"
          >
            <ButtonText>Ver Detalhes</ButtonText>
          </Button>
          <Button
            variant="solid"
            size="md"
            action="secondary"
            className="w-full rounded-lg md:w-auto"
          >
            <ButtonText>Desmontar</ButtonText>
          </Button>
        </Box>
      </Box>
    );
}
