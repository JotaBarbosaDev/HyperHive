import { apiFetch } from "./api-client";
import { loadAuthToken } from "./auth-storage";
import { setAuthToken, triggerUnauthorized } from "./api-client";
import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import { loadApiBaseUrl } from "./auth-storage";

export type Slave = {
  Addr: string;
  MachineName: string;
  Connection: Record<string, unknown>;
  LastSeen: string;
  EntryTime: string;
};

export enum VmState {
  UNKNOWN = 0,
  RUNNING = 1,
  BLOCKED = 2,
  PAUSED = 3,
  SHUTDOWN = 4,
  SHUTOFF = 5,
  CRASHED = 6,
  PMSUSPENDED = 7,
  NOSTATE = 8,
}

export type VirtualMachine = {
  AllocatedGb: number;
  CPUXML: string;
  DefinedCPUS: number;
  DefinedRam: number;
  VNCPassword: string;
  autoStart: boolean;
  cpuCount: number;
  currentCpuUsage: number;
  currentMemoryUsageMB: number;
  diskPath: string;
  diskSizeGB: number;
  ip: string[];
  isLive: boolean;
  machineName: string;
  memoryMB: number;
  name: string;
  network: string;
  novncPort: string;
  novnclink: string;
  spritePort: string;
  state: VmState;
};

const ensureApiBaseUrl = async () => {
  let baseUrl = getApiBaseUrl();
  if (baseUrl) {
    return baseUrl;
  }
  const storedBaseUrl = await loadApiBaseUrl();
  if (storedBaseUrl) {
    baseUrl = setApiBaseUrl(storedBaseUrl) ?? null;
  }
  if (!baseUrl) {
    throw new Error("Domínio/API base não configurado. Inicia sessão novamente.");
  }
  return baseUrl;
};

export const resolveToken = async () => {
  await ensureApiBaseUrl();
  const storedToken = await loadAuthToken();
  if (!storedToken) {
    setAuthToken(null);
    triggerUnauthorized();
    throw new Error("Token de autenticação inválida.");
  }
  setAuthToken(storedToken);
  return storedToken;
};

export async function listSlaves(): Promise<Slave[]> {
  const authToken = await resolveToken();
  return apiFetch<Slave[]>("/protocol/list", { token: authToken });
}

export async function getAllVMs(): Promise<VirtualMachine[]> {
  const authToken = await resolveToken();
  return apiFetch<VirtualMachine[]>("/virsh/getallvms", { token: authToken });
}

export async function pauseVM(vmName: string) {
  const authToken = await resolveToken();
  await apiFetch<void>(`/virsh/pausevm/${vmName}`, {
    method: "POST",
    token: authToken,
  });

}

export async function resumeVM(vmName: string) {
  const authToken = await resolveToken();
  await apiFetch<void>(`/virsh/resumevm/${vmName}`, {
    method: "POST",
    token: authToken,
  });
}

export async function restartVM(vmName: string) {
  const authToken = await resolveToken();
  await apiFetch<void>(`/virsh/restartvm/${vmName}`, {
    method: "POST",
    token: authToken,
  });
}

export async function shutdownVM(vmName: string) {
  const authToken = await resolveToken();
  await apiFetch<void>(`/virsh/shutdownvm/${vmName}`, {
    method: "POST",
    token: authToken,
  });
}

export async function startVM(vmName: string) {
  const authToken = await resolveToken();
  await apiFetch<void>(`/virsh/startvm/${vmName}`, {
    method: "POST",
    token: authToken,
  });
}

export async function migrateVM(vmName: string, targetMachineName: string) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const encodedTarget = encodeURIComponent(targetMachineName);
  return apiFetch<void>(`/virsh/migratevm/${encodedVmName}/${encodedTarget}`, {
    method: "POST",
    token: authToken,
  });
}

export async function coldMigrateVM(vmName: string, targetMachineName: string) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const encodedTarget = encodeURIComponent(targetMachineName);
  return apiFetch<void>(`/virsh/coldMigrate/${encodedVmName}/${encodedTarget}`, {
    method: "POST",
    token: authToken,
  });
}

export async function moveDisk(vmName: string, destNfsId: string, destDiskPath?: string) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const encodedNfs = encodeURIComponent(destNfsId);
  return apiFetch<void>(`/virsh/moveDisk/${encodedVmName}/${encodedNfs}`, {
    method: "POST",
    token: authToken,
    body: destDiskPath ? {dest_disk_path: destDiskPath} : undefined,
  });
}

export async function deleteVM(vmName: string) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  await apiFetch<void>(`/virsh/deletevm/${encodedVmName}`, {
    method: "DELETE",
    token: authToken,
  });
}

export async function forceShutdownVM(vmName: string) {
  const authToken = await resolveToken();
  await apiFetch<void>(`/virsh/forceshutdownvm/${vmName}`, {
    method: "POST",
    token: authToken,
  });
}

export async function cloneVm(
  vmName: string,
  destNfs: string,
  destMachineName: string,
  newName: string
) {
  const authToken = await resolveToken();
  const encodedVm = encodeURIComponent(vmName);
  const encodedNfs = encodeURIComponent(destNfs);
  const encodedMachine = encodeURIComponent(destMachineName);
  return apiFetch<void>(
    `/virsh/cloneVM/${encodedVm}/${encodedNfs}/${encodedMachine}`,
    {
      method: "POST",
      token: authToken,
      body: {new_name: newName},
    }
  );
}

export type EditVmPayload = {
  memory: number;
  vcpu: number;
  disk_sizeGB: number;
};

export async function editVmResources(vmName: string, payload: EditVmPayload) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  return apiFetch<void>(`/virsh/editvm/${encodedVmName}`, {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export type CreateVmPayload = {
  machine_name: string;
  name: string;
  memory: number;
  vcpu: number;
  disk_sizeGB: number;
  iso_id?: number;
  nfs_share_id: number;
  network: string;
  VNC_password: string;
  live: boolean;
  cpu_xml: string;
  auto_start: boolean;
  is_windows: boolean;
};

export async function createVm(payload: CreateVmPayload) {
  const authToken = await resolveToken();
  return apiFetch<void>("/virsh/createvm", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export type IsoApiResponse = {
  Id: number;
  MachineName: string;
  FilePath: string;
  Name: string;
  available_on_slaves: Record<string, boolean>;
}[];

export async function listIsos(): Promise<IsoApiResponse> {
  const authToken = await resolveToken();
  return apiFetch<IsoApiResponse>("/isos/", {
    token: authToken,
  });
}
