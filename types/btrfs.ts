export type BtrfsDisk = {
  device: string;
  name?: string;
  model?: string;
  vendor?: string;
  serial?: string;
  size?: string | number;
  type?: string;
  transport?: string;
  status?: string;
  byId?: string;
  pciPath?: string;
  free?: boolean;
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
  target?: string;
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
  mount_point: string;
  compression?: string;
  machine_name?: string;
};

export type ScrubStats = Record<string, unknown>;
export type RaidStatus = Record<string, unknown>;
