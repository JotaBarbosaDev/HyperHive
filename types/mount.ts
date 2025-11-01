export type MountShare = {
  Id: number;
  MachineName: string;
  FolderPath: string;
  Source: string;
  Target: string;
  Name: string;
  HostNormalMount: boolean;
};

export type MountStatus = {
  working: boolean;
  spaceOccupiedGB: number;
  spaceFreeGB: number;
  spaceTotalGB: number;
};

export type Mount = {
  NfsShare: MountShare;
  Status: MountStatus;
};
