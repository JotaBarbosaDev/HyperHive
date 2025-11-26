import {apiFetch} from "./api-client";
import {loadAuthToken} from "./auth-storage";
import {setAuthToken, triggerUnauthorized} from "./api-client";
import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {loadApiBaseUrl} from "./auth-storage";

export type Slave = {
  Addr: string;
  MachineName: string;
  Connection: Record<string, unknown>;
  LastSeen: string;
  EntryTime: string;
};

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
  state: number;
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

const resolveToken = async () => {
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
  return apiFetch<Slave[]>("/protocol/list", {token: authToken});
}

export async function getAllVMs(): Promise<VirtualMachine[]> {
  const authToken = await resolveToken();
  return apiFetch<VirtualMachine[]>("/virsh/getallvms", {token: authToken});
}
