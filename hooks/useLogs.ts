import {useCallback, useEffect, useRef, useState} from "react";
import {LogEntry, LogLevel, LOG_LEVEL_REVERSE_MAP} from "@/types/log";
import {listLogs} from "@/services/hyperhive";

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
  return content.replace(/^\[([^\]]+)\]\s*/, '');
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

// Função para normalizar os dados recebidos da API
const normalizeLogEntry = (rawLog: any, index: number): LogEntry => {
  // Se rawLog for uma string ou algo primitivo, converter para objeto
  const logObj = typeof rawLog === 'object' && rawLog !== null ? rawLog : {content: String(rawLog)};
  
  // Extrair conteúdo da mensagem
  const content = logObj.content || logObj.message || logObj.msg || String(logObj);
  
  return {
    id: String(logObj.id || logObj._id || `log-${index}-${Date.now()}`),
    timestamp: logObj.ts || logObj.timestamp || logObj.time || logObj.date || new Date().toISOString(),
    timestampMs: parseTimestampMs(logObj.ts || logObj.timestamp || logObj.time || logObj.date || Date.now()),
    level: normalizeLogLevel(logObj.level || logObj.severity),
    machine: extractMachineFromContent(content),
    message: cleanMessageContent(content),
    rawContent: typeof content === "string" ? content : undefined,
    raw: rawLog,
  };
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

  return {
    logs,
    isLoading,
    isRefreshing,
    error,
    refresh,
    refetch: fetchLogs,
  };
}
