export type UpdateSeverity =
  | "security"
  | "bugfix"
  | "enhancement"
  | "optional"
  | "other";

export type UpdateEntry = {
  id: string;
  name: string;
  currentVersion?: string;
  newVersion?: string;
  architecture?: string;
  repository?: string;
  description?: string;
  severity?: UpdateSeverity;
  rebootRequired?: boolean;
  raw?: unknown;
};

export type MachineUpdates = {
  machineName: string;
  items: UpdateEntry[];
  rebootRequired?: boolean;
  fetchedAt: string;
  source?: string;
  raw?: unknown;
};
