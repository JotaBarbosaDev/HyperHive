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
import { Pressable } from "@/components/ui/pressable";
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
import { DockerContainer, DockerNetwork, DockerVolume } from "@/types/docker";
import { Machine } from "@/types/machine";
import { ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket } from "@/services/websocket-client";
import {
	createDockerContainer,
	killDockerContainer,
	listDockerContainers,
	listDockerNetworks,
	pauseDockerContainer,
	removeDockerContainer,
	restartDockerContainer,
	startDockerContainer,
	stopDockerContainer,
	unpauseDockerContainer,
	updateDockerContainer,
	listDockerVolumes,
	streamDockerContainerLogs,
} from "@/services/docker";
import {
	Play,
	Square,
	RefreshCcw,
	Pause,
	PowerOff,
	Trash2,
	WifiPen as NetworkIcon,
	Plus,
	ShieldCheck,
	X,
	Terminal,
} from "lucide-react-native";

const formatDate = (timestamp?: number) => {
	if (!timestamp) return "";
	const date = new Date(timestamp * 1000);
	if (Number.isNaN(date.getTime())) return "";
	return new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
};

const formatBytes = (bytes?: number) => {
	if (!bytes || Number.isNaN(bytes)) return "";
	const gb = bytes / (1024 * 1024 * 1024);
	if (gb >= 1) return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
	const mb = bytes / (1024 * 1024);
	return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
};

const parseList = (value: string) =>
	value
		.split(/\n|,/)
		.map((item) => item.trim())
		.filter(Boolean);

const parsePorts = (value: string) => {
	return parseList(value).map((entry) => {
		const [left, right] = entry.split(":");
		const host = right ? left : undefined;
		const container = right ? right : left;
		const normalizedContainer = container.includes("/") ? container : `${container}/tcp`;
		return { ContainerPort: normalizedContainer, HostPort: host };
	});
};

const isContainerRunning = (container: DockerContainer) => {
	const status = (container.Status || "").toString().toLowerCase();
	return status.includes("up") || container.State === 2;
};

const generateStreamId = () => `logs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

type ConsoleLine = { ts: number; text: string };

const ContainerCard = ({
	container,
	onAction,
	onUpdate,
	onLogs,
	actioning,
}: {
	container: DockerContainer;
	onAction: (action: string, id: string) => void;
	onUpdate: (container: DockerContainer) => void;
	onLogs: (container: DockerContainer) => void;
	actioning: { id: string; action: string } | null;
}) => {
	const name = container.Names?.[0]?.replace(/^\//, "") ?? container.Id;
	const isRunning = typeof container.Status === "string" ? container.Status.toLowerCase().includes("up") : container.State === 2;
	const isPaused = typeof container.Status === "string" ? container.Status.toLowerCase().includes("paused") : false;
	const portsLabel = (container.Ports ?? [])
		.map((p) => `${p.IP ? `${p.IP}:` : ""}${p.PublicPort ?? ""}${p.PublicPort ? "->" : ""}${p.PrivatePort}/${p.Type ?? "tcp"}`)
		.join(", ");
	const network = container.HostConfig?.NetworkMode ?? Object.keys(container.NetworkSettings?.Networks ?? {})[0];
	const memoryLabel = container.Memory ? formatBytes(container.Memory) : null;
	const cpuLabel = typeof container.CPUS === "number" ? `${container.CPUS} CPU${container.CPUS === 1 ? "" : "s"}` : null;
	const restartPolicy = container.Restart;
	const mountsPreview = container.Mounts?.slice(0, 2) ?? [];
	const extraMounts = (container.Mounts?.length ?? 0) - mountsPreview.length;

	const disabled = (action: string) => actioning?.id === container.Id && actioning.action === action;

	const actionButtons = React.useMemo(() => {
		if (isPaused) {
			return [
				{ action: "logs", label: "Logs", icon: Terminal, intent: "secondary" as const },
				{ action: "update", label: "Update", icon: ShieldCheck, intent: "secondary" as const },
				{ action: "unpause", label: "Unpause", icon: Pause, intent: "secondary" as const },
				{ action: "restart", label: "Restart", icon: RefreshCcw, intent: "secondary" as const },
				{ action: "stop", label: "Stop", icon: Square, intent: "secondary" as const },
				{ action: "kill", label: "Kill", icon: PowerOff, intent: "secondary" as const },
				{ action: "remove", label: "Remove", icon: Trash2, intent: "negative" as const },
			];
		}

		if (isRunning) {
			return [
				{ action: "logs", label: "Logs", icon: Terminal, intent: "secondary" as const },
				{ action: "update", label: "Update", icon: ShieldCheck, intent: "secondary" as const },
				{ action: "restart", label: "Restart", icon: RefreshCcw, intent: "secondary" as const },
				{ action: "pause", label: "Pause", icon: Pause, intent: "secondary" as const },
				{ action: "stop", label: "Stop", icon: Square, intent: "secondary" as const },
				{ action: "kill", label: "Kill", icon: PowerOff, intent: "secondary" as const },
				{ action: "remove", label: "Remove", icon: Trash2, intent: "negative" as const },
			];
		}

		return [
			{ action: "logs", label: "Logs", icon: Terminal, intent: "secondary" as const },
			{ action: "update", label: "Update", icon: ShieldCheck, intent: "secondary" as const },
			{ action: "start", label: "Start", icon: Play, intent: "primary" as const },
			{ action: "remove", label: "Remove", icon: Trash2, intent: "negative" as const },
		];
	}, [isPaused, isRunning]);

	return (
		<Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4 gap-3">
			<HStack className="items-start justify-between gap-3">
				<VStack className="flex-1 gap-1">
					<HStack className="items-center gap-2 flex-wrap">
						<Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]" numberOfLines={1}>
							{name}
						</Text>
						<Badge
							size="sm"
							variant="solid"
							className={
								isRunning
									? "bg-[#0F766E]"
									: isPaused
										? "bg-[#F59E0B]"
										: "bg-[#1F2937]"
							}
						>
							<BadgeText className="text-white text-[11px]">{container.Status || ""}</BadgeText>
						</Badge>
					</HStack>
					<Text className="text-xs text-typography-500 dark:text-typography-400">{container.Image}</Text>
					{portsLabel ? (
						<HStack className="items-center gap-2">
							<Icon as={NetworkIcon} size="sm" className="text-typography-500 dark:text-typography-400" />
							<Text className="text-xs text-typography-600 dark:text-typography-300" numberOfLines={2}>
								{portsLabel}
							</Text>
						</HStack>
					) : null}
					<HStack className="flex-wrap gap-2 mt-1">
						{network ? (
							<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
								<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{network}</BadgeText>
							</Badge>
						) : null}
						<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
							<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{formatDate(container.Created)}</BadgeText>
						</Badge>
					</HStack>
					{memoryLabel || cpuLabel || restartPolicy ? (
						<HStack className="flex-wrap gap-2 mt-1">
							{memoryLabel ? (
								<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
									<BadgeText className="text-xs text-typography-600 dark:text-typography-300">RAM {memoryLabel}</BadgeText>
								</Badge>
							) : null}
							{cpuLabel ? (
								<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
									<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{cpuLabel}</BadgeText>
								</Badge>
							) : null}
							{restartPolicy ? (
								<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
									<BadgeText className="text-xs text-typography-600 dark:text-typography-300">Restart {restartPolicy}</BadgeText>
								</Badge>
							) : null}
						</HStack>
					) : null}
					{mountsPreview.length ? (
						<VStack className="gap-1 mt-1">
							<Text className="text-xs text-typography-500 dark:text-typography-400">Mounts</Text>
							{mountsPreview.map((mount, idx) => (
								<Text
									key={`${mount.Source || "host"}-${mount.Destination || "container"}-${idx}`}
									className="text-xs text-typography-600 dark:text-typography-300"
									numberOfLines={1}
								>
									{mount.Source ?? "host"} {"->"} {mount.Destination ?? "container"}
								</Text>
							))}
							{extraMounts > 0 ? (
								<Text className="text-[11px] text-typography-500 dark:text-typography-400">+{extraMounts} more</Text>
							) : null}
						</VStack>
					) : null}
				</VStack>
				<VStack className="gap-2 items-end">
					<HStack className="gap-2 flex-wrap justify-end">
						{actionButtons.map((item) => (
							<Button
								key={item.action}
								size="sm"
								variant="outline"
								action={item.intent}
								className="rounded-xl"
								onPress={() =>
									item.action === "update"
										? onUpdate(container)
										: item.action === "logs"
											? onLogs(container)
											: onAction(item.action, container.Id)
								}
								isDisabled={disabled(item.action)}
							>
								{disabled(item.action) ? <ButtonSpinner /> : <ButtonIcon as={item.icon} />}
								<ButtonText>{item.label}</ButtonText>
							</Button>
						))}
					</HStack>
				</VStack>
			</HStack>
		</Box>
	);
};

export default function DockerContainersScreen() {
	const colorScheme = useColorScheme();
	const toast = useToast();
	const { token, isChecking } = useAuthGuard();
	const { machines, isLoading: isLoadingMachines, error: machinesError } = useMachines(token);
	const { selectedMachine, setSelectedMachine } = useSelectedMachine();
	const [confirmConfig, setConfirmConfig] = React.useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
	const [isCreateOpen, setIsCreateOpen] = React.useState(false);
	const [containers, setContainers] = React.useState<DockerContainer[]>([]);
	const [networks, setNetworks] = React.useState<DockerNetwork[]>([]);
	const [isLoading, setIsLoading] = React.useState(false);
	const [isRefreshing, setIsRefreshing] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [actioning, setActioning] = React.useState<{ id: string; action: string } | null>(null);
	const [logConsole, setLogConsole] = React.useState<{ id: string | null; lines: ConsoleLine[]; isOpen: boolean; title: string }>(
		{ id: null, lines: [], isOpen: false, title: "" }
	);
	const logStreamRef = React.useRef<string | null>(null);
	const logAbortControllerRef = React.useRef<AbortController | null>(null);

	const [formImage, setFormImage] = React.useState("");
	const [formName, setFormName] = React.useState("");
	const [formPorts, setFormPorts] = React.useState("");
	const [envKey, setEnvKey] = React.useState("");
	const [envValue, setEnvValue] = React.useState("");
	const [envEntries, setEnvEntries] = React.useState<{ Key: string; Value: string }[]>([]);
	const [formNetwork, setFormNetwork] = React.useState("bridge");
	const [formRestart, setFormRestart] = React.useState<"no" | "always" | "unless-stopped">("unless-stopped");
	const [formDetach, setFormDetach] = React.useState(true);
	const [formMemory, setFormMemory] = React.useState("");
	const [formCpu, setFormCpu] = React.useState("");
	const [formCommand, setFormCommand] = React.useState("");
	const [formEntryPoint, setFormEntryPoint] = React.useState("");
	const [volumes, setVolumes] = React.useState<DockerVolume[]>([]);
	const [volumeSelect, setVolumeSelect] = React.useState<string | undefined>(undefined);
	const [volumeMount, setVolumeMount] = React.useState("/data");
	const [volumeHostPath, setVolumeHostPath] = React.useState("");
	const [volumeContainerPath, setVolumeContainerPath] = React.useState("");
	const [attachedVolumes, setAttachedVolumes] = React.useState<{ HostPath: string; ContainerPath: string }[]>([]);
	const [activeTab, setActiveTab] = React.useState<"runtime" | "volumes" | "env">("runtime");
	const [isCreating, setIsCreating] = React.useState(false);
	const [updateTarget, setUpdateTarget] = React.useState<DockerContainer | null>(null);
	const [updateMemory, setUpdateMemory] = React.useState("");
	const [updateCpu, setUpdateCpu] = React.useState("");
	const [updateRestart, setUpdateRestart] = React.useState<"no" | "always" | "unless-stopped">("unless-stopped");
	const [updateDefaults, setUpdateDefaults] = React.useState<{ memory: string; cpu: string; restart: "no" | "always" | "unless-stopped" } | null>(null);
	const [isUpdating, setIsUpdating] = React.useState(false);

	const runningCount = React.useMemo(() => containers.filter(isContainerRunning).length, [containers]);
	const hasUpdateChanges = React.useMemo(() => {
		if (!updateTarget) return false;
		if (!updateDefaults) return Boolean(updateMemory || updateCpu || updateRestart);
		return (
			updateMemory !== updateDefaults.memory ||
			updateCpu !== updateDefaults.cpu ||
			updateRestart !== updateDefaults.restart
		);
	}, [updateTarget, updateDefaults, updateMemory, updateCpu, updateRestart]);

	const resetCreateForm = React.useCallback(() => {
		setFormImage("");
		setFormName("");
		setFormPorts("");
		setEnvKey("");
		setEnvValue("");
		setEnvEntries([]);
		setFormNetwork("bridge");
		setFormRestart("unless-stopped");
		setFormDetach(true);
		setFormMemory("");
		setFormCpu("");
		setFormCommand("");
		setFormEntryPoint("");
		setVolumeSelect(undefined);
		setVolumeMount("/data");
		setVolumeHostPath("");
		setVolumeContainerPath("");
		setAttachedVolumes([]);
		setActiveTab("runtime");
	}, []);

	const closeCreateModal = React.useCallback(() => {
		setIsCreateOpen(false);
		resetCreateForm();
	}, [resetCreateForm]);

	const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
	const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

	React.useEffect(() => {
		if (!selectedMachine && machines.length > 0) {
			setSelectedMachine(machines[0].MachineName);
		}
	}, [machines, selectedMachine, setSelectedMachine]);

	React.useEffect(() => {
		if (!token) return;
		ensureHyperHiveWebsocket({ token }).catch((err) => console.warn("WS connect failed", err));
		const unsubscribe = subscribeToHyperHiveWebsocket((payload) => {
			setLogConsole((prev) => {
				if (!prev.id) return prev;
				let message: any = null;
				if (typeof payload === "string") {
					try {
						message = JSON.parse(payload);
					} catch {
						message = payload;
					}
				} else {
					message = payload;
				}
				if (typeof message === "string") {
					return message.includes(prev.id)
						? { ...prev, lines: [...prev.lines, { ts: Date.now(), text: message }] }
						: prev;
				}
				if (message && typeof message === "object") {
					const extra = (message as any).extra;
					const dataField = (message as any).data ?? JSON.stringify(message);
					if (extra === prev.id) {
						return { ...prev, lines: [...prev.lines, { ts: Date.now(), text: String(dataField) }] };
					}
				}
				return prev;
			});
		});
		return unsubscribe;
	}, [token]);

	const fetchContainers = React.useCallback(
		async (mode: "initial" | "refresh" | "silent" = "initial") => {
			if (!selectedMachine) return;
			const isSilent = mode === "silent";
			if (!isSilent) {
				mode === "refresh" ? setIsRefreshing(true) : setIsLoading(true);
			}
			try {
				const response = await listDockerContainers(selectedMachine);
				setContainers(response?.containers ?? []);
				setError(null);
			} catch (err) {
				const message = err instanceof Error ? err.message : "Failed to load containers.";
				setError(message);
			} finally {
				if (!isSilent) {
					mode === "refresh" ? setIsRefreshing(false) : setIsLoading(false);
				}
			}
		},
		[selectedMachine]
	);

	const fetchNetworks = React.useCallback(async () => {
		if (!selectedMachine) return;
		try {
			const response = await listDockerNetworks(selectedMachine);
			setNetworks(response?.Networks ?? []);
		} catch (err) {
			console.warn("Failed to load networks", err);
		}
	}, [selectedMachine]);

	const fetchVolumes = React.useCallback(async () => {
		if (!selectedMachine) return;
		try {
			const response = await listDockerVolumes(selectedMachine);
			setVolumes(response?.Volumes ?? []);
		} catch (err) {
			console.warn("Failed to load volumes", err);
		}
	}, [selectedMachine]);

	React.useEffect(() => {
		if (selectedMachine) {
			fetchContainers("initial");
			fetchNetworks();
			fetchVolumes();
		}
	}, [selectedMachine, fetchContainers, fetchNetworks, fetchVolumes]);

	React.useEffect(() => {
		if (!selectedMachine) return;
		const intervalId = setInterval(() => {
			fetchContainers("silent");
			fetchVolumes();
		}, 5000);
		return () => clearInterval(intervalId);
	}, [selectedMachine, fetchContainers, fetchVolumes]);

	React.useEffect(() => {
		return () => {
			logAbortControllerRef.current?.abort();
		};
	}, []);

	const executeAction = async (action: string, id: string) => {
		if (!selectedMachine) return;
		setActioning({ id, action });
		try {
			switch (action) {
				case "start":
					await startDockerContainer(selectedMachine, id);
					break;
				case "stop":
					await stopDockerContainer(selectedMachine, id);
					break;
				case "restart":
					await restartDockerContainer(selectedMachine, id);
					break;
				case "pause":
					await pauseDockerContainer(selectedMachine, id);
					break;
				case "unpause":
					await unpauseDockerContainer(selectedMachine, id);
					break;
				case "kill":
					await killDockerContainer(selectedMachine, id);
					break;
				case "remove":
					await removeDockerContainer(selectedMachine, { container_id: id, force: true });
					break;
				default:
					break;
			}
			fetchContainers("refresh");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Action failed.";
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="error">
						<ToastTitle>{message}</ToastTitle>
					</Toast>
				),
			});
		} finally {
			setActioning(null);
		}
	};

	const handleAction = (action: string, id: string) => {
		if (action === "remove") {
			setConfirmConfig({
				title: "Remove container?",
				description: "This will delete the container using force.",
				onConfirm: () => executeAction(action, id),
			});
			return;
		}

		executeAction(action, id);
	};

	const handleConfirm = () => {
		const action = confirmConfig?.onConfirm;
		setConfirmConfig(null);
		action?.();
	};

	const handleAddEnv = () => {
		if (!envKey.trim() || !envValue.trim()) return;
		setEnvEntries((prev) => [...prev, { Key: envKey.trim(), Value: envValue.trim() }]);
		setEnvKey("");
		setEnvValue("");
	};

	const handleRemoveEnv = (index: number) => {
		setEnvEntries((prev) => prev.filter((_, i) => i !== index));
	};

	const openUpdateModal = (container: DockerContainer) => {
		const memoryMb = container.Memory ? Math.round(container.Memory / (1024 * 1024)).toString() : "";
		const cpuString = typeof container.CPUS === "number" ? container.CPUS.toString() : "";
		const restartPolicy = container.Restart ?? "unless-stopped";
		setUpdateTarget(container);
		setUpdateMemory(memoryMb);
		setUpdateCpu(cpuString);
		setUpdateRestart(restartPolicy);
		setUpdateDefaults({ memory: memoryMb, cpu: cpuString, restart: restartPolicy });
	};

	const closeUpdateModal = () => {
		setUpdateTarget(null);
		setUpdateDefaults(null);
	};

	const handleSubmitUpdate = async () => {
		if (!selectedMachine || !updateTarget || !hasUpdateChanges) return;
		setIsUpdating(true);
		setActioning({ id: updateTarget.Id, action: "update" });
		try {
			const defaults = updateDefaults;
			const trimmedMemory = updateMemory.trim();
			const trimmedCpu = updateCpu.trim();
			await updateDockerContainer(selectedMachine, {
				container_id: updateTarget.Id,
				memory:
					trimmedMemory && (!defaults || trimmedMemory !== defaults.memory)
						? Number(trimmedMemory) * 1024 * 1024
						: undefined,
				cpus:
					trimmedCpu && (!defaults || trimmedCpu !== defaults.cpu)
						? Number(trimmedCpu)
						: undefined,
				restart: !defaults || updateRestart !== defaults.restart ? updateRestart : undefined,
			});
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="success">
						<ToastTitle>Container updated</ToastTitle>
					</Toast>
				),
			});
			fetchContainers("refresh");
			closeUpdateModal();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to update container.";
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="error">
						<ToastTitle>{message}</ToastTitle>
					</Toast>
				),
			});
		} finally {
			setIsUpdating(false);
			setActioning(null);
		}
	};

	const handleCreate = async () => {
		if (!selectedMachine || !formImage.trim() || !formName.trim()) return;
		setIsCreating(true);
		try {
			const combinedVolumes = [...attachedVolumes];
			if (volumeSelect && volumeMount.trim()) {
				combinedVolumes.push({ HostPath: volumeSelect, ContainerPath: volumeMount.trim() });
			}
			if (volumeHostPath.trim() && volumeContainerPath.trim()) {
				combinedVolumes.push({ HostPath: volumeHostPath.trim(), ContainerPath: volumeContainerPath.trim() });
			}

			const payload = {
				Image: formImage.trim(),
				Name: formName.trim(),
				Ports: parsePorts(formPorts),
				Volumes: combinedVolumes,
				Envs: envEntries,
				Network: formNetwork || undefined,
				Restart: formRestart,
				Detach: formDetach,
				Memory: formMemory ? Number(formMemory) * 1024 * 1024 : undefined,
				CPUS: formCpu ? Number(formCpu) : undefined,
				Command: parseList(formCommand),
				EntryPoint: parseList(formEntryPoint),
			};
			await createDockerContainer(selectedMachine, payload);
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="success">
						<ToastTitle>Container created</ToastTitle>
					</Toast>
				),
			});
			fetchContainers("refresh");
			closeCreateModal();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to create container.";
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

	const closeLogConsole = () => {
		logStreamRef.current = null;
		if (logAbortControllerRef.current) {
			logAbortControllerRef.current.abort();
			logAbortControllerRef.current = null;
		}
		setLogConsole({ id: null, lines: [], isOpen: false, title: "" });
	};

	const handleShowLogs = async (container: DockerContainer) => {
		if (!selectedMachine) return;
		if (logAbortControllerRef.current) {
			logAbortControllerRef.current.abort();
			logAbortControllerRef.current = null;
		}
		const abortController = new AbortController();
		const streamId = generateStreamId();
		logStreamRef.current = streamId;
		logAbortControllerRef.current = abortController;
		setActioning({ id: container.Id, action: "logs" });
		setLogConsole({
			id: streamId,
			lines: [{ ts: Date.now(), text: "Starting log stream..." }],
			isOpen: true,
			title: container.Names?.[0]?.replace(/^/, "") ?? container.Id,
		});
		try {
			await streamDockerContainerLogs(selectedMachine, {
				container_id: container.Id,
				tail: -1,
				stream_id: streamId,
			}, { signal: abortController.signal });
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") {
				return;
			}
			const message = err instanceof Error ? err.message : "Failed to stream logs.";
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="error">
						<ToastTitle>{message}</ToastTitle>
					</Toast>
				),
			});
			closeLogConsole();
		} finally {
			logAbortControllerRef.current = null;
			logStreamRef.current = null;
			setActioning(null);
		}
	};

	if (isChecking || !token) return null;

	const refreshControl = (
		<RefreshControl
			refreshing={isRefreshing}
			onRefresh={() => fetchContainers("refresh")}
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
					Docker Containers
				</Heading>
				<HStack className="items-center justify-between flex-wrap gap-3">
					<Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
						Manage containers: start, stop, create, and apply quick limits.
					</Text>
					<Button
						action="primary"
						className="rounded-xl"
						onPress={() => setIsCreateOpen(true)}
						isDisabled={!selectedMachine}
					>
						<ButtonIcon as={Plus} />
						<ButtonText>Create container</ButtonText>
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
								<Text className="text-xs text-typography-500 dark:text-typography-400">Containers</Text>
								<Text className="text-xl font-semibold text-typography-900 dark:text-[#E8EBF0]">{containers.length}</Text>
							</Box>
							<Box className="p-3 rounded-xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628]">
								<Text className="text-xs text-typography-500 dark:text-typography-400">Running</Text>
								<Text className="text-xl font-semibold text-typography-900 dark:text-[#E8EBF0]">{runningCount}</Text>
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
						) : containers.length === 0 ? (
							<Text className="text-typography-500 dark:text-typography-300">No containers found.</Text>
						) : (
							<VStack className="gap-3">
								{containers.map((container) => (
									<ContainerCard
										key={container.Id}
										container={container}
										onAction={handleAction}
										onUpdate={openUpdateModal}
										onLogs={handleShowLogs}
										actioning={actioning}
									/>
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
							<Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">Create container</Heading>
							<Text className="text-sm text-typography-500 dark:text-typography-300">
								Pulls and starts a container on the selected machine. Configure ports, envs, resources, and entrypoint in one place.
							</Text>
						</VStack>
						<ModalCloseButton onPress={closeCreateModal} />
					</ModalHeader>
					<ModalBody>
						<VStack className="gap-3">
							<HStack className="gap-2">
								{[
									{ key: "runtime", label: "Runtime" },
									{ key: "volumes", label: "Volumes" },
									{ key: "env", label: "Env" },
								].map((tab) => {
									const isActive = activeTab === tab.key;
									return (
										<Pressable key={tab.key} onPress={() => setActiveTab(tab.key as any)} className="flex-1">
											<Box
												className={
													"rounded-xl border border-outline-200 dark:border-[#1F2A3C] px-4 py-2 items-center " +
													(isActive ? "bg-primary-50/70 dark:bg-[#12213A]" : "bg-transparent")
												}
											>
												<Text className={"text-sm " + (isActive ? "text-primary-700 dark:text-[#8AB9FF]" : "text-typography-700 dark:text-typography-200")}>
													{tab.label}
												</Text>
											</Box>
										</Pressable>
									);
								})}
							</HStack>
							<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }} style={{ maxHeight: 520 }}>
								{activeTab === "runtime" ? (
									<VStack className="gap-4">
										<VStack className="gap-2">
											<Text className="text-xs font-semibold text-typography-500 dark:text-typography-300 uppercase tracking-[0.08em]">Basics</Text>
											<HStack className="gap-3 flex-wrap">
												<Box className="flex-1 min-w-[220px]">
													<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Image</Text>
													<Input className="rounded-xl">
														<InputField value={formImage} onChangeText={setFormImage} placeholder="nginx:alpine" autoCapitalize="none" />
													</Input>
												</Box>
												<Box className="flex-1 min-w-[200px]">
													<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Name</Text>
													<Input className="rounded-xl">
														<InputField value={formName} onChangeText={setFormName} placeholder="frontend" autoCapitalize="none" />
													</Input>
												</Box>
											</HStack>
										</VStack>

										<VStack className="gap-2">
											<Text className="text-xs font-semibold text-typography-500 dark:text-typography-300 uppercase tracking-[0.08em]">Ports</Text>
											<Box>
												<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Ports (host:container)</Text>
												<Input className="rounded-xl">
													<InputField
														value={formPorts}
														onChangeText={setFormPorts}
														placeholder="8080:80, 25565:25565/tcp"
														autoCapitalize="none"
													/>
												</Input>
											</Box>
										</VStack>

										<VStack className="gap-2">
											<Text className="text-xs font-semibold text-typography-500 dark:text-typography-300 uppercase tracking-[0.08em]">Runtime</Text>
											<HStack className="flex-wrap gap-3 items-end">
												<Box className="min-w-[180px]">
													<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Network</Text>
													<Select selectedValue={formNetwork} onValueChange={setFormNetwork as any}>
														<SelectTrigger className="w-40 rounded-xl border border-outline-200 dark:border-[#1F2A3C]">
															<SelectInput />
															<SelectIcon as={NetworkIcon} />
														</SelectTrigger>
														<SelectPortal>
															<SelectBackdrop />
															<SelectContent>
																<SelectDragIndicatorWrapper>
																	<SelectDragIndicator />
																</SelectDragIndicatorWrapper>
																{(networks.length ? networks : [{ Name: "bridge" } as DockerNetwork]).map((net) => (
																	<SelectItem key={net.Name} label={net.Name} value={net.Name} />
																))}
															</SelectContent>
														</SelectPortal>
													</Select>
												</Box>
												<Box className="w-32">
													<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Restart</Text>
													<Select selectedValue={formRestart} onValueChange={setFormRestart as any}>
														<SelectTrigger className="rounded-xl border border-outline-200 dark:border-[#1F2A3C]">
															<SelectInput />
															<SelectIcon as={RefreshCcw} />
														</SelectTrigger>
														<SelectPortal>
															<SelectBackdrop />
															<SelectContent>
																<SelectDragIndicatorWrapper>
																	<SelectDragIndicator />
																</SelectDragIndicatorWrapper>
																<SelectItem label="unless-stopped" value="unless-stopped" />
																<SelectItem label="always" value="always" />
																<SelectItem label="no" value="no" />
															</SelectContent>
														</SelectPortal>
													</Select>
												</Box>
												<Box className="w-32">
													<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Detach</Text>
													<HStack className="items-center gap-2">
														<Switch value={formDetach} onToggle={setFormDetach} />
														<Text className="text-sm text-typography-700 dark:text-typography-200">Detach</Text>
													</HStack>
												</Box>
												<Box className="w-28">
													<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">RAM (MB)</Text>
													<Input className="rounded-xl">
														<InputField value={formMemory} onChangeText={setFormMemory} placeholder="1024" keyboardType="numeric" />
													</Input>
												</Box>
												<Box className="w-24">
													<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">CPUs</Text>
													<Input className="rounded-xl">
														<InputField value={formCpu} onChangeText={setFormCpu} placeholder="1" keyboardType="numeric" />
													</Input>
												</Box>
											</HStack>
										</VStack>

										<VStack className="gap-2">
											<Text className="text-xs font-semibold text-typography-500 dark:text-typography-300 uppercase tracking-[0.08em]">Commands</Text>
											<HStack className="flex-wrap gap-3">
												<Box className="flex-1 min-w-[200px]">
													<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Command (space-separated)</Text>
													<Input className="rounded-xl">
														<InputField value={formCommand} onChangeText={setFormCommand} placeholder="/start.sh --flag" autoCapitalize="none" />
													</Input>
												</Box>
												<Box className="flex-1 min-w-[200px]">
													<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Entrypoint</Text>
													<Input className="rounded-xl">
														<InputField value={formEntryPoint} onChangeText={setFormEntryPoint} placeholder="/entrypoint.sh" autoCapitalize="none" />
													</Input>
												</Box>
											</HStack>
										</VStack>
									</VStack>
								) : null}

								{activeTab === "volumes" ? (
									<VStack className="gap-4">
										<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">Attach volumes</Text>
										<Box className="gap-3">
											<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Existing volume</Text>
											<HStack className="flex-wrap gap-3 items-end">
												<Box className="flex-1 min-w-[200px]">
													<Select selectedValue={volumeSelect} onValueChange={setVolumeSelect as any} isDisabled={!volumes.length}>
														<SelectTrigger className="rounded-xl border border-outline-200 dark:border-[#1F2A3C]">
															<SelectInput placeholder={volumes.length ? "Choose volume" : "No volumes available"} />
															<SelectIcon as={RefreshCcw} />
														</SelectTrigger>
														<SelectPortal>
															<SelectBackdrop />
															<SelectContent>
																<SelectDragIndicatorWrapper>
																	<SelectDragIndicator />
																</SelectDragIndicatorWrapper>
																{volumes.map((vol) => (
																	<SelectItem key={vol.Name} label={vol.Name} value={vol.Name} />
																))}
															</SelectContent>
														</SelectPortal>
													</Select>
												</Box>
												<Box className="w-44">
													<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Mount path</Text>
													<Input className="rounded-xl">
														<InputField value={volumeMount} onChangeText={setVolumeMount} placeholder="/data" autoCapitalize="none" />
													</Input>
												</Box>
												<Button
													size="sm"
													variant="outline"
													action="secondary"
													className="rounded-xl h-10 px-4"
													onPress={() => {
														if (!volumeSelect || !volumeMount.trim()) return;
														setAttachedVolumes((prev) => [...prev, { HostPath: volumeSelect, ContainerPath: volumeMount.trim() }]);
														setVolumeSelect(undefined);
														setVolumeMount("/data");
													}}
													isDisabled={!volumeSelect || !volumeMount.trim()}
												>
													<ButtonIcon as={Plus} />
													<ButtonText>Add volume</ButtonText>
												</Button>
											</HStack>
										</Box>

										<Box className="gap-3">
											<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Bind mount (host path)</Text>
											<HStack className="flex-wrap gap-3 items-end">
												<Box className="flex-1 min-w-[200px]">
													<Input className="rounded-xl">
														<InputField value={volumeHostPath} onChangeText={setVolumeHostPath} placeholder="/host/data" autoCapitalize="none" />
													</Input>
												</Box>
												<Box className="flex-1 min-w-[200px]">
													<Input className="rounded-xl">
														<InputField value={volumeContainerPath} onChangeText={setVolumeContainerPath} placeholder="/data" autoCapitalize="none" />
													</Input>
												</Box>
												<Button
													size="sm"
													variant="outline"
													action="secondary"
													className="rounded-xl h-10 px-4"
													onPress={() => {
														if (!volumeHostPath.trim() || !volumeContainerPath.trim()) return;
														setAttachedVolumes((prev) => [...prev, { HostPath: volumeHostPath.trim(), ContainerPath: volumeContainerPath.trim() }]);
														setVolumeHostPath("");
														setVolumeContainerPath("");
													}}
													isDisabled={!volumeHostPath.trim() || !volumeContainerPath.trim()}
												>
													<ButtonIcon as={Plus} />
													<ButtonText>Add bind</ButtonText>
												</Button>
											</HStack>
										</Box>

										{attachedVolumes.length ? (
											<VStack className="gap-2">
												<Text className="text-xs font-semibold text-typography-500 dark:text-typography-300 uppercase tracking-[0.08em]">Attached</Text>
												<HStack className="flex-wrap gap-2">
													{attachedVolumes.map((vol, idx) => (
														<Badge key={`${vol.HostPath}-${vol.ContainerPath}-${idx}`} size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
															<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{vol.HostPath} → {vol.ContainerPath}</BadgeText>
															<Pressable onPress={() => setAttachedVolumes((prev) => prev.filter((_, i) => i !== idx))} className="ml-1">
																<Icon as={X} size="xs" className="text-typography-500" />
															</Pressable>
														</Badge>
													))}
												</HStack>
											</VStack>
										) : (
											<Text className="text-xs text-typography-500 dark:text-typography-400">No volumes attached yet.</Text>
										)}
									</VStack>
								) : null}

								{activeTab === "env" ? (
									<VStack className="gap-3">
										<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">Environment variables</Text>
										<HStack className="flex-wrap gap-3 items-end">
											<Box className="flex-1 min-w-[180px]">
												<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Env key</Text>
												<Input className="rounded-xl">
													<InputField value={envKey} onChangeText={setEnvKey} placeholder="EULA" autoCapitalize="none" />
												</Input>
											</Box>
											<Box className="flex-1 min-w-[180px]">
												<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Env value</Text>
												<Input className="rounded-xl">
													<InputField value={envValue} onChangeText={setEnvValue} placeholder="TRUE" autoCapitalize="none" />
												</Input>
											</Box>
											<Button
												size="sm"
												variant="outline"
												action="secondary"
												className="rounded-xl h-10 px-4"
												onPress={handleAddEnv}
												isDisabled={!envKey.trim() || !envValue.trim()}
											>
												<ButtonIcon as={Plus} />
												<ButtonText>Add env</ButtonText>
											</Button>
										</HStack>
										{envEntries.length ? (
											<HStack className="flex-wrap gap-2">
												{envEntries.map((env, idx) => (
													<Badge key={`${env.Key}-${idx}`} size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
														<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{env.Key}={env.Value}</BadgeText>
														<Pressable onPress={() => handleRemoveEnv(idx)} className="ml-1">
															<Icon as={X} size="xs" className="text-typography-500" />
														</Pressable>
													</Badge>
												))}
											</HStack>
										) : null}
									</VStack>
								) : null}
							</ScrollView>
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
							isDisabled={!formImage.trim() || !formName.trim() || !selectedMachine || isCreating}
						>
							{isCreating ? <ButtonSpinner /> : <ButtonIcon as={Plus} />}
							<ButtonText>Create</ButtonText>
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal >

			<Modal isOpen={!!updateTarget} onClose={closeUpdateModal} size="md">
				<ModalBackdrop />
				<ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
					<ModalHeader className="flex-row items-center justify-between">
						<VStack className="gap-1 flex-1">
							<Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">Update container</Heading>
							<Text className="text-sm text-typography-500 dark:text-typography-300">Restart policy and limits are optional.</Text>
						</VStack>
						<ModalCloseButton onPress={closeUpdateModal} />
					</ModalHeader>
					<ModalBody>
						<VStack className="gap-3">
							<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]" numberOfLines={1}>
								{updateTarget?.Names?.[0]?.replace(/^\//, "") ?? updateTarget?.Id ?? ""}
							</Text>
							<HStack className="flex-wrap gap-3">
								<Box className="w-32 min-w-[120px]">
									<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">RAM (MB)</Text>
									<Input className="rounded-xl">
										<InputField value={updateMemory} onChangeText={setUpdateMemory} placeholder="4096" keyboardType="numeric" />
									</Input>
								</Box>
								<Box className="w-24 min-w-[100px]">
									<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">CPUs</Text>
									<Input className="rounded-xl">
										<InputField value={updateCpu} onChangeText={setUpdateCpu} placeholder="2" keyboardType="numeric" />
									</Input>
								</Box>
								<Box className="w-36 min-w-[120px]">
									<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Restart</Text>
									<Select selectedValue={updateRestart} onValueChange={setUpdateRestart as any}>
										<SelectTrigger className="rounded-xl border border-outline-200 dark:border-[#1F2A3C]">
											<SelectInput />
											<SelectIcon as={RefreshCcw} />
										</SelectTrigger>
										<SelectPortal>
											<SelectBackdrop />
											<SelectContent>
												<SelectDragIndicatorWrapper>
													<SelectDragIndicator />
												</SelectDragIndicatorWrapper>
												<SelectItem label="unless-stopped" value="unless-stopped" />
												<SelectItem label="always" value="always" />
												<SelectItem label="no" value="no" />
											</SelectContent>
										</SelectPortal>
									</Select>
								</Box>
							</HStack>
						</VStack>
					</ModalBody>
					<ModalFooter className="flex-row gap-3">
						<Button variant="outline" action="secondary" className="flex-1 rounded-xl" onPress={closeUpdateModal}>
							<ButtonText>Cancel</ButtonText>
						</Button>
						<Button
							action="primary"
							className="flex-1 rounded-xl"
							onPress={handleSubmitUpdate}
							isDisabled={!updateTarget || isUpdating || !hasUpdateChanges}
						>
							{isUpdating ? <ButtonSpinner /> : <ButtonIcon as={ShieldCheck} />}
							<ButtonText>Apply</ButtonText>
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<Modal isOpen={logConsole.isOpen && !!logConsole.id} onClose={closeLogConsole} size="lg">
				<ModalBackdrop />
				<ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
					<ModalHeader className="flex-row items-center justify-between">
						<HStack className="items-center gap-2">
							<Icon as={Terminal} size="sm" className="text-typography-600 dark:text-typography-300" />
							<Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">Container logs</Heading>
						</HStack>
						<HStack className="items-center gap-2">
							{logConsole.id ? (
								<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
									<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{logConsole.id}</BadgeText>
								</Badge>
							) : null}
							<ModalCloseButton onPress={closeLogConsole} />
						</HStack>
					</ModalHeader>
					<ModalBody>
						<VStack className="gap-2">
							{logConsole.title ? (
								<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">{logConsole.title}</Text>
							) : null}
							<Box className="rounded-xl border border-outline-200 dark:border-[#1F2A3C] bg-background-50 dark:bg-[#0F1625] p-3" style={{ maxHeight: 360 }}>
								<ScrollView>
									{logConsole.lines.length === 0 ? (
										<Text className="text-xs text-typography-500 dark:text-typography-400">A aguardar logs...</Text>
									) : (
										<VStack className="gap-1">
											{logConsole.lines.map((line, idx) => (
												<Text key={`${line.ts}-${idx}`} className="text-xs text-typography-700 dark:text-typography-200">
													{line.text}
												</Text>
											))}
										</VStack>
									)}
								</ScrollView>
							</Box>
						</VStack>
					</ModalBody>
					<ModalFooter className="flex-row gap-3">
						<Button variant="outline" action="secondary" className="flex-1 rounded-xl" onPress={closeLogConsole}>
							<ButtonText>Close</ButtonText>
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
		</Box >
	);
}
