import {DirectoryListing} from "@/types/directory";
import {Machine} from "@/types/machine";
import {Mount, MountShare} from "@/types/mount";
import {LoginPayload, LoginResponse} from "@/types/auth";
import {apiFetch, setAuthToken, triggerUnauthorized} from "./api-client";
import {loadAuthToken} from "./auth-storage";

export type DeleteMountOptions = {
  force?: boolean;
};

export type CreateMountInput = {
  machineName: string;
  folderPath: string;
  name: string;
  hostNormalMount: boolean;
};

const resolveToken = async () => {
  const storedToken = await loadAuthToken();
  if (!storedToken) {
    setAuthToken(null);
    triggerUnauthorized();
    throw new Error("Token de autenticação inválida.");
  }
  setAuthToken(storedToken);
  return storedToken;
};

export async function listMounts(): Promise<Mount[]> {
  const authToken = await resolveToken();
  return apiFetch<Mount[]>("/nfs/list", {token: authToken});
}

export async function deleteMount(
  share: Pick<MountShare, "MachineName" | "FolderPath">,
  {force = false}: DeleteMountOptions = {}
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
  return apiFetch<Machine[]>("/protocol/list", {token: authToken});
}

export async function listDirectory(
  machineName: string,
  path: string
): Promise<DirectoryListing> {
  const authToken = await resolveToken();
  return apiFetch<DirectoryListing>(`/nfs/contents/${machineName}`, {
    method: "POST",
    token: authToken,
    body: {path},
  });
}
