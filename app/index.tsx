import React from 'react';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import {Badge, BadgeText, BadgeIcon} from "@/components/ui/badge";
import {GlobeIcon} from "@/components/ui/icon";

import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/icon';
import {Laptop, Download, HardDrive} from "lucide-react-native";
import {Progress, ProgressFilledTrack} from "@/components/ui/progress";


export default function Home() {
  const router = useRouter();
  
  return (
    <Box className="flex-1 h-[100vh] p-3 bg-[##0e0f15]">
      <Box className="flex mt-14">
        <Text
          className="text-2xl color-white"
          style={{fontFamily: "Inter_700Bold"}}
        >
          Mounts
        </Text>
      </Box>
      <Box className="flex mt-5 bg-[#11151A] border border-[#222937] rounded-2xl max-w-3xl">
        <Box className="p-3">
          <Box className="flex flex-row justify-between">
            <Text
              className=" color-white"
              style={{fontFamily: "Inter_700Bold"}}
            >
              backup-main
            </Text>
            <Badge
              size="sm"
              variant="solid"
              action="success"
              className="rounded-full"
            >
              <BadgeText>Healthy</BadgeText>
              <BadgeIcon as={GlobeIcon} className="ml-2" />
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
              className="w-full h-2 bg-[#2A3346]"
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
              Usado / Total:
            </Text>
            <Text
              className=" color-white ml-4"
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
              Livre:
            </Text>
            <Text
              className=" color-white ml-2"
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
                  className=" color-white"
                  style={{fontFamily: "Inter_700Bold"}}
                >
                  slave2
                </Text>
              </Text>
            </Box>
          </Box>
        </Box>
        <Box className="rounded-b-2xl lex flex-row justify-end p-3 border-t border-[#222937] bg-[#0D0F14]">
          <Button
            variant="solid"
            size="md"
            action="primary"
            className="rounded-lg"
          >
            <ButtonText>Ver Detalhes</ButtonText>
          </Button>
          <Button
            variant="solid"
            size="md"
            action="secondary"
            className="ml-4 bg-[#2146C7] rounded-lg"
          >
            <ButtonText>Desmontar</ButtonText>
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
