import React from "react";
import { RefreshControl, ScrollView, Switch } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectItem,
  SelectIcon,
  SelectPortal,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectBackdrop,
} from "@/components/ui/select";
import { ChevronDownIcon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Divider } from "@/components/ui/divider";
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton } from "@/components/ui/modal";
import { AlertDialog, AlertDialogBackdrop, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, AlertDialogCloseButton } from "@/components/ui/alert-dialog";
import { FormControl, FormControlLabel, FormControlLabelText, FormControlHelper, FormControlHelperText } from "@/components/ui/form-control";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { BtrfsDisk, BtrfsRaid, AutomaticMount, BtrfsRaidDevice } from "@/types/btrfs";
import { Machine } from "@/types/machine";
import { listMachines } from "@/services/hyperhive";
import {
  addDiskRaid,
  balanceRaid,
  cancelBalance,
  changeRaidLevel,
  createAutomaticMount,
  createRaid,
  defragmentRaid,
  deleteAutomaticMount,
  getRaidStatus,
  getScrubStats,
  listAllDisks,
  listAutomaticMounts,
  listFreeDisks,
  listRaids,
  mountRaid,
  pauseBalance,
  removeDiskRaid,
  removeRaid,
  replaceDiskRaid,
  resumeBalance,
  scrubRaid,
  unmountRaid,
} from "@/services/btrfs";
import { ArrowRight, HardDrive, Plus, Power, RefreshCcw, Trash2 } from "lucide-react-native";

type FilterTab = "all" | "active" | "inactive";

const RAID_LEVELS = ["single", "raid0", "raid1", "raid5", "raid6", "raid10"];

const formatSize = (value?: string | number) => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "number") {
    if (value > 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (value > 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    if (value > 1024) return `${(value / 1024).toFixed(2)} KB`;
    return `${value} B`;
  }
  return value;
};

const formatDeviceDisplay = (device: BtrfsDisk | string): string => {
  if (typeof device === "string") return device;
  const dev = device.device || "";
  const model = device.model || "";
  if (model) return `${dev} - ${model}`;
  return dev;
};

const getRaidDeviceLabel = (dev: BtrfsRaidDevice | BtrfsDisk | string, disks: BtrfsDisk[]) => {
  if (typeof dev !== "string" && "model" in dev && dev.model) return formatDeviceDisplay(dev as BtrfsDisk);
  const path = typeof dev === "string" ? dev : (dev as any).device;
  const found = disks.find((d) => d.device === path);
  if (found) return formatDeviceDisplay(found);
  return typeof dev === "string" ? dev : formatDeviceDisplay(dev as BtrfsDisk);
};

const isRaidActive = (raid: BtrfsRaid) => raid.mounted !== false;

export default function BtrfsRaidsScreen() {
  const toast = useToast();
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [disks, setDisks] = React.useState<BtrfsDisk[]>([]);
  const [freeDisks, setFreeDisks] = React.useState<BtrfsDisk[]>([]);
  const [raids, setRaids] = React.useState<BtrfsRaid[]>([]);
  const [autoMounts, setAutoMounts] = React.useState<AutomaticMount[]>([]);
  const [filter, setFilter] = React.useState<FilterTab>("all");

  const [diskDetail, setDiskDetail] = React.useState<BtrfsDisk | null>(null);
  const [createModal, setCreateModal] = React.useState(false);
  const [raidModal, setRaidModal] = React.useState<BtrfsRaid | null>(null);
  const [raidStatus, setRaidStatus] = React.useState<Record<string, unknown> | null>(null);
  const [scrubStats, setScrubStats] = React.useState<Record<string, unknown> | null>(null);

  // create raid form
  const [raidName, setRaidName] = React.useState("");
  const [raidLevel, setRaidLevel] = React.useState("raid1");
  const [selectedDisks, setSelectedDisks] = React.useState<Set<string>>(new Set());
  const [creatingRaid, setCreatingRaid] = React.useState(false);

  // raid action forms
  const [mountPoint, setMountPoint] = React.useState("");
  const [compression, setCompression] = React.useState("zstd");
  const [forceUnmount, setForceUnmount] = React.useState(false);
  const [addDiskValue, setAddDiskValue] = React.useState("");
  const [removeDiskValue, setRemoveDiskValue] = React.useState("");
  const [replaceOld, setReplaceOld] = React.useState("");
  const [replaceNew, setReplaceNew] = React.useState("");
  const [newRaidLevel, setNewRaidLevel] = React.useState("raid1");
  const [balanceDataUsage, setBalanceDataUsage] = React.useState("100");
  const [balanceMetadataUsage, setBalanceMetadataUsage] = React.useState("100");
  const [balanceForce, setBalanceForce] = React.useState(false);
  const [balanceConvert, setBalanceConvert] = React.useState(true);
  const [autoMountPoint, setAutoMountPoint] = React.useState("");
  const [autoCompression, setAutoCompression] = React.useState("zstd");

  const [savingAction, setSavingAction] = React.useState<string | null>(null);
  const [deleteRaidTarget, setDeleteRaidTarget] = React.useState<BtrfsRaid | null>(null);

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
      showToast("Error loading machines", "Try again.", "error");
    }
  }, [selectedMachine, showToast]);

  const loadData = React.useCallback(
    async (mode: "full" | "refresh" | "silent" = "full") => {
      if (!selectedMachine) return;
      if (mode === "full") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const [allDisks, free, raidList, auto] = await Promise.all([
          listAllDisks(selectedMachine),
          listFreeDisks(selectedMachine),
          listRaids(selectedMachine),
          listAutomaticMounts(selectedMachine),
        ]);
        setDisks(Array.isArray(allDisks) ? allDisks : []);
        setFreeDisks(Array.isArray(free) ? free : []);
        setRaids(Array.isArray(raidList) ? raidList : []);
        setAutoMounts(Array.isArray(auto) ? auto : []);
      } catch (err) {
        console.error("Failed to load BTRFS data", err);
        showToast("Error loading", "Unable to fetch BTRFS data.", "error");
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
      loadData();
    }
  }, [selectedMachine, loadData]);

  const handleCreateRaid = async () => {
    if (!selectedMachine) return;
    if (!raidName.trim()) {
      showToast("Name required", "Provide a name for the RAID.", "error");
      return;
    }
    if (selectedDisks.size < 2 && raidLevel !== "single") {
      showToast("Select disks", "Select at least 2 disks for the RAID.", "error");
      return;
    }
    setCreatingRaid(true);
    try {
      await createRaid(selectedMachine, {
        name: raidName.trim(),
        raid: raidLevel,
        disks: Array.from(selectedDisks),
      });
      showToast("RAID created", "BTRFS array created successfully.");
      setCreateModal(false);
      setRaidName("");
      setSelectedDisks(new Set());
      await loadData("silent");
    } catch (err) {
      console.error("Failed to create raid", err);
      showToast("Error creating RAID", "Check the data and try again.", "error");
    } finally {
      setCreatingRaid(false);
    }
  };

  const performAction = async (label: string, action: () => Promise<unknown>, reload = true) => {
    setSavingAction(label);
    try {
      await action();
      showToast(`${label} completed`, "Action executed successfully.");
      if (reload) {
        await loadData("silent");
      }
    } catch (err) {
      console.error(`Failed to ${label}`, err);
      showToast(`Error during ${label}`, "Try again.", "error");
    } finally {
      setSavingAction(null);
    }
  };

  const openRaidModal = (raid: BtrfsRaid) => {
    setRaidModal(raid);
    setMountPoint(raid.mount_point ?? "");
    setCompression(raid.compression ?? "zstd");
    setAddDiskValue("");
    setRemoveDiskValue("");
    setReplaceNew("");
    setReplaceOld("");
    setNewRaidLevel(raid.raid_level ?? "raid1");
    setAutoMountPoint(raid.mount_point ?? "");
    setAutoCompression(raid.compression ?? "zstd");
    setRaidStatus(null);
    setScrubStats(null);
    fetchRaidExtras(raid);
  };

  const fetchRaidExtras = async (raid: BtrfsRaid) => {
    if (!selectedMachine || !raid.uuid) return;
    try {
      const [status, scrub] = await Promise.all([
        getRaidStatus(selectedMachine, raid.uuid).catch(() => null),
        getScrubStats(selectedMachine, raid.uuid).catch(() => null),
      ]);
      setRaidStatus(status);
      setScrubStats(scrub);
    } catch (err) {
      console.warn("Failed to load raid extras", err);
    }
  };

  const getAutoMountForRaid = (uuid?: string) => {
    if (!uuid) return null;
    return autoMounts.find((a) => a.uuid === uuid) ?? null;
  };

  const filteredRaids = React.useMemo(() => {
    if (filter === "active") return raids.filter((r) => isRaidActive(r));
    if (filter === "inactive") return raids.filter((r) => !isRaidActive(r));
    return raids;
  }, [filter, raids]);

  const StatsRow = ({ label, value }: { label: string; value?: string | number }) => (
    <HStack className="justify-between py-1">
      <Text className="text-typography-700">{label}</Text>
      <Text className="text-typography-900 font-semibold">{value ?? "—"}</Text>
    </HStack>
  );

  const renderDiskRow = (disk: BtrfsDisk) => (
    <Pressable
      key={disk.device}
      onPress={() => setDiskDetail(disk)}
      className="flex-row items-center justify-between px-3 py-2 border-b border-background-200"
    >
      <VStack className="gap-1">
        <Text className="text-typography-900 font-semibold">{formatDeviceDisplay(disk)}</Text>
        <Text className="text-typography-600 text-sm">
          {disk.model || disk.name || "—"} • {formatSize(disk.size)}
        </Text>
      </VStack>
      <HStack className="gap-2">
        {disk.type ? (
          <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
            <BadgeText className="text-xs text-typography-800">{disk.type}</BadgeText>
          </Badge>
        ) : null}
        {disk.status ? (
          <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
            <BadgeText className="text-xs text-typography-800">{disk.status}</BadgeText>
          </Badge>
        ) : null}
      </HStack>
    </Pressable>
  );

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData("refresh")} />}
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            BTRFS / RAIDs
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
            Management of BTRFS arrays and disks.
          </Text>

          <HStack className="mt-6 items-center justify-between flex-wrap gap-3">
            <HStack className="gap-3 items-center flex-wrap">
              <Select
                selectedValue={selectedMachine}
                onValueChange={(val) => setSelectedMachine(val)}
              >
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
            <Button action="primary" variant="solid" size="md" onPress={() => setCreateModal(true)} className="rounded-full px-5">
              <ButtonIcon as={Plus} size="sm" />
              <ButtonText>Create RAID</ButtonText>
            </Button>
          </HStack>

          {loading ? (
            <VStack className="mt-6 gap-4">
              {[1, 2].map((idx) => (
                <Box key={idx} className="p-4 rounded-2xl bg-background-0 border border-background-100 shadow-soft-1">
                  <Skeleton className="h-5 w-1/2 mb-2" />
                  <SkeletonText className="w-1/3" />
                </Box>
              ))}
            </VStack>
          ) : (
            <>
              <Box className="mt-6 rounded-2xl bg-background-0 border border-background-200 shadow-soft-1">
                <HStack className="items-center justify-between px-4 py-3">
                  <Text className="text-typography-900 font-semibold text-base">Free Disks</Text>
                  <HStack className="items-center gap-2">
                    <HardDrive size={18} color="#0f172a" />
                    <Text className="text-typography-700 text-sm">{(Array.isArray(freeDisks) ? freeDisks.length : 0)} disks</Text>
                  </HStack>
                </HStack>
                <Divider />
                {(!Array.isArray(freeDisks) || freeDisks.length === 0) ? (
                  <Box className="p-4">
                    <Text className="text-typography-600 text-sm">No free disks found.</Text>
                  </Box>
                ) : (
                  freeDisks.map(renderDiskRow)
                )}
              </Box>

              <Box className="mt-6 rounded-2xl bg-background-0 border border-background-200 shadow-soft-1">
                <HStack className="items-center justify-between px-4 py-3 flex-wrap gap-3">
                  <Text className="text-typography-900 font-semibold text-base">Arrays BTRFS</Text>
                  <HStack className="gap-2 flex-wrap">
                    {[
                      { key: "all" as FilterTab, label: `All (${raids.length})` },
                      { key: "active" as FilterTab, label: `Active (${raids.filter(isRaidActive).length})` },
                      { key: "inactive" as FilterTab, label: `Inactive (${raids.filter((r) => !isRaidActive(r)).length})` },
                    ].map((tab) => {
                      const active = filter === tab.key;
                      return (
                        <Pressable
                          key={tab.key}
                          onPress={() => setFilter(tab.key)}
                          className={`px-4 py-2 rounded-full border ${active ? "bg-typography-900 border-typography-900" : "bg-background-0 border-background-200"
                            }`}
                        >
                          <Text
                            className={`text-sm ${active ? "text-background-0" : "text-typography-700"}`}
                            style={{ fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" }}
                          >
                            {tab.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </HStack>
                </HStack>
                <Divider />
                {filteredRaids.length === 0 ? (
                  <Box className="p-4">
                    <Text className="text-typography-600 text-sm">No RAID found.</Text>
                  </Box>
                ) : (
                  <VStack className="divide-y divide-background-200">
                    {filteredRaids.map((raid) => {
                      const active = isRaidActive(raid);
                      const auto = getAutoMountForRaid(raid.uuid);
                      return (
                        <Pressable
                          key={raid.uuid}
                          onPress={() => openRaidModal(raid)}
                          className={`px-4 py-4 ${active ? "" : "opacity-70"}`}
                        >
                          <HStack className="items-start justify-between gap-4 flex-wrap">
                            <VStack className="gap-2 flex-1">
                              <HStack className="items-center gap-2 flex-wrap">
                                <Box className={`h-2.5 w-2.5 rounded-full ${active ? "bg-success-500" : "bg-outline-400"}`} />
                                <Text className="text-typography-900 font-semibold">{raid.mount_point || raid.name || raid.uuid}</Text>
                                {raid.raid_level ? (
                                  <Badge className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                                    <BadgeText className="text-xs text-typography-800">{(raid.raid_level || "").toUpperCase()}</BadgeText>
                                  </Badge>
                                ) : null}
                                {auto ? (
                                  <Badge className="rounded-full px-3 py-1" size="sm" action="info" variant="solid">
                                    <BadgeText className="text-xs text-typography-800">Auto-mount</BadgeText>
                                  </Badge>
                                ) : null}
                              </HStack>
                              <Text className="text-typography-700 text-sm">
                                UUID: {raid.uuid}
                              </Text>
                              <HStack className="gap-4 flex-wrap">
                                <Text className="text-typography-800 text-sm">Usado: {formatSize(raid.used)}</Text>
                                <Text className="text-typography-800 text-sm">Total: {formatSize(raid.total)}</Text>
                                <Text className="text-typography-800 text-sm">Livre: {formatSize(raid.free)}</Text>
                              </HStack>
                              <HStack className="gap-2 flex-wrap">
                                {(Array.isArray(raid.devices) ? raid.devices : []).map((dev) => {
                                  const devDisplay = getRaidDeviceLabel(dev, disks);
                                  return (
                                    <Badge key={typeof dev === "string" ? dev : (dev as any).device} className="rounded-full px-3 py-1" size="sm" action="muted" variant="solid">
                                      <BadgeText className="text-xs text-typography-800">
                                        {devDisplay}
                                      </BadgeText>
                                    </Badge>
                                  );
                                })}
                              </HStack>
                            </VStack>
                            <ArrowRight size={18} color="#0f172a" />
                          </HStack>
                        </Pressable>
                      );
                    })}
                  </VStack>
                )}
              </Box>
            </>
          )}
        </Box>
      </ScrollView>

      <Modal isOpen={diskDetail !== null} onClose={() => setDiskDetail(null)} size="lg">
        <ModalBackdrop />
        <ModalContent className="max-w-3xl">
          <ModalHeader className="flex-row items-start justify-between">
            <Heading size="md" className="text-typography-900">
              Disk Details
            </Heading>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-3 max-h-[70vh] overflow-y-auto">
            <Text className="text-typography-700">{diskDetail ? formatDeviceDisplay(diskDetail) : ""}</Text>
            <Divider />
            <StatsRow label="Name" value={diskDetail?.name} />
            <StatsRow label="Model" value={diskDetail?.model} />
            <StatsRow label="Vendor" value={diskDetail?.vendor} />
            <StatsRow label="Serial" value={diskDetail?.serial} />
            <StatsRow label="Size" value={formatSize(diskDetail?.size)} />
            <StatsRow label="Type" value={diskDetail?.type} />
            <StatsRow label="Transport" value={diskDetail?.transport} />
            <StatsRow label="Status" value={diskDetail?.status} />
            <StatsRow label="By ID" value={diskDetail?.byId} />
            <StatsRow label="PCI Path" value={diskDetail?.pciPath} />
          </ModalBody>
          <ModalFooter>
            <Button action="primary" onPress={() => setDiskDetail(null)}>
              <ButtonText>Close</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} size="lg">
        <ModalBackdrop />
        <ModalContent className="max-w-2xl">
          <ModalHeader className="flex-row items-start justify-between">
            <Heading size="md" className="text-typography-900">
              Create RAID
            </Heading>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4">
            <FormControl isRequired>
              <FormControlLabel>
                <FormControlLabelText>RAID Name</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  value={raidName}
                  onChangeText={setRaidName}
                  placeholder="ex: storage-raid1"
                />
              </Input>
            </FormControl>

            <FormControl isRequired>
              <FormControlLabel>
                <FormControlLabelText>RAID Level</FormControlLabelText>
              </FormControlLabel>
              <Select selectedValue={raidLevel} onValueChange={setRaidLevel}>
                <SelectTrigger>
                  <SelectInput placeholder="Select" value={raidLevel} />
                  <SelectIcon as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {RAID_LEVELS.map((level) => (
                      <SelectItem key={level} value={level} label={level.toUpperCase()} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Disks</FormControlLabelText>
              </FormControlLabel>
              <VStack className="gap-3 max-h-60 overflow-y-auto">
                {(Array.isArray(freeDisks) ? freeDisks : []).length === 0 ? (
                  <Text className="text-typography-600 text-sm">
                    No free disk available on this machine.
                  </Text>
                ) : (
                  freeDisks.map((disk) => {
                    const checked = selectedDisks.has(disk.device);
                    return (
                      <Pressable
                        key={disk.device}
                        onPress={() => {
                          setSelectedDisks((prev) => {
                            const next = new Set(prev);
                            if (next.has(disk.device)) {
                              next.delete(disk.device);
                            } else {
                              next.add(disk.device);
                            }
                            return next;
                          });
                        }}
                        className={`flex-row items-center gap-3 p-3 rounded-xl border ${checked ? "border-primary-500" : "border-background-200"}`}
                      >
                        <Box className={`h-4 w-4 rounded border ${checked ? "bg-primary-500 border-primary-500" : "border-outline-400"}`} />
                        <VStack className="flex-1">
                          <Text className="text-typography-900 font-semibold">{formatDeviceDisplay(disk)}</Text>
                          <Text className="text-typography-600 text-sm">
                            {formatSize(disk.size)} • {disk.type || "—"}
                          </Text>
                        </VStack>
                      </Pressable>
                    );
                  })
                )}
              </VStack>
              <FormControlHelper>
                <FormControlHelperText>
                  Select at least 2 disks for redundant levels.
                </FormControlHelperText>
              </FormControlHelper>
            </FormControl>
          </ModalBody>
          <ModalFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setCreateModal(false)} isDisabled={creatingRaid}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button action="primary" onPress={handleCreateRaid} isDisabled={creatingRaid}>
              {creatingRaid ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
              <ButtonText>Create RAID</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={raidModal !== null} onClose={() => setRaidModal(null)} size="lg">
        <ModalBackdrop />
        <ModalContent className="max-w-4xl max-h-[90vh]">
          <ModalHeader className="flex-row items-start justify-between">
            <VStack>
              <Heading size="md" className="text-typography-900">
                RAID {raidModal?.raid_level?.toUpperCase() || ""} {raidModal?.name || ""}
              </Heading>
              <Text className="text-typography-600">{raidModal?.mount_point || raidModal?.uuid}</Text>
            </VStack>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="gap-4 max-h-[60vh] overflow-y-auto">
            <Box className="p-3 rounded-xl border border-background-200 bg-background-50">
              <StatsRow label="UUID" value={raidModal?.uuid} />
              <StatsRow label="Label" value={raidModal?.label} />
              <StatsRow label="Compression" value={raidModal?.compression} />
              <StatsRow label="Target" value={raidModal?.mount_point} />
              <StatsRow label="Source" value={raidModal?.source} />
              <StatsRow label="Status" value={raidModal?.status} />
              <StatsRow label="Mounted" value={raidModal?.mounted ? "Yes" : "No"} />
              <StatsRow label="Used" value={formatSize(raidModal?.used)} />
              <StatsRow label="Total" value={formatSize(raidModal?.total)} />
              <StatsRow label="Free" value={formatSize(raidModal?.free)} />
            </Box>

            {raidStatus ? (
              <Box className="p-3 rounded-xl border border-background-200 bg-background-50">
                <Text className="text-typography-900 font-semibold mb-2">Raid Status</Text>
                {Object.entries(raidStatus).map(([key, val]) => (
                  <StatsRow key={key} label={key} value={String(val)} />
                ))}
              </Box>
            ) : null}

            {scrubStats ? (
              <Box className="p-3 rounded-xl border border-background-200 bg-background-50">
                <Text className="text-typography-900 font-semibold mb-2">Scrub Stats</Text>
                {Object.entries(scrubStats).map(([key, val]) => (
                  <StatsRow key={key} label={key} value={String(val)} />
                ))}
              </Box>
            ) : null}

            <Box className="p-3 rounded-xl border border-background-200">
              <Text className="text-typography-900 font-semibold mb-3">Actions</Text>
              <VStack className="gap-3">
                <HStack className="gap-3 flex-wrap">
                  <Input className="flex-1">
                    <InputField
                      value={mountPoint}
                      onChangeText={setMountPoint}
                      placeholder="Mount point"
                    />
                  </Input>
                  <Input className="flex-1">
                    <InputField
                      value={compression}
                      onChangeText={setCompression}
                      placeholder="zstd"
                    />
                  </Input>
                  <Button
                    action="primary"
                    onPress={() =>
                      raidModal?.uuid &&
                      performAction("mount", () => mountRaid(selectedMachine, { uuid: raidModal.uuid, mount_point: mountPoint, compression }))
                    }
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "mount" ? <ButtonSpinner /> : <ButtonIcon as={Power} size="sm" />}
                    <ButtonText>Mount</ButtonText>
                  </Button>
                </HStack>

                <HStack className="gap-3 items-center">
                  <Switch value={forceUnmount} onValueChange={setForceUnmount} />
                  <Text className="text-typography-800">Force unmount</Text>
                  <Button
                    action="default"
                    variant="outline"
                    onPress={() =>
                      raidModal?.uuid &&
                      performAction("unmount", () => unmountRaid(selectedMachine, { uuid: raidModal.uuid, force: forceUnmount }))
                    }
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "unmount" ? <ButtonSpinner /> : <ButtonIcon as={Power} size="sm" />}
                    <ButtonText>Unmount</ButtonText>
                  </Button>
                </HStack>

                <Divider />

                <HStack className="gap-3 flex-wrap">
                  <Input className="flex-1">
                    <InputField value={addDiskValue} onChangeText={setAddDiskValue} placeholder="/dev/sdx" />
                  </Input>
                  <Button
                    action="primary"
                    variant="outline"
                    onPress={() =>
                      raidModal?.uuid &&
                      performAction("add disk", () => addDiskRaid(selectedMachine, { uuid: raidModal.uuid, disk: addDiskValue }))
                    }
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "add disk" ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
                    <ButtonText>Add Disk</ButtonText>
                  </Button>
                </HStack>

                <HStack className="gap-3 flex-wrap">
                  <Input className="flex-1">
                    <InputField value={removeDiskValue} onChangeText={setRemoveDiskValue} placeholder="/dev/sdx" />
                  </Input>
                  <Button
                    action="negative"
                    variant="outline"
                    onPress={() =>
                      raidModal?.uuid &&
                      performAction("remove disk", () => removeDiskRaid(selectedMachine, { uuid: raidModal.uuid, disk: removeDiskValue }))
                    }
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "remove disk" ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
                    <ButtonText>Remove Disk</ButtonText>
                  </Button>
                </HStack>

                <HStack className="gap-3 flex-wrap">
                  <Input className="flex-1">
                    <InputField value={replaceOld} onChangeText={setReplaceOld} placeholder="Old disk" />
                  </Input>
                  <Input className="flex-1">
                    <InputField value={replaceNew} onChangeText={setReplaceNew} placeholder="New disk" />
                  </Input>
                  <Button
                    action="primary"
                    variant="outline"
                    onPress={() =>
                      raidModal?.uuid &&
                      performAction("replace disk", () => replaceDiskRaid(selectedMachine, { uuid: raidModal.uuid, old_disk: replaceOld, new_disk: replaceNew }))
                    }
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "replace disk" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                    <ButtonText>Replace Disk</ButtonText>
                  </Button>
                </HStack>

                <HStack className="gap-3 flex-wrap">
                  <Input className="flex-1">
                    <InputField value={newRaidLevel} onChangeText={setNewRaidLevel} placeholder="raid1" />
                  </Input>
                  <Button
                    action="primary"
                    variant="outline"
                    onPress={() =>
                      raidModal?.uuid &&
                      performAction("change level", () => changeRaidLevel(selectedMachine, { uuid: raidModal.uuid, new_raid_level: newRaidLevel }))
                    }
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "change level" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                    <ButtonText>Change Level</ButtonText>
                  </Button>
                </HStack>

                <Divider />

                <HStack className="gap-3 flex-wrap items-center">
                  <Input className="w-24">
                    <InputField
                      value={balanceDataUsage}
                      onChangeText={setBalanceDataUsage}
                      keyboardType="numeric"
                      placeholder="Data%"
                    />
                  </Input>
                  <Input className="w-24">
                    <InputField
                      value={balanceMetadataUsage}
                      onChangeText={setBalanceMetadataUsage}
                      keyboardType="numeric"
                      placeholder="Meta%"
                    />
                  </Input>
                  <HStack className="items-center gap-2">
                    <Switch value={balanceForce} onValueChange={setBalanceForce} />
                    <Text className="text-typography-800">Force</Text>
                  </HStack>
                  <HStack className="items-center gap-2">
                    <Switch value={balanceConvert} onValueChange={setBalanceConvert} />
                    <Text className="text-typography-800">Convert to current RAID</Text>
                  </HStack>
                  <Button
                    action="primary"
                    variant="outline"
                    onPress={() =>
                      raidModal?.uuid &&
                      performAction("balance", () =>
                        balanceRaid(selectedMachine, {
                          uuid: raidModal.uuid,
                          filters: {
                            dataUsageMax: Number(balanceDataUsage) || undefined,
                            metadataUsageMax: Number(balanceMetadataUsage) || undefined,
                          },
                          force: balanceForce,
                          convertToCurrentRaid: balanceConvert,
                        })
                      )
                    }
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "balance" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                    <ButtonText>Balance</ButtonText>
                  </Button>
                </HStack>

                <HStack className="gap-3 flex-wrap">
                  <Button
                    action="default"
                    variant="outline"
                    onPress={() => raidModal?.uuid && performAction("pause balance", () => pauseBalance(selectedMachine, raidModal.uuid))}
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "pause balance" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                    <ButtonText>Pause Balance</ButtonText>
                  </Button>
                  <Button
                    action="default"
                    variant="outline"
                    onPress={() => raidModal?.uuid && performAction("resume balance", () => resumeBalance(selectedMachine, raidModal.uuid))}
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "resume balance" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                    <ButtonText>Resume Balance</ButtonText>
                  </Button>
                  <Button
                    action="negative"
                    variant="outline"
                    onPress={() => raidModal?.uuid && performAction("cancel balance", () => cancelBalance(selectedMachine, raidModal.uuid))}
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "cancel balance" ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
                    <ButtonText>Cancel Balance</ButtonText>
                  </Button>
                </HStack>

                <HStack className="gap-3 flex-wrap">
                  <Button
                    action="default"
                    variant="outline"
                    onPress={() => raidModal?.uuid && performAction("scrub", () => scrubRaid(selectedMachine, raidModal.uuid))}
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "scrub" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                    <ButtonText>Scrub</ButtonText>
                  </Button>
                  <Button
                    action="default"
                    variant="outline"
                    onPress={() => raidModal?.uuid && performAction("defragmentar", () => defragmentRaid(selectedMachine, raidModal.uuid))}
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "defragmentar" ? <ButtonSpinner /> : <ButtonIcon as={RefreshCcw} size="sm" />}
                    <ButtonText>Defragment</ButtonText>
                  </Button>
                </HStack>

                <Divider />

                <VStack className="gap-3">
                  <Text className="text-typography-900 font-semibold">Auto-mount</Text>
                  <HStack className="gap-3 flex-wrap">
                    <Input className="flex-1">
                      <InputField value={autoMountPoint} onChangeText={setAutoMountPoint} placeholder="/mnt/raid" />
                    </Input>
                    <Input className="flex-1">
                      <InputField value={autoCompression} onChangeText={setAutoCompression} placeholder="zstd" />
                    </Input>
                    <Button
                      action="primary"
                      variant="outline"
                    onPress={() =>
                      raidModal?.uuid &&
                      performAction("auto-mount", () => createAutomaticMount(selectedMachine, { uuid: raidModal.uuid, mount_point: autoMountPoint, compression: autoCompression }))
                    }
                    isDisabled={savingAction !== null}
                  >
                    {savingAction === "auto-mount" ? <ButtonSpinner /> : <ButtonIcon as={Plus} size="sm" />}
                    <ButtonText>Enable Auto-mount</ButtonText>
                  </Button>
                  {getAutoMountForRaid(raidModal?.uuid)?.id ? (
                    <Button
                      action="negative"
                      variant="outline"
                      onPress={() =>
                          performAction("remove auto-mount", () => deleteAutomaticMount(getAutoMountForRaid(raidModal?.uuid)!.id))
                        }
                      isDisabled={savingAction !== null}
                    >
                      {savingAction === "remove auto-mount" ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
                      <ButtonText>Remove Auto-mount</ButtonText>
                    </Button>
                  ) : null}
                </HStack>
                </VStack>
              </VStack>
            </Box>

            <Box className="p-3 rounded-xl border border-background-200">
              <Text className="text-typography-900 font-semibold mb-2">Devices</Text>
              <VStack className="gap-2">
                {(Array.isArray(raidModal?.devices) ? raidModal?.devices : [])?.map((dev) => {
                  const devDisplay = getRaidDeviceLabel(dev, disks);
                  return (
                    <Box
                      key={typeof dev === "string" ? dev : dev.device}
                      className="px-3 py-2 rounded-lg border border-background-200 bg-background-50"
                    >
                      <Text className="text-typography-900 font-semibold">{devDisplay}</Text>
                      {typeof dev !== "string" ? (
                        <Text className="text-typography-700 text-sm">
                          {formatSize(dev.size)} • {dev.status || "—"}
                        </Text>
                      ) : null}
                    </Box>
                  );
                })}
              </VStack>
            </Box>
          </ModalBody>
          <ModalFooter className="gap-3 flex-wrap">
            <Button
              action="negative"
              variant="outline"
              onPress={() => setDeleteRaidTarget(raidModal)}
              className="border-error-500"
            >
              <ButtonIcon as={Trash2} size="sm" />
              <ButtonText>Remove RAID</ButtonText>
            </Button>
            <Button action="primary" onPress={() => setRaidModal(null)}>
              <ButtonText>Close</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={Boolean(deleteRaidTarget)} onClose={() => setDeleteRaidTarget(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="md" className="text-typography-900">
              Remove RAID?
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-typography-700">
              This action will delete RAID{" "}
              <Text className="font-semibold">{deleteRaidTarget?.uuid}</Text>. Do you want to continue?
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            <Button variant="outline" action="default" onPress={() => setDeleteRaidTarget(null)} isDisabled={savingAction !== null}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button
              action="negative"
              onPress={() =>
                deleteRaidTarget?.uuid &&
                performAction("remove RAID", () => removeRaid(selectedMachine, deleteRaidTarget.uuid)).then(() => {
                  setDeleteRaidTarget(null);
                  setRaidModal(null);
                })
              }
              isDisabled={savingAction !== null}
            >
              {savingAction === "remove RAID" ? <ButtonSpinner /> : <ButtonIcon as={Trash2} size="sm" />}
              <ButtonText>Remove</ButtonText>
            </Button>
          </AlertDialogFooter>
          <AlertDialogCloseButton />
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
