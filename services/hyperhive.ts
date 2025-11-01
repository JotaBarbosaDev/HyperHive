import {DEFAULT_AUTH_TOKEN} from "@/config/apiConfig";
import {DirectoryListing} from "@/types/directory";
import {Machine} from "@/types/machine";
import {Mount, MountShare} from "@/types/mount";
import {apiFetch} from "./api-client";

export type ListMountsOptions = {
  token?: string;
};

export type DeleteMountOptions = {
  token?: string;
  force?: boolean;
};

export type CreateMountInput = {
  machineName: string;
  folderPath: string;
  name: string;
  hostNormalMount: boolean;
};

export type CreateMountOptions = {
  token?: string;
};

export type ListDirectoryOptions = {
  token?: string;
  path: string;
};

export async function listMounts(
  {token = DEFAULT_AUTH_TOKEN}: ListMountsOptions = {}
): Promise<Mount[]> {
  return apiFetch<Mount[]>("/nfs/list", {token});
}

export async function deleteMount(
  share: Pick<MountShare, "MachineName" | "FolderPath">,
  {token = DEFAULT_AUTH_TOKEN, force = false}: DeleteMountOptions = {}
): Promise<void> {
  await apiFetch<void>(`/nfs/delete?force=${force}`, {
    method: "DELETE",
    token,
    body: {
      machine_name: share.MachineName,
      folder_path: share.FolderPath,
    },
  });
}

export async function createMount(
  input: CreateMountInput,
  {token = DEFAULT_AUTH_TOKEN}: CreateMountOptions = {}
): Promise<void> {
  await apiFetch<void>("/nfs/create", {
    method: "POST",
    token,
    body: {
      machine_name: input.machineName,
      folder_path: input.folderPath,
      name: input.name,
      host_normal_mount: input.hostNormalMount,
    },
  });
}

export async function listMachines(
  token: string = DEFAULT_AUTH_TOKEN
): Promise<Machine[]> {
  return apiFetch<Machine[]>("/protocol/list", {token});
}

export async function listDirectory(
  machineName: string,
  {token = DEFAULT_AUTH_TOKEN, path}: ListDirectoryOptions
): Promise<DirectoryListing> {
  return apiFetch<DirectoryListing>(`/nfs/contents/${machineName}`, {
    method: "POST",
    token,
    body: {path},
  });
}
