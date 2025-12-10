import React from "react";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import {
  API_BASE_URL_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  loadApiBaseUrl,
  loadAuthToken,
} from "@/services/auth-storage";

export enum RealtimeEventType {
  DownloadIso = 0,
  MigrateVm = 1,
  BackUpVM = 2,
  ContainerLogs = 3,
  Logs = 4,
  DockerCompose = 5,
}

type RealtimePayload = {
  rawType: unknown;
  type: RealtimeEventType;
  data: string;
  extra?: string;
};

type UseRealtimeEventsOptions = {
  enabled?: boolean;
};

const SOCKET_PATH = "/ws";
const RECONNECT_DELAY_MS = 3000;
const MIGRATION_IDLE_MS = 5000;

const EVENT_TYPE_NAME_MAP: Record<string, RealtimeEventType> = {
  downloadiso: RealtimeEventType.DownloadIso,
  migratevm: RealtimeEventType.MigrateVm,
  backupvm: RealtimeEventType.BackUpVM,
  containerlogs: RealtimeEventType.ContainerLogs,
  logs: RealtimeEventType.Logs,
  dockercompose: RealtimeEventType.DockerCompose,
};

const EVENT_TYPE_VALUES = new Set<RealtimeEventType>([
  RealtimeEventType.DownloadIso,
  RealtimeEventType.MigrateVm,
  RealtimeEventType.BackUpVM,
  RealtimeEventType.ContainerLogs,
  RealtimeEventType.Logs,
  RealtimeEventType.DockerCompose,
]);

const buildSocketUrl = (baseUrl: string, token: string) => {
  try {
    const parsed = new URL(baseUrl);
    const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    return `${protocol}//${parsed.host}${normalizedPath}${SOCKET_PATH}?token=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
};

const normalizeEventType = (value: unknown): RealtimeEventType | null => {
  if (typeof value === "number" && EVENT_TYPE_VALUES.has(value as RealtimeEventType)) {
    return value as RealtimeEventType;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && EVENT_TYPE_VALUES.has(numeric as RealtimeEventType)) {
      return numeric as RealtimeEventType;
    }
    const mapped = EVENT_TYPE_NAME_MAP[trimmed.toLowerCase()];
    if (mapped !== undefined) {
      return mapped;
    }
  }
  return null;
};

const parseIncomingMessage = (raw: unknown): RealtimePayload | null => {
  if (raw == null) return null;
  let payload: any = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      payload = JSON.parse(trimmed);
    } catch {
      payload = { type: undefined, data: trimmed };
    }
  }

  if (typeof payload !== "object" || Array.isArray(payload) || payload === null) {
    return null;
  }

  const normalizedType = normalizeEventType((payload as any).type);
  if (normalizedType == null) {
    return null;
  }

  const dataValue = (payload as any).data;
  const extraValue = (payload as any).extra;

  const data = typeof dataValue === "string" ? dataValue : dataValue != null ? String(dataValue) : "";
  const extra = typeof extraValue === "string" ? extraValue : extraValue != null ? String(extraValue) : undefined;

  return {
    rawType: (payload as any).type,
    type: normalizedType,
    data,
    extra,
  };
};

const resolveApiBaseUrl = async () => {
  const current = getApiBaseUrl();
  if (current) return current;
  const stored = await loadApiBaseUrl();
  if (!stored) return null;
  return setApiBaseUrl(stored) ?? stored;
};

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
  const { enabled = true } = options;
  const toast = useToast();
  const wsRef = React.useRef<WebSocket | null>(null);
  const migrationToastIdRef = React.useRef<string | number | null>(null);
  const migrationIdleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  const closeSocket = React.useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (err) {
        console.warn("Failed to close realtime socket", err);
      }
      wsRef.current = null;
    }
  }, []);

  const closeMigrationToast = React.useCallback(() => {
    if (migrationIdleTimerRef.current) {
      clearTimeout(migrationIdleTimerRef.current);
      migrationIdleTimerRef.current = null;
    }
    const anyToast = toast as any;
    if (migrationToastIdRef.current && typeof anyToast?.close === "function") {
      anyToast.close(migrationToastIdRef.current);
    }
    migrationToastIdRef.current = null;
  }, [toast]);

  const showMigrationToast = React.useCallback(
    (message: string, extra?: string) => {
      const anyToast = toast as any;
      const description = extra && extra.trim().length > 0 ? `${message} — ${extra}` : message;

      if (migrationToastIdRef.current && typeof anyToast?.close === "function") {
        anyToast.close(migrationToastIdRef.current);
        migrationToastIdRef.current = null;
      }

      const nextId = anyToast?.show?.({
        placement: "top",
        duration: MIGRATION_IDLE_MS + 2000,
        render: ({ id }: { id: string | number }) => (
          <Toast
            nativeID={`toast-${id}`}
            className="px-5 py-3 gap-2 shadow-soft-1 items-start flex-row"
            action="info"
          >
            <ToastTitle size="sm">Migração de VM</ToastTitle>
            {description ? <ToastDescription size="sm">{description}</ToastDescription> : null}
          </Toast>
        ),
      });

      migrationToastIdRef.current = nextId ?? migrationToastIdRef.current;

      if (migrationIdleTimerRef.current) {
        clearTimeout(migrationIdleTimerRef.current);
      }

      migrationIdleTimerRef.current = setTimeout(() => {
        closeMigrationToast();
      }, MIGRATION_IDLE_MS);
    },
    [closeMigrationToast, toast]
  );

  const handleRealtimeMessage = React.useCallback(
    (payload: RealtimePayload) => {
      switch (payload.type) {
        case RealtimeEventType.MigrateVm:
          showMigrationToast(payload.data || "Migração em curso...", payload.extra);
          break;
        default:
          // Placeholder for future handlers.
          break;
      }
    },
    [showMigrationToast]
  );

  React.useEffect(() => {
    if (!enabled) {
      closeSocket();
      closeMigrationToast();
      return;
    }

    let isActive = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanupTimers = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = async () => {
      const [token, baseUrl] = await Promise.all([loadAuthToken(), resolveApiBaseUrl()]);
      if (!isActive) return;

      if (!token || !baseUrl) {
        closeSocket();
        closeMigrationToast();
        return;
      }

      const socketUrl = buildSocketUrl(baseUrl, token);
      if (!socketUrl || typeof WebSocket === "undefined") {
        return;
      }

      closeSocket();

      let socket: WebSocket;
      try {
        socket = new WebSocket(socketUrl);
      } catch (err) {
        console.warn("Failed to open realtime socket", err);
        cleanupTimers();
        reconnectTimer = setTimeout(() => {
          if (isActive) {
            connect();
          }
        }, RECONNECT_DELAY_MS);
        return;
      }

      wsRef.current = socket;

      socket.onopen = () => {
        console.info("[Realtime] WebSocket connected", socketUrl);
        cleanupTimers();
      };

      socket.onerror = (event) => {
        console.warn("Realtime socket error", event);
        socket.close();
      };

      socket.onclose = (event) => {
        console.info("[Realtime] WebSocket disconnected", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        wsRef.current = null;
        if (!isActive) return;
        cleanupTimers();
        reconnectTimer = setTimeout(() => {
          if (isActive) {
            connect();
          }
        }, RECONNECT_DELAY_MS);
      };

      socket.onmessage = (event) => {
        console.info("[Realtime] WebSocket message", event.data);
        const parsed = parseIncomingMessage(event.data);
        if (!parsed) return;
        handleRealtimeMessage(parsed);
      };
    };

    connect();

    return () => {
      isActive = false;
      cleanupTimers();
      closeSocket();
      closeMigrationToast();
    };
  }, [closeMigrationToast, closeSocket, enabled, handleRealtimeMessage, refreshTick]);

  React.useEffect(() => {
    const canListenToStorageEvents =
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function" &&
      typeof window.removeEventListener === "function";

    if (!canListenToStorageEvents) {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === AUTH_TOKEN_STORAGE_KEY ||
        event.key === API_BASE_URL_STORAGE_KEY
      ) {
        setRefreshTick((prev) => prev + 1);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);
}
