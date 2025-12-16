import { apiFetch } from "./api-client";
import { resolveToken, ensureApiBaseUrl } from "./vms-client";

export type BackupApiItem = Record<string, unknown>;

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
};

export async function listBackups(): Promise<BackupApiItem[]> {
  const token = await resolveToken();
  return apiFetch<BackupApiItem[]>("/virsh/backups", { token });
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
  return apiFetch(`/virsh/useBackup/${encodedId}`, {
    method: "POST",
    token,
    body: {
      ...payload,
      live: Boolean(payload.live),
    },
  });
}

export async function getBackupDownloadUrl(backupId: string | number) {
  const baseUrl = await ensureApiBaseUrl();
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const encodedId = encodeURIComponent(String(backupId));
  return `${normalizedBase}/virsh/downloadbackup/${encodedId}`;
}
