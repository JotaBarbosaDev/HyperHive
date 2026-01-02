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
import { useToast, Toast, ToastTitle } from "@/components/ui/toast";
import { Icon } from "@/components/ui/icon";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMachines } from "@/hooks/useMachines";
import { useSelectedMachine } from "@/hooks/useSelectedMachine";
import ConfirmDialog from "@/components/modals/ConfirmDialog";
import { DockerGitEntry } from "@/types/docker";
import { Machine } from "@/types/machine";
import { ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket } from "@/services/websocket-client";
import { cloneDockerGit, listDockerGit, removeDockerGit, updateDockerGit } from "@/services/docker";
import { GitBranch, RefreshCcw, Trash2, Plus, RotateCw, Link, X, Terminal } from "lucide-react-native";

const generateStackId = () => `stack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

type ConsoleLine = { ts: number; text: string };

const envEntriesToRecord = (entries: { Key: string; Value: string }[]) =>
	entries.reduce<Record<string, string>>((acc, curr) => {
		if (curr.Key && curr.Value) {
			acc[curr.Key] = curr.Value;
		}
		return acc;
	}, {});

const GitCard = ({
	entry,
	onUpdate,
	onRemove,
	actioning,
}: {
	entry: DockerGitEntry;
	onUpdate: (name: string) => void;
	onRemove: (name: string) => void;
	actioning: { name: string; action: string } | null;
}) => {
	const disabled = (action: string) => actioning?.name === entry.Name && actioning.action === action;
	return (
		<Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4 gap-3">
			<HStack className="items-start justify-between gap-3">
				<HStack className="items-center gap-3">
					<Box className="w-10 h-10 rounded-xl bg-primary-50/70 dark:bg-[#12213A] items-center justify-center">
						<Icon as={GitBranch} size="md" className="text-primary-700 dark:text-[#8AB9FF]" />
					</Box>
					<VStack className="gap-1">
						<Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">{entry.Name}</Text>
						<HStack className="items-center gap-2">
							<Icon as={Link} size="sm" className="text-typography-500 dark:text-typography-400" />
							<Text className="text-xs text-typography-600 dark:text-typography-300" numberOfLines={2}>
								{entry.RepoLink}
							</Text>
						</HStack>
					</VStack>
				</HStack>
				<HStack className="gap-2">
					<Button
						size="sm"
						variant="outline"
						action="secondary"
						className="rounded-xl"
						onPress={() => onUpdate(entry.Name)}
						isDisabled={disabled("update")}
					>
						{disabled("update") ? <ButtonSpinner /> : <ButtonIcon as={RotateCw} />}
					</Button>
					<Button
						size="sm"
						variant="outline"
						action="negative"
						className="rounded-xl"
						onPress={() => onRemove(entry.Name)}
						isDisabled={disabled("remove")}
					>
						{disabled("remove") ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
					</Button>
				</HStack>
			</HStack>
		</Box>
	);
};

export default function DockerGitScreen() {
	const colorScheme = useColorScheme();
	const toast = useToast();
	const { token, isChecking } = useAuthGuard();
	const { machines, isLoading: isLoadingMachines, error: machinesError } = useMachines(token);
	const { selectedMachine, setSelectedMachine } = useSelectedMachine();
	const [confirmConfig, setConfirmConfig] = React.useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
	const [isCreateOpen, setIsCreateOpen] = React.useState(false);
	const [entries, setEntries] = React.useState<DockerGitEntry[]>([]);
	const [isLoading, setIsLoading] = React.useState(false);
	const [isRefreshing, setIsRefreshing] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [formLink, setFormLink] = React.useState("");
	const [formPath, setFormPath] = React.useState("");
	const [formName, setFormName] = React.useState("");
	const [envKey, setEnvKey] = React.useState("");
	const [envValue, setEnvValue] = React.useState("");
	const [envEntries, setEnvEntries] = React.useState<{ Key: string; Value: string }[]>([]);
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const [actioning, setActioning] = React.useState<{ name: string; action: string } | null>(null);
	const [updateTarget, setUpdateTarget] = React.useState<string | null>(null);
	const [updateEnvKey, setUpdateEnvKey] = React.useState("");
	const [updateEnvValue, setUpdateEnvValue] = React.useState("");
	const [updateEnvEntries, setUpdateEnvEntries] = React.useState<{ Key: string; Value: string }[]>([]);
	const [isUpdating, setIsUpdating] = React.useState(false);
	const [consoleState, setConsoleState] = React.useState<{ id: string | null; lines: ConsoleLine[]; isOpen: boolean }>(
		{ id: null, lines: [], isOpen: false }
	);
	const consoleIdRef = React.useRef<string | null>(null);

	const closeConsole = () => setConsoleState({ id: null, lines: [], isOpen: false });

	const handleAddEnv = () => {
		if (!envKey.trim() || !envValue.trim()) return;
		setEnvEntries((prev) => [...prev, { Key: envKey.trim(), Value: envValue.trim() }]);
		setEnvKey("");
		setEnvValue("");
	};

	const handleRemoveEnv = (index: number) => {
		setEnvEntries((prev) => prev.filter((_, i) => i !== index));
	};

	const handleAddUpdateEnv = () => {
		if (!updateEnvKey.trim() || !updateEnvValue.trim()) return;
		setUpdateEnvEntries((prev) => [...prev, { Key: updateEnvKey.trim(), Value: updateEnvValue.trim() }]);
		setUpdateEnvKey("");
		setUpdateEnvValue("");
	};

	const handleRemoveUpdateEnv = (index: number) => {
		setUpdateEnvEntries((prev) => prev.filter((_, i) => i !== index));
	};

	const appendConsoleLine = React.useCallback((text: string) => {
		setConsoleState((prev) => {
			if (!prev.id) return prev;
			return { ...prev, lines: [...prev.lines, { ts: Date.now(), text }] };
		});
	}, []);

	React.useEffect(() => {
		if (!token) return;
		ensureHyperHiveWebsocket({ token }).catch((err) => console.warn("WS connect failed", err));
		const unsubscribe = subscribeToHyperHiveWebsocket((payload) => {
			setConsoleState((prev) => {
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
					return message.includes(prev.id) ? { ...prev, lines: [...prev.lines, { ts: Date.now(), text: message }] } : prev;
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

	const resetForm = React.useCallback(() => {
		setFormLink("");
		setFormPath("");
		setFormName("");
		setEnvKey("");
		setEnvValue("");
		setEnvEntries([]);
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

	const fetchEntries = React.useCallback(
		async (mode: "initial" | "refresh" = "initial") => {
			if (!selectedMachine) return;
			mode === "refresh" ? setIsRefreshing(true) : setIsLoading(true);
			try {
				const response = await listDockerGit(selectedMachine);
				setEntries(response?.Elems ?? []);
				setError(null);
			} catch (err) {
				const message = err instanceof Error ? err.message : "Failed to load repositories.";
				setError(message);
			} finally {
				mode === "refresh" ? setIsRefreshing(false) : setIsLoading(false);
			}
		},
		[selectedMachine]
	);

	React.useEffect(() => {
		if (selectedMachine) {
			fetchEntries("initial");
		}
	}, [selectedMachine, fetchEntries]);

	const handleClone = async () => {
		if (!selectedMachine || !formLink.trim() || !formName.trim()) return;
		const stackId = generateStackId();
		consoleIdRef.current = stackId;
		setConsoleState({ id: stackId, lines: [{ ts: Date.now(), text: "Starting clone..." }], isOpen: true });
		setIsSubmitting(true);
		try {
			await cloneDockerGit(selectedMachine, {
				link: formLink.trim(),
				folder_to_run: formPath.trim() || undefined,
				name: formName.trim(),
				id: stackId,
				env: envEntriesToRecord(envEntries),
			});
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="success">
						<ToastTitle>Clone started</ToastTitle>
					</Toast>
				),
			});
			fetchEntries("refresh");
			closeCreateModal();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to clone.";
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="error">
						<ToastTitle>{message}</ToastTitle>
					</Toast>
				),
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const openUpdateModal = (name: string) => {
		setUpdateTarget(name);
		setUpdateEnvEntries([]);
		setUpdateEnvKey("");
		setUpdateEnvValue("");
	};

	const closeUpdateModal = () => {
		setUpdateTarget(null);
		setUpdateEnvEntries([]);
		setUpdateEnvKey("");
		setUpdateEnvValue("");
	};

	const handleSubmitUpdate = async () => {
		if (!selectedMachine || !updateTarget) return;
		const stackId = generateStackId();
		consoleIdRef.current = stackId;
		setConsoleState({ id: stackId, lines: [{ ts: Date.now(), text: "Starting update..." }], isOpen: true });
		setIsUpdating(true);
		setActioning({ name: updateTarget, action: "update" });
		try {
			await updateDockerGit(selectedMachine, {
				name: updateTarget,
				id: stackId,
				env: envEntriesToRecord(updateEnvEntries),
			});
			toast.show({
				placement: "top",
				render: () => (
					<Toast action="success">
						<ToastTitle>Stack update started</ToastTitle>
					</Toast>
				),
			});
			fetchEntries("refresh");
			closeUpdateModal();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to update.";
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

	const performRemove = async (name: string) => {
		if (!selectedMachine) return;
		setActioning({ name, action: "remove" });
		try {
			await removeDockerGit(selectedMachine, name);
			fetchEntries("refresh");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to remove.";
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

	const handleRemove = (name: string) => {
		setConfirmConfig({
			title: "Remove stack?",
			description: "This will remove the stack configuration from the selected machine.",
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
			onRefresh={() => fetchEntries("refresh")}
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
					Docker Git
				</Heading>
				<HStack className="items-center justify-between flex-wrap gap-3">
					<Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
						Clone, update, and remove stacks from Git repositories (compose/stack runner).
					</Text>
					<Button action="primary" className="rounded-xl" onPress={() => setIsCreateOpen(true)} isDisabled={!selectedMachine}>
						<ButtonIcon as={Plus} />
						<ButtonText>Clone stack</ButtonText>
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
								<Text className="text-xs text-typography-500 dark:text-typography-400">Stacks</Text>
								<Text className="text-xl font-semibold text-typography-900 dark:text-[#E8EBF0]">{entries.length}</Text>
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
						) : entries.length === 0 ? (
							<Text className="text-typography-500 dark:text-typography-300">No repositories configured.</Text>
						) : (
							<VStack className="gap-3">
								{entries.map((entry) => (
									<GitCard key={entry.Name} entry={entry} onUpdate={openUpdateModal} onRemove={handleRemove} actioning={actioning} />
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
							<Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">Clone stack</Heading>
							<Text className="text-sm text-typography-500 dark:text-typography-300">
								Pull a docker-compose repo and optionally swap environment vars before starting.
							</Text>
						</VStack>
						<ModalCloseButton onPress={closeCreateModal} />
					</ModalHeader>
					<ModalBody>
						<ScrollView className="max-h-[60vh]">
							<VStack space="md">
								<VStack className="gap-2">
									<Text className="text-xs font-semibold text-typography-500 dark:text-typography-300 uppercase tracking-[0.08em]">Repository</Text>
									<Box>
										<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Repository URL</Text>
										<Input className="rounded-xl">
											<InputField
												value={formLink}
												onChangeText={setFormLink}
												placeholder="https://github.com/user/repo.git"
												autoCapitalize="none"
											/>
										</Input>
									</Box>
									<Box>
										<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Compose path (folder_to_run)</Text>
										<Input className="rounded-xl">
											<InputField value={formPath} onChangeText={setFormPath} placeholder="portainer/compose.yaml" autoCapitalize="none" />
										</Input>
										<Text className="text-[11px] text-typography-500 dark:text-typography-400 mt-1">Leave blank for repo root compose.</Text>
									</Box>
								</VStack>

								<VStack className="gap-2">
									<Text className="text-xs font-semibold text-typography-500 dark:text-typography-300 uppercase tracking-[0.08em]">Stack details</Text>
									<Box>
										<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Name (required)</Text>
										<Input className="rounded-xl">
											<InputField value={formName} onChangeText={setFormName} placeholder="stack-name" autoCapitalize="none" />
										</Input>
									</Box>
								</VStack>

								<VStack className="gap-2">
									<Text className="text-xs font-semibold text-typography-500 dark:text-typography-300 uppercase tracking-[0.08em]">Environment</Text>
									<VStack className="gap-2">
										<HStack className="gap-3 flex-wrap items-end">
											<Box className="flex-1 min-w-[180px]">
												<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Env key</Text>
												<Input className="rounded-xl">
													<InputField value={envKey} onChangeText={setEnvKey} placeholder="HOST_PORT" autoCapitalize="none" />
												</Input>
											</Box>
											<Box className="flex-1 min-w-[180px]">
												<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Env value</Text>
												<Input className="rounded-xl">
													<InputField value={envValue} onChangeText={setEnvValue} placeholder="8080" autoCapitalize="none" />
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
										<Text className="text-[11px] text-typography-500 dark:text-typography-400 mt-1">Replaces env vars before running.</Text>
									</VStack>
								</VStack>
							</VStack>
						</ScrollView>
					</ModalBody>
					<ModalFooter className="flex-row gap-3">
						<Button variant="outline" action="secondary" className="flex-1 rounded-xl" onPress={closeCreateModal}>
							<ButtonText>Cancel</ButtonText>
						</Button>
						<Button
							action="primary"
							className="flex-1 rounded-xl"
							onPress={handleClone}
							isDisabled={!formLink.trim() || !formName.trim() || !selectedMachine || isSubmitting}
						>
							{isSubmitting ? <ButtonSpinner /> : <ButtonIcon as={Plus} />}
							<ButtonText>Clone</ButtonText>
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<Modal isOpen={!!updateTarget} onClose={closeUpdateModal} size="lg">
				<ModalBackdrop />
				<ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
					<ModalHeader className="flex-row items-center justify-between">
						<VStack className="gap-1 flex-1">
							<Heading size="lg" className="text-typography-900 dark:text-[#E8EBF0]">Update stack</Heading>
							<Text className="text-sm text-typography-500 dark:text-typography-300">Apply env overrides and re-run the stack.</Text>
						</VStack>
						<ModalCloseButton onPress={closeUpdateModal} />
					</ModalHeader>
					<ModalBody>
						<VStack className="gap-3">
							<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]" numberOfLines={1}>
								{updateTarget ?? ""}
							</Text>
							<VStack className="gap-2">
								<Text className="text-xs font-semibold text-typography-500 dark:text-typography-300 uppercase tracking-[0.08em]">Environment</Text>
								<HStack className="gap-3 flex-wrap items-end">
									<Box className="flex-1 min-w-[180px]">
										<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Env key</Text>
										<Input className="rounded-xl">
											<InputField value={updateEnvKey} onChangeText={setUpdateEnvKey} placeholder="HOST_PORT" autoCapitalize="none" />
										</Input>
									</Box>
									<Box className="flex-1 min-w-[180px]">
										<Text className="text-xs text-typography-500 dark:text-typography-400 mb-1">Env value</Text>
										<Input className="rounded-xl">
											<InputField value={updateEnvValue} onChangeText={setUpdateEnvValue} placeholder="8080" autoCapitalize="none" />
										</Input>
									</Box>
									<Button
										size="sm"
										variant="outline"
										action="secondary"
										className="rounded-xl h-10 px-4"
										onPress={handleAddUpdateEnv}
										isDisabled={!updateEnvKey.trim() || !updateEnvValue.trim()}
									>
										<ButtonIcon as={Plus} />
										<ButtonText>Add env</ButtonText>
									</Button>
								</HStack>
								{updateEnvEntries.length ? (
									<HStack className="flex-wrap gap-2">
										{updateEnvEntries.map((env, idx) => (
											<Badge key={`${env.Key}-${idx}`} size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
												<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{env.Key}={env.Value}</BadgeText>
												<Pressable onPress={() => handleRemoveUpdateEnv(idx)} className="ml-1">
													<Icon as={X} size="xs" className="text-typography-500" />
												</Pressable>
											</Badge>
										))}
									</HStack>
								) : null}
								<Text className="text-[11px] text-typography-500 dark:text-typography-400 mt-1">Env overrides are optional.</Text>
							</VStack>
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
							isDisabled={!updateTarget || isUpdating}
						>
							{isUpdating ? <ButtonSpinner /> : <ButtonIcon as={RotateCw} />}
							<ButtonText>Update</ButtonText>
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<Modal isOpen={consoleState.isOpen && !!consoleState.id} onClose={closeConsole} size="lg">
				<ModalBackdrop />
				<ModalContent className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
					<ModalHeader className="flex-row items-center justify-between">
						<HStack className="items-center gap-2">
							<Icon as={Terminal} size="sm" className="text-typography-600 dark:text-typography-300" />
							<Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">Stack console</Heading>
						</HStack>
						<HStack className="items-center gap-2">
							{consoleState.id ? (
								<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
									<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{consoleState.id}</BadgeText>
								</Badge>
							) : null}
							<ModalCloseButton onPress={closeConsole} />
						</HStack>
					</ModalHeader>
					<ModalBody>
						<Box className="rounded-xl border border-outline-200 dark:border-[#1F2A3C] bg-background-50 dark:bg-[#0F1625] p-3" style={{ maxHeight: 360 }}>
							<ScrollView>
								{consoleState.lines.length === 0 ? (
									<Text className="text-xs text-typography-500 dark:text-typography-400">A aguardar logs...</Text>
								) : (
									<VStack className="gap-1">
										{consoleState.lines.map((line, idx) => (
											<Text key={`${line.ts}-${idx}`} className="text-xs text-typography-700 dark:text-typography-200">
												{line.text}
											</Text>
										))}
									</VStack>
								)}
							</ScrollView>
						</Box>
					</ModalBody>
					<ModalFooter className="flex-row gap-3">
						<Button variant="outline" action="secondary" className="flex-1 rounded-xl" onPress={closeConsole}>
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
		</Box>
	);
}
