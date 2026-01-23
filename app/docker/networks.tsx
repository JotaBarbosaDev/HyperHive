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
import { useToast, Toast, ToastTitle } from "@/components/ui/toast";
import { Icon } from "@/components/ui/icon";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMachines } from "@/hooks/useMachines";
import { useSelectedMachine } from "@/hooks/useSelectedMachine";
import ConfirmDialog from "@/components/modals/ConfirmDialog";
import { DockerNetwork } from "@/types/docker";
import { Machine } from "@/types/machine";
import { createDockerNetwork, listDockerNetworks, removeDockerNetwork } from "@/services/docker";
import { WifiPen, RefreshCcw, Trash2, Plus, Shield } from "lucide-react-native";

const NetworkCard = ({
	network,
	onRemove,
	removingId,
}: {
	network: DockerNetwork;
	onRemove: (name: string) => void;
	removingId: string | null;
}) => {
	const subnets = network.IPAM?.Config?.map((cfg) => cfg.Subnet).filter(Boolean).join(", ");
	return (
		<Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4 gap-3">
			<HStack className="items-start justify-between gap-3">
				<HStack className="items-center gap-3">
					<Box className="w-10 h-10 rounded-xl bg-primary-50/70 dark:bg-[#12213A] items-center justify-center">
						<Icon as={WifiPen} size="md" className="text-primary-700 dark:text-[#8AB9FF]" />
					</Box>
					<VStack className="gap-1">
						<Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">{network.Name}</Text>
						<HStack className="flex-wrap gap-2">
							{network.Driver ? (
								<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
									<BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">{network.Driver}</BadgeText>
								</Badge>
							) : null}
							{network.Scope ? (
								<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
									<BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">{network.Scope}</BadgeText>
								</Badge>
							) : null}
							{subnets ? (
								<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
									<BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">{subnets}</BadgeText>
								</Badge>
							) : null}
						</HStack>
					</VStack>
				</HStack>
				<Button
					size="sm"
					variant="outline"
					action="negative"
					className="rounded-xl"
					onPress={() => onRemove(network.Name)}
					isDisabled={removingId === network.Name}
				>
					{removingId === network.Name ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
				</Button>
			</HStack>
			{network.Options && Object.keys(network.Options).length ? (
				<HStack className="flex-wrap gap-2">
					{Object.entries(network.Options).map(([key, value]) => (
						<Badge key={`${network.Id}-${key}`} size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
							<BadgeText className="text-xs text-typography-600 dark:text-[#8A94A8]">
								{key}: {value}
							</BadgeText>
						</Badge>
					))}
				</HStack>
			) : null}
		</Box>
	);
};

export default function DockerNetworksScreen() {
	const colorScheme = useColorScheme();
	const toast = useToast();
	const { token, isChecking } = useAuthGuard();
	const { machines, isLoading: isLoadingMachines, error: machinesError } = useMachines(token);
	const { selectedMachine, setSelectedMachine } = useSelectedMachine();
	const [confirmConfig, setConfirmConfig] = React.useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
	const [isCreateOpen, setIsCreateOpen] = React.useState(false);
	const [networks, setNetworks] = React.useState<DockerNetwork[]>([]);
	const [isLoading, setIsLoading] = React.useState(false);
	const [isRefreshing, setIsRefreshing] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [formName, setFormName] = React.useState("");
	const [formType, setFormType] = React.useState<"bridge" | "macvlan">("bridge");
	const [isCreating, setIsCreating] = React.useState(false);
	const [removingId, setRemovingId] = React.useState<string | null>(null);

	const resetForm = React.useCallback(() => {
		setFormName("");
		setFormType("bridge");
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

	const fetchNetworks = React.useCallback(
		async (mode: "initial" | "refresh" | "silent" = "initial") => {
			if (!selectedMachine) return;
			const isSilent = mode === "silent";
			if (!isSilent) {
				mode === "refresh" ? setIsRefreshing(true) : setIsLoading(true);
			}
			try {
				const response = await listDockerNetworks(selectedMachine);
				setNetworks(response?.Networks ?? []);
				setError(null);
			} catch (err) {
				const message = err instanceof Error ? err.message : "Failed to load networks.";
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
			fetchNetworks("initial");
		}
	}, [selectedMachine, fetchNetworks]);

	React.useEffect(() => {
		if (!selectedMachine) return;
		const id = setInterval(() => {
			fetchNetworks("silent");
		}, 5000);
		return () => clearInterval(id);
	}, [selectedMachine, fetchNetworks]);

	const handleCreate = async () => {
		if (!selectedMachine || !formName.trim()) return;
		setIsCreating(true);
		try {
			await createDockerNetwork(selectedMachine, { name: formName.trim(), type: formType });
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="success">
						<ToastTitle>Rede criada</ToastTitle>
					</Toast>
				),
			});
			fetchNetworks("refresh");
			closeCreateModal();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to create network.";
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

	const performRemove = async (name: string) => {
		if (!selectedMachine) return;
		setRemovingId(name);
		try {
			await removeDockerNetwork(selectedMachine, name);
			fetchNetworks("refresh");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to remove network.";
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
		setConfirmConfig({
			title: "Remove network?",
			description: "This will delete the network from the selected machine.",
			onConfirm: () => performRemove(name),
		});
	};

	const handleConfirm = () => {
		const action = confirmConfig?.onConfirm;
		setConfirmConfig(null);
		action?.();
	};

	if (isChecking || !token) return null;

	const refreshControl = (
		<RefreshControl
			refreshing={isRefreshing}
			onRefresh={() => fetchNetworks("refresh")}
			tintColor={refreshControlTint}
			colors={[refreshControlTint]}
			progressBackgroundColor={refreshControlBackground}
		/>
	);

	return (
		<Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
			<Box className="p-4 pt-16 web:p-10 web:max-w-7xl web:mx-auto web:w-full gap-4">
				<Heading
					size="2xl"
					className="text-typography-900 dark:text-[#E8EBF0] mb-2 web:text-4xl"
					style={{ fontFamily: "Inter_700Bold" }}
				>
					Docker Networks
				</Heading>
				<HStack className="items-center justify-between flex-wrap gap-3">
					<Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
						List and manage Docker networks (bridge / macvlan).
					</Text>
					<Button action="primary" className="rounded-xl" onPress={() => setIsCreateOpen(true)} isDisabled={!selectedMachine}>
						<ButtonIcon as={Plus} />
						<ButtonText>Create network</ButtonText>
					</Button>
				</HStack>

				<VStack className="mt-5 gap-4">
					<HStack className="gap-3 flex-wrap items-end">
						<Box className="min-w-[180px]">
							<Text className="text-xs text-typography-500 dark:text-[#8A94A8] mb-1">Machine</Text>
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
								<Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Networks</Text>
								<Text className="text-xl font-semibold text-typography-900 dark:text-[#E8EBF0]">{networks.length}</Text>
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
							<Text className="text-typography-500 dark:text-[#8A94A8]">Loading...</Text>
						) : error ? (
							<Text className="text-[#EF4444]">{error}</Text>
						) : networks.length === 0 ? (
							<Text className="text-typography-500 dark:text-[#8A94A8]">No networks found.</Text>
						) : (
							<VStack className="gap-3">
								{networks.map((network) => (
									<NetworkCard key={network.Id} network={network} onRemove={handleRemove} removingId={removingId} />
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
							<Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">Create network</Heading>
							<Text className="text-sm text-typography-500 dark:text-[#8A94A8]">
								Bridge and macvlan are common. Provide subnet only if you need static addressing.
							</Text>
						</VStack>
						<ModalCloseButton onPress={closeCreateModal} />
					</ModalHeader>
					<ModalBody>
						<VStack className="gap-4">
							<VStack className="gap-2">
								<Text className="text-xs font-semibold text-typography-500 dark:text-[#8A94A8] uppercase tracking-[0.08em]">Basics</Text>
								<Box>
									<Text className="text-xs text-typography-500 dark:text-[#8A94A8] mb-1">Name (required)</Text>
									<Input className="rounded-xl">
										<InputField value={formName} onChangeText={setFormName} placeholder="ex: bridge-prod" autoCapitalize="none" />
									</Input>
								</Box>
								<Box>
									<Text className="text-xs text-typography-500 dark:text-[#8A94A8] mb-1">Type</Text>
									<Select selectedValue={formType} onValueChange={setFormType as any}>
										<SelectTrigger className="rounded-xl border border-outline-200 dark:border-[#1F2A3C]">
											<SelectInput placeholder="Select driver" />
											<SelectIcon as={Shield} />
										</SelectTrigger>
										<SelectPortal>
											<SelectBackdrop />
											<SelectContent>
												<SelectDragIndicatorWrapper>
													<SelectDragIndicator />
												</SelectDragIndicatorWrapper>
												<SelectItem label="bridge" value="bridge" />
												<SelectItem label="macvlan" value="macvlan" />
											</SelectContent>
										</SelectPortal>
									</Select>
									<Text className="text-[11px] text-typography-500 dark:text-[#8A94A8] mt-1">Bridge = default. Macvlan = attach to VLAN.</Text>
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
				onConfirm={handleConfirm}
				onClose={() => setConfirmConfig(null)}
			/>
		</Box>
	);
}
