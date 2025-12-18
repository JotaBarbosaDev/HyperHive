import React from "react";
import { ScrollView, RefreshControl } from "react-native";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@/components/ui/select";
import { Input, InputField } from "@/components/ui/input";
import { Divider } from "@/components/ui/divider";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { ChevronDownIcon } from "@/components/ui/icon";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@/components/ui/modal";
import { Machine } from "@/types/machine";
import { AutomaticMount, BtrfsRaid } from "@/types/btrfs";
import { listMachines } from "@/services/hyperhive";
import { createAutomaticMount, deleteAutomaticMount, listAutomaticMounts, listRaids } from "@/services/btrfs";
import { COMPRESSION_OPTIONS } from "@/constants/btrfs";
import { RefreshCcw, Plus, Trash2 } from "lucide-react-native";

const DEFAULT_COMPRESSION = "zstd:3";

const getCompressionLabel = (value?: string | null) => {
  if (value === null || value === undefined) return "None";
  return COMPRESSION_OPTIONS.find((opt) => opt.value === value)?.label ?? (value || "None");
};

const getRaidLabel = (uuid: string | undefined, raids: BtrfsRaid[]) => {
  if (!uuid) return "—";
  const raid = raids.find((r) => r.uuid === uuid);
  if (!raid) return uuid;
  return raid.mount_point || raid.name || raid.label || uuid;
};

export default function BtrfsAutomaticMountsScreen() {
  const toast = useToast();
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = React.useState<string>("");
  const [autoMounts, setAutoMounts] = React.useState<AutomaticMount[]>([]);
  const [raids, setRaids] = React.useState<BtrfsRaid[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const [formRaid, setFormRaid] = React.useState<string>("");
  const [formMountPoint, setFormMountPoint] = React.useState<string>("");
  const [formCompression, setFormCompression] = React.useState<string>(DEFAULT_COMPRESSION);
  const [saving, setSaving] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<number | null>(null);
  const [createModal, setCreateModal] = React.useState(false);

  const showToast = React.useCallback(
    (title: string, description: string, action: "success" | "error" = "success") => {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1 items-start flex-row"
            action={action}
          >
            <ToastTitle size="sm">{title}</ToastTitle>
            {description ? <ToastDescription size="sm">{description}</ToastDescription> : null}
          </Toast>
        ),
      });
    },
    [toast]
  );

  const loadMachines = React.useCallback(async () => {
    try {
      const data = await listMachines();
      const list = Array.isArray(data) ? data : [];
      setMachines(list);
      if (!selectedMachine && list.length > 0) {
        setSelectedMachine(list[0].MachineName);
      }
    } catch (err) {
      console.error("Failed to load machines", err);
      showToast("Error", "Failed to load machines.", "error");
    }
  }, [selectedMachine, showToast]);

  const loadData = React.useCallback(
    async (mode: "full" | "refresh" = "full") => {
      if (!selectedMachine) return;
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const [auto, raidList] = await Promise.all([
          listAutomaticMounts(selectedMachine),
          listRaids(selectedMachine),
        ]);
        setAutoMounts(Array.isArray(auto) ? auto : []);
        setRaids(Array.isArray(raidList) ? raidList : []);
      } catch (err) {
        console.error("Failed to load auto-mounts", err);
        showToast("Error", "Unable to load auto-mounts.", "error");
      } finally {
        if (mode === "full") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [selectedMachine, showToast]
  );

  React.useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  React.useEffect(() => {
    if (selectedMachine) {
      loadData("full");
    }
  }, [selectedMachine, loadData]);

  const handleCreate = async () => {
    if (!selectedMachine) return;
    if (!formRaid) {
      showToast("UUID requerido", "Selecione ou informe o RAID.", "error");
      return;
    }
    if (!formMountPoint.trim()) {
      showToast("Mount point requerido", "Informe o caminho para montar.", "error");
      return;
    }
    setSaving(true);
    try {
      await createAutomaticMount(selectedMachine, {
        uuid: formRaid,
        mount_point: formMountPoint.trim(),
        compression: formCompression,
      });
      showToast("Auto-mount created", "Rule added successfully.");
      setFormMountPoint("");
      await loadData("refresh");
    } catch (err) {
      console.error("Failed to create auto-mount", err);
      showToast("Create failed", "Check the data and try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: number) => {
    setRemovingId(id);
    try {
      await deleteAutomaticMount(id);
      showToast("Auto-mount removed", "Rule deleted.");
      await loadData("refresh");
    } catch (err) {
      console.error("Failed to delete auto-mount", err);
      showToast("Error", "Could not delete.", "error");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-5xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            BTRFS Auto-Mounts
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Regras que montam automaticamente RAIDs BTRFS ao iniciar a maquina.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <HStack className="gap-3 items-center flex-wrap">
              <Select selectedValue={selectedMachine} onValueChange={(val) => setSelectedMachine(val)}>
                <SelectTrigger className="min-w-[180px]">
                  <SelectInput placeholder="Machine" value={selectedMachine} />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {(machines ?? []).map((m) => (
                      <SelectItem key={m.MachineName} label={m.MachineName} value={m.MachineName} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
              <Button variant="outline" action="default" size="sm" onPress={() => loadData("refresh")}>
                <ButtonIcon as={RefreshCcw} size="sm" />
                <ButtonText>Refresh</ButtonText>
              </Button>
            </HStack>
            <Button action="primary" onPress={() => setCreateModal(true)}>
              <ButtonIcon as={Plus} size="sm" />
              <ButtonText>New Auto-mount</ButtonText>
            </Button>
          </HStack>

          <Box className="mt-6 rounded-2xl bg-background-0 border border-background-200 shadow-soft-1">
            <HStack className="items-center justify-between px-4 py-3">
              <Text className="text-typography-900 font-semibold text-base">Rules</Text>
              <Text className="text-typography-700 text-sm">{autoMounts.length} items</Text>
            </HStack>
            <Divider />
            {loading ? (
              <VStack className="gap-3 p-4">
                {[1, 2].map((i) => (
                  <Box key={i} className="p-3 rounded-xl border border-background-100">
                    <Skeleton className="h-5 w-1/2 mb-2" />
                    <SkeletonText className="w-1/3" />
                  </Box>
                ))}
              </VStack>
            ) : autoMounts.length === 0 ? (
              <Box className="p-4">
              <Text className="text-typography-600 text-sm">No rules configured.</Text>
              </Box>
            ) : (
              <VStack className="divide-y divide-background-200">
                {autoMounts.map((rule) => (
                  <Box key={rule.id} className="px-4 py-3">
                    <HStack className="justify-between items-start gap-3 flex-wrap">
                      <VStack className="gap-1">
                        <Text className="text-typography-900 font-semibold">{rule.mount_point}</Text>
                        <Text className="text-typography-700 text-sm">RAID: {getRaidLabel(rule.uuid || rule.raid_uuid, raids)}</Text>
                        <Text className="text-typography-600 text-sm">UUID: {rule.uuid || rule.raid_uuid}</Text>
                        <HStack className="gap-2 mt-1 flex-wrap">
                          <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                            <BadgeText className="text-xs text-typography-800">Compression: {getCompressionLabel(rule.compression)}</BadgeText>
                          </Badge>
                          {rule.machine_name ? (
                            <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                              <BadgeText className="text-xs text-typography-800">{rule.machine_name}</BadgeText>
                            </Badge>
                          ) : null}
                        </HStack>
                      </VStack>
                      <Button
                        action="negative"
                        variant="outline"
                        onPress={() => handleRemove(rule.id)}
                        isDisabled={removingId !== null}
                      >
                        {removingId === rule.id ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
                        <ButtonText>Remove</ButtonText>
                      </Button>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </Box>
      </ScrollView>

      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} size="lg">
        <ModalBackdrop />
        <ModalContent className="max-w-2xl">
          <ModalHeader className="flex-row items-start justify-between">
            <Heading size="md" className="text-typography-900">
              New Auto-mount
            </Heading>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4">
            <VStack className="gap-3">
              <Select selectedValue={formRaid} onValueChange={setFormRaid}>
                <SelectTrigger>
                  <SelectInput placeholder="Select RAID" value={getRaidLabel(formRaid, raids)} />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {(raids ?? []).map((r) => (
                      <SelectItem key={r.uuid} value={r.uuid} label={getRaidLabel(r.uuid, raids)} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
              <Input>
                <InputField value={formMountPoint} onChangeText={setFormMountPoint} placeholder="/mnt/raid" />
              </Input>
              <Select selectedValue={formCompression} onValueChange={setFormCompression}>
                <SelectTrigger>
                  <SelectInput placeholder="Compression" value={getCompressionLabel(formCompression)} />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {COMPRESSION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value || "none"} value={opt.value} label={opt.label} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </VStack>
          </ModalBody>
          <ModalFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setCreateModal(false)} isDisabled={saving}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button action="primary" onPress={() => handleCreate().then(() => setCreateModal(false))} isDisabled={saving}>
              {saving ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
              <ButtonText>Create</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
