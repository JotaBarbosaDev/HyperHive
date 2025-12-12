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
    throw new Error("Base domain/API not configured. Sign in again.");
  }
  return baseUrl;
};

export const resolveToken = async () => {
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

export async function migrateVM(
  vmName: string,
  {
    targetMachineName,
    originMachine,
    live,
    timeout,
  }: {
    targetMachineName: string;
    originMachine: string;
    live: boolean;
    timeout?: number;
  }
) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  return apiFetch<void>(`/virsh/migratevm/${encodedVmName}`, {
    method: "POST",
    token: authToken,
    body: {
      origin_machine: originMachine,
      destination_machine: targetMachineName,
      live,
      timeout: timeout ?? 500,
    },
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

export async function moveDisk(vmName: string, destNfsId: string, newName: string) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const encodedNfs = encodeURIComponent(destNfsId);
  return apiFetch<void>(`/virsh/moveDisk/${encodedVmName}/${encodedNfs}`, {
    method: "POST",
    token: authToken,
    body: { new_name: newName },
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

export async function removeAllIsos(vmName: string) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  await apiFetch<void>(`/virsh/removeiso/${encodedVmName}`, {
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
      body: { new_name: newName },
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

export async function changeVmNetwork(vmName: string, newNetwork: string) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  return apiFetch<void>(`/virsh/change_vm_network/${encodedVmName}`, {
    method: "POST",
    token: authToken,
    body: { new_network: newNetwork },
  });
}

export async function changeVncPassword(vmName: string, newPassword: string) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  return apiFetch<void>(`/virsh/change_vnc_password/${encodedVmName}`, {
    method: "POST",
    token: authToken,
    body: { new_password: newPassword },
  });
}

export async function getVmExportUrl(vmName: string) {
  const authToken = await resolveToken();
  const baseUrl = await ensureApiBaseUrl();
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const encodedVm = encodeURIComponent(vmName);
  return {
    url: `${normalizedBase}/virsh/export/${encodedVm}`,
    token: authToken,
  };
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

export type ImportVmPayload = {
  slave_name: string;
  nfs_share_id: number;
  vm_name: string;
  memory: number;
  vcpu: number;
  network: string;
  VNC_password?: string;
  cpu_xml: string;
  live: boolean;
};

export type ImportVmFile = Blob | ArrayBuffer | ArrayBufferView;

export async function importVm(
  payload: ImportVmPayload,
  file: ImportVmFile,
  options?: { onProgress?: (percent: number) => void }
) {
  const authToken = await resolveToken();
  const baseUrl = await ensureApiBaseUrl();
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  const params = new URLSearchParams({
    slave_name: payload.slave_name,
    nfs_share_id: String(payload.nfs_share_id),
    vm_name: payload.vm_name,
    memory: String(payload.memory),
    vcpu: String(payload.vcpu),
    network: payload.network,
    live: String(payload.live),
    cpu_xml: payload.cpu_xml,
  });

  if (payload.VNC_password !== undefined) {
    params.append("VNC_password", payload.VNC_password);
  }

  const url = `${normalizedBase}/virsh/import?${params.toString()}`;

  // Web: use XMLHttpRequest to expose upload progress events
  if (typeof XMLHttpRequest !== "undefined" && typeof window !== "undefined" && file instanceof Blob) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      if (authToken) {
        xhr.setRequestHeader("Authorization", authToken);
      }

      const onProgress = options?.onProgress;

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && evt.total > 0) {
            const percent = Math.round((evt.loaded / evt.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          options?.onProgress?.(100);
          resolve();
        } else {
          reject(new Error(xhr.statusText || `Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => {
        reject(new Error("Network error while uploading VM image"));
      };

      xhr.send(file);
    });
  }

  // Fallback (non-web / non-Blob): no progress
  return apiFetch<void>(`/virsh/import?${params.toString()}`, {
    method: "PUT",
    token: authToken,
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: file,
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

export async function getCpuDisableFeatures(slaveNames: string[]): Promise<string> {
  const authToken = await resolveToken();
  const slavesQuery = slaveNames.join(",") + ",";
  return apiFetch<string>(`/virsh/getcpudisablefeatures?slavesnames=${encodeURIComponent(slavesQuery)}`, {
    method: "GET",
    token: authToken,
  });
}

export async function updateCpuXml(vmName: string, payload: { machine_name: string; cpu_xml: string }) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  return apiFetch<void>(`/virsh/updatecpuxml/${encodedVmName}`, {
    method: "POST",
    token: authToken,
    body: {
      machine_name: payload.machine_name,
      cpu_xml: payload.cpu_xml,
    },
  });
}
