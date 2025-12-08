export type SmartDiskSelfTest = {
  type?: string;
  status?: string;
  lifetimeHours?: number | string;
  completed?: boolean;
};

export type SmartDiskMetrics = {
  reallocatedSectors?: number;
  reallocatedEventCount?: number;
  pendingSectors?: number;
  offlineUncorrectable?: number;
};

export type SmartDiskDevice = {
  device: string;
  model?: string;
  serial?: string;
  firmware?: string;
  capacity?: string | number;
  temp?: string | number;
  tempC?: number;
  reallocated?: number;
  pending?: number;
  status?: string;
  healthStatus?: string;
  smartPassed?: boolean;
  powerOnHours?: number | string;
  maxTemp?: number | string;
  minTemp?: number | string;
  powerCycles?: number | string;
  risk?: string;
  recommendedAction?: string;
  metrics?: SmartDiskMetrics;
  testsHistory?: SmartDiskSelfTest[];
};

export type SmartDiskSchedule = {
  id: number;
  device: string;
  week_day: number;
  hour: number;
  type: string;
  active: boolean;
};
