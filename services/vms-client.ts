import { apiFetch } from "./api-client";
import { loadAuthToken } from "./auth-storage";
import { setAuthToken, triggerUnauthorized } from "./api-client";
import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import { loadApiBaseUrl } from "./auth-storage";
import { normalizeOptionalTemplateId } from "@/utils/xml-template";

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
  hasVnc?: boolean;
  hasvnc?: boolean;
  novncPort: string;
  novnclink: string;
  spritePort: string;
  state: VmState;
};

export const ensureApiBaseUrl = async () => {
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

export async function coldMigrateVM(
  vmName: string,
  targetMachineName: string,
  options?: { template_id?: number }
) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const encodedTarget = encodeURIComponent(targetMachineName);
  const templateId = normalizeOptionalTemplateId(options?.template_id);
  return apiFetch<void>(`/virsh/coldMigrate/${encodedVmName}/${encodedTarget}`, {
    method: "POST",
    token: authToken,
    body: templateId ? { template_id: templateId } : undefined,
  });
}

export async function moveDisk(
  vmName: string,
  destNfsId: string,
  newName: string,
  options?: { template_id?: number }
) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const encodedNfs = encodeURIComponent(destNfsId);
  const templateId = normalizeOptionalTemplateId(options?.template_id);
  return apiFetch<void>(`/virsh/moveDisk/${encodedVmName}/${encodedNfs}`, {
    method: "POST",
    token: authToken,
    body: {
      new_name: newName,
      ...(templateId ? { template_id: templateId } : {}),
    },
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

export async function setVmAutostart(vmName: string, autoStart: boolean) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  await apiFetch<void>(`/virsh/autostart/${encodedVmName}`, {
    method: "POST",
    token: authToken,
    body: { auto_start: autoStart },
  });
}

export async function setVmLive(vmName: string, enable: boolean) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  await apiFetch<void>(`/virsh/vmlive/${encodedVmName}`, {
    method: "POST",
    token: authToken,
    body: { enable },
  });
}

export async function setVmActiveVnc(vmName: string, enable: boolean) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const action = enable ? "add" : "remove";
  await apiFetch<void>(`/virsh/novncvideo/${action}/${encodedVmName}`, {
    method: "POST",
    token: authToken,
  });
}

export type VmBallooningStatus = {
  enabled: boolean;
  has_memballoon: boolean;
  memballoon_model: string | null;
};

export async function getVmBallooning(vmName: string): Promise<VmBallooningStatus> {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const response = await apiFetch<any>(`/virsh/ballooning/${encodedVmName}`, {
    token: authToken,
  });

  const enabled = response?.enabled;
  const hasMemballoon = response?.has_memballoon ?? response?.hasMemballoon;
  const memballoonModel = response?.memballoon_model ?? response?.memballoonModel;

  if (typeof enabled !== "boolean" || typeof hasMemballoon !== "boolean") {
    throw new Error("Invalid ballooning status response.");
  }

  return {
    enabled,
    has_memballoon: hasMemballoon,
    memballoon_model: typeof memballoonModel === "string" ? memballoonModel : null,
  };
}

export async function setVmBallooning(vmName: string, enable: boolean) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  await apiFetch<void>(`/virsh/ballooning/${encodedVmName}`, {
    method: "POST",
    token: authToken,
    body: { enable },
  });
}

export type VmHugepagesStatus = {
  enabled: boolean;
  has_hugepages: boolean;
  memory_locked: boolean;
};

export async function getVmHugepages(vmName: string): Promise<VmHugepagesStatus> {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const response = await apiFetch<any>(`/virsh/hugepages/${encodedVmName}`, {
    token: authToken,
  });

  const enabled = response?.enabled ?? response?.Enabled;
  const hasHugepages = response?.has_hugepages ?? response?.hasHugepages;
  const memoryLocked = response?.memory_locked ?? response?.memoryLocked;
  const normalizedEnabled = typeof enabled === "boolean" ? enabled : undefined;
  const normalizedHasHugepages =
    typeof hasHugepages === "boolean" ? hasHugepages : undefined;

  return {
    enabled: normalizedEnabled ?? normalizedHasHugepages ?? false,
    has_hugepages: normalizedHasHugepages ?? normalizedEnabled ?? false,
    memory_locked: typeof memoryLocked === "boolean" ? memoryLocked : false,
  };
}

export async function setVmHugepages(vmName: string, enable: boolean) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  await apiFetch<void>(`/virsh/hugepages/${encodedVmName}`, {
    method: "POST",
    token: authToken,
    body: { enable },
  });
}

export async function cloneVm(
  vmName: string,
  destNfs: string,
  destMachineName: string,
  newName: string,
  options?: { template_id?: number }
) {
  const authToken = await resolveToken();
  const encodedVm = encodeURIComponent(vmName);
  const encodedNfs = encodeURIComponent(destNfs);
  const encodedMachine = encodeURIComponent(destMachineName);
  const templateId = normalizeOptionalTemplateId(options?.template_id);
  return apiFetch<void>(
    `/virsh/cloneVM/${encodedVm}/${encodedNfs}/${encodedMachine}`,
    {
      method: "POST",
      token: authToken,
      body: {
        new_name: newName,
        ...(templateId ? { template_id: templateId } : {}),
      },
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
  template_id?: number;
};

export async function createVm(payload: CreateVmPayload) {
  const authToken = await resolveToken();
  const templateId = normalizeOptionalTemplateId(payload.template_id);
  const { template_id: _templateId, ...restPayload } = payload;
  return apiFetch<void>("/virsh/createvm", {
    method: "POST",
    token: authToken,
    body: {
      ...restPayload,
      ...(templateId ? { template_id: templateId } : {}),
    },
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
  template_id?: number;
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

  const templateId = normalizeOptionalTemplateId(payload.template_id);
  if (templateId) {
    params.append("template_id", String(templateId));
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

export type VmXmlResponse = {
  vm_xml: string;
  machine_name: string;
};

export async function getVmXml(vmName: string, machineName?: string) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const normalizedMachineName = machineName?.trim();
  const params = new URLSearchParams();
  if (normalizedMachineName) {
    params.set("machine_name", normalizedMachineName);
  }
  const query = params.toString();
  const response = await apiFetch<any>(
    `/virsh/vmxml/${encodedVmName}${query ? `?${query}` : ""}`,
    {
      method: "GET",
      token: authToken,
    }
  );

  const vmXml = response?.vm_xml ?? response?.vmXml;
  const resolvedMachineName = response?.machine_name ?? response?.machineName;

  if (typeof vmXml !== "string") {
    throw new Error("Invalid VM XML response.");
  }

  return {
    vm_xml: vmXml,
    machine_name:
      typeof resolvedMachineName === "string" ? resolvedMachineName : normalizedMachineName ?? "",
  } satisfies VmXmlResponse;
}

export async function updateVmXml(
  vmName: string,
  payload: { machine_name?: string; vm_xml: string }
) {
  const authToken = await resolveToken();
  const encodedVmName = encodeURIComponent(vmName);
  const normalizedMachineName = payload.machine_name?.trim();
  return apiFetch<void>(`/virsh/updatevmxml/${encodedVmName}`, {
    method: "POST",
    token: authToken,
    body: {
      machine_name: normalizedMachineName || undefined,
      vm_xml: payload.vm_xml,
    },
  });
}

export type NodeIrqbalanceStatus = {
  enabled: boolean;
  active: boolean;
  unitName: string;
};

export type NodeIrqbalanceUpdateResponse = {
  ok: boolean;
  message?: string;
  enabled: boolean;
  active: boolean;
  unitName: string;
};

export async function getNodeIrqbalanceStatus(machineName: string): Promise<NodeIrqbalanceStatus> {
  const authToken = await resolveToken();
  const encodedMachineName = encodeURIComponent(machineName);
  return apiFetch<NodeIrqbalanceStatus>(`/virsh/irqbalance/${encodedMachineName}`, {
    method: "GET",
    token: authToken,
  });
}

export async function setNodeIrqbalanceStatus(
  machineName: string,
  enabled: boolean
): Promise<NodeIrqbalanceUpdateResponse> {
  const authToken = await resolveToken();
  const encodedMachineName = encodeURIComponent(machineName);
  return apiFetch<NodeIrqbalanceUpdateResponse>(`/virsh/irqbalance/${encodedMachineName}`, {
    method: "POST",
    token: authToken,
    body: { enabled },
  });
}

export type NodeHostHugepagesStatus = {
  enabled: boolean;
  rebootRequired: boolean;
  message: string;
  pageSize: string;
  pageCount: number;
  activePageSize: string;
  activePageCount: number;
  defaultHugepagesz: string;
  hugepagesz: string;
  hugepages: string;
  activeDefaultHugepagesz: string;
  activeHugepagesz: string;
  activeHugepages: string;
};

export type NodeHostHugepagesUpdatePayload = {
  page_size: string;
  page_count: number;
};

const toHugepagesCount = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
};

const toHugepagesString = (value: unknown) => {
  return typeof value === "string" ? value : "";
};

const normalizeNodeHostHugepagesStatus = (response: any): NodeHostHugepagesStatus => ({
  enabled: Boolean(response?.enabled ?? response?.Enabled),
  rebootRequired: Boolean(response?.rebootRequired ?? response?.reboot_required),
  message: toHugepagesString(response?.message ?? response?.Message),
  pageSize: toHugepagesString(response?.pageSize ?? response?.page_size),
  pageCount: toHugepagesCount(response?.pageCount ?? response?.page_count),
  activePageSize: toHugepagesString(response?.activePageSize ?? response?.active_page_size),
  activePageCount: toHugepagesCount(response?.activePageCount ?? response?.active_page_count),
  defaultHugepagesz: toHugepagesString(response?.defaultHugepagesz ?? response?.default_hugepagesz),
  hugepagesz: toHugepagesString(response?.hugepagesz ?? response?.hugepages_z),
  hugepages: toHugepagesString(response?.hugepages),
  activeDefaultHugepagesz: toHugepagesString(
    response?.activeDefaultHugepagesz ?? response?.active_default_hugepagesz
  ),
  activeHugepagesz: toHugepagesString(response?.activeHugepagesz ?? response?.active_hugepages_z),
  activeHugepages: toHugepagesString(response?.activeHugepages ?? response?.active_hugepages),
});

export async function getNodeHostHugepagesStatus(
  machineName: string
): Promise<NodeHostHugepagesStatus> {
  const authToken = await resolveToken();
  const encodedMachineName = encodeURIComponent(machineName);
  const response = await apiFetch<any>(`/virsh/hosthugepages/${encodedMachineName}`, {
    method: "GET",
    token: authToken,
  });
  return normalizeNodeHostHugepagesStatus(response);
}

export async function setNodeHostHugepagesStatus(
  machineName: string,
  payload: NodeHostHugepagesUpdatePayload,
  method: "POST" | "PUT" = "POST"
): Promise<NodeHostHugepagesStatus> {
  const authToken = await resolveToken();
  const encodedMachineName = encodeURIComponent(machineName);
  const response = await apiFetch<any>(`/virsh/hosthugepages/${encodedMachineName}`, {
    method,
    token: authToken,
    body: payload,
  });
  return normalizeNodeHostHugepagesStatus(response);
}

export async function deleteNodeHostHugepagesStatus(
  machineName: string
): Promise<NodeHostHugepagesStatus> {
  const authToken = await resolveToken();
  const encodedMachineName = encodeURIComponent(machineName);
  const response = await apiFetch<any>(`/virsh/hosthugepages/${encodedMachineName}`, {
    method: "DELETE",
    token: authToken,
  });
  return normalizeNodeHostHugepagesStatus(response);
}
