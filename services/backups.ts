import { apiFetch } from "./api-client";
import { resolveToken, ensureApiBaseUrl } from "./vms-client";
import { normalizeOptionalTemplateId } from "@/utils/xml-template";

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
  template_id?: number;
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
