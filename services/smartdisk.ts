import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {apiFetch, setAuthToken, triggerUnauthorized} from "./api-client";
import {loadApiBaseUrl, loadAuthToken} from "./auth-storage";
import {SmartDiskDevice, SmartDiskSchedule} from "@/types/smartdisk";

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

const machinePath = (machineName: string, path: string) => {
  const encoded = encodeURIComponent(machineName);
  return `/smartdisk/${encoded}/${path}`;
};

const normalizeDevices = (data: any): SmartDiskDevice[] => {
  const devices = Array.isArray(data)
    ? data
    : Array.isArray(data?.disks)
    ? data.disks
    : Array.isArray(data?.devices)
    ? data.devices
    : [];
  return devices.map((d) => ({
    device: d?.device ?? d?.path ?? d?.name ?? d ?? "",
    model: d?.model,
    serial: d?.serial,
    firmware: d?.firmware,
    capacity: d?.capacity,
    temp: d?.temp ?? d?.temperature,
    tempC: d?.tempC ?? d?.temp,
    reallocated: d?.reallocated ?? d?.reallocatedSectors,
    pending: d?.pending ?? d?.pendingSectors,
    status: d?.status,
    healthStatus: d?.healthStatus,
    smartPassed: d?.smartPassed,
    powerOnHours: d?.powerOnHours,
    maxTemp: d?.maxTemp,
    minTemp: d?.minTemp,
    powerCycles: d?.powerCycles,
    risk: d?.risk,
    recommendedAction: d?.recommendedAction,
    metrics: {
      reallocatedSectors: d?.metrics?.reallocatedSectors ?? d?.reallocatedSectors,
      reallocatedEventCount: d?.metrics?.reallocatedEventCount,
      pendingSectors: d?.metrics?.pendingSectors,
      offlineUncorrectable: d?.metrics?.offlineUncorrectable,
    },
    testsHistory: d?.testsHistory ?? d?.selfTests ?? [],
  }));
};

export async function listSmartDisks(machineName: string, device: string): Promise<SmartDiskDevice[]> {
  if (!device) {
    throw new Error("device parameter is required");
  }
  const allowed = /^\/dev\/(sd|nvme|vd|hd|xvd)/.test(device);
  if (!allowed) {
    return [];
  }
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  const query = `?device=${encodeURIComponent(device)}`;
  const data = await apiFetch<any>(`/smartdisk/${encodedMachine}${query}`, {token: authToken});
  return normalizeDevices(data);
}

export async function getSelfTestProgress(machineName: string, device: string): Promise<unknown> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  const path = `/smartdisk/${encodedMachine}/self-test/progress?device=${encodeURIComponent(device)}`;
  return apiFetch<unknown>(path, {token: authToken});
}

export async function startSelfTest(machineName: string, body: {device: string; type?: string}): Promise<unknown> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<unknown>(`/smartdisk/${encodedMachine}/self-test`, {
    method: "POST",
    token: authToken,
    body,
  });
}

export async function cancelSelfTest(machineName: string, device: string): Promise<unknown> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<unknown>(`/smartdisk/${encodedMachine}/self-test/cancel`, {
    method: "POST",
    token: authToken,
    body: {device},
  });
}

export async function getRealloc(machineName: string): Promise<unknown> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<unknown>(`/smartdisk/${encodedMachine}/realloc`, {token: authToken});
}

export async function getReallocStatus(machineName: string, device: string): Promise<unknown> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<unknown>(`/smartdisk/${encodedMachine}/realloc/status?device=${encodeURIComponent(device)}`, {
    token: authToken,
  });
}

export async function reallocFullWipe(machineName: string, device: string): Promise<unknown> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<unknown>(`/smartdisk/${encodedMachine}/realloc/full-wipe`, {
    method: "POST",
    token: authToken,
    body: {device},
  });
}

export async function reallocNonDestructive(machineName: string, device: string): Promise<unknown> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<unknown>(`/smartdisk/${encodedMachine}/realloc/non-destructive`, {
    method: "POST",
    token: authToken,
    body: {device},
  });
}

export async function reallocCancel(machineName: string, device: string): Promise<unknown> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<unknown>(`/smartdisk/${encodedMachine}/realloc/cancel`, {
    method: "POST",
    token: authToken,
    body: {device},
  });
}

export async function listSchedules(machineName: string): Promise<SmartDiskSchedule[]> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  try {
    const data = await apiFetch<any>(`/smartdisk/${encodedMachine}/schedules`, {token: authToken});
    if (Array.isArray(data)) return data as SmartDiskSchedule[];
    if (Array.isArray(data?.schedules)) return data.schedules as SmartDiskSchedule[];
  } catch (err) {
    console.error("listSchedules failed", err);
  }
  return [];
}

export async function createSchedule(machineName: string, payload: Omit<SmartDiskSchedule, "id">): Promise<SmartDiskSchedule> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<SmartDiskSchedule>(`/smartdisk/${encodedMachine}/schedules`, {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function updateSchedule(machineName: string, id: number, payload: Omit<SmartDiskSchedule, "id">): Promise<SmartDiskSchedule> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<SmartDiskSchedule>(`/smartdisk/${encodedMachine}/schedules/${id}`, {
    method: "PUT",
    token: authToken,
    body: payload,
  });
}

export async function deleteSchedule(machineName: string, id: number): Promise<void> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  await apiFetch<void>(`/smartdisk/${encodedMachine}/schedules/${id}`, {
    method: "DELETE",
    token: authToken,
  });
}

export async function enableSchedule(machineName: string, id: number, active = true): Promise<SmartDiskSchedule> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<SmartDiskSchedule>(`/smartdisk/${encodedMachine}/schedules/${id}/enable`, {
    method: "PUT",
    token: authToken,
    body: {active},
  });
}
