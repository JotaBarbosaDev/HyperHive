import { apiFetch } from "./api-client";

// Cluster-wide schedule: start/stop are HH:MM in the master's timezone.
export type PowerSchedule = {
  enabled: boolean;
  start: string;
  stop: string;
  tz: string;
  updatedAt: string;
};

export type PowerScheduleHost = {
  machine: string;
  connected: boolean;
  enabled: boolean;
  stopUnix: number;
  wakeUnix: number;
  jobId: string;
  appliedAt: string;
  lastError: string;
  attemptedAt: string;
};

export type PowerScheduleView = {
  schedule: PowerSchedule;
  masterTz: string;
  masterTime: string;
  next?: { stopUnix: number; masterStopUnix: number; wakeUnix: number };
  hosts: PowerScheduleHost[];
};

export type PowerScheduleUpdate = Pick<PowerSchedule, "enabled" | "start" | "stop">;

export const getPowerSchedule = (signal?: AbortSignal) =>
  apiFetch<PowerScheduleView>("/power-schedule", { signal, reportResult: false });

// The backend saves and then applies to every host in the background (202).
export const updatePowerSchedule = (update: PowerScheduleUpdate) =>
  apiFetch<{ status: string; schedule: PowerSchedule }>("/power-schedule", { method: "PUT", body: update, reportResult: false });

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_OFF_MINUTES = 10;

const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

// Mirrors the backend validation so the form can explain problems before saving.
export const validatePowerSchedule = (start: string, stop: string): string | null => {
  if (!timePattern.test(start) || !timePattern.test(stop)) return "Times use HH:MM, for example 08:00.";
  if (start === stop) return "Start and stop must differ.";
  const off = (toMinutes(start) - toMinutes(stop) + 24 * 60) % (24 * 60);
  if (off < MIN_OFF_MINUTES) return `Machines must stay off for at least ${MIN_OFF_MINUTES} minutes.`;
  return null;
};

export const formatEpoch = (unix?: number) => (unix ? new Date(unix * 1000).toLocaleString() : "—");
