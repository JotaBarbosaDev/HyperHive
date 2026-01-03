export type BtrfsDisk = {
  device: string;
  name?: string;
  model?: string;
  vendor?: string;
  serial?: string;
  size?: string | number;
  sizeGb?: number;
  type?: string;
  transport?: string;
  status?: string;
  byId?: string;
  pciPath?: string;
  free?: boolean;
  mounted?: boolean;
  rotational?: boolean;
};

export type BtrfsRaidDevice = {
  device: string;
  path?: string;
  size?: string | number;
  sizeBytes?: string | number;
  status?: string;
  mounted?: boolean;
  name?: string;
};

export type BtrfsRaid = {
  uuid: string;
  name?: string;
  mount_point?: string;
  target?: string;
  label?: string;
  raid_level?: string;
  raidType?: string;
  compression?: string;
  options?: string;
  source?: string;
  fs_type?: string;
  fsType?: string;
  status?: string;
  mounted?: boolean;
  used?: string | number;
  usedSpace?: string | number;
  total?: string | number;
  maxSpace?: string | number;
  realMaxSpace?: string | number;
  free?: string | number;
  realUsedSpace?: string | number;
  devices?: BtrfsRaidDevice[] | string[];
  children?: unknown[];
};

export type BalanceFilters = {
  dataUsageMax?: number;
  metadataUsageMax?: number;
};

export type BalancePayload = {
  uuid: string;
  filters?: BalanceFilters;
  force?: boolean;
  convertToCurrentRaid?: boolean;
};

export type AutomaticMount = {
  id: number;
  uuid: string;
  raid_uuid?: string;
  mount_point: string;
  compression?: string;
  machine_name?: string;
};

export type ScrubStats = {
  uuid?: string;
  path?: string;
  status?: string;
  startedAt?: string;
  duration?: string;
  timeLeft?: string;
  totalToScrub?: string | number;
  bytesScrubbed?: string | number;
  rate?: string;
  errorSummary?: string;
  percentDone?: number;
  [key: string]: unknown;
};

export type RaidDeviceStatus = {
  device?: string;
  devId?: number;
  writeIoErrs?: number;
  readIoErrs?: number;
  flushIoErrs?: number;
  corruptionErrs?: number;
  generationErrs?: number;
  balanceStatus?: string;
  deviceSizeBytes?: string | number;
  deviceUsedBytes?: string | number;
  deviceMissing?: boolean;
  fsUuid?: string;
  fsLabel?: string;
};

export type RaidStatus = {
  version?: string;
  fsUuid?: string;
  fsLabel?: string;
  replaceStatus?: string | number;
  totalDevices?: number;
  deviceStats?: RaidDeviceStatus[];
  [key: string]: unknown;
};

export type CompressionOption = {
  value: string;
  label: string;
  description?: string;
};
