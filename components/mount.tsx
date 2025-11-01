import React from "react";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Badge, BadgeText, BadgeIcon} from "@/components/ui/badge";
import {Icon, GlobeIcon, TrashIcon} from "@/components/ui/icon";
import {Laptop, Download, HardDrive} from "lucide-react-native";
import {Progress, ProgressFilledTrack} from "@/components/ui/progress";
import {Button, ButtonText, ButtonSpinner} from "@/components/ui/button";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import {Heading} from "@/components/ui/heading";
import {Toast, ToastTitle, useToast} from "@/components/ui/toast";
import {Divider} from "@/components/ui/divider";
import Svg, {G, Path} from "react-native-svg";
import {useColorScheme} from "@/components/useColorScheme";

export type MountType = {
  NfsShare: {
    Id: number;
    MachineName: string;
    FolderPath: string;
    Source: string;
    Target: string;
    Name: string;
    HostNormalMount: boolean;
  };
  Status: {
    working: boolean;
    spaceOccupiedGB: number;
    spaceFreeGB: number;
    spaceTotalGB: number;
  };
};

export type MountProps = MountType & {
  onDelete?: (share: MountType["NfsShare"]) => void;
};

export default function Mount({NfsShare, Status, onDelete}: MountProps) {
  const {MachineName, FolderPath, Name, HostNormalMount} = NfsShare;
  const {spaceOccupiedGB: usageUsedGB, spaceTotalGB: usageTotalGB} = Status;

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const deleteMount = React.useCallback(async () => {
    try {
      setDeleteError(null);
      setIsDeleting(true);

      const response = await fetch(
        "https://hyperhive.maruqes.com/nfs/delete?force=false",
        {
          method: "DELETE",
          headers: {
            Authorization:
              "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcGkiLCJhdHRycyI6eyJpZCI6Mn0sInNjb3BlIjpbInVzZXIiXSwiZXhwaXJlc0luIjoiMWQiLCJqdGkiOiJJWm1ObG92RUVieExELytaIiwiaWF0IjoxNzYxOTA4MTAwLCJleHAiOjE3NjE5OTQ1MDB9.xJUEc8CS5dBV4oc0MPHnbAtZPxtxB9p-7DyNQL14GneQ4thrJ4GgUog3H8WCXoejWIczVgVphRbtQEq4vrMSvN3nNxgRCjd_SUlXHbBQHyqHEXZi9Kx2eWNF7b5UQpADYBRFxjhWlk6Zl_aSwPAryI81_V2OhHBsW-mwGcmiXdOgZaNFCiVQ8LGStunppz2xCkWdfrJY5lbD88cEGDWhaozz6-JXib8zFZpwRGpAyKOwgTtQ7CPAwlNgvAQkL3TpRkAd_9JzgG0tBoamSv80nbZGxbMKve1ArEYuQdivaTzGiuU0K5trYKG1G69Qvllhdo3OzHaUl7oB8Db78Zf2ng",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            machine_name: MachineName,
            folder_path: FolderPath,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      onDelete?.(NfsShare);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao remover mount.";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
      toast.show({
        placement: "top",
        render: ({id}) => {
          const toastId = "toast-" + id;
          return (
            <Toast
              nativeID={toastId}
              className="px-5 py-3 gap-4 shadow-soft-1 items-center flex-row"
              action="success"
            >
              <Icon
                as={TrashIcon}
                size="xl"
                className=" stroke-none"
              />
              <Divider
                orientation="vertical"
                className="h-[30px] bg-outline-200"
              />
              <ToastTitle size="sm">Mount deleted successfully!</ToastTitle>
            </Toast>
          );
        },
      });
    }
  }, [FolderPath, MachineName, NfsShare, onDelete]);
  

  let usagePercent = Number(((usageUsedGB * 100) / usageTotalGB).toFixed(2));
  const status = Status.working ? "success" : "error";

  // Progress ring maths
  const safePercent = isNaN(usagePercent) ? 0 : Math.max(0, Math.min(100, usagePercent));
  const mobileGaugeCircumference = Math.PI * 70;
  const desktopGaugeCircumference = Math.PI * 80;
  const colorScheme = useColorScheme();
  const outlineStroke = colorScheme === "dark" ? "#2A3B52" : "rgb(221, 220, 219)";

  const [showModal, setShowModal] = React.useState(false);
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);
  const toast = useToast();
  
  return (
    <Box className="flex flex-col justify-between rounded-2xl border border-outline-100 bg-background-0 dark:border-[#2A3B52] dark:bg-[#151F30] mb-6 overflow-hidden web:mb-0 web:w-full web:max-w-[380px] web:min-h-[340px] web:shadow-md dark:web:shadow-none">
      <Box className="flex flex-1 flex-col gap-2 p-3 web:p-4 web:gap-2">
        <Box className="flex flex-row justify-between items-center gap-3">
          <Box className="flex-1 min-w-0">
            <Text
              className="text-typography-900 dark:text-[#E8EBF0] truncate web:text-lg"
              style={{fontFamily: "Inter_700Bold"}}
            >
              {Name}
            </Text>
            <Text
              className="text-[#9AA4B8] dark:text-[#8A94A8] text-xs mt-1 truncate"
              style={{fontFamily: "Inter_400Regular"}}
            >
              {FolderPath}
            </Text>
          </Box>
          <Badge
            size="sm"
            variant="outline"
            action={status}
            className={`rounded-full border shrink-0 px-2 py-1 ${
              status === "error"
                ? "bg-[#ef444419] border-[#EF4444] dark:bg-[#EF444420] dark:border-[#F87171]"
                : "bg-[#2dd4be19] border-[#2DD4BF] dark:bg-[#2DD4BF20] dark:border-[#5EEAD4]"
            }`}
          >
            <BadgeText
              className={`${status === "error" ? "text-[#EF4444] dark:text-[#FCA5A5]" : "text-[#2DD4BF] dark:text-[#5EEAD4]"} text-[10px]`}
            >
              {status === "error" ? "Unhealthy" : "Healthy"}
            </BadgeText>

            <BadgeIcon
              as={GlobeIcon}
              className={`ml-1 ${
                status === "error" ? "text-[#EF4444] dark:text-[#FCA5A5]" : "text-[#2DD4BF] dark:text-[#5EEAD4]"
              }`}
              size="sm"
            />
          </Badge>
        </Box>

        <Box className="mt-3 web:mt-4 flex flex-col gap-3">
          {/* Semicircle gauge com métricas integradas - responsivo para mobile */}
          <Box className="relative flex flex-col items-center" style={{height: 135}}>
            {/* Label "Usage" acima do arco */}
            <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium uppercase tracking-wide mb-1" style={{fontFamily: "Inter_500Medium"}}>
              Storage Usage
            </Text>
            
            {/* SVG semicircle gauge - menor em mobile */}
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
                    stroke={
                      safePercent >= 90 ? "#EF4444" : safePercent >= 50 ? "#FBBF24" : "#2DD4BF"
                    }
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

            {/* SVG desktop */}
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
                    stroke={
                      safePercent >= 90 ? "#EF4444" : safePercent >= 50 ? "#FBBF24" : "#2DD4BF"
                    }
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

            {/* Percentagem no centro do arco */}
            <Box className="absolute top-[54px] web:top-[62px] left-1/2 -translate-x-1/2 flex flex-col items-center">
              <Text className="text-typography-900 dark:text-[#E8EBF0] text-xl web:text-2xl font-bold leading-none" style={{fontFamily: "Inter_700Bold"}}>
                {safePercent}%
              </Text>
            </Box>

            {/* Used (ponta esquerda inferior) */}
            <Box className="absolute bottom-[12px] web:bottom-[14px] left-[8px] web:left-[10px] flex flex-col items-start">
              <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium uppercase" style={{fontFamily: "Inter_500Medium"}}>Used</Text>
              <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] web:text-xs font-bold leading-tight" style={{fontFamily: "Inter_700Bold"}}>{isNaN(usageUsedGB) ? 0 : usageUsedGB} GB</Text>
            </Box>

            {/* Total (ponta direita inferior) */}
            <Box className="absolute bottom-[12px] web:bottom-[14px] right-[8px] web:right-[10px] flex flex-col items-end">
              <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium uppercase" style={{fontFamily: "Inter_500Medium"}}>Total</Text>
              <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] web:text-xs font-bold leading-tight" style={{fontFamily: "Inter_700Bold"}}>{isNaN(usageTotalGB) ? 0 : usageTotalGB} GB</Text>
            </Box>

            {/* Free (abaixo da percentagem) */}
            <Box className="absolute bottom-[12px] web:bottom-[14px] left-1/2 -translate-x-1/2 flex items-center gap-1">
              <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-[8px] web:text-[9px] font-medium" style={{fontFamily: "Inter_500Medium"}}>Free:</Text>
              <Text className="text-typography-900 dark:text-[#E8EBF0] text-[11px] web:text-xs font-semibold" style={{fontFamily: "Inter_600SemiBold"}}>{isNaN(Status.spaceFreeGB) ? 0 : Status.spaceFreeGB.toFixed(2)} GB</Text>
            </Box>
          </Box>

          {/* Divider sutil */}
          <Box className="w-full h-px bg-outline-100 dark:bg-[#2A3B52]" />

          {/* Host minimalista */}
          <Box className="flex items-center justify-center gap-2 pb-1">
            <Icon className="text-typography-500 dark:text-[#8A94A8]" as={Laptop} size="sm" />
            <Text className="text-[#9AA4B8] dark:text-[#8A94A8] text-xs" style={{fontFamily: "Inter_500Medium"}}>Host:</Text>
            <Text className="text-typography-900 dark:text-[#E8EBF0] text-sm font-semibold truncate" style={{fontFamily: "Inter_600SemiBold"}}>{MachineName}</Text>
          </Box>
        </Box>
      </Box>
  <Box className="rounded-b-2xl flex flex-col gap-2 border-t border-outline-100 bg-background-50 p-2 dark:border-[#2A3B52] dark:bg-[#0E1828] md:flex-row md:justify-end md:gap-3 web:flex-row web:gap-3 web:p-3 web:mt-auto">

        <Button
          variant="solid"
          size="md"
          action="secondary"
          className="w-full rounded-md md:w-auto web:flex-1 web:h-10 dark:bg-[#2A3B52] dark:hover:bg-[#34445E] dark:active:bg-[#3D4F6A]"
          onPress={() => setShowDetailsModal(true)}
        >
          <ButtonText className="web:text-sm web:font-medium dark:text-[#E8EBF0]">See Details</ButtonText>
        </Button>

        {!isDeleting ? (
          <Button
            variant="solid"
            size="md"
            action="primary"
            className="w-full rounded-md md:w-auto web:flex-1 web:h-10 dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
            onPress={() => setShowModal(true)}
            isDisabled={false}
          >
            <ButtonText className="web:text-sm web:font-medium dark:text-[#0D1420]">UMount</ButtonText>
          </Button>
        ) : (
          <Button className="p-3 web:flex-1 dark:bg-[#2A3B52]" isDisabled={true}>
            <ButtonSpinner color="gray" />
            <ButtonText className="font-medium text-sm ml-2 web:text-sm dark:text-[#E8EBF0]">
              Removing...
            </ButtonText>
          </Button>
        )}
        {deleteError ? (
          <Box className="w-full web:mt-2">
            <Text
              className="text-[#EF4444]"
              style={{fontFamily: "Inter_400Regular"}}
            >
              {deleteError}
            </Text>
          </Box>
        ) : null}
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
          }}
          
        >
          <ModalBackdrop className="dark:bg-black/60" />
          <ModalContent className="max-w-[305px] items-center web:max-w-[420px] web:items-stretch web:p-6 dark:bg-[#151F30]">
            <ModalHeader>
              <Box className="w-[56px] h-[56px] rounded-full bg-background-error dark:bg-[#EF444420] items-center justify-center web:mx-auto">
                <Icon as={TrashIcon} className="stroke-error-600 dark:stroke-[#F87171]" size="xl" />
              </Box>
            </ModalHeader>
            <ModalBody className="mt-0 mb-4 web:mt-2 web:mb-6">
              <Heading
                size="md"
                className="text-typography-950 dark:text-[#E8EBF0] mb-2 text-center web:text-2xl"
              >
                Delete {MachineName}
              </Heading>
              <Text size="sm" className="text-typography-500 dark:text-[#8A94A8] text-center web:text-base">
                Are you sure you want to delete this mount? This action cannot
                be undone.
              </Text>
            </ModalBody>
            <ModalFooter className="w-full web:gap-3">
              <Button
                variant="outline"
                action="secondary"
                size="sm"
                onPress={() => {
                  setShowModal(false);
                }}
                className="flex-grow web:flex-grow-0 web:w-1/2 web:px-6 dark:border-[#2A3B52] dark:bg-transparent dark:hover:bg-[#1A2637]"
              >
                <ButtonText className="web:text-base dark:text-[#E8EBF0]">Cancel</ButtonText>
              </Button>
              {!isDeleting ? (
                <Button
                  onPress={async () => {
                    setShowModal(false);
                    await deleteMount();
                  }}
                  size="sm"
                  action="negative"
                  className="flex-grow web:flex-grow-0 web:w-1/2 web:px-6 dark:bg-[#EF4444] dark:hover:bg-[#F87171] dark:active:bg-[#DC2626]"
                >
                  <ButtonText className="web:text-base">Delete</ButtonText>
                </Button>
              ) : (
                <Button className="p-3 web:w-1/2 dark:bg-[#2A3B52]" isDisabled={true} disabled={true}>
                  <ButtonSpinner color="gray" />
                  <ButtonText className="font-medium text-sm ml-2 web:text-base dark:text-[#E8EBF0]">
                    Removing...
                  </ButtonText>
                </Button>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
        >
          <ModalBackdrop className="bg-background-950/50 dark:bg-black/60" />
          <ModalContent className="max-w-[340px] web:max-w-[520px] p-5 web:p-7 rounded-2xl dark:bg-[#151F30]">
            <ModalHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
              <Box style={{display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%'}}>
                <Box style={{flex: 1, minWidth: 0, paddingRight: 12}}>
                  <Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0] web:text-2xl truncate" style={{fontFamily: "Inter_700Bold"}}>
                    {Name}
                  </Heading>
                  <Text size="sm" className="text-typography-500 dark:text-[#8A94A8] web:text-base" style={{marginTop: 4}}>
                    Mount details and configuration
                  </Text>
                </Box>
                <Badge
                  size="sm"
                  variant="outline"
                  action={status}
                  className={`rounded-full border px-2.5 py-1 ${
                    status === "error"
                      ? "bg-[#ef444419] border-[#EF4444] dark:bg-[#EF444420] dark:border-[#F87171]"
                      : "bg-[#2dd4be19] border-[#2DD4BF] dark:bg-[#2DD4BF20] dark:border-[#5EEAD4]"
                  }`}
                  style={{flexShrink: 0, alignSelf: 'flex-start'}}
                >
                  <BadgeText className={`${status === "error" ? "text-[#EF4444] dark:text-[#FCA5A5]" : "text-[#2DD4BF] dark:text-[#5EEAD4]"} text-[10px] font-semibold`}>
                    {status === "error" ? "Unhealthy" : "Healthy"}
                  </BadgeText>
                </Badge>
              </Box>
            </ModalHeader>
            <ModalBody style={{paddingTop: 24}}>
              <Box style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                {/* Machine */}
                <Box className="flex flex-col gap-3 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
                  <Text className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide" style={{fontFamily: "Inter_700Bold"}}>
                    Machine
                  </Text>
                  <Box className="flex items-center gap-2">
                    <Icon className="text-typography-600 dark:text-[#8A94A8]" as={Laptop} size="sm" />
                    <Text className="text-sm text-typography-900 dark:text-[#E8EBF0] font-semibold web:text-base" style={{fontFamily: "Inter_600SemiBold"}}>
                      {MachineName}
                    </Text>
                  </Box>
                </Box>
                  
                {/* Folder Path */}
                <Box className="flex flex-col gap-3 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
                <Text className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide" style={{fontFamily: "Inter_700Bold"}}>
                  Folder Path
                </Text>
                <Text className="text-sm text-typography-900 dark:text-[#E8EBF0] web:text-base break-all" style={{fontFamily: "Inter_400Regular"}}>
                  {FolderPath}
                </Text>
              </Box>

              {/* Source & Target */}
              <Box className="grid grid-cols-1 web:grid-cols-2 gap-4">
                <Box className="flex flex-col gap-3 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
                  <Text className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide" style={{fontFamily: "Inter_700Bold"}}>
                    Source
                  </Text>
                  <Text className="text-sm text-typography-900 dark:text-[#E8EBF0] web:text-base break-all" style={{fontFamily: "Inter_400Regular"}}>
                    {NfsShare.Source || "-"}
                  </Text>
                </Box>
                <Box className="flex flex-col gap-3 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
                  <Text className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide" style={{fontFamily: "Inter_700Bold"}}>
                    Target
                  </Text>
                  <Text className="text-sm text-typography-900 dark:text-[#E8EBF0] web:text-base break-all" style={{fontFamily: "Inter_400Regular"}}>
                    {NfsShare.Target || "-"}
                  </Text>
                </Box>
              </Box>

              {/* Storage Info */}
              <Box className="flex flex-col gap-3 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
                <Text className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide" style={{fontFamily: "Inter_700Bold"}}>
                  Storage Information
                </Text>
                <Box className="grid grid-cols-3 gap-4">
                  <Box className="flex flex-col items-center gap-1.5">
                    <Icon className="text-typography-500 dark:text-[#8A94A8]" as={HardDrive} size="sm" />
                    <Text className="text-[9px] font-medium uppercase text-typography-500 dark:text-[#8A94A8]" style={{fontFamily: "Inter_500Medium"}}>Used</Text>
                    <Text className="text-sm text-typography-900 dark:text-[#E8EBF0] font-bold" style={{fontFamily: "Inter_700Bold"}}>
                      {isNaN(usageUsedGB) ? "0" : usageUsedGB} GB
                    </Text>
                  </Box>
                  <Box className="flex flex-col items-center gap-1.5">
                    <Icon className="text-typography-500 dark:text-[#8A94A8]" as={Download} size="sm" />
                    <Text className="text-[9px] font-medium uppercase text-typography-500 dark:text-[#8A94A8]" style={{fontFamily: "Inter_500Medium"}}>Free</Text>
                    <Text className="text-sm text-typography-900 dark:text-[#E8EBF0] font-bold" style={{fontFamily: "Inter_700Bold"}}>
                      {isNaN(Status.spaceFreeGB) ? "0" : Status.spaceFreeGB.toFixed(2)} GB
                    </Text>
                  </Box>
                  <Box className="flex flex-col items-center gap-1.5">
                    <Icon className="text-typography-500 dark:text-[#8A94A8]" as={HardDrive} size="sm" />
                    <Text className="text-[9px] font-medium uppercase text-typography-500 dark:text-[#8A94A8]" style={{fontFamily: "Inter_500Medium"}}>Total</Text>
                    <Text className="text-sm text-typography-900 dark:text-[#E8EBF0] font-bold" style={{fontFamily: "Inter_700Bold"}}>
                      {isNaN(usageTotalGB) ? "0" : usageTotalGB} GB
                    </Text>
                  </Box>
                </Box>
              </Box>

                {/* Host Normal Mount */}
                <Box className="flex flex-col gap-3 p-4 rounded-xl bg-background-50 dark:bg-[#1A2637] border border-outline-100 dark:border-[#2A3B52]">
                  <Text className="text-xs font-bold uppercase text-typography-700 dark:text-[#A8B3C7] tracking-wide" style={{fontFamily: "Inter_700Bold"}}>
                    Host Normal Mount
                  </Text>
                  <Text className="text-sm text-typography-900 dark:text-[#E8EBF0] font-semibold web:text-base" style={{fontFamily: "Inter_600SemiBold"}}>
                    {HostNormalMount ? "Enabled" : "Disabled"}
                  </Text>
                </Box>
              </Box>
            </ModalBody>
            <ModalFooter className="w-full">
              <Button
                variant="solid"
                action="secondary"
                className="w-full"
                onPress={() => setShowDetailsModal(false)}
              >
                <ButtonText>Close</ButtonText>
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
      
    </Box>
  );
}
