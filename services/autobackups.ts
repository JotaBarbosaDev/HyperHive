import {apiFetch} from "./api-client";
import {resolveToken} from "./vms-client";

export type AutoBackupRecord = {
  Id: number;
  VmName: string;
  FrequencyDays: number;
  MinTime: string;
  MaxTime: string;
  NfsMountId: number;
  MaxBackupsRetain: number;
  Enabled: boolean;
  LastBackupTime?: string | null;
};

export type CreateAutoBackupInput = {
  vm_name: string;
  frequency_days: number;
  min_time: string;
  max_time: string;
  nfs_mount_id: number;
  max_backups_retain: number;
};

export type UpdateAutoBackupInput = Partial<CreateAutoBackupInput> & {
  vm_name?: string;
  frequency_days?: number;
  min_time?: string;
  max_time?: string;
  nfs_mount_id?: number;
  max_backups_retain?: number;
};

export async function listAutoBackups(): Promise<AutoBackupRecord[]> {
  const token = await resolveToken();
  return apiFetch<AutoBackupRecord[]>("/virsh/autobak", {token});
}

export async function createAutoBackup(payload: CreateAutoBackupInput): Promise<void> {
  const token = await resolveToken();
  await apiFetch<void>("/virsh/autobak", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function updateAutoBackup(id: number | string, payload: UpdateAutoBackupInput) {
  const token = await resolveToken();
  const encodedId = encodeURIComponent(String(id));
  await apiFetch<void>(`/virsh/autobak/${encodedId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function deleteAutoBackup(id: number | string) {
  const token = await resolveToken();
  const encodedId = encodeURIComponent(String(id));
  await apiFetch<void>(`/virsh/autobak/${encodedId}`, {
    method: "DELETE",
    token,
  });
}

export async function enableAutoBackup(id: number | string) {
  const token = await resolveToken();
  const encodedId = encodeURIComponent(String(id));
  await apiFetch<void>(`/virsh/autopak/enable/${encodedId}`, {
    method: "PATCH",
    token,
  });
}

export async function disableAutoBackup(id: number | string) {
  const token = await resolveToken();
  const encodedId = encodeURIComponent(String(id));
  await apiFetch<void>(`/virsh/autopak/disable/${encodedId}`, {
    method: "PATCH",
    token,
  });
}
