import { DirectoryListing } from "@/types/directory";
import { Machine } from "@/types/machine";
import { Mount, MountShare } from "@/types/mount";
import { LoginPayload, LoginResponse } from "@/types/auth";
import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import { apiFetch, setAuthToken, triggerUnauthorized } from "./api-client";
import { loadAuthToken, loadApiBaseUrl } from "./auth-storage";

export type DeleteMountOptions = {
  force?: boolean;
};

export type CreateMountInput = {
  machineName: string;
  folderPath: string;
  name: string;
  hostNormalMount: boolean;
};

export type IsoRaw = Record<string, unknown> | string;

export type IsoApiResponse = IsoRaw[] | Record<string, unknown> | string;

export type ListIsosOptions = {
  token?: string | null;
};

export type DownloadIsoInput = {
  url: string;
  isoName: string;
  nfsShareId: number;
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

export async function listMounts(): Promise<Mount[]> {
  const authToken = await resolveToken();
  return apiFetch<Mount[]>("/nfs/list", { token: authToken });
}

export async function deleteMount(
  share: Pick<MountShare, "MachineName" | "FolderPath">,
  { force = false }: DeleteMountOptions = {}
): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>(`/nfs/delete?force=${force}`, {
    method: "DELETE",
    token: authToken,
    body: {
      machine_name: share.MachineName,
      folder_path: share.FolderPath,
    },
  });
}



export async function createMount(
  input: CreateMountInput
): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/nfs/create", {
    method: "POST",
    token: authToken,
    body: {
      machine_name: input.machineName,
      folder_path: input.folderPath,
      name: input.name,
      host_normal_mount: input.hostNormalMount,
    },
  });
}

export async function login(input: LoginPayload): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/login", {
    method: "POST",
    token: null,
    body: input,
  });
}

export async function listMachines(): Promise<Machine[]> {
  const authToken = await resolveToken();
  return apiFetch<Machine[]>("/protocol/list", { token: authToken });
}

export async function listDirectory(
  machineName: string,
  path: string
): Promise<DirectoryListing> {
  const authToken = await resolveToken();
  return apiFetch<DirectoryListing>(`/nfs/contents/${machineName}`, {
    method: "POST",
    token: authToken,
    body: { path },
  });
}

export async function listIsos({ token }: ListIsosOptions = {}): Promise<IsoApiResponse> {
  const authToken = token ?? (await resolveToken());
  return apiFetch<IsoApiResponse>("/isos/", {
    token: authToken,
  });
}

export async function downloadIso(input: DownloadIsoInput): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/isos/download", {
    method: "POST",
    token: authToken,
    body: {
      url: input.url,
      iso_name: input.isoName,
      nfs_share_id: input.nfsShareId,
    },

  });
}

export async function deleteIso(id: string): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>(`/isos/${id}`, {
    method: "DELETE",
    token: authToken,
  });
}

export async function listLogs(options: { limit?: number; level?: number } = {}): Promise<any[]> {
  const authToken = await resolveToken();
  const params = new URLSearchParams();

  console.log('listLogs called with options:', options);

  if (options.limit !== undefined) {
    params.append("limit", options.limit.toString());
  }

  if (options.level !== undefined) {
    params.append("level", options.level.toString());
  }

  const queryString = params.toString();
  const path = queryString ? `/logs/list?${queryString}` : "/logs/list";

  console.log('API path:', path);

  return apiFetch<any[]>(path, {
    token: authToken,
  });
}

export type PerformUpdateInput = {
  pkgName?: string;
  reboot?: boolean;
};

export async function getMachineUpdates(machineName: string): Promise<unknown> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<unknown>(`/extra/getUpdates/${encodedMachine}`, {
    token: authToken,
  });
}

export async function performMachineUpdate(
  machineName: string,
  {pkgName = "", reboot = true}: PerformUpdateInput = {}
): Promise<unknown> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<unknown>(`/extra/performUpdate/${encodedMachine}`, {
    method: "POST",
    token: authToken,
    body: {
      pkgName: pkgName ?? "",
      reboot: Boolean(reboot),
    },
  });
}
