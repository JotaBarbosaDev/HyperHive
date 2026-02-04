import { apiFetch } from "@/services/api-client";
import { resolveToken } from "@/services/vms-client";
import { PciGpu, PciHostResponse, PciVmGpuActionPayload } from "@/types/pci";

const encodeMachine = (machineName: string) => encodeURIComponent(machineName);

const toGpuList = (payload: PciHostResponse): PciGpu[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.gpus)) {
    return payload.gpus;
  }
  return [];
};

export async function listHostGpus(machineName: string): Promise<PciGpu[]> {
  const token = await resolveToken();
  const response = await apiFetch<PciHostResponse>(`/pci/host/${encodeMachine(machineName)}`, {
    token,
  });
  return toGpuList(response);
}

export async function attachGpuToVm(
  machineName: string,
  payload: PciVmGpuActionPayload
): Promise<void> {
  const token = await resolveToken();
  await apiFetch<void>(`/pci/attach/${encodeMachine(machineName)}`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function detachGpuFromVm(
  machineName: string,
  payload: PciVmGpuActionPayload
): Promise<void> {
  const token = await resolveToken();
  await apiFetch<void>(`/pci/detach/${encodeMachine(machineName)}`, {
    method: "POST",
    token,
    body: payload,
  });
}
