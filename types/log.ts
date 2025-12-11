export type LogLevel = "info" | "error" | "warn" | "debug";

export interface LogEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  level: LogLevel;
  machine: string;
  message: string;
  rawContent?: string;
  raw?: unknown;
}

export interface ListLogsOptions {
  limit?: number;
  level?: number;
}

// Log level mapping
export const LOG_LEVEL_MAP = {
  info: 0,
  error: 1,
  warn: 2,
  debug: 3,
} as const;

export const LOG_LEVEL_REVERSE_MAP = {
  0: "info",
  1: "error",
  2: "warn",
  3: "debug",
} as const;
