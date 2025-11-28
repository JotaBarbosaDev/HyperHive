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

export async function forceShutdownVM(vmName: string) {
  const authToken = await resolveToken();
  await apiFetch<void>(`/virsh/forceshutdownvm/${vmName}`, {
    method: "POST",
    token: authToken,
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