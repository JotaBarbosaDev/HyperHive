import { apiFetch } from "./api-client";
import { resolveToken, ensureApiBaseUrl } from "./vms-client";
import { normalizeOptionalTemplateId } from "@/utils/xml-template";

export type BackupApiItem = Record<string, unknown>;

export type VmBackupStatus = "complete" | "partial" | "failed" | string;
export type VmBackupType = "full" | "incremental" | string;

export interface VmBackup {
  id: string;
  vmName: string;
  machineName: string;
  backupDate: Date;
  size: number | null; // GB
  nfsShareId: number | null;
  status?: VmBackupStatus | null;
  type?: VmBackupType | null;
  // false when the backup file is missing on its share
  live?: boolean;
  automatic?: boolean;
  path?: string;
}

export type RevertBackupResponse = {
  status: string;
  vm_name: string;
  backup_id: number;
};

export type UseBackupPayload = {
  slave_name: string;
  vm_name: string;
  memory: number;
  vcpu: number;
  network: string;
  VNC_password: string;
  nfs_share_id: number;
  cpu_xml: string;
  live: boolean;
  template_id?: number;
};

export async function listBackups(): Promise<BackupApiItem[]> {
  const token = await resolveToken();
  return apiFetch<BackupApiItem[]>("/virsh/backups", { token });
}

// Lists one VM's backups (manual and automatic), same shape as listBackups.
// Background polls pass silent so failures don't raise the global API error dialog.
export async function listBackupsForVm(
  vmName: string,
  options: { silent?: boolean } = {}
): Promise<BackupApiItem[]> {
  const token = await resolveToken();
  const data = await apiFetch<BackupApiItem[] | null>(
    `/virsh/backups?vm_name=${encodeURIComponent(vmName)}`,
    { token, reportResult: !options.silent }
  );
  return Array.isArray(data) ? data : [];
}

// Starts an in-place revert; the master answers 202 and reports progress
// over the RevertVM websocket type and a notification.
export async function revertBackup(
  backupId: string | number,
  options: { start_after: boolean }
): Promise<RevertBackupResponse> {
  const token = await resolveToken();
  const encodedId = encodeURIComponent(String(backupId));
  return apiFetch<RevertBackupResponse>(`/virsh/revertBackup/${encodedId}`, {
    method: "POST",
    token,
    body: { start_after: Boolean(options.start_after) },
  });
}

export async function deleteBackup(backupId: string | number): Promise<void> {
  const token = await resolveToken();
  const encodedId = encodeURIComponent(String(backupId));
  await apiFetch<void>(`/virsh/deleteBackup/${encodedId}`, {
    method: "DELETE",
    token,
  });
}

export async function createBackup(vmName: string, nfsId: number): Promise<unknown> {
  const token = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const encodedNfsId = encodeURIComponent(String(nfsId));
  return apiFetch(`/virsh/backup/${encodedVmName}/${encodedNfsId}`, {
    method: "POST",
    token,
  });
}

export async function useBackup(
  backupId: string | number,
  payload: UseBackupPayload
): Promise<unknown> {
  const token = await resolveToken();
  const encodedId = encodeURIComponent(String(backupId));
  const templateId = normalizeOptionalTemplateId(payload.template_id);
  const { template_id: _templateId, ...restPayload } = payload;
  return apiFetch(`/virsh/useBackup/${encodedId}`, {
    method: "POST",
    token,
    body: {
      ...restPayload,
      live: Boolean(restPayload.live),
      ...(templateId ? { template_id: templateId } : {}),
    },
  });
}

export async function getBackupDownloadUrl(backupId: string | number) {
  const baseUrl = await ensureApiBaseUrl();
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const encodedId = encodeURIComponent(String(backupId));
  return `${normalizedBase}/virsh/downloadbackup/${encodedId}`;
}

const parseBackupDate = (value: unknown): Date => {
  const candidates = Array.isArray(value) ? value : [value];
  const knownKeys = [
    "backupDate",
    "backup_date",
    "date",
    "created_at",
    "timestamp",
    "time",
    "CreatedAt",
  ];
  if (value && typeof value === "object") {
    for (const key of knownKeys) {
      const candidate = (value as Record<string, unknown>)[key];
      if (candidate) {
        const parsed = new Date(String(candidate));
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(String(candidate));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
};

const extractShareFromPath = (path?: string | null) => {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  const sharedIndex = parts.findIndex((p) => p === "shared");
  if (sharedIndex >= 0 && parts[sharedIndex + 1]) {
    return parts[sharedIndex + 1];
  }
  return "";
};

export function mapBackupItem(rawItem: unknown, index: number): VmBackup {
  const item = rawItem as any;
  const source = item?.db_res ?? item;
  const fallbackId = `backup-${index}`;
  const id =
    source?.Id ??
    item?.id ??
    item?.backup_id ??
    item?.bak_id ??
    item?._id ??
    source?.Name ??
    fallbackId;
  const vmName = source?.Name ?? item?.vm_name ?? item?.vmName ?? item?.vm ?? "Unknown VM";
  const path = source?.Path ?? item?.path ?? "";
  const machineName =
    extractShareFromPath(path) ||
    item?.machine_name ||
    item?.slave_name ||
    item?.machine ||
    item?.host ||
    "Unknown host";
  const sizeRaw =
    source?.Size ??
    source?.size ??
    source?.size_gb ??
    source?.sizeGB ??
    source?.total_size_gb ??
    item?.size ??
    null;
  const parsedSize =
    typeof sizeRaw === "number"
      ? sizeRaw
      : typeof sizeRaw === "string"
        ? Number(sizeRaw)
        : null;
  const nfsRaw =
    source?.NfsId ??
    item?.nfs_share_id ??
    item?.nfsShareId ??
    item?.nfs_id ??
    item?.nfs ??
    item?.nfsId;
  const nfsShareId =
    nfsRaw === undefined || nfsRaw === null || Number.isNaN(Number(nfsRaw))
      ? null
      : Number(nfsRaw);
  const status =
    item?.status ??
    item?.state ??
    item?.backup_status ??
    source?.status ??
    ("complete" as VmBackupStatus | null);
  const type = item?.type ?? item?.backup_type ?? source?.type ?? ("full" as VmBackupType | null);
  const live = Boolean(item?.live ?? item?.isLive ?? source?.live);
  const automatic = Boolean(source?.Automatic ?? item?.automatic ?? item?.Automatic);

  return {
    id: String(id),
    vmName: String(vmName),
    machineName: String(machineName),
    backupDate: parseBackupDate(
      item?.backupDate ?? item?.created_at ?? item?.date ?? source?.CreatedAt ?? item
    ),
    size: Number.isFinite(parsedSize) ? Number(parsedSize) : null,
    nfsShareId,
    status,
    type,
    live,
    automatic,
    path,
  };
}
