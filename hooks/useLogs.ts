import {useCallback, useEffect, useRef, useState} from "react";
import {LogEntry, LogLevel, LOG_LEVEL_MAP, LOG_LEVEL_REVERSE_MAP} from "@/types/log";
import {listLogs} from "@/services/hyperhive";
import {ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket} from "@/services/websocket-client";

type FetchMode = "initial" | "refresh";

export type UseLogsOptions = {
  token?: string | null;
  limit?: number;
  level?: number;
};

// Função para normalizar o nível do log
const normalizeLogLevel = (level: any): LogLevel => {
  if (typeof level === "number") {
    return LOG_LEVEL_REVERSE_MAP[level as keyof typeof LOG_LEVEL_REVERSE_MAP] || "info";
  }
  if (typeof level === "string") {
    const normalized = level.toLowerCase();
    if (["info", "error", "warn", "debug"].includes(normalized)) {
      return normalized as LogLevel;
    }
  }
  return "info";
};

// Função para extrair nome da máquina da mensagem [nome]
const extractMachineFromContent = (content: string): string => {
  const match = content.match(/^\[([^\]]+)\]/);
  return match ? match[1] : "Sistema";
};

// Função para remover [máquina] do início da mensagem
const cleanMessageContent = (content: string): string => {
  return content.replace(/^\[([^\]]+)\]\s*/, "");
};

const parseTimestampMs = (value: unknown): number => {
  if (!value) return Date.now();
  if (typeof value === "number") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : Date.now();
  }
  const parsed = Date.parse(String(value));
  if (Number.isNaN(parsed)) {
    return Date.now();
  }
  return parsed;
};

const parseJsonLogString = (rawLog: string): Record<string, unknown> | null => {
  const trimmed = rawLog.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
};

const toContentString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const getMachineNameFromRecord = (record: Record<string, unknown>): string => {
  const candidate =
    typeof record.machine_name === "string"
      ? record.machine_name
      : typeof record.machineName === "string"
        ? record.machineName
        : typeof record.machine === "string"
          ? record.machine
          : typeof record.host === "string"
            ? record.host
            : "";
  return candidate;
};

const extractPayloadFromValue = (
  value: unknown,
  depth: number = 0
): { machineName?: string; content?: unknown; rawContent?: string } => {
  if (depth > 2) {
    return {
      content: value,
      rawContent: typeof value === "string" ? value : undefined,
    };
  }
  if (typeof value === "string") {
    const parsed = parseJsonLogString(value);
    if (parsed) {
      const nested = extractPayloadFromValue(parsed, depth + 1);
      return {
        machineName: nested.machineName || getMachineNameFromRecord(parsed),
        content:
          nested.content ?? parsed.content ?? parsed.context ?? parsed.message ?? parsed.msg ?? value,
        rawContent: value,
      };
    }
    return { content: value, rawContent: value };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const machineName = getMachineNameFromRecord(record);
    const content = record.content ?? record.context ?? record.message ?? record.msg;
    if (content !== undefined) {
      const nested = extractPayloadFromValue(content, depth + 1);
      return {
        machineName: machineName || nested.machineName,
        content: nested.content ?? content,
        rawContent: nested.rawContent ?? (typeof content === "string" ? content : undefined),
      };
    }
    return { machineName, content: value };
  }
  return { content: value, rawContent: toContentString(value) };
};

// Função para normalizar os dados recebidos da API
const normalizeLogEntry = (rawLog: any, index: number): LogEntry => {
  // Se rawLog for uma string ou algo primitivo, converter para objeto
  const parsedLog =
    typeof rawLog === "string" ? parseJsonLogString(rawLog) : null;
  const logObj =
    typeof rawLog === "object" && rawLog !== null ? rawLog : parsedLog ?? { content: String(rawLog) };

  // Extrair conteúdo da mensagem
  const contentCandidate = logObj.content || logObj.context || logObj.message || logObj.msg || rawLog;
  const payload = extractPayloadFromValue(contentCandidate);
  const messageRaw = toContentString(payload.content ?? contentCandidate);
  const machineHint = getMachineNameFromRecord(logObj).trim();
  const payloadMachine = (payload.machineName ?? "").trim();
  const machine =
    machineHint || payloadMachine || extractMachineFromContent(messageRaw);

  return {
    id: String(logObj.id || logObj._id || `log-${index}-${Date.now()}`),
    timestamp: logObj.ts || logObj.timestamp || logObj.time || logObj.date || new Date().toISOString(),
    timestampMs: parseTimestampMs(logObj.ts || logObj.timestamp || logObj.time || logObj.date || Date.now()),
    level: normalizeLogLevel(logObj.level || logObj.severity),
    machine,
    message: cleanMessageContent(messageRaw),
    rawContent: payload.rawContent ?? (typeof contentCandidate === "string" ? contentCandidate : undefined),
    raw: rawLog,
  };
};

const resolveLogLevelFromHint = (hint: unknown): LogLevel | null => {
  if (typeof hint === "number") {
    const mapped = (LOG_LEVEL_REVERSE_MAP as Record<number, LogLevel | undefined>)[hint];
    return mapped ?? null;
  }
  if (typeof hint === "string") {
    const trimmed = hint.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      const mapped = (LOG_LEVEL_REVERSE_MAP as Record<number, LogLevel | undefined>)[numeric];
      return mapped ?? null;
    }
    const normalized = trimmed.toLowerCase();
    if (["info", "error", "warn", "debug"].includes(normalized)) {
      return normalized as LogLevel;
    }
  }
  return null;
};

const decodeSocketPayload = async (payload: unknown): Promise<unknown> => {
  if (typeof Blob !== "undefined" && payload instanceof Blob) {
    try {
      return await payload.text();
    } catch (err) {
      console.warn("useLogs: failed to read Blob payload", err);
      return null;
    }
  }
  if (typeof ArrayBuffer !== "undefined" && payload instanceof ArrayBuffer) {
    if (typeof TextDecoder !== "undefined") {
      try {
        return new TextDecoder().decode(payload);
      } catch (err) {
        console.warn("useLogs: failed to decode ArrayBuffer payload", err);
        return payload;
      }
    }
    return payload;
  }
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(payload)) {
    const view = payload as ArrayBufferView;
    if (typeof TextDecoder !== "undefined") {
      try {
        return new TextDecoder().decode(view.buffer);
      } catch (err) {
        console.warn("useLogs: failed to decode BufferView payload", err);
        return payload;
      }
    }
    return view.buffer;
  }
  return payload;
};

const parseLogsRecord = (message: unknown): Record<string, unknown> | null => {
  if (!message) {
    return null;
  }
  if (typeof message === "string") {
    const trimmed = message.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (typeof message === "object") {
    return message as Record<string, unknown>;
  }
  return null;
};

const buildLogEntryFromRecord = (record: Record<string, unknown>): LogEntry | null => {
  const type = typeof record.type === "string" ? record.type.trim().toLowerCase() : "";
  if (type !== "logs") {
    return null;
  }
  const contentCandidate = record.data ?? record.message ?? record.content ?? record.context;
  if (typeof contentCandidate !== "string" || !contentCandidate.trim()) {
    return null;
  }
  const now = new Date();
  const timestampSource =
    typeof record.timestamp === "string"
      ? record.timestamp
      : typeof record.ts === "string"
        ? record.ts
        : now.toISOString();
  const numericTs =
    typeof record.ts === "number"
      ? record.ts
      : typeof record.timestamp === "number"
        ? record.timestamp
        : now.getTime();
  const hintedLevel = resolveLogLevelFromHint(record.extra ?? record.level);
  return normalizeLogEntry(
    {
      ...record,
      timestamp: timestampSource,
      ts: numericTs,
      level: hintedLevel ?? record.level,
      content: contentCandidate,
    },
    0
  );
};

export function useLogs({token, limit = 200, level}: UseLogsOptions = {}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchLogs = useCallback(
    async (mode: FetchMode = "refresh") => {
      if (!token) {
        if (!isMountedRef.current) return;
        if (mode === "initial") {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
        return;
      }

      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        console.log('Fetching logs with params:', {limit, level});
        const response = await listLogs({limit, level});
        console.log('Response received:', response?.length, 'logs');
        if (!isMountedRef.current) return;
        
        // Normalizar os dados recebidos
        const normalizedLogs = Array.isArray(response) 
          ? response.map((log, index) => normalizeLogEntry(log, index))
          : [];
        
        console.log('Normalized logs:', normalizedLogs.length, 'entries');
        
        const ordered = normalizedLogs.sort((a, b) => b.timestampMs - a.timestampMs);
        setLogs(ordered);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        const message =
          err instanceof Error ? err.message : "Unable to load logs.";
        setError(message);
      } finally {
        if (!isMountedRef.current) return;
        if (mode === "initial") {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [token, limit, level]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchLogs("initial");
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchLogs]);

  const refresh = useCallback(() => fetchLogs("refresh"), [fetchLogs]);

  const processWsLog = useCallback(
    async (payload: unknown) => {
      const decoded = await decodeSocketPayload(payload);
      if (!decoded) {
        return;
      }
      const record = parseLogsRecord(decoded);
      if (!record) {
        return;
      }
      const logEntry = buildLogEntryFromRecord(record);
      if (!logEntry) {
        return;
      }
      if (typeof level === "number") {
        const entryLevelNumber = LOG_LEVEL_MAP[logEntry.level];
        if (entryLevelNumber !== undefined && entryLevelNumber !== level) {
          return;
        }
      }
      setLogs((prev) => {
        const next = [logEntry, ...prev];
        if (typeof limit === "number" && Number.isFinite(limit) && next.length > limit) {
          return next.slice(0, limit);
        }
        return next;
      });
    },
    [level, limit]
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    let isCancelled = false;
    let unsubscribe: (() => void) | undefined;
    const setup = async () => {
      try {
        await ensureHyperHiveWebsocket();
      } catch (err) {
        console.warn("useLogs: unable to connect to HyperHive WebSocket", err);
        return;
      }
      if (isCancelled) {
        return;
      }
      unsubscribe = subscribeToHyperHiveWebsocket((message) => {
        void processWsLog(message);
      });
    };
    setup();
    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [token, processWsLog]);

  return {
    logs,
    isLoading,
    isRefreshing,
    error,
    refresh,
    refetch: fetchLogs,
  };
}
