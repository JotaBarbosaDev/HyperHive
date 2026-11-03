import React from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Download, RefreshCw, RotateCcw, Copy } from "lucide-react-native";
import {
  getBackupDownloadUrl,
  listBackupsForVm,
  mapBackupItem,
  VmBackup,
} from "@/services/backups";
import { ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket } from "@/services/websocket-client";
import { parseHyperHiveSocketPayload } from "@/utils/socketMessages";
import { RevertBackupDialog } from "@/components/modals/RevertBackupDialog";

const REFRESH_INTERVAL_MS = 10000;
const REFRESH_TYPES = new Set(["revertvm", "backupvm"]);

export type VmBackupTimelineProps = {
  vmName: string;
  vmRunning: boolean;
  getShareLabel: (nfsShareId: number | null) => string;
  onRestoreAsNew: (backup: VmBackup) => void;
  onToast: (title: string, description?: string, action?: "success" | "error") => void;
};

const formatBackupDate = (date: Date) =>
  date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

// Websocket progress ids are "<vmName>-<unix seconds>"; errors carry the bare VM name.
export const socketMessageTargetsVm = (message: unknown, vmName: string) => {
  if (!message || typeof message !== "object") return false;
  const { type, extra } = message as { type?: unknown; extra?: unknown };
  const normalizedType = typeof type === "string" ? type.toLowerCase() : "";
  const target = typeof extra === "string" ? extra.trim() : "";
  if (normalizedType === "error") return target === vmName;
  if (!REFRESH_TYPES.has(normalizedType)) return false;
  const lastHyphen = target.lastIndexOf("-");
  return lastHyphen > 0 && target.slice(0, lastHyphen) === vmName;
};

export function VmBackupTimeline({
  vmName,
  vmRunning,
  getShareLabel,
  onRestoreAsNew,
  onToast,
}: VmBackupTimelineProps) {
  const [backups, setBackups] = React.useState<VmBackup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revertTarget, setRevertTarget] = React.useState<VmBackup | null>(null);

  const refresh = React.useCallback(async (silent = false) => {
    try {
      const data = await listBackupsForVm(vmName, { silent });
      const mapped = data
        .map((item, index) => mapBackupItem(item, index))
        .sort((a, b) => b.backupDate.getTime() - a.backupDate.getTime());
      setBackups(mapped);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load backups.");
    } finally {
      setLoading(false);
    }
  }, [vmName]);

  React.useEffect(() => {
    setLoading(true);
    setBackups([]);
    void refresh();
    const interval = setInterval(() => void refresh(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Refresh when a backup or revert of this VM reports progress or fails.
  React.useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const setup = async () => {
      try {
        await ensureHyperHiveWebsocket();
      } catch (err) {
        console.warn("Backup timeline: unable to ensure websocket", err);
      }
      if (!active) return;
      unsubscribe = subscribeToHyperHiveWebsocket(async (payload) => {
        const messages = await parseHyperHiveSocketPayload(payload);
        if (!messages.some((message) => socketMessageTargetsVm(message, vmName))) return;
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => void refresh(true), 1000);
      });
    };
    void setup();
    return () => {
      active = false;
      if (pending) clearTimeout(pending);
      unsubscribe?.();
    };
  }, [refresh, vmName]);

  const handleDownload = async (backup: VmBackup) => {
    try {
      const url = await getBackupDownloadUrl(backup.id);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(url, "_blank");
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
      onToast("Download started", `Backup from ${formatBackupDate(backup.backupDate)}`);
    } catch (err) {
      onToast("Download failed", err instanceof Error ? err.message : "Failed to get download URL.", "error");
    }
  };

  return (
    <VStack className="gap-3" testID="vm-backup-timeline">
      <HStack className="items-center justify-between">
        <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">Backups</Text>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-outline-200 dark:border-[#2A3B52]"
          onPress={() => void refresh()}
          accessibilityLabel="Refresh backups"
        >
          <ButtonIcon as={RefreshCw} className="text-typography-900 dark:text-[#E8EBF0]" />
        </Button>
      </HStack>

      {loading ? (
        <HStack className="items-center gap-2">
          <ButtonSpinner />
          <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">Loading backups…</Text>
        </HStack>
      ) : error ? (
        <Text className="text-sm text-error-600 dark:text-[#F87171]">{error}</Text>
      ) : backups.length === 0 ? (
        <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
          No backups for this VM yet.
        </Text>
      ) : (
        <VStack className="gap-0">
          {backups.map((backup, index) => {
            const missing = backup.live === false;
            const isLast = index === backups.length - 1;
            return (
              <HStack key={backup.id} className="gap-3">
                {/* Timeline rail */}
                <VStack className="items-center w-3">
                  <Box
                    className={`mt-1.5 h-3 w-3 rounded-full ${missing ? "bg-outline-300 dark:bg-[#2A3B52]" : "bg-primary-500 dark:bg-[#5EEAD4]"}`}
                  />
                  {!isLast ? <Box className="flex-1 w-px bg-outline-200 dark:bg-[#2A3B52]" /> : null}
                </VStack>
                <VStack className={`flex-1 gap-2 ${isLast ? "" : "pb-4"}`}>
                  <HStack className="items-center gap-2 flex-wrap">
                    <Text className="text-sm font-medium text-typography-900 dark:text-[#E8EBF0]">
                      {formatBackupDate(backup.backupDate)}
                    </Text>
                    <Badge variant="outline" className="rounded-full" action={backup.automatic ? "info" : "muted"}>
                      <BadgeText>{backup.automatic ? "Automatic" : "Manual"}</BadgeText>
                    </Badge>
                    {missing ? (
                      <Badge variant="outline" className="rounded-full" action="error">
                        <BadgeText>File missing</BadgeText>
                      </Badge>
                    ) : null}
                  </HStack>
                  <Text className="text-xs text-typography-600 dark:text-[#8A94A8]">
                    {getShareLabel(backup.nfsShareId)}
                    {backup.size != null ? ` · ${backup.size.toFixed(2)} GB` : ""}
                  </Text>
                  <HStack className="gap-2 flex-wrap">
                    <Button
                      size="sm"
                      action="negative"
                      variant="outline"
                      className="rounded-xl"
                      isDisabled={missing}
                      onPress={() => setRevertTarget(backup)}
                      accessibilityLabel={`Revert to backup ${backup.id}`}
                    >
                      <ButtonIcon as={RotateCcw} />
                      <ButtonText>Revert</ButtonText>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-outline-200 dark:border-[#2A3B52]"
                      isDisabled={missing}
                      onPress={() => onRestoreAsNew(backup)}
                      accessibilityLabel={`Restore backup ${backup.id} as new VM`}
                    >
                      <ButtonIcon as={Copy} className="text-typography-900 dark:text-[#E8EBF0]" />
                      <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Restore as new VM</ButtonText>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-outline-200 dark:border-[#2A3B52]"
                      isDisabled={missing}
                      onPress={() => void handleDownload(backup)}
                      accessibilityLabel={`Download backup ${backup.id}`}
                    >
                      <ButtonIcon as={Download} className="text-typography-900 dark:text-[#E8EBF0]" />
                      <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Download</ButtonText>
                    </Button>
                  </HStack>
                </VStack>
              </HStack>
            );
          })}
        </VStack>
      )}

      <RevertBackupDialog
        backup={revertTarget}
        vmName={vmName}
        vmRunning={vmRunning}
        safetyShareLabel={getShareLabel(revertTarget?.nfsShareId ?? null)}
        onClose={() => setRevertTarget(null)}
        onStarted={(backup) => {
          setRevertTarget(null);
          onToast(
            "Revert started",
            `${vmName} is being reverted to the backup from ${formatBackupDate(backup.backupDate)}.`
          );
          void refresh();
        }}
      />
    </VStack>
  );
}

export default VmBackupTimeline;
