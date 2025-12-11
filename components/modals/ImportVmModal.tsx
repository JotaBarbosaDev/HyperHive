import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { ScrollView, Platform, TextInput } from "react-native";
import { Cpu, X, Copy, Trash2, ChevronDown, Check, Upload } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { useToast, Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";
import { importVm, listSlaves, Slave, getCpuDisableFeatures } from "@/services/vms-client";
import { listMounts } from "@/services/hyperhive";
import { Mount } from "@/types/mount";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";

type ImportVmModalProps = {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onSuccess?: (importedName?: string) => void;
};

const DEFAULT_CPU_XML =
  "<cpu mode='custom' match='exact'> <model fallback='allow'>Broadwell-noTSX-IBRS</model> <vendor>Intel</vendor> </cpu>";

export default function ImportVmModal({ showModal, setShowModal, onSuccess }: ImportVmModalProps) {
  const [vmName, setVmName] = useState("");
  const [slave, setSlave] = useState("");
  const [vcpu, setVcpu] = useState("4");
  const [memory, setMemory] = useState("4096");
  const [nfsShare, setNfsShare] = useState("");
  const [network, setNetwork] = useState("default");
  const [vncPassword, setVncPassword] = useState("");
  const [live, setLive] = useState(false);
  const [cpuXml, setCpuXml] = useState("");

  const [selectedSlaves, setSelectedSlaves] = useState<string[]>([]);
  const [currentSlaveSelect, setCurrentSlaveSelect] = useState("");
  const [loadingCPU, setLoadingCPU] = useState(false);

  const [slaveOptions, setSlaveOptions] = useState<Slave[]>([]);
  const [mountOptions, setMountOptions] = useState<Mount[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const toast = useToast();
  const isWeb = Platform.OS === "web";
  const quickMemoryGb = [2, 4, 8, 16, 32, 64];

  const availableSlaves = useMemo(
    () => slaveOptions.map((s) => s.MachineName).filter((s) => !selectedSlaves.includes(s)),
    [selectedSlaves, slaveOptions]
  );

  useEffect(() => {
    if (!showModal) {
      return;
    }
    if (slaveOptions.length > 0 && mountOptions.length > 0) {
      return;
    }
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const [fetchedMounts, fetchedSlaves] = await Promise.all([listMounts(), listSlaves()]);
        setMountOptions(fetchedMounts);
        setSlaveOptions(fetchedSlaves);
      } catch (error) {
        console.error("Erro ao carregar NFS/Slaves:", error);
        toast.show({
          placement: "top",
          render: ({ id }) => (
            <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1" action="error">
              <ToastTitle size="sm">Error loading lists</ToastTitle>
              <ToastDescription size="sm">Could not list NFS/Slaves. Check the connection and try again.</ToastDescription>
            </Toast>
          ),
        });
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [showModal, slaveOptions.length, mountOptions.length, toast]);

  const handleGetMutualCPUs = async () => {
    if (selectedSlaves.length === 0) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1" action="error">
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
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1" action="error">
            <ToastTitle size="sm">Error</ToastTitle>
            <ToastDescription size="sm">Failed to fetch CPUs. Check the console for more details.</ToastDescription>
          </Toast>
        ),
      });
    } finally {
      setLoadingCPU(false);
    }
  };

  const formatFileSize = (size: number) => {
    if (!Number.isFinite(size)) {
      return "";
    }
    if (size >= 1024 * 1024 * 1024) {
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (size >= 1024) {
      return `${(size / 1024).toFixed(0)} KB`;
    }
    return `${size} B`;
  };

  const resetForm = () => {
    setVmName("");
    setSlave("");
    setVcpu("4");
    setMemory("4096");
    setNfsShare("");
    setNetwork("default");
    setVncPassword("");
    setLive(false);
    setCpuXml("");
    setSelectedSlaves([]);
    setCurrentSlaveSelect("");
    setSelectedFile(null);
    setUploadProgress(null);
  };

  const handleImport = async () => {
    const parsedMemory = parseInt(memory, 10);
    const parsedVcpu = parseInt(vcpu, 10);
    const hasNetwork = Boolean(network && network.trim().length > 0);

    if (!vmName || !slave || !nfsShare || !parsedMemory || !parsedVcpu || !hasNetwork || !selectedFile) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1" action="error">
            <ToastTitle size="sm">Required data missing</ToastTitle>
            <ToastDescription size="sm">Name, Slave, NFS Share, Network, vCPU, Memory, and VM file are required.</ToastDescription>
          </Toast>
        ),
      });
      return;
    }

    if (!isWeb) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1" action="error">
            <ToastTitle size="sm">Import available only in the browser</ToastTitle>
          </Toast>
        ),
      });
      return;
    }

    setImporting(true);
    setUploadProgress(0);
    try {
      await importVm(
        {
          slave_name: slave,
          nfs_share_id: parseInt(nfsShare, 10),
          vm_name: vmName,
          memory: parsedMemory,
          vcpu: parsedVcpu,
          network,
          VNC_password: vncPassword || undefined,
          cpu_xml: cpuXml || DEFAULT_CPU_XML,
          live,
        },
        selectedFile,
        {
          onProgress: (percent) => setUploadProgress(percent),
        }
      );

      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1" action="success">
            <ToastTitle size="sm">Import started</ToastTitle>
            <ToastDescription size="sm">The VM disk upload was sent to the server.</ToastDescription>
          </Toast>
        ),
      });

      if (onSuccess) {
        onSuccess(vmName);
      }
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error importing VM:", error);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1" action="error">
            <ToastTitle size="sm">Error importing VM</ToastTitle>
            <ToastDescription size="sm">
              {error instanceof Error ? error.message : String(error)}
            </ToastDescription>
          </Toast>
        ),
      });
    }
    setImporting(false);
    setUploadProgress(null);
  };

  const handleCopyXml = async () => {
    if (!cpuXml) return;
    try {
      // Clipboard already required dynamically in CreateVmModal; using optional require here keeps parity.
      const Clipboard = require("expo-clipboard");
      await Clipboard.setStringAsync(cpuXml);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} className="px-5 py-3 gap-3 shadow-soft-1" action="success">
            <ToastTitle size="sm">XML copied</ToastTitle>
          </Toast>
        ),
      });
    } catch (err) {
      console.warn("Clipboard unavailable", err);
    }
  };

  return (
    <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="full">
      <ModalBackdrop />
      <ModalContent className="max-w-[90%] max-h-[90%] web:max-w-4xl">
        <ModalHeader className="border-b border-outline-100 dark:border-[#2A3B52]">
          <Heading
            size="lg"
            className="text-typography-900 dark:text-[#E8EBF0]"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            Import Virtual Machine
          </Heading>
          <ModalCloseButton>
            <X className="text-typography-700 dark:text-[#E8EBF0]" />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody className="bg-background-50 dark:bg-[#0A1628]">
          <ScrollView showsVerticalScrollIndicator>
            <Box className="p-4 web:p-6">
              <VStack className="gap-4 web:grid web:grid-cols-2 web:gap-4">
                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-typography-300"
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    VM Name
                  </Text>
                  <Input variant="outline" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]">
                    <InputField
                      value={vmName}
                      onChangeText={setVmName}
                      placeholder="vm-importada-01"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                  </Input>
                </VStack>

                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-typography-300"
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    Slave
                  </Text>
                  <Select selectedValue={slave} onValueChange={setSlave} isDisabled={loadingOptions || slaveOptions.length === 0}>
                    <SelectTrigger className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]">
                      <SelectInput placeholder={loadingOptions ? "Loading..." : "Select..."} className="text-typography-900 dark:text-[#E8EBF0]" />
                      <SelectIcon as={ChevronDown} className="mr-3" />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent className="bg-background-0 dark:bg-[#151F30]">
                        <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {slaveOptions.length === 0 ? (
                        <SelectItem label={loadingOptions ? "Loading..." : "No slaves found"} value="" isDisabled />
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

                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-typography-300"
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    vCPU
                  </Text>
                  <Input variant="outline" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]">
                    <InputField
                      value={vcpu}
                      onChangeText={setVcpu}
                      keyboardType="numeric"
                      placeholder="4"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                  </Input>
                </VStack>

                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-typography-300"
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    Memory (MB)
                  </Text>
                  <Input variant="outline" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]">
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
                          Number(memory) === gb * 1024 ? "border-primary-500 bg-primary-50" : "border-outline-200 bg-background-0"
                        }`}
                      >
                        <Text className="text-xs font-medium text-typography-700">{gb} GB</Text>
                      </Pressable>
                    ))}
                  </HStack>
                </VStack>

                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-typography-300"
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    Network
                  </Text>
                  <Select
                    selectedValue={network === "default" || network === "512rede" ? network : "outro"}
                    onValueChange={(value) => {
                      if (value === "outro") {
                        setNetwork("");
                      } else {
                        setNetwork(value);
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]">
                      <SelectInput placeholder="Select network" className="text-typography-900 dark:text-[#E8EBF0]" />
                      <SelectIcon as={ChevronDown} className="mr-3" />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent className="bg-background-0 dark:bg-[#151F30]">
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        <SelectItem label="default" value="default" className="text-typography-900 dark:text-[#E8EBF0]" />
                        <SelectItem label="512rede" value="512rede" className="text-typography-900 dark:text-[#E8EBF0]" />
                        <SelectItem label="other..." value="outro" className="text-typography-900 dark:text-[#E8EBF0]" />
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                  {network !== "default" && network !== "512rede" && (
                    <Input variant="outline" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] mt-2">
                      <InputField
                        value={network}
                        onChangeText={setNetwork}
                        placeholder="Enter the network name"
                        className="text-typography-900 dark:text-[#E8EBF0]"
                      />
                    </Input>
                  )}
                </VStack>

                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-typography-300"
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    NFS Share ID
                  </Text>
                  <Select selectedValue={nfsShare} onValueChange={setNfsShare} isDisabled={loadingOptions || mountOptions.length === 0}>
                    <SelectTrigger variant="outline" size="md">
                      <SelectInput placeholder={loadingOptions ? "Loading..." : "Select NFS"} />
                      <SelectIcon className="mr-3" as={ChevronDown} />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        {mountOptions.length === 0 ? (
                          <SelectItem label={loadingOptions ? "Loading..." : "No NFS found"} value="" isDisabled />
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

                <VStack className="gap-2">
                  <Text
                    className="text-sm text-typography-700 dark:text-typography-300"
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    VNC Password (optional)
                  </Text>
                  <Input variant="outline" className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]">
                    <InputField
                      value={vncPassword}
                      onChangeText={setVncPassword}
                      placeholder="Insert NoVNC Password (optional)"
                      secureTextEntry
                      className="text-typography-900 dark:text-[#E8EBF0]"
                    />
                  </Input>
                </VStack>
              </VStack>

              <VStack className="gap-3 mt-6">
                <Text
                  className="text-sm text-typography-700 dark:text-typography-300"
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  VM file
                </Text>
                {isWeb ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".qcow2,.qcow,.img,.raw,.vmdk"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setSelectedFile(file);
                      }}
                    />
                    <Pressable
                      onPress={() => fileInputRef.current?.click()}
                      className="border border-dashed border-outline-300 dark:border-[#2A3B52] rounded-lg p-4 bg-background-0 dark:bg-[#0F1A2E]"
                    >
                      <HStack className="items-center gap-3">
                        <Box className="w-10 h-10 rounded-full bg-primary-50 dark:bg-[#1E2F47] items-center justify-center">
                          <Upload className="text-primary-500" />
                        </Box>
                        <VStack className="flex-1">
                          <Text className="text-typography-900 dark:text-[#E8EBF0]" style={{ fontFamily: "Inter_600SemiBold" }}>
                            {selectedFile ? selectedFile.name : "Select the .qcow2 file"}
                          </Text>
                          <Text className="text-xs text-typography-600 dark:text-typography-400">
                            {selectedFile ? formatFileSize(selectedFile.size) : "Maximum size depends on the backend"}
                          </Text>
                        </VStack>
                      </HStack>
                    </Pressable>
                    {typeof uploadProgress === "number" && (
                      <Box className="mt-3">
                        <HStack className="justify-between mb-1">
                          <Text className="text-xs text-typography-600 dark:text-typography-400">Upload progress</Text>
                          <Text className="text-xs text-typography-600 dark:text-typography-400">{uploadProgress}%</Text>
                        </HStack>
                        <Progress value={uploadProgress} className="h-2 rounded-full bg-outline-100 dark:bg-[#1E2F47]">
                          <ProgressFilledTrack className="bg-primary-500" />
                        </Progress>
                      </Box>
                    )}
                  </>
                ) : (
                  <Box className="border border-outline-200 dark:border-[#2A3B52] rounded-lg p-3 bg-background-0 dark:bg-[#0F1A2E]">
                    <Text className="text-sm text-typography-600 dark:text-typography-400">
                      Importing with disk upload is available only on the web version.
                    </Text>
                  </Box>
                )}
              </VStack>

              <VStack className="gap-3 mt-6">
                <Checkbox value="live" isChecked={live} onChange={setLive} className="gap-2">
                  <CheckboxIndicator className="border-outline-300 dark:border-[#2A3B52]">
                    <CheckboxIcon as={Check} />
                  </CheckboxIndicator>
                  <CheckboxLabel className="text-typography-700 dark:text-typography-300">
                    Live VM / custom CPU
                  </CheckboxLabel>
                </Checkbox>
              </VStack>

              {live && (
                <Box className="mt-4 p-4 bg-background-0 dark:bg-[#0F1A2E] border border-outline-200 dark:border-[#2A3B52] rounded-xl">
                  <HStack className="gap-2 items-center mb-3">
                    <Cpu size={20} className="text-typography-700 dark:text-[#E8EBF0]" />
                    <Heading
                      size="sm"
                      className="text-typography-900 dark:text-[#E8EBF0]"
                      style={{ fontFamily: "Inter_700Bold" }}
                    >
                      Advanced CPU Configuration
                    </Heading>
                  </HStack>

                  <Text className="text-sm text-typography-600 dark:text-typography-400 mb-4">
                    Select slaves to compare and get a CPU configuration compatible between them.
                  </Text>

                  <VStack className="gap-2 mb-4">
                    <Text
                      className="text-sm text-typography-700 dark:text-typography-300"
                      style={{ fontFamily: "Inter_600SemiBold" }}
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
                                    setSelectedSlaves(selectedSlaves.filter((s) => s !== slaveName));
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

                  <VStack className="gap-2 mb-4">
                    <Text
                      className="text-sm text-typography-700 dark:text-typography-300"
                      style={{ fontFamily: "Inter_600SemiBold" }}
                    >
                      Add slave to comparison
                    </Text>

                    <Select
                      selectedValue={currentSlaveSelect}
                      onValueChange={(value) => {
                        if (value && slaveOptions.find((s) => s.MachineName === value) && !selectedSlaves.includes(value)) {
                          setSelectedSlaves([...selectedSlaves, value]);
                          setCurrentSlaveSelect("");
                        }
                      }}
                      isDisabled={loadingOptions || availableSlaves.length === 0}
                    >
                      <SelectTrigger className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30]">
                        <SelectInput placeholder={loadingOptions ? "Loading..." : "Select a slave..."} className="text-typography-900 dark:text-[#E8EBF0]" />
                        <SelectIcon as={ChevronDown} className="mr-3" />
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent className="bg-background-0 dark:bg-[#151F30]">
                          <SelectDragIndicatorWrapper>
                            <SelectDragIndicator />
                          </SelectDragIndicatorWrapper>
                          {availableSlaves.length === 0 ? (
                            <SelectItem label="All slaves have been added" value="" isDisabled />
                          ) : (
                            availableSlaves.map((s) => (
                              <SelectItem key={s} label={s} value={s} className="text-typography-900 dark:text-[#E8EBF0]" />
                            ))
                          )}
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  </VStack>

                  <Button
                    variant="outline"
                    onPress={handleGetMutualCPUs}
                    disabled={selectedSlaves.length === 0 || loadingCPU}
                    className="rounded-lg mb-4 border-outline-200 dark:border-[#2A3B52]"
                  >
                    {loadingCPU ? (
                      <>
                        <ButtonSpinner className="mr-2" />
                        <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Fetching CPUs...</ButtonText>
                      </>
                    ) : (
                      <>
                        <ButtonIcon as={Cpu} className="mr-2 text-typography-900 dark:text-[#E8EBF0]" />
                        <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Get Mutual CPUs</ButtonText>
                      </>
                    )}
                  </Button>

                  <VStack className="gap-2">
                    <HStack className="justify-between items-center">
                      <Text
                        className="text-sm text-typography-700 dark:text-typography-300"
                        style={{ fontFamily: "Inter_600SemiBold" }}
                      >
                        CPU Configuration XML
                      </Text>

                      <HStack className="gap-2">
                        <Button size="xs" variant="outline" onPress={handleCopyXml} disabled={!cpuXml} className="rounded-md border-outline-200 dark:border-[#2A3B52]">
                          <ButtonIcon as={Copy} size="xs" className="text-typography-700 dark:text-[#E8EBF0]" />
                        </Button>

                        <Button
                          size="xs"
                          variant="outline"
                          onPress={() => setCpuXml("")}
                          disabled={!cpuXml}
                          className="rounded-md border-red-300 dark:border-red-700"
                        >
                          <ButtonIcon as={Trash2} size="xs" className="text-red-600 dark:text-red-400" />
                        </Button>
                      </HStack>
                    </HStack>

                    <Text className="text-xs text-typography-500 dark:text-typography-400">
                      This XML configures the VM CPU. You can edit it manually if needed.
                    </Text>

                    <Box className="bg-[#0F172A] border border-[#1E2F47] rounded-lg overflow-hidden">
                      <Box className="bg-[#0A0E1A] px-3 py-2 border-b border-[#1E2F47] flex-row justify-between items-center">
                        <Text className="text-xs text-[#64748B] font-mono">XML Editor</Text>
                        <Text className="text-xs text-[#475569]">{cpuXml.length} chars</Text>
                      </Box>
                      <TextInput
                        defaultValue={cpuXml}
                        onChangeText={setCpuXml}
                        multiline
                        scrollEnabled
                        autoCorrect={false}
                        autoCapitalize="none"
                        spellCheck={false}
                        textAlignVertical="top"
                        style={{
                          fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
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
              onPress={() => {
                resetForm();
                setShowModal(false);
              }}
              disabled={importing}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>

            <Button
              className="flex-1 rounded-lg bg-typography-900 dark:bg-[#E8EBF0]"
              onPress={handleImport}
              disabled={importing || !isWeb}
            >
              {importing ? <ButtonSpinner className="mr-2" /> : null}
              <ButtonText className="text-background-0 dark:text-typography-900">Import VM</ButtonText>
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
