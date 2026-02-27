import { apiFetch } from "./api-client";
import { resolveToken } from "./vms-client";

export type CoreIsolationSocketStatus = {
  socketId: number;
  totalPhysicalCores: number;
  maxIsolatableCores: number;
  isolatedCoreIndices: number[];
};

export type CoreIsolationStatus = {
  enabled: boolean;
  rebootRequired: boolean;
  message: string;
  isolcpus: string;
  nohzFull: string;
  rcuNocbs: string;
  activeIsolcpus: string;
  configuredCpus: number[];
  activeCpus: number[];
  sockets: CoreIsolationSocketStatus[];
};

export type CoreIsolationSocketPayload = {
  socket_id: number;
  core_indices: number[];
};

export type CoreIsolationPayload = {
  sockets: CoreIsolationSocketPayload[];
};

export async function getCoreIsolation(machineName: string): Promise<CoreIsolationStatus> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<CoreIsolationStatus>(`/virsh/coreisolation/${encodedMachine}`, {
    token: authToken,
  });
}

export async function createCoreIsolation(
  machineName: string,
  payload: CoreIsolationPayload
): Promise<CoreIsolationStatus> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<CoreIsolationStatus>(`/virsh/coreisolation/${encodedMachine}`, {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function updateCoreIsolation(
  machineName: string,
  payload: CoreIsolationPayload
): Promise<CoreIsolationStatus> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<CoreIsolationStatus>(`/virsh/coreisolation/${encodedMachine}`, {
    method: "PUT",
    token: authToken,
    body: payload,
  });
}

export async function deleteCoreIsolation(machineName: string): Promise<CoreIsolationStatus> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<CoreIsolationStatus>(`/virsh/coreisolation/${encodedMachine}`, {
    method: "DELETE",
    token: authToken,
  });
}
