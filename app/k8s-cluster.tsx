import React from "react";
import { Platform, RefreshControl, ScrollView, useColorScheme } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Divider } from "@/components/ui/divider";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Radio, RadioGroup, RadioIndicator, RadioLabel, RadioIcon } from "@/components/ui/radio";
import { Toast, ToastTitle, useToast } from "@/components/ui/toast";
import { Icon } from "@/components/ui/icon";
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader,
} from "lucide-react-native";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { fetchK8sClusterStatus, fetchK8sTlsSans, downloadK8sConnectionFile } from "@/services/k8s";
import { K8sClusterNode, K8sClusterStatusResponse } from "@/types/k8s";

const formatLastSeen = (value?: string) => {
	if (!value) return "-";
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toLocaleString();
};

const saveConnectionFile = async (content: string) => {
	const filename = "k8s-connection.conf";

	if (Platform.OS === "web") {
		const blob = new Blob([content], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
		return filename;
	}

	const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
	if (!baseDir) {
		throw new Error("Unable to access the storage directory.");
	}

	const targetPath = `${baseDir}${filename}`;
	await FileSystem.writeAsStringAsync(targetPath, content, {
		encoding: FileSystem.EncodingType.UTF8,
	});

	const canShare = await Sharing.isAvailableAsync();
	if (canShare) {
		await Sharing.shareAsync(targetPath, {
			mimeType: "text/plain",
			dialogTitle: filename,
			UTI: "public.plain-text",
		});
	}

	return targetPath;
};

export default function K8ClusterScreen() {
	const { token, isChecking } = useAuthGuard();
	const toast = useToast();
	const colorScheme = useColorScheme();
	const [tlsSans, setTlsSans] = React.useState<string[]>([]);
	const [selectedIp, setSelectedIp] = React.useState<string | null>(null);
	const [status, setStatus] = React.useState<K8sClusterStatusResponse | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [isRefreshing, setIsRefreshing] = React.useState(false);
	const [isDownloading, setIsDownloading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const loadData = React.useCallback(
		async (opts: { refresh?: boolean; silent?: boolean } = {}) => {
			const isSilent = Boolean(opts.silent);
			if (!token) {
				setTlsSans([]);
				setSelectedIp(null);
				setStatus(null);
				if (!isSilent) {
					setIsLoading(false);
					setIsRefreshing(false);
				}
				return;
			}

			if (!isSilent && opts.refresh) {
				setIsRefreshing(true);
			} else if (!isSilent) {
				setIsLoading(true);
			}

			try {
				const [ips, clusterStatus] = await Promise.all([
					fetchK8sTlsSans(),
					fetchK8sClusterStatus(),
				]);

				setTlsSans(ips);
				setSelectedIp((prev) => {
					if (!ips.length) return null;
					if (prev && ips.includes(prev)) return prev;
					return ips[0];
				});
				setStatus(clusterStatus);
				setError(null);
			} catch (err) {
				const message = err instanceof Error ? err.message : "Unable to load cluster information.";
				setError(message);
			} finally {
				if (!isSilent) {
					setIsLoading(false);
					setIsRefreshing(false);
				}
			}
		},
		[token]
	);

	React.useEffect(() => {
		if (!isChecking) {
			void loadData();
		}
	}, [isChecking, loadData]);

	React.useEffect(() => {
		if (isChecking || !token) return;
		const id = setInterval(() => {
			void loadData({ silent: true });
		}, 5000);
		return () => clearInterval(id);
	}, [isChecking, token, loadData]);

	const handleRefresh = React.useCallback(async () => {
		await loadData({ refresh: true });
	}, [loadData]);

	const handleDownload = React.useCallback(async () => {
		if (!selectedIp) return;
		setIsDownloading(true);
		try {
			const content = await downloadK8sConnectionFile(selectedIp);
			const normalizedContent = typeof content === "string" ? content : JSON.stringify(content, null, 2);
			await saveConnectionFile(normalizedContent);
			toast.show({
				placement: "top",
				render: ({ id }) => (
					<Toast nativeID={`toast-${id}`} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="success">
						<ToastTitle size="sm">Connection file ready</ToastTitle>
					</Toast>
				),
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unable to download connection file.";
			toast.show({
				placement: "top",
				render: ({ id }) => (
					<Toast nativeID={`toast-${id}`} className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row" action="error">
						<ToastTitle size="sm">{message}</ToastTitle>
					</Toast>
				),
			});
		} finally {
			setIsDownloading(false);
		}
	}, [selectedIp, toast]);

	if (isChecking || !token) {
		return null;
	}

	const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
	const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

	const renderNodes = (label: string, nodes: K8sClusterNode[], isConnected: boolean) => {
		return (
			<Box className="mt-4">
				<HStack className="items-center justify-between mb-2">
					<Text className="text-xs font-semibold uppercase text-typography-500 dark:text-[#8A94A8] tracking-[0.08em]" style={{ fontFamily: "Inter_600SemiBold" }}>
						{label}
					</Text>
					<Text className="text-xs text-typography-500 dark:text-[#8A94A8]">
						{nodes.length} node{nodes.length === 1 ? "" : "s"}
					</Text>
				</HStack>
				{!nodes.length ? (
					<Box className="p-3 rounded-lg border border-outline-100 dark:border-[#2A3B52] bg-background-50/70 dark:bg-[#0F1A2E]">
						<Text className="text-sm text-typography-600 dark:text-[#8A94A8]">No nodes in this state.</Text>
					</Box>
				) : (
					<VStack className="gap-3">
						{nodes.map((node) => (
							<Box
								key={`${node.machine}-${node.addr}`}
								className={`p-3 rounded-lg border ${isConnected
									? "border-[#BBF7D0] bg-[#F0FDF4] dark:border-[#1F3B2C] dark:bg-[#0E1C13]"
									: "border-[#FECACA] bg-[#FEF2F2] dark:border-[#2C1A1A] dark:bg-[#1A0E0E]"
									}`}
							>
								<HStack className="items-center justify-between mb-1">
									<Text className="text-base text-typography-900 dark:text-[#E8EBF0]" style={{ fontFamily: "Inter_600SemiBold" }}>
										{node.machine || node.addr || "Unknown"}
									</Text>
									<HStack className="items-center gap-1">
										<Icon
											as={isConnected ? CheckCircle2 : AlertTriangle}
											size="sm"
											className={isConnected ? "text-emerald-600 dark:text-emerald-400" : "text-[#DC2626] dark:text-[#FCA5A5]"}
										/>
										<Text
											className={
												isConnected
													? "text-xs font-semibold text-emerald-700 dark:text-emerald-300"
													: "text-xs font-semibold text-[#B91C1C] dark:text-[#FCA5A5]"
											}
										>
											{isConnected ? "Connected" : "Disconnected"}
										</Text>
									</HStack>
								</HStack>
								<Text className="text-sm text-typography-700 dark:text-typography-200">Address: {node.addr || "-"}</Text>
								<Text className="text-sm text-typography-700 dark:text-typography-200">Last seen: {formatLastSeen(node.lastSeen)}</Text>
								{node.tlsSANs?.length ? (
									<Text className="text-sm text-typography-700 dark:text-typography-200">TLS SANs: {node.tlsSANs.join(", ")}</Text>
								) : null}
								{!isConnected && node.error ? (
									<Text className="text-xs text-[#B91C1C] dark:text-[#FCA5A5] mt-2">{node.error}</Text>
								) : null}
							</Box>
						))}
					</VStack>
				)}
			</Box>
		);
	};

	return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 80}}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={refreshControlTint}
            colors={[refreshControlTint]}
            progressBackgroundColor={refreshControlBackground}
          />
        }
      >
        <Box className="p-4 pt-16 web:p-20 web:max-w-7xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            K8 Cluster
          </Heading>
          <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl mb-6">
            Download the cluster connection file and monitor node connectivity.
          </Text>

          {error ? (
            <Box className="p-3 mb-4 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1212]">
              <Text
                className="text-[#B91C1C] dark:text-[#FCA5A5]"
                style={{fontFamily: "Inter_500Medium"}}
              >
                {error}
              </Text>
            </Box>
          ) : null}

          <Box className="gap-6">
            <Box className="p-5 rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1524] shadow-soft-1">
              <Heading
                size="md"
                className="text-typography-900 dark:text-[#E8EBF0] mb-1"
                style={{fontFamily: "Inter_700Bold"}}
              >
                Connection File
              </Heading>
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8] mb-4">
                Select the cluster IP to include in the connection file and
                download it.
              </Text>

              {isLoading ? (
                <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                  Loading options...
                </Text>
              ) : (
                <RadioGroup
                  value={selectedIp ?? undefined}
                  onChange={(val: any) => setSelectedIp(val)}
                  className="gap-3"
                >
                  {tlsSans.map((ip) => (
                    <Radio
                      key={ip}
                      value={ip}
                      aria-label={ip}
                      className="flex-row items-center gap-3 rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50/70 dark:bg-[#0F1A2E] px-3 py-3"
                    >
                      <RadioIndicator>
                        {selectedIp === ip ? (
                          <Box className="w-2 h-2 rounded-full bg-primary-700 dark:bg-[#E8EBF0]"></Box>
                        ) : null}
                      </RadioIndicator>
                      <RadioLabel
                        className="text-base text-typography-900 dark:text-[#E8EBF0]"
                        style={{fontFamily: "Inter_600SemiBold"}}
                      >
                        {ip}
                      </RadioLabel>
                    </Radio>
                  ))}
                  {!tlsSans.length ? (
                    <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                      No TLS SANs available.
                    </Text>
                  ) : null}
                </RadioGroup>
              )}

              <Divider className="my-4" />

              <Button
                onPress={handleDownload}
                isDisabled={!selectedIp || isDownloading}
                className="rounded-xl h-12 dark:bg-[#5EEAD4]"
                action="primary"
              >
                {isDownloading ? (
                  <ButtonSpinner color="white" />
                ) : (
                  <ButtonIcon as={Download} className="text-background-0" />
                )}
                <ButtonText
                  className="text-background-0"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Download Cluster Connection File
                </ButtonText>
              </Button>
            </Box>

            <Box className="p-5 rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1524] shadow-soft-1">
              <Heading
                size="md"
                className="text-typography-900 dark:text-[#E8EBF0] mb-1"
                style={{fontFamily: "Inter_700Bold"}}
              >
                Cluster Status
              </Heading>
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                Current connectivity for each node in the cluster.
              </Text>
              {isLoading && !status ? (
                <Text className="text-sm text-typography-600 dark:text-[#8A94A8] mt-3">
                  Loading status...
                </Text>
              ) : null}
              {status ? (
                <>
                  {renderNodes("Connected", status.connected || [], true)}
                  {renderNodes(
                    "Disconnected",
                    status.disconnected || [],
                    false,
                  )}
                </>
              ) : null}
            </Box>
          </Box>
        </Box>
      </ScrollView>
    </Box>
  );
}
