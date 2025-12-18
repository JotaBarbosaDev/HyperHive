import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {apiFetch, setAuthToken, triggerUnauthorized} from "./api-client";
import {loadApiBaseUrl, loadAuthToken} from "./auth-storage";
import {
  AutomaticMount,
  BalancePayload,
  BtrfsDisk,
  BtrfsRaid,
  BtrfsRaidDevice,
  ScrubStats,
  RaidStatus,
  RaidDeviceStatus,
} from "@/types/btrfs";

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
  const sizeGb = toNumber(disk?.sizeGb ?? disk?.size_gb);
  const size =
    disk?.size ??
    disk?.sizeBytes ??
    disk?.SizeBytes ??
    (sizeGb !== undefined ? sizeGb * 1024 * 1024 * 1024 : undefined);
  return {
    device: disk?.device ?? disk?.path ?? disk?.name ?? disk ?? "",
    name: disk?.name ?? disk?.device ?? disk?.path,
    model: disk?.model,
    vendor: disk?.vendor,
    serial: disk?.serial,
    size,
    sizeGb,
    type: disk?.type,
    transport: disk?.transport,
    status: disk?.status,
    byId: disk?.byId,
    pciPath: disk?.pciPath,
    free: disk?.free,
    mounted: disk?.mounted,
    rotational: disk?.rotational,
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

const parseCompression = (raid: any): string | undefined => {
  if (raid?.compression) return raid.compression;
  if (typeof raid?.options === "string") {
    const match = raid.options.match(/compress=([^,]+)/);
    if (match?.[1]) return match[1];
  }
  return undefined;
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
    compression: parseCompression(raid),
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

const normalizeScrubStats = (stats: any): ScrubStats => {
  const base = (typeof stats === "object" && stats !== null ? stats : {}) as Record<string, unknown>;
  const percent = toNumber((stats as any)?.percentDone ?? (stats as any)?.percent_done);
  return {
    ...base,
    uuid: (stats as any)?.uuid ?? (stats as any)?.UUID,
    path: (stats as any)?.path,
    status: (stats as any)?.status,
    startedAt: (stats as any)?.startedAt ?? (stats as any)?.started_at,
    duration: (stats as any)?.duration,
    timeLeft: (stats as any)?.timeLeft ?? (stats as any)?.time_left,
    totalToScrub: (stats as any)?.totalToScrub ?? (stats as any)?.total_to_scrub,
    bytesScrubbed: (stats as any)?.bytesScrubbed ?? (stats as any)?.bytes_scrubbed,
    rate: (stats as any)?.rate,
    errorSummary: (stats as any)?.errorSummary ?? (stats as any)?.error_summary,
    percentDone: percent,
  };
};

const normalizeRaidDeviceStatus = (stat: any): RaidDeviceStatus => ({
  device: stat?.device ?? stat?.Device ?? stat?.path,
  devId: toNumber(stat?.devId ?? stat?.DevId),
  writeIoErrs: toNumber(stat?.writeIoErrs ?? stat?.WriteIoErrs),
  readIoErrs: toNumber(stat?.readIoErrs ?? stat?.ReadIoErrs),
  flushIoErrs: toNumber(stat?.flushIoErrs ?? stat?.FlushIoErrs),
  corruptionErrs: toNumber(stat?.corruptionErrs ?? stat?.CorruptionErrs),
  generationErrs: toNumber(stat?.generationErrs ?? stat?.GenerationErrs),
  balanceStatus: stat?.balanceStatus ?? stat?.BalanceStatus,
  deviceSizeBytes: stat?.deviceSizeBytes ?? stat?.DeviceSizeBytes,
  deviceUsedBytes: stat?.deviceUsedBytes ?? stat?.DeviceUsedBytes,
  deviceMissing: stat?.deviceMissing ?? stat?.DeviceMissing,
  fsUuid: stat?.fsUuid ?? stat?.FsUuid,
  fsLabel: stat?.fsLabel ?? stat?.FsLabel,
});

const normalizeRaidStatus = (status: any): RaidStatus => {
  const base = (typeof status === "object" && status !== null ? status : {}) as Record<string, unknown>;
  const rawStats = Array.isArray((status as any)?.deviceStats)
    ? (status as any).deviceStats
    : Array.isArray((status as any)?.DeviceStats)
      ? (status as any).DeviceStats
      : [];
  return {
    ...base,
    version: (status as any)?.version ?? (status as any)?.Version,
    fsUuid: (status as any)?.fsUuid ?? (status as any)?.fs_uuid ?? (status as any)?.FsUuid,
    fsLabel: (status as any)?.fsLabel ?? (status as any)?.fs_label ?? (status as any)?.FsLabel,
    totalDevices: toNumber((status as any)?.totalDevices ?? (status as any)?.TotalDevices),
    deviceStats: rawStats.map(normalizeRaidDeviceStatus),
  };
};

const normalizeAutomaticMount = (entry: any): AutomaticMount => ({
  id: entry?.id ?? entry?.Id ?? 0,
  uuid: entry?.uuid ?? entry?.raid_uuid ?? entry?.raidUuid ?? "",
  raid_uuid: entry?.raid_uuid ?? entry?.raidUuid,
  mount_point: entry?.mount_point ?? entry?.mountPoint ?? "",
  compression: entry?.compression,
  machine_name: entry?.machine_name ?? entry?.machineName,
});

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
  const resp = await apiFetch<any>(`/btrfs/scrub_stats/${encodedMachine}?uuid=${encodedUuid}`, {token: authToken});
  return normalizeScrubStats(resp);
}

export async function getRaidStatus(machineName: string, uuid: string): Promise<RaidStatus> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  const encodedUuid = encodeURIComponent(uuid);
  const resp = await apiFetch<any>(`/btrfs/raid_status/${encodedMachine}?uuid=${encodedUuid}`, {token: authToken});
  return normalizeRaidStatus(resp);
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
  await apiFetch<void>("/btrfs/automatic_mount", {
    method: "DELETE",
    token: authToken,
    body: {id},
  });
}

export async function listAutomaticMounts(machineName: string): Promise<AutomaticMount[]> {
  const authToken = await resolveToken();
  const encodedMachine = encodeURIComponent(machineName);
  const resp = await apiFetch<any>(`/btrfs/automatic_mount/${encodedMachine}`, {
    token: authToken,
  });
  const list = Array.isArray(resp) ? resp : Array.isArray(resp?.data) ? resp.data : [];
  return list.map(normalizeAutomaticMount);
}
