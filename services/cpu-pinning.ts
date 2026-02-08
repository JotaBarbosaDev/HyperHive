import { apiFetch } from "./api-client";
import { resolveToken } from "./vms-client";
import type {
  CpuTopology,
  CpuPinningInfo,
  CpuPinningPayload,
} from "@/types/cpu-pinning";

/**
 * GET /virsh/cputopology/:machine_name
 * Returns the full CPU topology (sockets → cores → siblings) of the physical host.
 */
export async function getCpuTopology(machineName: string): Promise<CpuTopology> {
  const authToken = await resolveToken();
  const encoded = encodeURIComponent(machineName);
  return apiFetch<CpuTopology>(`/virsh/cputopology/${encoded}`, {
    token: authToken,
  });
}

/**
 * GET /virsh/cpupinning/:vm_name
 * Returns the current CPU pinning configuration for a VM.
 */
export async function getCpuPinning(vmName: string): Promise<CpuPinningInfo> {
  const authToken = await resolveToken();
  const encoded = encodeURIComponent(vmName);
  return apiFetch<CpuPinningInfo>(`/virsh/cpupinning/${encoded}`, {
    token: authToken,
  });
}

/**
 * POST /virsh/cpupinning/:vm_name
 * Sets (or updates) the CPU pinning for a VM.
 */
export async function setCpuPinning(
  vmName: string,
  payload: CpuPinningPayload
): Promise<void> {
  const authToken = await resolveToken();
  const encoded = encodeURIComponent(vmName);
  await apiFetch<void>(`/virsh/cpupinning/${encoded}`, {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

/**
 * DELETE /virsh/cpupinning/:vm_name
 * Removes all CPU pinning from a VM.
 */
export async function removeCpuPinning(vmName: string): Promise<void> {
  const authToken = await resolveToken();
  const encoded = encodeURIComponent(vmName);
  await apiFetch<void>(`/virsh/cpupinning/${encoded}`, {
    method: "DELETE",
    token: authToken,
  });
}
