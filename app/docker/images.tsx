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
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from "@/components/ui/select";
import { useToast, Toast, ToastTitle } from "@/components/ui/toast";
import { Icon } from "@/components/ui/icon";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMachines } from "@/hooks/useMachines";
import { useSelectedMachine } from "@/hooks/useSelectedMachine";
import {
	Modal,
	ModalBackdrop,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
	ModalCloseButton,
} from "@/components/ui/modal";
import ConfirmDialog from "@/components/modals/ConfirmDialog";
import { DockerImage } from "@/types/docker";
import { Machine } from "@/types/machine";
import { Image as ImageIcon, RefreshCcw, Trash2, Download } from "lucide-react-native";
import { listDockerImages, pullDockerImage, removeDockerImage } from "@/services/docker";

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

const formatDate = (timestamp?: number) => {
	if (!timestamp) return "—";
	const date = new Date(timestamp * 1000);
	if (Number.isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(date);
};

const ImageCard = ({ img, onRemove, removingId }: { img: DockerImage; onRemove: (id: string) => void; removingId?: string | null }) => {
	const repoTag = img.repo_tags?.[0] ?? img.repo_digests?.[0] ?? img.id;
	return (
		<Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4 gap-3">
			<HStack className="items-center justify-between gap-3">
				<HStack className="items-center gap-3 flex-1">
					<Box className="w-10 h-10 rounded-xl bg-primary-50/70 dark:bg-[#12213A] items-center justify-center">
						<Icon as={ImageIcon} size="md" className="text-primary-700 dark:text-[#8AB9FF]" />
					</Box>
					<VStack className="flex-1 gap-1">
						<Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]" numberOfLines={1}>
							{repoTag}
						</Text>
						<Text className="text-xs text-typography-500 dark:text-[#8A94A8]" numberOfLines={2}>
							{img.repo_tags?.slice(1).join(", ") || ""}
						</Text>
					</VStack>
				</HStack>
				<HStack space="md" className="items-center">
					<Badge variant="outline" size="sm" className="border-outline-300 dark:border-[#243247]">
						<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{formatBytes(img.size)}</BadgeText>
					</Badge>
					<Badge variant="outline" size="sm" className="border-outline-300 dark:border-[#243247]">
						<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{formatDate(img.created)}</BadgeText>
					</Badge>
					<Button
						size="sm"
						variant="outline"
						action="negative"
						className="rounded-xl"
						onPress={() => onRemove(img.id)}
						isDisabled={removingId === img.id}
					>
						{removingId === img.id ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
					</Button>
				</HStack>
			</HStack>
			{img.labels && Object.keys(img.labels).length ? (
				<Box className="mt-2">
					<Text className="text-xs text-typography-500 dark:text-[#8A94A8] mb-1">Labels</Text>
					<HStack className="flex-wrap gap-2">
						{Object.entries(img.labels).map(([key, value]) => (
							<Badge key={`${img.id}-${key}`} size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
								<BadgeText className="text-xs text-typography-600 dark:text-typography-300">
									{key}: {value}
								</BadgeText>
							</Badge>
						))}
					</HStack>
				</Box>
			) : null}
		</Box>
	);
};

export default function DockerImagesScreen() {
	const colorScheme = useColorScheme();
	const toast = useToast();
	const { token, isChecking } = useAuthGuard();
	const { machines, isLoading: isLoadingMachines, error: machinesError } = useMachines(token);
	const { selectedMachine, setSelectedMachine } = useSelectedMachine();
	const [isAddOpen, setIsAddOpen] = React.useState(false);
	const [confirmConfig, setConfirmConfig] = React.useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
	const [images, setImages] = React.useState<DockerImage[]>([]);
	const [isLoading, setIsLoading] = React.useState(false);
	const [isRefreshing, setIsRefreshing] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [pullImage, setPullImage] = React.useState("");
	const [pullRegistry, setPullRegistry] = React.useState("");
	const [isPulling, setIsPulling] = React.useState(false);
	const [removingId, setRemovingId] = React.useState<string | null>(null);

	const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
	const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

	React.useEffect(() => {
		if (!selectedMachine && machines.length > 0) {
			setSelectedMachine(machines[0].MachineName);
		}
	}, [machines, selectedMachine, setSelectedMachine]);

	const fetchImages = React.useCallback(
		async (mode: "initial" | "refresh" | "silent" = "initial") => {
			if (!selectedMachine) return;
			const isSilent = mode === "silent";
			if (!isSilent) {
				mode === "refresh" ? setIsRefreshing(true) : setIsLoading(true);
			}
			try {
				const response = await listDockerImages(selectedMachine);
				setImages(response?.imgs ?? []);
				setError(null);
			} catch (err) {
				const message = err instanceof Error ? err.message : "Failed to load images.";
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
			fetchImages("initial");
		}
	}, [selectedMachine, fetchImages]);

	React.useEffect(() => {
		if (!selectedMachine) return;
		const id = setInterval(() => {
			fetchImages("silent");
		}, 5000);
		return () => clearInterval(id);
	}, [selectedMachine, fetchImages]);

	const handlePull = async () => {
		if (!selectedMachine || !pullImage.trim()) return;
		setIsPulling(true);
		try {
			await pullDockerImage(selectedMachine, { image: pullImage.trim(), registry: pullRegistry.trim() || undefined });
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="success">
						<ToastTitle>Image pulled</ToastTitle>
					</Toast>
				),
			});
			setPullImage("");
			setPullRegistry("");
			setIsAddOpen(false);
			fetchImages("refresh");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to pull image.";
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="error">
						<ToastTitle>{message}</ToastTitle>
					</Toast>
				),
			});
		} finally {
			setIsPulling(false);
		}
	};

	const performRemove = async (id: string) => {
		if (!selectedMachine) return;
		setRemovingId(id);
		try {
			await removeDockerImage(selectedMachine, { image_id: id, force: false, prune_child: false });
			fetchImages("refresh");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to remove image.";
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

	const handleRemove = (id: string) => {
		setConfirmConfig({
			title: "Remove image?",
			description: "This will delete the image from the selected machine.",
			onConfirm: () => performRemove(id),
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
			onRefresh={() => fetchImages("refresh")}
			tintColor={refreshControlTint}
			colors={[refreshControlTint]}
			progressBackgroundColor={refreshControlBackground}
		/>
	);

	const totalSize = images.reduce((acc, img) => acc + (img.size ?? 0), 0);

	return (
		<Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
			<Box className="p-4 pt-16 web:p-10 web:max-w-7xl web:mx-auto web:w-full gap-4">
				<Heading
					size="2xl"
					className="text-typography-900 dark:text-[#E8EBF0] mb-2 web:text-4xl"
					style={{ fontFamily: "Inter_700Bold" }}
				>
					Docker Images
				</Heading>
				<HStack className="items-center justify-between flex-wrap gap-3">
					<Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
						List images on the selected machine and pull new ones.
					</Text>
					<Button action="primary" className="rounded-xl" onPress={() => setIsAddOpen(true)} isDisabled={!selectedMachine}>
						<ButtonIcon as={Download} />
						<ButtonText>Pull image</ButtonText>
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
								<Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Images</Text>
								<Text className="text-xl font-semibold text-typography-900 dark:text-[#E8EBF0]">{images.length}</Text>
							</Box>
							<Box className="p-3 rounded-xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628]">
								<Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Disk usage</Text>
								<Text className="text-xl font-semibold text-typography-900 dark:text-[#E8EBF0]">{formatBytes(totalSize)}</Text>
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
						) : images.length === 0 ? (
							<Text className="text-typography-500 dark:text-typography-300">No images found.</Text>
						) : (
							<VStack className="gap-3">
								{images.map((img) => (
									<ImageCard key={img.id} img={img} onRemove={handleRemove} removingId={removingId} />
								))}
							</VStack>
						)}
					</ScrollView>
				</VStack>
			</Box>
			<Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} size="lg">
				<ModalBackdrop />
				<ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
					<ModalHeader className="flex-row items-center justify-between">
						<Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">Pull image</Heading>
						<ModalCloseButton onPress={() => setIsAddOpen(false)} />
					</ModalHeader>
					<ModalBody>
						<VStack className="gap-3">
							<Box>
								<Text className="text-xs text-typography-500 dark:text-[#8A94A8] mb-1">Image</Text>
								<Input className="rounded-xl">
									<InputField value={pullImage} onChangeText={setPullImage} placeholder="e.g. nginx:alpine" autoCapitalize="none" />
								</Input>
							</Box>
							<Box>
								<Text className="text-xs text-typography-500 dark:text-[#8A94A8] mb-1">Registry (optional)</Text>
								<Input className="rounded-xl">
									<InputField value={pullRegistry} onChangeText={setPullRegistry} placeholder="registry" autoCapitalize="none" />
								</Input>
							</Box>
						</VStack>
					</ModalBody>
					<ModalFooter className="flex-row gap-3">
						<Button variant="outline" action="secondary" className="flex-1 rounded-xl" onPress={() => setIsAddOpen(false)}>
							<ButtonText>Cancel</ButtonText>
						</Button>
						<Button
							action="primary"
							className="flex-1 rounded-xl"
							onPress={handlePull}
							isDisabled={!pullImage.trim() || !selectedMachine || isPulling}
						>
							{isPulling ? <ButtonSpinner /> : <ButtonIcon as={Download} />}
							<ButtonText>Pull</ButtonText>
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
