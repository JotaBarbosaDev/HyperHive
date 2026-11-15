import { apiFetch } from "@/services/api-client";
import { resolveToken } from "@/services/vms-client";
import { PciGpu, PciHostResponse, PciGpuModePayload } from "@/types/pci";

const encodeMachine = (machineName: string) => encodeURIComponent(machineName);

const toGpuList = (payload: PciHostResponse): PciGpu[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.gpus)) {
    return payload.gpus;
  }
  throw new Error("Invalid GPU inventory response. Please refresh or select another machine.");
};

export async function listHostGpus(machineName: string): Promise<PciGpu[]> {
  const token = await resolveToken();
  const response = await apiFetch<PciHostResponse>(`/pci/host/${encodeMachine(machineName)}`, {
    token,
  });
  return toGpuList(response);
}

// Resolves once the switch is done. It rejects, naming the VM or host process, when the GPU is in use.
export async function setGpuMode(machineName: string, payload: PciGpuModePayload): Promise<void> {
  const token = await resolveToken();
  await apiFetch<void>(`/pci/mode/${encodeMachine(machineName)}`, {
    method: "POST",
    token,
    body: payload,
  });
}
