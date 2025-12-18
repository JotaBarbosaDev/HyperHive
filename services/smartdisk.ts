import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {apiFetch, setAuthToken, triggerUnauthorized} from "./api-client";
import {loadApiBaseUrl, loadAuthToken} from "./auth-storage";
import {
  SmartDiskDevice,
  SmartDiskReallocStatus,
  SmartDiskSchedule,
  SmartDiskSelfTestProgress,
} from "@/types/smartdisk";

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
    throw new Error("Base domain/API not configured. Sign in again.");
  }
  return baseUrl;
};

const resolveToken = async () => {
  await ensureApiBaseUrl();
  const storedToken = await loadAuthToken();
  if (!storedToken) {
    setAuthToken(null);
    triggerUnauthorized();
    throw new Error("Invalid authentication token.");
  }
  setAuthToken(storedToken);
  return storedToken;
};

const machinePath = (machineName: string, path: string) => {
  const encoded = encodeURIComponent(machineName);
  return `/smartdisk/${encoded}/${path}`;
};

const toNumber = (val: unknown): number | undefined => {
  if (val === null || val === undefined) return undefined;
  const num = typeof val === "number" ? val : Number(val);
  return Number.isNaN(num) ? undefined : num;
};

const normalizeDevices = (data: any): SmartDiskDevice[] => {
  const asArray =
    Array.isArray(data) && data.length > 0
      ? data
      : Array.isArray(data?.disks)
      ? data.disks
      : Array.isArray(data?.devices)
      ? data.devices
      : data && typeof data === "object" && (data.device || data.path || data.name)
      ? [data]
      : [];

  return asArray.map((d: any) => ({
    device: d?.device ?? d?.path ?? d?.name ?? d ?? "",
    model: d?.model,
    serial: d?.serial,
    firmware: d?.firmware,
    capacity: d?.capacity ?? d?.capacityBytes ?? d?.Capacity,
    capacityBytes: d?.capacityBytes,
    temp: d?.temp ?? d?.temperature ?? d?.temperatureC,
    tempC: d?.tempC ?? d?.temp,
    temperatureC: d?.temperatureC,
    temperatureMax: d?.temperatureMax ?? d?.tempMax ?? d?.maxTemp,
    temperatureMin: d?.temperatureMin ?? d?.tempMin ?? d?.minTemp,
    reallocated: d?.reallocated ?? d?.reallocatedSectors,
    pending: d?.pending ?? d?.pendingSectors,
    status: d?.status,
    healthStatus: d?.healthStatus,
    smartPassed: d?.smartPassed,
    powerOnHours: d?.powerOnHours,
    powerCycleCount: d?.powerCycleCount ?? d?.powerCycles,
    maxTemp: d?.maxTemp,
    minTemp: d?.minTemp,
    powerCycles: d?.powerCycles ?? d?.powerCycleCount,
    risk: d?.risk,
    recommendedAction: d?.recommendedAction,
    metrics: {
      reallocatedSectors: d?.metrics?.reallocatedSectors ?? d?.reallocatedSectors,
      reallocatedEventCount: d?.metrics?.reallocatedEventCount ?? d?.reallocatedEventCount,
      pendingSectors: d?.metrics?.pendingSectors ?? d?.pendingSectors ?? d?.pending,
      offlineUncorrectable: d?.metrics?.offlineUncorrectable ?? d?.offlineUncorrectable,
    },
    testsHistory: d?.testsHistory ?? d?.selfTests ?? d?.smartTests ?? [],
    lastAtaErrors: d?.lastAtaErrors ?? [],
    lastNvmeErrors: d?.lastNvmeErrors ?? [],
    smartctlError: d?.smartctlError,
    physicalProblemRisk: d?.physicalProblemRisk,
    raw: d,
  }));
};

const normalizeSelfTestProgress = (data: any, device: string): SmartDiskSelfTestProgress => {
  const base = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  return {
    device: (base.device as string) ?? device,
    progressPercent: toNumber((base as any).progressPercent ?? (base as any).progress),
    remainingPercent: toNumber((base as any).remainingPercent),
    status: (base as any).status,
    type: (base as any).type,
    startedAtUnix: (base as any).startedAtUnix,
  };
};

const normalizeReallocStatus = (data: any, deviceFallback?: string): SmartDiskReallocStatus => ({
  device: data?.device ?? deviceFallback ?? "",
  mode: data?.mode,
  startedAtUnix: data?.startedAtUnix,
  elapsedSeconds: data?.elapsedSeconds,
  percent: toNumber(data?.percent),
  pattern: data?.pattern,
  readErrors: toNumber(data?.readErrors),
  writeErrors: toNumber(data?.writeErrors),
  corruptionErrors: toNumber(data?.corruptionErrors),
  lastLine: data?.lastLine,
  completed: data?.completed,
  error: data?.error,
});

export async function listSmartDisks(machineName: string, device: string): Promise<SmartDiskDevice[]> {
  if (!device) {
    throw new Error("device parameter is required");
  }
  const allowed = /^\/dev\/(sd|nvme|vd|hd|xvd|loop)/.test(device);
  if (!allowed) {
    return [];
  }
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  const query = `?device=${encodeURIComponent(device)}`;
  const data = await apiFetch<any>(`/smartdisk/${encodedMachine}${query}`, {token: authToken});
  return normalizeDevices(data);
}

export async function getSelfTestProgress(machineName: string, device: string): Promise<SmartDiskSelfTestProgress> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  const path = `/smartdisk/${encodedMachine}/self-test/progress?device=${encodeURIComponent(device)}`;
  const data = await apiFetch<any>(path, {token: authToken});
  return normalizeSelfTestProgress(data, device);
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

export async function getRealloc(machineName: string): Promise<SmartDiskReallocStatus[]> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  const resp = await apiFetch<any>(`/smartdisk/${encodedMachine}/realloc`, {token: authToken});
  const list = Array.isArray(resp?.statuses) ? resp.statuses : Array.isArray(resp) ? resp : [];
  return (list as any[]).map((item) => normalizeReallocStatus(item));
}

export async function getReallocStatus(machineName: string, device: string): Promise<SmartDiskReallocStatus> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  const data = await apiFetch<any>(`/smartdisk/${encodedMachine}/realloc/status?device=${encodeURIComponent(device)}`, {token: authToken});
  return normalizeReallocStatus(data, device);
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
