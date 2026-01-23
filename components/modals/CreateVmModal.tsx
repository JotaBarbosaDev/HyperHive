import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox, CheckboxIndicator, CheckboxIcon, CheckboxLabel } from "@/components/ui/checkbox";
import { StableTextInput } from "@/components/ui/stable-text-input";
import { Badge, BadgeText } from "@/components/ui/badge";
import { ScrollView, Platform } from "react-native";
import { Cpu, X, Copy, Trash2, ChevronDown, Check, ChevronDownIcon } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useToast, Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";
import { createVm, listIsos, listSlaves, IsoApiResponse, Slave, getCpuDisableFeatures } from "@/services/vms-client";
import { listMounts } from "@/services/hyperhive";
import { Mount } from "@/types/mount";

// Try/catch para lidar com expo-clipboard
let Clipboard: any;
try {
  Clipboard = require("expo-clipboard");
} catch (e) {
  // Fallback se expo-clipboard não estiver disponível
  Clipboard = {
    setStringAsync: async (text: string) => {
      console.log("Clipboard não disponível:", text);
    },
  };
}

interface CreateVmModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onSuccess?: (createdName?: string) => void;
}

export default function CreateVmModal({
  showModal,
  setShowModal,
  onSuccess,
}: CreateVmModalProps) {
  const { resolvedMode } = useAppTheme();
  const isWeb = Platform.OS === "web";
  const primaryButtonClass =
    isWeb ? "bg-typography-900 dark:bg-[#2DD4BF]" : resolvedMode === "dark" ? "bg-[#2DD4BF]" : "bg-typography-900";
  const primaryButtonTextClass =
    isWeb ? "text-background-0 dark:text-[#0A1628]" : resolvedMode === "dark" ? "text-[#0A1628]" : "text-background-0";
  // Estados básicos da VM
  const [name, setName] = useState("");
  const [slave, setSlave] = useState("");
  const [vcpu, setVcpu] = useState("2");
  const [memory, setMemory] = useState("4096");
  const [disk, setDisk] = useState("50");
  const [iso, setIso] = useState("");
  const [nfsShare, setNfsShare] = useState("");
  const [network, setNetwork] = useState("default");
  const [vncPassword, setVncPassword] = useState("");

  // Estados de checkboxes
  const [autoStart, setAutoStart] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [live, setLive] = useState(false);

  // Estados para CPU XML
  const [selectedSlaves, setSelectedSlaves] = useState<string[]>([]);
  const [currentSlaveSelect, setCurrentSlaveSelect] = useState("");
  const [cpuXml, setCpuXml] = useState("");
  const [loadingCPU, setLoadingCPU] = useState(false);
  const [isoOptions, setIsoOptions] = useState<IsoApiResponse>([]);
  const [mountOptions, setMountOptions] = useState<Mount[]>([]);
  const [slaveOptions, setSlaveOptions] = useState<Slave[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [creating, setCreating] = useState(false);
  const quickMemoryGb = [2, 4, 8, 16, 32, 64];
  const quickDiskGb = [20, 50, 100, 200, 500];

  const toast = useToast();

  const availableSlaves = slaveOptions
    .map((s) => s.MachineName)
    .filter((s) => !selectedSlaves.includes(s));

  useEffect(() => {
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const [fetchedIsos, fetchedMounts, fetchedSlaves] = await Promise.all([
          listIsos(),
          listMounts(),
          listSlaves(),
        ]);
        setIsoOptions(fetchedIsos);
        setMountOptions(fetchedMounts);
        setSlaveOptions(fetchedSlaves);
      } catch (err) {
        console.error("Failed to list ISOs or mounts:", err);
        toast.show({
          placement: "top",
          render: ({ id }) => (
            <Toast
              nativeID={"toast-" + id}
              className="px-5 py-3 gap-3 shadow-soft-1"
              action="error"
            >
              <ToastTitle size="sm">Error loading lists</ToastTitle>
              <ToastDescription size="sm">
                Could not list ISOs/NFS. Check the connection and try again.
              </ToastDescription>
            </Toast>
          ),
        });
      } finally {
        setLoadingOptions(false);
      }
    };

    if (showModal && isoOptions.length === 0 && mountOptions.length === 0) {
      fetchOptions();
    }
  }, [showModal, isoOptions.length, mountOptions.length, toast]);

  const handleGetMutualCPUs = async () => {
    if (selectedSlaves.length === 0) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1"
            action="error"
          >
            <ToastTitle size="sm">Error</ToastTitle>
            <ToastDescription size="sm">Select at least one slave.</ToastDescription>
          </Toast>
        ),
      });
      return;
    }

    setLoadingCPU(true);

    try {
      const cpuXmlResult = await getCpuDisableFeatures(selectedSlaves);
      setCpuXml(cpuXmlResult);
    } catch (error) {
      console.error("Error fetching CPUs:", error);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1"
            action="error"
          >
            <ToastTitle size="sm">Error</ToastTitle>
            <ToastDescription size="sm">Failed to fetch CPUs. Check the console for more details.</ToastDescription>
          </Toast>
        ),
      });
    } finally {
      setLoadingCPU(false);
    }
  };

  const handleCreate = async () => {
    const parsedMemory = parseInt(memory, 10);
    const parsedVcpu = parseInt(vcpu, 10);
    const parsedDisk = parseInt(disk, 10);

    const hasIso = Boolean(iso && parseInt(iso, 10));
    const hasNetwork = Boolean(network && network.trim().length > 0);

    if (
      !name ||
      !slave ||
      !hasIso ||
      !nfsShare ||
      !parsedMemory ||
      !parsedVcpu ||
      !parsedDisk ||
      !hasNetwork
    ) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1"
            action="error"
          >
            <ToastTitle size="sm">Error</ToastTitle>
            <ToastDescription size="sm">
              Name, Slave, ISO, NFS Share, Network, vCPU, Memory, and Disk are required.
            </ToastDescription>
          </Toast>
        ),
      });
      return;
    }

    setCreating(true);
    try {
      const vmData = {
        machine_name: slave,
        name,
        memory: parsedMemory,
        vcpu: parsedVcpu,
        disk_sizeGB: parsedDisk,
        iso_id: iso ? parseInt(iso) : undefined,
        nfs_share_id: parseInt(nfsShare),
        network,
        VNC_password: vncPassword,
        live,
        cpu_xml:
          cpuXml ||
          "<cpu mode='custom' match='exact'> <model fallback='allow'>Broadwell-IBRS</model> <vendor>Intel</vendor></cpu>",
        auto_start: autoStart,
        is_windows: isWindows,
      };

      await createVm(vmData);

      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1"
            action="success"
          >
            <ToastTitle size="sm">VM created successfully</ToastTitle>
          </Toast>
        ),
      });

      if (onSuccess) onSuccess();
      setShowModal(false);

      // Reset form
      setName("");
      setSlave("");
      setVcpu("2");
      setMemory("4096");
      setDisk("50");
      setIso("");
      setNfsShare("");
      setNetwork("default");
      setVncPassword("");
      setAutoStart(false);
      setIsWindows(false);
      setLive(false);
      setSelectedSlaves([]);
      setCpuXml("");
    } catch (error) {
      console.error("Error creating VM:", error);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1"
            action="error"
          >
            <ToastTitle size="sm">Error creating VM</ToastTitle>
            <ToastDescription size="sm">
              {error instanceof Error ? error.message : String(error)}
            </ToastDescription>
          </Toast>
        ),
      });
    }
    setCreating(false);
  };

  const handleCopyXml = async () => {
    if (cpuXml) {
      await Clipboard.setStringAsync(cpuXml);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1"
            action="success"
          >
            <ToastTitle size="sm">XML copied</ToastTitle>
          </Toast>
        ),
      });
    }
  };

  return (
    <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="full">
      <ModalBackdrop />
      <ModalContent className="max-w-[90%] max-h-[90%] web:max-w-4xl dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
        <ModalHeader className="border-b pb-4 border-outline-100 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
          <Heading
            size="lg"
            className="text-typography-900 dark:text-[#E8EBF0]"
            style={{fontFamily: "Inter_700Bold"}}
          >
            Create Virtual Machine
          </Heading>
          <ModalCloseButton>
            <X className="text-typography-700 dark:text-[#E8EBF0]" />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody className="bg-background-50 dark:border-[#1E2F47] dark:bg-[#0F1A2E]">
          <ScrollView showsVerticalScrollIndicator={true}>
            <Box className="p-4 web:p-6">
              {/* SEÇÃO 1: CAMPOS BÁSICOS */}
              <VStack className="gap-4 web:grid web:grid-cols-2 web:gap-4">
                {/* Nome da VM */}
                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#8A94A8]"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    VM Name
                  </Text>
                  <Input
                    variant="outline"
                    className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]"
                  >
                    <InputField
                      value={name}
                      onChangeText={setName}
                      placeholder="vm-web-01"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                  </Input>
                </VStack>

                {/* Slave */}
                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#8A94A8]"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    Slave
                  </Text>
                  <Select
                    selectedValue={slave}
                    onValueChange={setSlave}
                    isDisabled={loadingOptions || slaveOptions.length === 0}
                  >
                    <SelectTrigger className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
                      <SelectInput
                        placeholder={
                          loadingOptions ? "Loading..." : "Select..."
                        }
                        className="dark:text-[#E8EBF0]"
                      />
                      <SelectIcon as={ChevronDown} className="mr-3" />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent className="bg-background-0 dark:bg-[#0E1828]">
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        {slaveOptions.length === 0 ? (
                          <SelectItem
                            label={
                              loadingOptions ? "Loading..." : "No slaves found"
                            }
                            value=""
                            isDisabled
                          />
                        ) : (
                          slaveOptions.map((s) => (
                            <SelectItem
                              key={s.MachineName}
                              label={s.MachineName}
                              value={s.MachineName}
                              className="text-typography-900 dark:text-[#E8EBF0]"
                            />
                          ))
                        )}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </VStack>

                {/* vCPU */}
                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#8A94A8]"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    vCPU
                  </Text>
                  <Input
                    variant="outline"
                    className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]"
                  >
                    <InputField
                      value={vcpu}
                      onChangeText={setVcpu}
                      keyboardType="numeric"
                      placeholder="2"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                  </Input>
                </VStack>

                {/* Memória */}
                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#8A94A8]"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    Memory (MB)
                  </Text>
                  <Input
                    variant="outline"
                    className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]"
                  >
                    <InputField
                      value={memory}
                      onChangeText={setMemory}
                      keyboardType="numeric"
                      placeholder="4096"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                  </Input>
                  <HStack className="gap-2 flex-wrap">
                    {quickMemoryGb.map((gb) => (
                      <Pressable
                        key={`mem-${gb}`}
                        onPress={() => setMemory(String(gb * 1024))}
                        className={`px-3 py-2 rounded-full border ${
                          Number(memory) === gb * 1024
                            ? "rounded-full px-3 border-outline-200 dark:bg-[#213250] dark:border-[#1E2F47]"
                            : "rounded-full px-3 border-outline-200 dark:bg-[#0F1A2E] dark:border-[#1E2F47]"
                        }`}
                      >
                        <Text className="text-xs font-medium text-typography-700">
                          {gb} GB
                        </Text>
                      </Pressable>
                    ))}
                  </HStack>
                </VStack>

                {/* Disco */}
                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#8A94A8]"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    Disk (GB)
                  </Text>
                  <Input
                    variant="outline"
                    className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]"
                  >
                    <InputField
                      value={disk}
                      onChangeText={setDisk}
                      keyboardType="numeric"
                      placeholder="50"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                  </Input>
                  <HStack className="gap-2 flex-wrap">
                    {quickDiskGb.map((gb) => (
                      <Pressable
                        key={`disk-${gb}`}
                        onPress={() => setDisk(String(gb))}
                        className={`px-3 py-2 rounded-full border ${
                          Number(disk) === gb
                            ? "rounded-full px-3 border-outline-200 dark:bg-[#213250] dark:border-[#1E2F47]"
                            : "rounded-full px-3 border-outline-200 dark:bg-[#0F1A2E] dark:border-[#1E2F47]"
                        }`}
                      >
                        <Text className="text-xs font-medium text-typography-700">
                          {gb} GB
                        </Text>
                      </Pressable>
                    ))}
                  </HStack>
                </VStack>

                {/* Network */}
                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#8A94A8]"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    Network
                  </Text>
                  <Select
                    selectedValue={
                      network === "default" || network === "512rede"
                        ? network
                        : "outro"
                    }
                    onValueChange={(value) => {
                      if (value === "outro") {
                        setNetwork("");
                      } else {
                        setNetwork(value);
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
                      <SelectInput
                        placeholder="Select network"
                        className="text-typography-900 dark:text-[#E8EBF0]"
                      />
                      <SelectIcon as={ChevronDown} className="mr-3" />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent className="bg-background-0 dark:bg-[#0E1828]">
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        <SelectItem
                          label="default"
                          value="default"
                          className="text-typography-900 dark:text-[#E8EBF0]"
                        />
                        <SelectItem
                          label="512rede"
                          value="512rede"
                          className="text-typography-900 dark:text-[#E8EBF0]"
                        />
                        <SelectItem
                          label="other..."
                          value="outro"
                          className="text-typography-900 dark:text-[#E8EBF0]"
                        />
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                  {network !== "default" && network !== "512rede" && (
                    <Input
                      variant="outline"
                      className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828] mt-2"
                    >
                      <InputField
                        value={network}
                        onChangeText={setNetwork}
                        placeholder="Enter the network name"
                        className="text-typography-900 dark:text-[#E8EBF0]"
                      />
                    </Input>
                  )}
                </VStack>

                {/* NFS Share ID */}
                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#8A94A8]"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    NFS Share ID
                  </Text>
                  <Select
                    selectedValue={nfsShare}
                    onValueChange={setNfsShare}
                    isDisabled={loadingOptions || mountOptions.length === 0}
                  >
                    <SelectTrigger variant="outline" size="md">
                      <SelectInput
                        placeholder={
                          loadingOptions ? "Loading..." : "Select NFS"
                        }
                      />
                      <SelectIcon className="mr-3" as={ChevronDownIcon} />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        {mountOptions.length === 0 ? (
                          <SelectItem
                            label={
                              loadingOptions ? "Loading..." : "No NFS found"
                            }
                            value=""
                            isDisabled
                          />
                        ) : (
                          mountOptions.map((s) => (
                            <SelectItem
                              key={s.NfsShare.Id}
                              label={s.NfsShare.Name}
                              value={String(s.NfsShare.Id)}
                              className="text-typography-900 dark:text-[#E8EBF0]"
                            />
                          ))
                        )}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </VStack>

                {/* ISO ID */}
                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-[#8A94A8]"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    ISO ID (Optional)
                  </Text>
                  <Select
                    selectedValue={iso}
                    onValueChange={setIso}
                    isDisabled={loadingOptions || isoOptions.length === 0}
                  >
                    <SelectTrigger variant="outline" size="md">
                      <SelectInput
                        placeholder={
                          loadingOptions ? "Loading..." : "Select ISO"
                        }
                      />
                      <SelectIcon className="mr-3" as={ChevronDownIcon} />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        {isoOptions.length === 0 ? (
                          <SelectItem
                            label={
                              loadingOptions ? "Loading..." : "No ISO found"
                            }
                            value=""
                            isDisabled
                          />
                        ) : (
                          isoOptions.map((s) => (
                            <SelectItem
                              key={s.Id}
                              label={s.Name}
                              value={String(s.Id)}
                              className="text-typography-900 dark:text-[#E8EBF0]"
                            />
                          ))
                        )}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                </VStack>
              </VStack>

              {/* SEÇÃO 2: CHECKBOXES */}
              <VStack className="gap-3 mt-6">
                <Checkbox
                  value="autostart"
                  isChecked={autoStart}
                  onChange={setAutoStart}
                  className="gap-2"
                >
                  <CheckboxIndicator className="border-outline-300 dark:border-[#2A3B52]">
                    <CheckboxIcon as={Check} />
                  </CheckboxIndicator>
                  <CheckboxLabel className="text-typography-700 dark:text-[#8A94A8]">
                    Auto-start on slave boot
                  </CheckboxLabel>
                </Checkbox>

                <Checkbox
                  value="windows"
                  isChecked={isWindows}
                  onChange={setIsWindows}
                  className="gap-2"
                >
                  <CheckboxIndicator className="border-outline-300 dark:border-[#2A3B52]">
                    <CheckboxIcon as={Check} />
                  </CheckboxIndicator>
                  <CheckboxLabel className="text-typography-700 dark:text-[#8A94A8]">
                    Windows VM
                  </CheckboxLabel>
                </Checkbox>

                <Checkbox
                  value="live"
                  isChecked={live}
                  onChange={setLive}
                  className="gap-2"
                >
                  <CheckboxIndicator className="border-outline-300 dark:border-[#2A3B52]">
                    <CheckboxIcon as={Check} />
                  </CheckboxIndicator>
                  <CheckboxLabel className="text-typography-700 dark:text-[#8A94A8]">
                    Live VM
                  </CheckboxLabel>
                </Checkbox>
              </VStack>

              {/* SEÇÃO 3: VNC PASSWORD */}
              <VStack className="gap-2 mt-6">
                <Text
                  className="text-sm text-typography-700 dark:text-[#8A94A8]"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  VNC Password
                </Text>
                <Input
                  variant="outline"
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]"
                >
                  <InputField
                    value={vncPassword}
                    onChangeText={setVncPassword}
                    placeholder="Insert NoVNC Password (optional)"
                    secureTextEntry={true}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
              </VStack>

              {/* SEÇÃO 4: CONFIGURAÇÃO AVANÇADA DE CPU */}
              {live && (
                <Box className="mt-6 p-4 bg-background-0 dark:bg-[#0F1A2E] border border-outline-200 dark:border-[#2A3B52] rounded-xl">
                  {/* Header */}
                  <HStack className="gap-2 items-center mb-3">
                    <Cpu
                      size={20}
                      className="text-typography-700 dark:text-[#E8EBF0]"
                    />
                    <Heading
                      size="sm"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                      style={{fontFamily: "Inter_700Bold"}}
                    >
                      Advanced CPU Configuration
                    </Heading>
                  </HStack>

                  <Text className="text-sm text-typography-600 dark:text-[#8A94A8] mb-4">
                    Select slaves to compare and get a CPU configuration
                    compatible between them.
                  </Text>

                  {/* Lista de Slaves Selecionados */}
                  <VStack className="gap-2 mb-4">
                    <Text
                      className="text-sm text-typography-700 dark:text-[#8A94A8]"
                      style={{fontFamily: "Inter_600SemiBold"}}
                    >
                      Selected slaves ({selectedSlaves.length})
                    </Text>

                    <Box className="p-3 bg-background-50 dark:bg-[#0A1628] border border-outline-200 dark:border-[#1E2F47] rounded-lg min-h-[60px]">
                      {selectedSlaves.length === 0 ? (
                        <Text className="text-sm text-typography-400 dark:text-typography-500 text-center">
                          No slave selected
                        </Text>
                      ) : (
                        <HStack className="gap-2 flex-wrap">
                          {selectedSlaves.map((slaveName) => (
                            <Badge
                              key={slaveName}
                              variant="solid"
                              className="rounded-full bg-typography-100 dark:bg-[#1E2F47]"
                            >
                              <HStack className="gap-1 items-center">
                                <BadgeText className="text-typography-900 dark:text-[#E8EBF0]">
                                  {slaveName}
                                </BadgeText>
                                <Button
                                  size="xs"
                                  variant="link"
                                  onPress={() => {
                                    setSelectedSlaves(
                                      selectedSlaves.filter(
                                        (s) => s !== slaveName,
                                      ),
                                    );
                                  }}
                                  className="p-0 min-w-0 h-4"
                                >
                                  <ButtonIcon
                                    as={X}
                                    size="xs"
                                    className="text-typography-700 dark:text-[#E8EBF0]"
                                  />
                                </Button>
                              </HStack>
                            </Badge>
                          ))}
                        </HStack>
                      )}
                    </Box>
                  </VStack>

                  {/* Dropdown Adicionar Slaves */}
                  <VStack className="gap-2 mb-4">
                    <Text
                      className="text-sm text-typography-700 dark:text-[#8A94A8]"
                      style={{fontFamily: "Inter_600SemiBold"}}
                    >
                      Add slave to comparison
                    </Text>

                    <Select
                      selectedValue={currentSlaveSelect}
                      onValueChange={(value) => {
                        if (
                          value &&
                          slaveOptions.find((s) => s.MachineName === value) &&
                          !selectedSlaves.includes(value)
                        ) {
                          setSelectedSlaves([...selectedSlaves, value]);
                          setCurrentSlaveSelect("");
                        }
                      }}
                      isDisabled={
                        loadingOptions || availableSlaves.length === 0
                      }
                    >
                      <SelectTrigger className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1828]">
                        <SelectInput
                          placeholder={
                            loadingOptions ? "Loading..." : "Select a slave..."
                          }
                          className="text-typography-900 dark:text-[#E8EBF0]"
                        />
                        <SelectIcon as={ChevronDown} className="mr-3" />
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent className="bg-background-0 dark:bg-[#0E1828]">
                          <SelectDragIndicatorWrapper>
                            <SelectDragIndicator />
                          </SelectDragIndicatorWrapper>

                          {availableSlaves.length === 0 ? (
                            <SelectItem
                              label="All slaves have been added"
                              value=""
                              isDisabled
                            />
                          ) : (
                            availableSlaves.map((s) => (
                              <SelectItem
                                key={s}
                                label={s}
                                value={s}
                                className="text-typography-900 dark:text-[#E8EBF0]"
                              />
                            ))
                          )}
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  </VStack>

                  {/* Botão Get Mutual CPUs */}
                  <Button
                    variant="outline"
                    onPress={handleGetMutualCPUs}
                    disabled={selectedSlaves.length === 0 || loadingCPU}
                    className="rounded-lg mb-4 border-outline-200 dark:border-[#2A3B52]"
                  >
                    {loadingCPU ? (
                      <>
                        <ButtonSpinner className="mr-2" />
                        <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                          Fetching CPUs...
                        </ButtonText>
                      </>
                    ) : (
                      <>
                        <ButtonIcon
                          as={Cpu}
                          className="mr-2 text-typography-900 dark:text-[#E8EBF0]"
                        />
                        <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                          Get Mutual CPUs
                        </ButtonText>
                      </>
                    )}
                  </Button>

                  {/* XML TextArea */}
                  <VStack className="gap-2">
                    <HStack className="justify-between items-center">
                      <Text
                        className="text-sm text-typography-700 dark:text-[#8A94A8]"
                        style={{fontFamily: "Inter_600SemiBold"}}
                      >
                        CPU Configuration XML
                      </Text>

                      <HStack className="gap-2">
                        <Button
                          size="xs"
                          variant="outline"
                          onPress={handleCopyXml}
                          disabled={!cpuXml}
                          className="rounded-md border-outline-200 dark:border-[#2A3B52]"
                        >
                          <ButtonIcon
                            as={Copy}
                            size="xs"
                            className="text-typography-700 dark:text-[#E8EBF0]"
                          />
                        </Button>

                        <Button
                          size="xs"
                          variant="outline"
                          onPress={() => setCpuXml("")}
                          disabled={!cpuXml}
                          className="rounded-md border-red-300 dark:border-red-700"
                        >
                          <ButtonIcon
                            as={Trash2}
                            size="xs"
                            className="text-red-600 dark:text-red-400"
                          />
                        </Button>
                      </HStack>
                    </HStack>

                    <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
                      This XML configures the VM CPU. You can edit it manually
                      if needed.
                    </Text>

                    <Box className="bg-[#0F172A] border border-[#1E2F47] rounded-lg overflow-hidden">
                      <Box className="bg-[#0A0E1A] px-3 py-2 border-b border-[#1E2F47] flex-row justify-between items-center">
                        <Text className="text-xs text-[#64748B] font-mono">
                          XML Editor
                        </Text>
                        <Text className="text-xs text-[#475569]">
                          {cpuXml.length} chars
                        </Text>
                      </Box>
                      <StableTextInput
                        defaultValue={cpuXml}
                        onChangeText={setCpuXml}
                        multiline
                        scrollEnabled
                        autoCorrect={false}
                        autoCapitalize="none"
                        spellCheck={false}
                        textAlignVertical="top"
                        style={{
                          fontFamily: Platform.select({
                            ios: "Menlo",
                            android: "monospace",
                          }),
                          color: cpuXml ? "#22C55E" : "#64748B",
                          backgroundColor: "#0F172A",
                          fontSize: 12,
                          lineHeight: 18,
                          padding: 12,
                          height: 240,
                        }}
                      />
                    </Box>
                  </VStack>
                </Box>
              )}
            </Box>
          </ScrollView>
        </ModalBody>

        <ModalFooter className="border-t border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0F1A2E]">
          <HStack className="gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1 rounded-lg border-outline-200 dark:border-[#2A3B52]"
              onPress={() => setShowModal(false)}
              disabled={creating}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                Cancel
              </ButtonText>
            </Button>

            <Button
              className={`flex-1 rounded-lg ${primaryButtonClass}`}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? <ButtonSpinner className="mr-2" /> : null}
              <ButtonText className={`${primaryButtonTextClass}`}>
                Create VM
              </ButtonText>
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
