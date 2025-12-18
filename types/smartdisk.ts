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
  capacityBytes?: string | number;
  temp?: string | number;
  tempC?: number;
  temperatureC?: number | string;
  temperatureMax?: number | string;
  temperatureMin?: number | string;
  reallocated?: number;
  pending?: number;
  status?: string;
  healthStatus?: string;
  smartPassed?: boolean;
  powerOnHours?: number | string;
  powerCycleCount?: number | string;
  maxTemp?: number | string;
  minTemp?: number | string;
  powerCycles?: number | string;
  risk?: string;
  recommendedAction?: string;
  metrics?: SmartDiskMetrics;
  testsHistory?: SmartDiskSelfTest[];
  lastAtaErrors?: unknown[];
  lastNvmeErrors?: unknown[];
  smartctlError?: string;
  physicalProblemRisk?: string;
  raw?: Record<string, unknown>;
};

export type SmartDiskSchedule = {
  id: number;
  device: string;
  week_day: number;
  hour: number;
  type: string;
  active: boolean;
  last_run?: string;
  machine_name?: string;
};

export type SmartDiskSelfTestProgress = {
  device: string;
  progressPercent?: number;
  remainingPercent?: number;
  status?: string;
  type?: string;
  startedAtUnix?: string | number;
};

export type SmartDiskReallocStatus = {
  device: string;
  mode?: string;
  startedAtUnix?: string | number;
  elapsedSeconds?: string | number;
  percent?: number;
  pattern?: string;
  readErrors?: number;
  writeErrors?: number;
  corruptionErrors?: number;
  lastLine?: string;
  completed?: boolean;
  error?: string;
};
