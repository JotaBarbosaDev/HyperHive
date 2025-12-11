import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {apiFetch, setAuthToken, triggerUnauthorized} from "./api-client";
import {loadApiBaseUrl, loadAuthToken} from "./auth-storage";
import {AutomaticMount, BalancePayload, BtrfsDisk, BtrfsRaid, BtrfsRaidDevice, ScrubStats, RaidStatus} from "@/types/btrfs";

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
  return `/btrfs/${path}/${encoded}`;
};

export async function listAllDisks(machineName: string): Promise<BtrfsDisk[]> {
  const authToken = await resolveToken();
  const data = await apiFetch<any>(machinePath(machineName, "getAllDuckingDisks"), {token: authToken});
  const disks = Array.isArray(data) ? data : Array.isArray(data?.disks) ? data.disks : [];
  return disks.map(normalizeDisk);
}

export async function listFreeDisks(machineName: string): Promise<BtrfsDisk[]> {
  const authToken = await resolveToken();
  const data = await apiFetch<any>(machinePath(machineName, "getFreeDisks"), {token: authToken});
  const disks = Array.isArray(data) ? data : Array.isArray(data?.disks) ? data.disks : [];
  return disks.map(normalizeDisk);
}

const toNumber = (val: unknown): number | undefined => {
  if (val === null || val === undefined) return undefined;
  const num = typeof val === "number" ? val : Number(val);
  return isNaN(num) ? undefined : num;
};

const normalizeDisk = (disk: any): BtrfsDisk => {
  const size = disk?.size ?? disk?.sizeBytes ?? disk?.SizeBytes;
  return {
    device: disk?.device ?? disk?.path ?? disk?.name ?? disk ?? "",
    name: disk?.name ?? disk?.device ?? disk?.path,
    model: disk?.model,
    vendor: disk?.vendor,
    serial: disk?.serial,
    size,
    type: disk?.type,
    transport: disk?.transport,
    status: disk?.status,
    byId: disk?.byId,
    pciPath: disk?.pciPath,
    free: disk?.free,
  };
};

const normalizeDevice = (dev: any): BtrfsRaidDevice => {
  const size = dev?.sizeBytes ?? dev?.size ?? dev?.SizeBytes;
  return {
    device: dev?.device ?? dev?.path ?? dev?.name ?? dev ?? "",
    path: dev?.path,
    name: dev?.name,
    size,
    sizeBytes: size,
    mounted: dev?.mounted,
    status: dev?.mounted === true ? "mounted" : dev?.status,
  };
};

const normalizeRaid = (raid: any): BtrfsRaid => {
  const used = toNumber(raid?.usedSpace ?? raid?.used ?? raid?.UsedSpace);
  const total =
    toNumber(raid?.realMaxSpace ?? raid?.maxSpace ?? raid?.total ?? raid?.Total) ??
    (used && raid?.free ? used + toNumber(raid.free)! : undefined);
  const free =
    toNumber(raid?.free) ??
    (used !== undefined && total !== undefined ? total - used : undefined);

  const devicesRaw = Array.isArray(raid?.devices) ? raid.devices : [];
  const devices = devicesRaw.map(normalizeDevice);

  return {
    uuid: raid?.uuid ?? raid?.UUID ?? "",
    name: raid?.name,
    label: raid?.label,
    mount_point: raid?.mount_point ?? raid?.target,
    target: raid?.target,
    source: raid?.source,
    options: raid?.options,
    raid_level: raid?.raid_level ?? raid?.raidType,
    raidType: raid?.raidType,
    compression: raid?.compression,
    fs_type: raid?.fs_type ?? raid?.fsType,
    fsType: raid?.fsType,
    status: raid?.status,
    mounted: raid?.mounted ?? raid?.Mounted,
    used: used ?? raid?.used,
    usedSpace: raid?.usedSpace,
    total: total ?? raid?.total,
    maxSpace: raid?.maxSpace,
    realMaxSpace: raid?.realMaxSpace,
    free,
    realUsedSpace: raid?.realUsedSpace,
    devices,
    children: raid?.children,
  };
};

export async function listRaids(machineName: string): Promise<BtrfsRaid[]> {
  const authToken = await resolveToken();
  const data = await apiFetch<any>(machinePath(machineName, "getraids"), {token: authToken});
  if (Array.isArray(data)) {
    return data.map(normalizeRaid);
  }
  if (data?.filesystems && Array.isArray(data.filesystems)) {
    return data.filesystems.map(normalizeRaid);
  }
  return [];
}

export async function createRaid(machineName: string, payload: {name: string; raid: string; disks: string[]}): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "createraid"), {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function removeRaid(machineName: string, uuid: string): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>(machinePath(machineName, "removeraid"), {
    method: "DELETE",
    token: authToken,
    body: {uuid},
  });
}

export async function mountRaid(machineName: string, body: {uuid: string; mount_point: string; compression?: string}): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "mount_raid"), {
    method: "POST",
    token: authToken,
    body,
  });
}

export async function unmountRaid(machineName: string, body: {uuid: string; force?: boolean}): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "umount_raid"), {
    method: "POST",
    token: authToken,
    body: {...body, force: Boolean(body.force)},
  });
}

export async function addDiskRaid(machineName: string, body: {uuid: string; disk: string}): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "add_diskraid"), {
    method: "POST",
    token: authToken,
    body,
  });
}

export async function removeDiskRaid(machineName: string, body: {uuid: string; disk: string}): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "remove_diskraid"), {
    method: "POST",
    token: authToken,
    body,
  });
}

export async function replaceDiskRaid(machineName: string, body: {uuid: string; old_disk: string; new_disk: string}): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "replace_diskraid"), {
    method: "POST",
    token: authToken,
    body,
  });
}

export async function changeRaidLevel(machineName: string, body: {uuid: string; new_raid_level: string}): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "change_raid_level"), {
    method: "POST",
    token: authToken,
    body,
  });
}

export async function balanceRaid(machineName: string, payload: BalancePayload): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "balance_raid"), {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function pauseBalance(machineName: string, uuid: string): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "pause_balance"), {
    method: "POST",
    token: authToken,
    body: {uuid},
  });
}

export async function resumeBalance(machineName: string, uuid: string): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "resume_balance"), {
    method: "POST",
    token: authToken,
    body: {uuid},
  });
}

export async function cancelBalance(machineName: string, uuid: string): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "cancel_balance"), {
    method: "POST",
    token: authToken,
    body: {uuid},
  });
}

export async function defragmentRaid(machineName: string, uuid: string): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "defragment_raid"), {
    method: "POST",
    token: authToken,
    body: {uuid},
  });
}

export async function scrubRaid(machineName: string, uuid: string): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>(machinePath(machineName, "scrub_raid"), {
    method: "POST",
    token: authToken,
    body: {uuid},
  });
}

export async function getScrubStats(machineName: string, uuid: string): Promise<ScrubStats> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  const encodedUuid = encodeURIComponent(uuid);
  return apiFetch<ScrubStats>(`/btrfs/scrub_stats/${encodedMachine}?uuid=${encodedUuid}`, {token: authToken});
}

export async function getRaidStatus(machineName: string, uuid: string): Promise<RaidStatus> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  const encodedUuid = encodeURIComponent(uuid);
  return apiFetch<RaidStatus>(`/btrfs/raid_status/${encodedMachine}?uuid=${encodedUuid}`, {token: authToken});
}

export async function createAutomaticMount(machine_name: string, body: {uuid: string; mount_point: string; compression?: string}): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>("/btrfs/automatic_mount", {
    method: "POST",
    token: authToken,
    body: {...body, machine_name},
  });
}

export async function deleteAutomaticMount(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/btrfs/automatic_moun", {
    method: "DELETE",
    token: authToken,
    body: {id},
  });
}

export async function listAutomaticMounts(machineName: string): Promise<AutomaticMount[]> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  return apiFetch<AutomaticMount[]>(`/btrfs/automatic_mount/${encodedMachine}`, {
    token: authToken,
  });
}
