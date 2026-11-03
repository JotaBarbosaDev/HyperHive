// Disk health history computed by the master from 6-hourly SMART polls.
export type DiskHealthBand = "good" | "watch" | "at_risk" | "critical";

export type DiskHealthSample = {
  capturedAt: string;
  machineName: string;
  device: string;
  score: number | null;
  temperatureC: number;
  powerOnHours: number;
  pendingSectors: number;
  offlineUncorrectable: number;
  reallocatedSectors: number;
  reportedUncorrectable: number;
  mediaErrors: number;
  crcErrorCount: number;
  percentageUsed: number;
  availableSpare: number;
  availableSpareThreshold: number;
  criticalWarning: number;
  smartPassed: boolean;
  selfTestFailed: boolean;
  healthStatus: string;
  smartctlError: string;
};

export type DiskHealthDisk = {
  serial: string;
  model: string;
  machineName: string;
  device: string;
  transport: string;
  rotational: boolean;
  capacityBytes: number;
  firstSeen: string;
  lastSeen: string;
  retiredAt: string | null;
  smartAvailable: boolean;
  score: number | null;
  band: DiskHealthBand | "";
  wearOutAt: string | null;
  reasons: string[];
  pastRatedEndurance: boolean;
  latest?: DiskHealthSample;
};

export type DiskHealthList = {
  lastPollAt: string | null;
  disks: DiskHealthDisk[];
};

export type DiskHealthPoint = {
  at: string;
  resolution: "6h" | "daily";
  score: number | null;
  band: DiskHealthBand | "";
  temperatureC: number;
  powerOnHours: number;
  pendingSectors: number;
  offlineUncorrectable: number;
  reallocatedSectors: number;
  reportedUncorrectable: number;
  mediaErrors: number;
  crcErrorCount: number;
  percentageUsed: number;
  smartPassed: boolean;
};

export type DiskHealthHistory = {
  disk: DiskHealthDisk;
  points: DiskHealthPoint[];
};
