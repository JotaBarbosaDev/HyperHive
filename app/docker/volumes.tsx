import React from "react";
import { RefreshControl, ScrollView, useColorScheme } from "react-native";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
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
import {
	Modal,
	ModalBackdrop,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { useToast, Toast, ToastTitle } from "@/components/ui/toast";
import { Icon } from "@/components/ui/icon";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMachines } from "@/hooks/useMachines";
import { useSelectedMachine } from "@/hooks/useSelectedMachine";
import ConfirmDialog from "@/components/modals/ConfirmDialog";
import { DockerVolume } from "@/types/docker";
import { Machine } from "@/types/machine";
import { createDockerVolume, listDockerVolumes, removeDockerVolume } from "@/services/docker";
import { Database, RefreshCcw, Trash2, Plus, HardDrive } from "lucide-react-native";

const formatBytes = (bytes?: number) => {
	if (bytes == null || !Number.isFinite(bytes)) return "—";
	const units = ["B", "KB", "MB", "GB", "TB", "PB"];
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	const formatted = value >= 10 ? value.toFixed(1) : value.toFixed(2);
	return `${formatted} ${units[unitIndex]}`;
};

const VolumeCard = ({ volume, onRemove, removingId }: { volume: DockerVolume; onRemove: (name: string) => void; removingId?: string | null }) => {
	const usage = volume.DiskSpace?.Used ?? 0;
	const total = volume.DiskSpace?.Total ?? 0;
	return (
		<Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4 gap-3">
			<HStack className="items-start justify-between gap-3">
				<HStack className="items-center gap-3">
					<Box className="w-10 h-10 rounded-xl bg-primary-50/70 dark:bg-[#12213A] items-center justify-center">
						<Icon as={Database} size="md" className="text-primary-700 dark:text-[#8AB9FF]" />
					</Box>
					<VStack className="gap-1">
						<Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">{volume.Name}</Text>
						<Text className="text-xs text-typography-500 dark:text-typography-400">{volume.Mountpoint}</Text>
						<HStack className="flex-wrap gap-2">
							<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
								<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{volume.Driver}</BadgeText>
							</Badge>
							{volume.Options?.type ? (
								<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
									<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{volume.Options.type}</BadgeText>
								</Badge>
							) : null}
						</HStack>
					</VStack>
				</HStack>
				<VStack className="items-end gap-2">
					<Text className="text-sm text-typography-700 dark:text-typography-200">
						{formatBytes(usage)} / {formatBytes(total)}
					</Text>
					<Button
						size="sm"
						variant="outline"
						action="negative"
						className="rounded-xl"
						onPress={() => onRemove(volume.Name)}
						isDisabled={removingId === volume.Name}
					>
						{removingId === volume.Name ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
					</Button>
				</VStack>
			</HStack>
		</Box>
	);
};

export default function DockerVolumesScreen() {
	const colorScheme = useColorScheme();
	const toast = useToast();
	const { token, isChecking } = useAuthGuard();
	const { machines, isLoading: isLoadingMachines, error: machinesError } = useMachines(token);
	const { selectedMachine, setSelectedMachine } = useSelectedMachine();
	const [confirmConfig, setConfirmConfig] = React.useState<{ title: string; description?: string } | null>(null);
	const [isCreateOpen, setIsCreateOpen] = React.useState(false);
	const [volumes, setVolumes] = React.useState<DockerVolume[]>([]);
	const [isLoading, setIsLoading] = React.useState(false);
	const [isRefreshing, setIsRefreshing] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [formName, setFormName] = React.useState("");
	const [formFolder, setFormFolder] = React.useState("");
	const [formNfs, setFormNfs] = React.useState("");
	const [confirmForceDelete, setConfirmForceDelete] = React.useState(false);
	const [pendingVolume, setPendingVolume] = React.useState<string | null>(null);
	const [removingId, setRemovingId] = React.useState<string | null>(null);
	const [isCreating, setIsCreating] = React.useState(false);

	const resetForm = React.useCallback(() => {
		setFormName("");
		setFormFolder("");
		setFormNfs("");
	}, []);

	const closeCreateModal = React.useCallback(() => {
		setIsCreateOpen(false);
		resetForm();
	}, [resetForm]);

	const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
	const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

	React.useEffect(() => {
		if (!selectedMachine && machines.length > 0) {
			setSelectedMachine(machines[0].MachineName);
		}
	}, [machines, selectedMachine, setSelectedMachine]);

	const fetchVolumes = React.useCallback(
		async (mode: "initial" | "refresh" | "silent" = "initial") => {
			if (!selectedMachine) return;
			const isSilent = mode === "silent";
			if (!isSilent) {
				mode === "refresh" ? setIsRefreshing(true) : setIsLoading(true);
			}
			try {
				const response = await listDockerVolumes(selectedMachine);
				setVolumes(response?.Volumes ?? []);
				setError(null);
			} catch (err) {
				const message = err instanceof Error ? err.message : "Failed to load volumes.";
				setError(message);
			} finally {
				if (!isSilent) {
					mode === "refresh" ? setIsRefreshing(false) : setIsLoading(false);
				}
			}
		},
		[selectedMachine]
	);

	React.useEffect(() => {
		if (selectedMachine) {
			fetchVolumes("initial");
		}
	}, [selectedMachine, fetchVolumes]);

	React.useEffect(() => {
		if (!selectedMachine) return;
		const id = setInterval(() => {
			fetchVolumes("silent");
		}, 5000);
		return () => clearInterval(id);
	}, [selectedMachine, fetchVolumes]);

	const handleCreate = async () => {
		if (!selectedMachine || !formName.trim()) return;
		setIsCreating(true);
		try {
			await createDockerVolume(selectedMachine, {
				Name: formName.trim(),
				Folder: formFolder.trim() || undefined,
				nfs_id: formNfs ? Number(formNfs) : undefined,
				Labels: {},
			});
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="success">
						<ToastTitle>Volume criado</ToastTitle>
					</Toast>
				),
			});
			fetchVolumes("refresh");
			closeCreateModal();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to create volume.";
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="error">
						<ToastTitle>{message}</ToastTitle>
					</Toast>
				),
			});
		} finally {
			setIsCreating(false);
		}
	};

	const performRemove = async (name: string, force?: boolean) => {
		if (!selectedMachine) return;
		setRemovingId(name);
		try {
			await removeDockerVolume(selectedMachine, { VolumeId: name, Force: Boolean(force) });
			fetchVolumes("refresh");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to remove volume.";
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="error">
						<ToastTitle>{message}</ToastTitle>
					</Toast>
				),
			});
		} finally {
			setRemovingId(null);
		}
	};

	const handleRemove = (name: string) => {
		setPendingVolume(name);
		setConfirmForceDelete(false);
		setConfirmConfig({
			title: "Remove volume?",
			description: "This will delete the volume from the selected machine.",
			onConfirm: () => { },
		});
	};

	const handleConfirm = () => {
		if (!pendingVolume) return;
		setConfirmConfig(null);
		performRemove(pendingVolume, confirmForceDelete);
		setPendingVolume(null);
		setConfirmForceDelete(false);
	};

	if (isChecking || !token) return null;

	const refreshControl = (
		<RefreshControl
			refreshing={isRefreshing}
			onRefresh={() => fetchVolumes("refresh")}
			tintColor={refreshControlTint}
			colors={[refreshControlTint]}
			progressBackgroundColor={refreshControlBackground}
		/>
	);

	return (
		<Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
			<Box className="p-4 pt-16 web:p-10 web:max-w-7xl web:mx-auto web:w-full gap-4">
				<Heading
					size="2xl"
					className="text-typography-900 dark:text-[#E8EBF0] mb-2 web:text-4xl"
					style={{ fontFamily: "Inter_700Bold" }}
				>
					Docker Volumes
				</Heading>
				<HStack className="items-center justify-between flex-wrap gap-3">
					<Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
						List volumes, create new ones (NFS or custom path), and clean up when needed.
					</Text>
					<Button action="primary" className="rounded-xl" onPress={() => setIsCreateOpen(true)} isDisabled={!selectedMachine}>
						<ButtonIcon as={Plus} />
						<ButtonText>Create volume</ButtonText>
					</Button>
				</HStack>

				<VStack className="mt-5 gap-4">
					<HStack className="gap-3 flex-wrap items-end">
						<Box className="min-w-[180px]">
							<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Machine</Text>
							<Select
								selectedValue={selectedMachine ?? undefined}
								onValueChange={setSelectedMachine as any}
								isDisabled={isLoadingMachines || machines.length === 0}
							>
								<SelectTrigger className="w-52 rounded-xl border border-outline-200 dark:border-[#1F2A3C]">
									<SelectInput placeholder={isLoadingMachines ? "Loading..." : "Select machine"} />
									<SelectIcon as={RefreshCcw} className="text-typography-500" />
								</SelectTrigger>
								<SelectPortal>
									<SelectBackdrop />
									<SelectContent>
										<SelectDragIndicatorWrapper>
											<SelectDragIndicator />
										</SelectDragIndicatorWrapper>
										{machines.map((machine: Machine) => (
											<SelectItem key={machine.MachineName} label={machine.MachineName} value={machine.MachineName} />
										))}
									</SelectContent>
								</SelectPortal>
							</Select>
							{machinesError ? (
								<Text className="text-[12px] text-[#EF4444] mt-1">{machinesError}</Text>
							) : null}
						</Box>
						<HStack className="gap-3 flex-wrap">
							<Box className="p-3 rounded-xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628]">
								<Text className="text-xs text-typography-500 dark:text-typography-400">Volumes</Text>
								<Text className="text-xl font-semibold text-typography-900 dark:text-[#E8EBF0]">{volumes.length}</Text>
							</Box>
						</HStack>
					</HStack>

					<ScrollView
						className="flex-1"
						showsVerticalScrollIndicator={false}
						contentContainerStyle={{ paddingBottom: 72 }}
						refreshControl={refreshControl}
					>
						{isLoading ? (
							<Text className="text-typography-500 dark:text-typography-300">Loading...</Text>
						) : error ? (
							<Text className="text-[#EF4444]">{error}</Text>
						) : volumes.length === 0 ? (
							<Text className="text-typography-500 dark:text-typography-300">No volumes found.</Text>
						) : (
							<VStack className="gap-3">
								{volumes.map((volume) => (
									<VolumeCard key={volume.Name} volume={volume} onRemove={handleRemove} removingId={removingId} />
								))}
							</VStack>
						)}
					</ScrollView>
				</VStack>
			</Box>
			<Modal isOpen={isCreateOpen} onClose={closeCreateModal} size="lg">
				<ModalBackdrop />
				<ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
					<ModalHeader className="flex-row items-center justify-between">
						<VStack className="gap-1 flex-1">
							<Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">Create volume</Heading>
							<Text className="text-sm text-typography-500 dark:text-typography-300">
								Bind to a folder or NFS target. Pick one path style; labels are added automatically.
							</Text>
						</VStack>
						<ModalCloseButton onPress={closeCreateModal} />
					</ModalHeader>
					<ModalBody>
						<VStack className="gap-4">
							<VStack className="gap-2">
								<Text className="text-xs font-semibold text-typography-500 dark:text-typography-300 uppercase tracking-[0.08em]">Basics</Text>
								<Box>
									<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Volume name (required)</Text>
									<Input className="rounded-xl">
										<InputField value={formName} onChangeText={setFormName} placeholder="ex: n8nvol" autoCapitalize="none" />
									</Input>
								</Box>
							</VStack>

							<VStack className="gap-2">
								<Text className="text-xs font-semibold text-typography-500 dark:text-typography-300 uppercase tracking-[0.08em]">Mount target</Text>
								<Box>
									<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Folder (bind)</Text>
									<Input className="rounded-xl">
										<InputField value={formFolder} onChangeText={setFormFolder} placeholder="/mnt/.../docker/n8nvol" autoCapitalize="none" />
									</Input>
									<Text className="text-[11px] text-typography-500 dark:text-typography-400 mt-1">Leave blank if using NFS.</Text>
								</Box>
								<Box>
									<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">NFS ID</Text>
									<Input className="rounded-xl">
										<InputField value={formNfs} onChangeText={setFormNfs} placeholder="62" keyboardType="numeric" />
									</Input>
									<Text className="text-[11px] text-typography-500 dark:text-typography-400 mt-1">Leave blank if binding a folder.</Text>
								</Box>
							</VStack>
						</VStack>
					</ModalBody>
					<ModalFooter className="flex-row gap-3">
						<Button variant="outline" action="secondary" className="flex-1 rounded-xl" onPress={closeCreateModal}>
							<ButtonText>Cancel</ButtonText>
						</Button>
						<Button
							action="primary"
							className="flex-1 rounded-xl"
							onPress={handleCreate}
							isDisabled={!formName.trim() || isCreating || !selectedMachine}
						>
							{isCreating ? <ButtonSpinner /> : <ButtonIcon as={Plus} />}
							<ButtonText>Create</ButtonText>
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<ConfirmDialog
				isOpen={!!confirmConfig}
				title={confirmConfig?.title || ""}
				description={confirmConfig?.description}
				bodyContent={
					<Box className="mt-3">
						<HStack className="items-center gap-2">
							<Switch value={confirmForceDelete} onToggle={setConfirmForceDelete} />
							<Text className="text-sm text-typography-700 dark:text-typography-200">Force delete</Text>
						</HStack>
						<Text className="text-[11px] text-typography-500 dark:text-typography-400 mt-1">
							Use force if the volume is still in use by a container.
						</Text>
					</Box>
				}
				onConfirm={handleConfirm}
				onClose={() => {
					setConfirmConfig(null);
					setPendingVolume(null);
					setConfirmForceDelete(false);
				}}
			/>
		</Box>
	);
}
