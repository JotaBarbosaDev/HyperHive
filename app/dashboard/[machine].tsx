import React from "react";
import { Dimensions, RefreshControl, ScrollView, useColorScheme } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { VictoryAxis, VictoryChart, VictoryLine, VictoryTheme, VictoryTooltip, createContainer } from "victory-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalHeader } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMachines } from "@/hooks/useMachines";
import {
	getCpuHistory,
	getCpuInfo,
	getDiskHistory,
	getDiskInfo,
	getMachineUptime,
	getMemHistory,
	getMemInfo,
	getNetworkHistory,
	getNetworkInfo,
} from "@/services/hyperhive";
import { CpuInfo, DiskInfo, HistoryEntry, MemInfo, NetworkInfo, UptimeInfo } from "@/types/metrics";
import { Machine } from "@/types/machine";
import { ArrowLeft, BarChart3, Clock3, Cpu, HardDrive, MemoryStick, Network, SignalHigh, ThermometerSun } from "lucide-react-native";

const formatBytes = (value?: number) => {
	if (value == null || !Number.isFinite(value)) return "—";
	const units = ["B", "KB", "MB", "GB", "TB", "PB"];
	let result = value;
	let unitIndex = 0;
	while (result >= 1024 && unitIndex < units.length - 1) {
		result /= 1024;
		unitIndex += 1;
	}
	const formatted = result >= 10 ? result.toFixed(1) : result.toFixed(2);
	return `${formatted} ${units[unitIndex]}`;
};

const getXDomain = (series: { x: Date; y: number }[]): [Date, Date] | undefined => {
	if (!series.length) return undefined;
	return [series[0].x, series[series.length - 1].x] as [Date, Date];
};

const getMultiXDomain = (series: { data: { x: Date; y: number }[] }[]): [Date, Date] | undefined => {
	const allPoints = series.flatMap((s) => s.data);
	if (!allPoints.length) return undefined;
	const sorted = [...allPoints].sort((a, b) => a.x.getTime() - b.x.getTime());
	return [sorted[0].x, sorted[sorted.length - 1].x] as [Date, Date];
};

const bytesToGb = (value?: number) => {
	if (value == null || !Number.isFinite(value)) return 0;
	return Number((value / 1024 ** 3).toFixed(2));
};

const formatPercent = (value?: number) => {
	if (value == null || !Number.isFinite(value)) return "—";
	return `${value.toFixed(1)}%`;
};

const computeDiskTotals = (info?: DiskInfo) => {
	if (!info?.disks?.length) return { used: 0, total: 0 };
	return info.disks.reduce(
		(acc, disk) => {
			const total = Number(disk.total ?? 0);
			const free = Number(disk.free ?? 0);
			const used = Number.isFinite(total - free) && total && free ? total - free : Number(disk.used ?? 0);
			return {
				used: acc.used + (Number.isFinite(used) ? used : 0),
				total: acc.total + (Number.isFinite(total) ? total : 0),
			};
		},
		{ used: 0, total: 0 }
	);
};

const formatRelative = (timestamp?: string | number | Date) => {
	if (!timestamp) return "—";
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return "—";
	const diffMs = Date.now() - date.getTime();
	const diffSec = Math.max(0, Math.floor(diffMs / 1000));
	if (diffSec < 60) return `${diffSec}s ago`;
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 48) return `${diffHours}h ago`;
	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays}d ago`;
};

const parseUptime = (uptime?: string) => {
	if (!uptime) return "—";
	const matches = uptime.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
	if (!matches) return uptime;
	const [, h, m, s] = matches;
	const parts = [] as string[];
	if (h) parts.push(`${h}h`);
	if (m) parts.push(`${m}m`);
	if (s) parts.push(`${s.replace(/\.\d+$/, "")}s`);
	return parts.length ? parts.join(" ") : uptime;
};

const averageCpuUsage = (cpu?: CpuInfo | null) => {
	if (!cpu?.cores?.length) return 0;
	const total = cpu.cores.reduce((acc, core) => acc + (Number(core.usage) || 0), 0);
	return total / cpu.cores.length;
};

const averageCpuTemp = (cpu?: CpuInfo | null) => {
	if (!cpu?.cores?.length) return 0;
	const temps = cpu.cores.map((core) => Number(core.temp ?? 0)).filter((t) => Number.isFinite(t));
	if (!temps.length) return 0;
	return temps.reduce((acc, t) => acc + t, 0) / temps.length;
};

const maxCpuTemp = (cpu?: CpuInfo | null) => {
	if (!cpu?.cores?.length) return 0;
	const temps = cpu.cores.map((core) => Number(core.temp ?? 0)).filter((t) => Number.isFinite(t));
	if (!temps.length) return 0;
	return Math.max(...temps);
};

const maxCpuUsage = (cpu?: CpuInfo | null) => {
	if (!cpu?.cores?.length) return 0;
	const usages = cpu.cores.map((core) => Number(core.usage ?? 0)).filter((u) => Number.isFinite(u));
	if (!usages.length) return 0;
	return Math.max(...usages);
};

type RangeOption = {
	key: string;
	label: string;
	query: { hours?: number; days?: number; weeks?: number; months?: number; numberOfRows: number };
	description: string;
};

const RANGE_OPTIONS: RangeOption[] = [
	{ key: "1h", label: "Last hour", query: { hours: 1, numberOfRows: 30 }, description: "30 points (~2 min)" },
	{ key: "1d", label: "24 hours", query: { hours: 24, numberOfRows: 48 }, description: "48 points (~30 min)" },
	{ key: "1w", label: "7 days", query: { days: 7, numberOfRows: 84 }, description: "84 points (~2 h)" },
	{ key: "1m", label: "30 days", query: { days: 30, numberOfRows: 120 }, description: "120 points (~6 h)" },
	{ key: "3m", label: "90 days", query: { months: 3, numberOfRows: 90 }, description: "90 points (~1 day)" },
];

const toSeries = <TInfo,>(entries: HistoryEntry<TInfo>[], selector: (entry: HistoryEntry<TInfo>) => number) => {
	return entries
		.map((entry) => ({ x: new Date(entry.captured_at), y: selector(entry) }))
		.filter((point) => Number.isFinite(point.y) && !Number.isNaN(point.x.getTime()))
		.sort((a, b) => a.x.getTime() - b.x.getTime());
};

const formatTick = (value: Date | string | number, rangeKey: string) => {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const formatter = new Intl.DateTimeFormat("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		month: rangeKey === "1h" ? undefined : "short",
		day: rangeKey === "1h" ? undefined : "numeric",
	});
	return formatter.format(date);
};

const formatPointLabel = (x: Date, y: number, unit?: string) => {
	const time = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(x);
	const value = Math.abs(y) >= 10 ? y.toFixed(1) : y.toFixed(2);
	return `${value}${unit ? ` ${unit}` : ""}\n${time}`;
};

const formatPointLabelWithSeries = (series: string, x: Date, y: number, unit?: string) => `${series}\n${formatPointLabel(x, y, unit)}`;

// Typed alias to satisfy TS when using the composite container.
const ZoomVoronoiContainer: React.ComponentType<any> = createContainer("zoom", "voronoi") as React.ComponentType<any>;

export default function MachineDetailsScreen() {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const chartWidth = React.useMemo(() => {
		const screenWidth = Dimensions.get("window").width;
		return Math.max(320, Math.min(1100, screenWidth - 48));
	}, []);
	const params = useLocalSearchParams<{ machine?: string }>();
	const machineName = React.useMemo(() => {
		if (!params.machine) return "";
		try {
			return decodeURIComponent(params.machine);
		} catch {
			return String(params.machine);
		}
	}, [params.machine]);

	const { token, isChecking } = useAuthGuard();
	const { machines, isLoading: isLoadingMachines } = useMachines(token);

	const [machine, setMachine] = React.useState<Machine | null>(null);
	const [uptime, setUptime] = React.useState<UptimeInfo | null>(null);
	const [cpu, setCpu] = React.useState<CpuInfo | null>(null);
	const [mem, setMem] = React.useState<MemInfo | null>(null);
	const [disk, setDisk] = React.useState<DiskInfo | null>(null);
	const [network, setNetwork] = React.useState<NetworkInfo | null>(null);
	const [cpuHistory, setCpuHistory] = React.useState<HistoryEntry<CpuInfo>[]>([]);
	const [memHistory, setMemHistory] = React.useState<HistoryEntry<MemInfo>[]>([]);
	const [diskHistory, setDiskHistory] = React.useState<HistoryEntry<DiskInfo>[]>([]);
	const [networkHistory, setNetworkHistory] = React.useState<HistoryEntry<NetworkInfo>[]>([]);
	const [rangeKey, setRangeKey] = React.useState<string>(RANGE_OPTIONS[0].key);
	const [isLoading, setIsLoading] = React.useState(false);
	const [isRefreshing, setIsRefreshing] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const selectedRange = React.useMemo(() => RANGE_OPTIONS.find((r) => r.key === rangeKey) ?? RANGE_OPTIONS[0], [rangeKey]);

	React.useEffect(() => {
		const found = machines.find((m) => m.MachineName === machineName) ?? null;
		setMachine(found);
	}, [machineName, machines]);

	const fetchData = React.useCallback(
		async (mode: "initial" | "refresh" = "initial", showLoading: boolean = true) => {
			if (!machineName) return;
			const isRefresh = mode === "refresh";
			if (!showLoading) {
				setError(null);
			} else {
				isRefresh ? setIsRefreshing(true) : setIsLoading(true);
				setError(null);
			}
			try {
				// Soft updates não carregam histórico
				if (showLoading) {
					const rangeParams = selectedRange.query;
					const [uptimeRes, cpuRes, memRes, diskRes, netRes, cpuHist, memHist, diskHist, netHist] = await Promise.all([
						getMachineUptime(machineName),
						getCpuInfo(machineName),
						getMemInfo(machineName),
						getDiskInfo(machineName),
						getNetworkInfo(machineName),
						getCpuHistory(machineName, rangeParams),
						getMemHistory(machineName, rangeParams),
						getDiskHistory(machineName, rangeParams),
						getNetworkHistory(machineName, rangeParams),
					]);

					setUptime(uptimeRes);
					setCpu(cpuRes);
					setMem(memRes);
					setDisk(diskRes);
					setNetwork(netRes);
					setCpuHistory(cpuHist ?? []);
					setMemHistory(memHist ?? []);
					setDiskHistory(diskHist ?? []);
					setNetworkHistory(netHist ?? []);
				} else {
					// Soft update: apenas métricas atuais, sem histórico
					const [uptimeRes, cpuRes, memRes, diskRes, netRes] = await Promise.all([
						getMachineUptime(machineName),
						getCpuInfo(machineName),
						getMemInfo(machineName),
						getDiskInfo(machineName),
						getNetworkInfo(machineName),
					]);

					setUptime(uptimeRes);
					setCpu(cpuRes);
					setMem(memRes);
					setDisk(diskRes);
					setNetwork(netRes);
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : "Failed to load metrics.";
				if (showLoading) {
					setError(message);
				}
			} finally {
				if (showLoading) {
					isRefresh ? setIsRefreshing(false) : setIsLoading(false);
				}
			}
		},
		[machineName, selectedRange]
	);

	React.useEffect(() => {
		if (!isChecking && !isLoadingMachines && machineName) {
			fetchData("initial");
		}
	}, [fetchData, isChecking, isLoadingMachines, machineName]);

	React.useEffect(() => {
		if (!isChecking && !isLoadingMachines && machineName) {
			fetchData("refresh");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedRange]);

	// Soft update a cada 5 segundos
	React.useEffect(() => {
		if (!isChecking && !isLoadingMachines && machineName) {
			const interval = setInterval(() => {
				fetchData("refresh", false);
			}, 5000);

			return () => clearInterval(interval);
		}
	}, [isChecking, isLoadingMachines, machineName, fetchData]);

	// Atualizar apenas histórico a cada 45 segundos
	React.useEffect(() => {
		if (!isChecking && !isLoadingMachines && machineName) {
			const fetchHistoryOnly = async () => {
				try {
					const rangeParams = selectedRange.query;
					const [cpuHist, memHist, diskHist, netHist] = await Promise.all([
						getCpuHistory(machineName, rangeParams),
						getMemHistory(machineName, rangeParams),
						getDiskHistory(machineName, rangeParams),
						getNetworkHistory(machineName, rangeParams),
					]);

					setCpuHistory(cpuHist ?? []);
					setMemHistory(memHist ?? []);
					setDiskHistory(diskHist ?? []);
					setNetworkHistory(netHist ?? []);
				} catch (err) {
					console.warn("Failed to load history:", err);
				}
			};

			const interval = setInterval(fetchHistoryOnly, 45000);

			return () => clearInterval(interval);
		}
	}, [isChecking, isLoadingMachines, machineName, selectedRange]);

	const diskTotals = React.useMemo(() => computeDiskTotals(disk ?? undefined), [disk]);
	const cpuAvg = React.useMemo(() => averageCpuUsage(cpu), [cpu]);
	const tempAvg = React.useMemo(() => averageCpuTemp(cpu), [cpu]);
	const tempMax = React.useMemo(() => maxCpuTemp(cpu), [cpu]);

	const historySeries = React.useMemo(() => {
		return {
			cpuUsage: {
				avg: toSeries(cpuHistory, (entry) => averageCpuUsage(entry.info)),
				max: toSeries(cpuHistory, (entry) => maxCpuUsage(entry.info)),
			},
			cpuTemp: {
				avg: toSeries(cpuHistory, (entry) => averageCpuTemp(entry.info)),
				max: toSeries(cpuHistory, (entry) => maxCpuTemp(entry.info)),
			},
			mem: toSeries(memHistory, (entry) => entry.info?.usedPercent ?? 0),
			disk: toSeries(diskHistory, (entry) => {
				const totals = computeDiskTotals(entry.info ?? undefined);
				return totals.total ? (totals.used / totals.total) * 100 : 0;
			}),
			net: toSeries(networkHistory, (entry) => {
				const usageValues = entry.info?.usage ? Object.values(entry.info.usage) : [];
				const total = usageValues.reduce((acc: number, val) => acc + Number(val ?? 0), 0);
				return total / 1024 ** 2; // convert to MB
			}),
		};
	}, [cpuHistory, memHistory, diskHistory, networkHistory]);

	const isDark = colorScheme === "dark";

	const renderHistoryChart = React.useCallback(
		(title: string, data: { x: Date; y: number }[], color: string, unit?: string) => {
			if (!data?.length) {
				return (
					<Box>
						<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0] mb-1">{title}</Text>
						<Text className="text-sm text-typography-500 dark:text-typography-400">No history</Text>
					</Box>
				);
			}

			const xDomain = getXDomain(data);

			return (
				<Box>
					<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0] mb-1">{title}</Text>
					<VictoryChart
						theme={VictoryTheme.material}
						height={230}
						width={chartWidth}
						padding={{ top: 10, bottom: 36, left: 54, right: 18 }}
						scale={{ x: "time" }}
						domain={xDomain ? { x: xDomain } : undefined}
						containerComponent={
							<ZoomVoronoiContainer
								allowZoom={false}
								voronoiDimension="x"
								voronoiPadding={{ left: 8, right: 8, top: 8, bottom: 12 }}
								mouseFollowTooltips
								labels={({ datum }: { datum: { x: Date; y: number } }) => formatPointLabel(datum.x, datum.y, unit)}
								labelComponent={<VictoryTooltip cornerRadius={6} flyoutStyle={{ fill: isDark ? "#0A1628" : "white", stroke: color }} />}
							/>
						}
					>
						<VictoryAxis
							style={{
								tickLabels: { fill: isDark ? "#64748B" : "#1F2937", fontSize: 10 },
								axis: { stroke: isDark ? "#1F2937" : "#64748B" },
								ticks: { stroke: isDark ? "#1F2937" : "#64748B" },
							}}
							tickFormat={(v: Date | string | number) => formatTick(v as Date, selectedRange.key)}
						/>
						<VictoryAxis
							dependentAxis
							tickFormat={
								unit
									? (t: number) => `${t.toFixed(0)} ${unit}`
									: (t: number) => (Math.abs(t) >= 10 ? t.toFixed(0) : t.toFixed(1))
							}
							style={{
								tickLabels: { fill: isDark ? "#64748B" : "#1F2937", fontSize: 10 },
								axis: { stroke: isDark ? "#1F2937" : "#64748B" },
								ticks: { stroke: isDark ? "#1F2937" : "#64748B" },
							}}
						/>
						<VictoryLine
							data={data}
							interpolation="monotoneX"
							style={{ data: { stroke: color, strokeWidth: 2.5 } }}
						/>
					</VictoryChart>
				</Box>
			);
		},
		[colorScheme, isDark, selectedRange.key, chartWidth]
	);

	const renderMultiHistoryChart = React.useCallback(
		(
			title: string,
			series: { label: string; color: string; data: { x: Date; y: number }[] }[],
			unit?: string
		) => {
			const hasData = series.some((s) => s.data.length);
			if (!hasData) {
				return (
					<Box>
						<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0] mb-1">{title}</Text>
						<Text className="text-sm text-typography-500 dark:text-typography-400">No history</Text>
					</Box>
				);
			}

			const xDomain = getMultiXDomain(series);

			return (
				<Box>
					<HStack className="items-center justify-between mb-2 flex-wrap gap-2">
						<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">{title}</Text>
						<HStack className="gap-3">
							{series.map((s) => (
								<HStack key={s.label} className="items-center gap-1">
									<Box className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
									<Text className="text-xs text-typography-600 dark:text-typography-300">{s.label}</Text>
								</HStack>
							))}
						</HStack>
					</HStack>
					<VictoryChart
						theme={VictoryTheme.material}
						height={230}
						width={chartWidth}
						padding={{ top: 10, bottom: 36, left: 54, right: 18 }}
						scale={{ x: "time" }}
						domain={xDomain ? { x: xDomain } : undefined}
						containerComponent={
							<ZoomVoronoiContainer
								allowZoom={false}
								voronoiDimension="x"
								voronoiPadding={{ left: 8, right: 8, top: 8, bottom: 12 }}
								mouseFollowTooltips
								labels={({ datum }: { datum: { x: Date; y: number; series?: string } }) =>
									formatPointLabelWithSeries(datum.series ?? "", datum.x, datum.y, unit)
								}
								labelComponent={<VictoryTooltip cornerRadius={6} flyoutStyle={{ fill: isDark ? "#0A1628" : "white", stroke: "#CBD5E1" }} />}
							/>
						}
					>
						<VictoryAxis
							style={{
								tickLabels: { fill: isDark ? "#64748B" : "#1F2937", fontSize: 10 },
								axis: { stroke: isDark ? "#1F2937" : "#64748B" },
								ticks: { stroke: isDark ? "#1F2937" : "#64748B" },
							}}
							tickFormat={(v: Date | string | number) => formatTick(v as Date, selectedRange.key)}
						/>
						<VictoryAxis
							dependentAxis
							tickFormat={
								unit
									? (t: number) => `${t.toFixed(0)} ${unit}`
									: (t: number) => (Math.abs(t) >= 10 ? t.toFixed(0) : t.toFixed(1))
							}
							style={{
								tickLabels: { fill: isDark ? "#64748B" : "#1F2937", fontSize: 10 },
								axis: { stroke: isDark ? "#1F2937" : "#64748B" },
								ticks: { stroke: isDark ? "#1F2937" : "#64748B" },
							}}
						/>
						{series.map((s) => (
							<VictoryLine
								key={s.label}
								data={s.data.map((d) => ({ ...d, series: s.label }))}
								interpolation="monotoneX"
								style={{ data: { stroke: s.color, strokeWidth: 2.5 } }}
							/>
						))}
					</VictoryChart>
				</Box>
			);
		},
		[colorScheme, isDark, selectedRange.key, chartWidth]
	);

	const refreshControl = (
		<RefreshControl refreshing={isRefreshing} onRefresh={() => fetchData("refresh")} tintColor="#0F172A" />
	);

	if (!machineName) {
		return (
			<Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0 items-center justify-center">
				<Text className="text-typography-600 dark:text-typography-300">No machine selected.</Text>
			</Box>
		);
	}

	return (
		<Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
			<ScrollView showsVerticalScrollIndicator={false} refreshControl={refreshControl} contentContainerStyle={{ paddingBottom: 36 }}>
				<Box className="p-4 pt-14 web:p-10 web:max-w-7xl web:mx-auto web:w-full">
					<HStack className="items-center justify-between mb-4">
						<HStack className="items-center gap-3 flex-1">
							<Button size="sm" variant="outline" className="rounded-xl" onPress={() => router.replace("/dashboard")}>
								<ButtonIcon as={ArrowLeft} />
								<ButtonText>Back</ButtonText>
							</Button>
							<VStack className="gap-1 flex-1">
								<Heading size="2xl" className="text-typography-900 dark:text-[#E8EBF0]" style={{ fontFamily: "Inter_700Bold" }}>
									{machineName || "Machine"}
								</Heading>
								<Text className="text-sm text-typography-600 dark:text-typography-400">
									Detailed view with CPU, RAM, disk, and network charts ({selectedRange.label}, {selectedRange.description}).
								</Text>
								{machine ? (
									<HStack className="items-center gap-2 flex-wrap">
										<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
											<BadgeText className="text-xs text-typography-600 dark:text-typography-300">
												Last seen: {formatRelative((machine as any).LastSeen)}
											</BadgeText>
										</Badge>
										<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
											<BadgeText className="text-xs text-typography-600 dark:text-typography-300">
												Joined: {formatRelative((machine as any).EntryTime)}
											</BadgeText>
										</Badge>
										{(machine as any).Addr ? (
											<Badge size="sm" variant="outline" className="border-outline-300 dark:border-[#243247]">
												<BadgeText className="text-xs text-typography-600 dark:text-typography-300">{(machine as any).Addr}</BadgeText>
											</Badge>
										) : null}
									</HStack>
								) : null}
							</VStack>
						</HStack>
					</HStack>

					{error ? (
						<Box className="mb-4 p-3 rounded-xl border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/30">
							<Text className="text-error-700 dark:text-error-200 text-sm">{error}</Text>
						</Box>
					) : null}

					<HStack className="gap-4 flex-wrap">
						<Box className="flex-1 min-w-[200px] rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
							<HStack className="items-center justify-between mb-2">
								<Text className="text-xs font-semibold uppercase text-typography-500 dark:text-typography-300 tracking-[0.08em]">
									CPU
								</Text>
								<Icon as={Cpu} size="md" className="text-primary-700 dark:text-[#8AB9FF]" />
							</HStack>
							<Heading size="xl" className="text-typography-900 dark:text-[#E8EBF0]">{formatPercent(cpuAvg)}</Heading>
							<Text className="text-sm text-typography-600 dark:text-typography-400">
								{cpu?.cores?.length ?? 0} cores • Avg temp {tempAvg ? `${tempAvg.toFixed(1)}ºC` : "—"} • Max {tempMax ? `${tempMax.toFixed(1)}ºC` : "—"}
							</Text>
						</Box>

						<Box className="flex-1 min-w-[200px] rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
							<HStack className="items-center justify-between mb-2">
								<Text className="text-xs font-semibold uppercase text-typography-500 dark:text-typography-300 tracking-[0.08em]">
									RAM
								</Text>
								<Icon as={MemoryStick} size="md" className="text-primary-700 dark:text-[#8AB9FF]" />
							</HStack>
							<Heading size="xl" className="text-typography-900 dark:text-[#E8EBF0]">{formatPercent(mem?.usedPercent)}</Heading>
							<Text className="text-sm text-typography-600 dark:text-typography-400">
								{bytesToGb((mem?.usedMb ?? 0) * 1024 ** 2)} / {bytesToGb((mem?.totalMb ?? 0) * 1024 ** 2)} GB
							</Text>
						</Box>

						<Box className="flex-1 min-w-[200px] rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
							<HStack className="items-center justify-between mb-2">
								<Text className="text-xs font-semibold uppercase text-typography-500 dark:text-typography-300 tracking-[0.08em]">
									Disk
								</Text>
								<Icon as={HardDrive} size="md" className="text-primary-700 dark:text-[#8AB9FF]" />
							</HStack>
							<Heading size="xl" className="text-typography-900 dark:text-[#E8EBF0]">
								{diskTotals.total ? `${((diskTotals.used / diskTotals.total) * 100).toFixed(1)}%` : "—"}
							</Heading>
							<Text className="text-sm text-typography-600 dark:text-typography-400">
								{formatBytes(diskTotals.used)} / {formatBytes(diskTotals.total)}
							</Text>
						</Box>

						<Box className="flex-1 min-w-[200px] rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
							<HStack className="items-center justify-between mb-2">
								<Text className="text-xs font-semibold uppercase text-typography-500 dark:text-typography-300 tracking-[0.08em]">
									Uptime
								</Text>
								<Icon as={Clock3} size="md" className="text-primary-700 dark:text-[#8AB9FF]" />
							</HStack>
							<Heading size="xl" className="text-typography-900 dark:text-[#E8EBF0]">{parseUptime(uptime?.uptime)}</Heading>
							<Text className="text-sm text-typography-600 dark:text-typography-400">Online since {formatRelative((machine as any)?.EntryTime)}</Text>
						</Box>
					</HStack>

					<Box className="mt-6 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
						<HStack className="items-center justify-between mb-3">
							<Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">CPU per core</Heading>
							<Icon as={ThermometerSun} size="sm" className="text-primary-700 dark:text-[#8AB9FF]" />
						</HStack>
						<HStack className="flex-wrap gap-3">
							{cpu?.cores?.map((core, idx) => (
								<Box key={idx} className="w-[140px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
									<HStack className="items-center justify-between mb-2">
										<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">Core {idx + 1}</Text>
										<Badge
											size="sm"
											variant="solid"
											action={core.usage > 80 ? "error" : core.usage > 60 ? "warning" : "success"}
											className={core.usage > 80 ? "bg-error-600 dark:bg-error-500" : core.usage > 60 ? "bg-warning-600 dark:bg-warning-500" : "bg-success-600 dark:bg-success-500"}
										>
											<BadgeText className="text-xs text-typography-0 dark:text-typography-0">{formatPercent(core.usage)}</BadgeText>
										</Badge>
									</HStack>
									<Box className="h-2 rounded-full bg-background-200 dark:bg-[#1A2637] overflow-hidden mb-2">
										<Box
											className="h-2 rounded-full bg-primary-500"
											style={{ width: `${Math.min(100, Math.max(0, core.usage))}%` }}
										/>
									</Box>
									<Text className="text-xs text-typography-500 dark:text-typography-300">Temp: {core.temp ? `${core.temp}ºC` : "—"}</Text>
								</Box>
							))}
							{!cpu?.cores?.length ? <Text className="text-sm text-typography-600 dark:text-typography-400">No CPU data.</Text> : null}
						</HStack>
					</Box>

					<Box className="mt-6 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
						<HStack className="items-center justify-between mb-3">
							<Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">Disks</Heading>
							<Icon as={BarChart3} size="sm" className="text-primary-700 dark:text-[#8AB9FF]" />
						</HStack>
						<VStack className="gap-3">
							{disk?.disks?.map((d) => {
								const total = Number(d.total ?? 0);
								const free = Number(d.free ?? 0);
								const used = Number.isFinite(total - free) && total && free ? total - free : Number(d.used ?? 0);
								const percent = total ? (used / total) * 100 : d.usedPercent ?? 0;
								return (
									<Box key={`${d.device}-${d.mountPoint}`} className="rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
										<HStack className="items-center justify-between mb-1">
											<VStack className="gap-1 flex-1">
												<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
													{d.mountPoint || d.device || "Disk"}
												</Text>
												<Text className="text-xs text-typography-500 dark:text-typography-300">{d.fstype || "—"}</Text>
											</VStack>
											<Text className="text-sm text-typography-600 dark:text-typography-300">{formatPercent(percent)}</Text>
										</HStack>
										<Box className="h-2 rounded-full bg-background-200 dark:bg-[#1A2637] overflow-hidden mb-1">
											<Box className="h-2 rounded-full bg-primary-500" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
										</Box>
										<Text className="text-xs text-typography-500 dark:text-typography-300">
											{formatBytes(used)} / {formatBytes(total)} • Temp {d.temperatureC ?? "—"}ºC
										</Text>
									</Box>
								);
							})}
							{!disk?.disks?.length ? <Text className="text-sm text-typography-600 dark:text-typography-400">No disks listed.</Text> : null}
						</VStack>
					</Box>

					<Box className="mt-6 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
						<HStack className="items-center justify-between mb-3">
							<Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">Network</Heading>
							<Icon as={Network} size="sm" className="text-primary-700 dark:text-[#8AB9FF]" />
						</HStack>
						<VStack className="gap-2">
							{network?.stats?.slice(0, 4).map((stat) => {
								const sent = Number(stat.bytesSent ?? 0);
								const recv = Number(stat.bytesRecv ?? 0);
								const totalMb = bytesToGb(sent + recv) * 1024; // convert to MB for display
								return (
									<HStack key={stat.name} className="items-center justify-between rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
										<VStack className="gap-1">
											<Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">{stat.name}</Text>
											<Text className="text-xs text-typography-500 dark:text-typography-300">{stat.packetsRecv} rx / {stat.packetsSent} tx</Text>
										</VStack>
										<HStack className="items-center gap-2">
											<Icon as={SignalHigh} size="sm" className="text-primary-700 dark:text-[#8AB9FF]" />
											<Text className="text-sm text-typography-600 dark:text-typography-300">{formatBytes(sent + recv)} ({totalMb.toFixed(1)} MB)</Text>
										</HStack>
									</HStack>
								);
							})}
							{!network?.stats?.length ? <Text className="text-sm text-typography-600 dark:text-typography-400">No visible interfaces.</Text> : null}
						</VStack>
					</Box>

					<Box className="mt-6 rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4">
						<HStack className="items-center justify-between mb-4">
							<VStack className="gap-1">
								<Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">History • {selectedRange.label}</Heading>
								<Text className="text-xs text-typography-600 dark:text-typography-400">{selectedRange.description}</Text>
							</VStack>
							<HStack className="gap-2 items-center">
								{RANGE_OPTIONS.map((option) => (
									<Button
										key={option.key}
										size="sm"
										variant={rangeKey === option.key ? "solid" : "outline"}
										className="rounded-xl"
										onPress={() => setRangeKey(option.key)}
										isDisabled={rangeKey === option.key || isLoading}
									>
										<ButtonText>{option.label}</ButtonText>
									</Button>
								))}
							</HStack>
						</HStack>
						<VStack className="gap-6">
							{renderMultiHistoryChart("CPU usage (%)", [
								{ label: "Average", color: "#4F46E5", data: historySeries.cpuUsage.avg },
								{ label: "Max core", color: "#EF4444", data: historySeries.cpuUsage.max },
							])}
							{renderMultiHistoryChart(
								"CPU temperature (°C)",
								[
									{ label: "Average", color: "#F59E0B", data: historySeries.cpuTemp.avg },
									{ label: "Max core", color: "#DC2626", data: historySeries.cpuTemp.max },
								],
								"°C"
							)}
							{renderHistoryChart("RAM (%)", historySeries.mem, "#10B981")}
							{renderHistoryChart("Disk (%)", historySeries.disk, "#F59E0B")}
							{renderHistoryChart("Network (MB)", historySeries.net, "#0EA5E9", "MB")}
						</VStack>
					</Box>
				</Box>
			</ScrollView>

			<Modal isOpen={isLoading || isRefreshing} onClose={() => { }}>
				<ModalBackdrop />
				<ModalContent className="bg-background-0 dark:bg-[#0A1628]">
					<ModalHeader>
						<Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">Loading</Heading>
					</ModalHeader>
					<ModalBody className="items-center gap-3 pb-6">
						<Spinner size="large" color="#3B82F6" />
						<Text className="text-sm text-typography-600 dark:text-typography-300">Fetching metrics...</Text>
					</ModalBody>
				</ModalContent>
			</Modal>
		</Box>
	);
}
