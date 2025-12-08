import {useCallback, useEffect, useRef, useState} from "react";
import {MachineUpdates, UpdateEntry, UpdateSeverity} from "@/types/update";
import {getMachineUpdates} from "@/services/hyperhive";

type FetchMode = "initial" | "refresh";

export type UseUpdatesOptions = {
  machineName?: string | null;
  token?: string | null;
};

const tryParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeVersion = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  return undefined;
};

const normalizeSeverity = (value: unknown): UpdateSeverity | undefined => {
  if (value === undefined || value === null) return undefined;
  const label = String(value).toLowerCase();
  if (label.includes("security") || label.includes("critical")) return "security";
  if (label.includes("bug") || label.includes("fix")) return "bugfix";
  if (label.includes("enhanc") || label.includes("improv") || label.includes("feature")) {
    return "enhancement";
  }
  if (label.includes("optional") || label.includes("low")) return "optional";
  return "other";
};

const parseStringEntry = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const arrowMatch = trimmed.match(
    /^([^\s:]+)\s*[:\s]\s*([0-9A-Za-z.+~:-]+)\s*(?:->|=>|to|:)\s*([0-9A-Za-z.+~:-]+)/i
  );
  if (arrowMatch) {
    return {
      name: arrowMatch[1],
      currentVersion: arrowMatch[2],
      newVersion: arrowMatch[3],
    };
  }

  const colonMatch = trimmed.match(/^([^\s:]+)\s*[:]\s*([0-9A-Za-z.+~:-]+)/);
  if (colonMatch) {
    return {
      name: colonMatch[1],
      newVersion: colonMatch[2],
    };
  }

  return {name: trimmed};
};

const normalizeUpdateEntry = (raw: any, index: number): UpdateEntry | null => {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw === "string") {
    const parsed = parseStringEntry(raw);
    if (!parsed) return null;
    return {
      id: `update-${index}`,
      name: parsed.name || `Pacote ${index + 1}`,
      currentVersion: normalizeVersion(parsed.currentVersion),
      newVersion: normalizeVersion(parsed.newVersion),
      raw,
    };
  }

  if (typeof raw !== "object") {
    return {
      id: `update-${index}`,
      name: String(raw),
      raw,
    };
  }

  const entry = raw as Record<string, any>;
  const parsedFromText = typeof entry.text === "string" ? parseStringEntry(entry.text) : null;
  const parsedFromValue = typeof entry.value === "string" ? parseStringEntry(entry.value) : null;

  const name =
    entry.package ||
    entry.pkg ||
    entry.pkgName ||
    entry.name ||
    entry.Package ||
    entry.Name ||
    entry.title ||
    entry.label ||
    entry.__key;

  const id =
    entry.id ||
    entry.pkg ||
    entry.pkgName ||
    entry.package ||
    entry.name ||
    entry.__key ||
    `update-${index}`;

  const currentVersion =
    parsedFromText?.currentVersion ??
    parsedFromValue?.currentVersion ??
    entry.current_version ??
    entry.currentVersion ??
    entry.installed ??
    entry.installed_version ??
    entry.previous ??
    entry.oldVersion ??
    entry.old_version ??
    entry.versionInstalled;

  const newVersion =
    parsedFromText?.newVersion ??
    parsedFromValue?.newVersion ??
    entry.new_version ??
    entry.available_version ??
    entry.available ??
    entry.latest ??
    entry.latestVersion ??
    entry.version ??
    entry.versionNew ??
    entry.target ??
    entry.candidate ??
    entry.version_available;

  const architecture = entry.arch || entry.architecture || entry.Arch;
  const repository = entry.repo || entry.repository || entry.origin || entry.source || entry.channel || entry.Release;
  const description = entry.description || entry.summary || entry.message || entry.details || entry.note;
  const severity = normalizeSeverity(
    entry.severity || entry.type || entry.kind || entry.category || entry.priority
  );

  const rebootRequired = Boolean(
    entry.reboot_required ||
      entry.reboot ||
      entry.restart ||
      entry.needs_reboot ||
      entry.need_reboot ||
      entry.requires_reboot ||
      entry.requiresRestart ||
      entry.rebootRequired
  );

  return {
    id: String(id),
    name: String(name ?? parsedFromText?.name ?? parsedFromValue?.name ?? `Pacote ${index + 1}`),
    currentVersion: normalizeVersion(currentVersion),
    newVersion: normalizeVersion(newVersion),
    architecture: architecture ? String(architecture) : undefined,
    repository: repository ? String(repository) : undefined,
    description: description ? String(description) : undefined,
    severity,
    rebootRequired,
    raw,
  };
};

const UPDATE_COLLECTION_KEYS = new Set([
  "updates",
  "pkgs",
  "packages",
  "available",
  "upgradable",
  "upgradeable",
  "items",
  "list",
  "data",
  "result",
  "results",
  "payload",
  "entries",
]);

const METADATA_KEYS = new Set([
  "status",
  "message",
  "reboot",
  "reboot_required",
  "needs_reboot",
  "timestamp",
  "checked_at",
  "updated_at",
  "last_checked",
]);

const extractUpdateCollection = (payload: unknown, depth = 0): any[] => {
  if (payload === null || payload === undefined) return [];
  if (depth > 4) return [];

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload === "string") {
    const parsed = tryParseJson(payload);
    if (parsed && typeof parsed !== "string") {
      return extractUpdateCollection(parsed, depth + 1);
    }
    return payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (typeof payload !== "object") {
    return [];
  }

  const obj = payload as Record<string, any>;
  const normalizedKeys = Object.keys(obj).map((key) => key.toLowerCase());
  const isLikelyMetadataOnly =
    normalizedKeys.length > 0 &&
    normalizedKeys.every((key) => METADATA_KEYS.has(key));

  if (isLikelyMetadataOnly) {
    return [];
  }

  for (const key of Object.keys(obj)) {
    const normalizedKey = key.toLowerCase();
    const value = obj[key];
    if (Array.isArray(value) && UPDATE_COLLECTION_KEYS.has(normalizedKey)) {
      return value;
    }
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = extractUpdateCollection(value, depth + 1);
      if (nested.length) {
        return nested;
      }
    }
  }

  const firstArray = Object.values(obj).find((value) => Array.isArray(value));
  if (Array.isArray(firstArray)) {
    return firstArray;
  }

  return Object.keys(obj).map((key) => {
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return {...value, __key: key};
    }
    return {__key: key, value};
  });
};

const TRUEISH_VALUES = new Set(["true", "1", "yes", "y", "sim", "on", "reboot", "needed"]);

const isTrueish = (value: unknown) => {
  if (value === true) return true;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return TRUEISH_VALUES.has(normalized);
  }
  return false;
};

const extractBoolean = (payload: any, keys: string[]): boolean | undefined => {
  if (!payload || typeof payload !== "object") {
    if (typeof payload === "string") {
      return isTrueish(payload);
    }
    return undefined;
  }

  const normalizedPairs = Object.entries(payload).map(([key, value]) => [
    key.replace(/[_-]/g, "").toLowerCase(),
    value,
  ]);

  for (const key of keys) {
    const normalizedKey = key.replace(/[_-]/g, "").toLowerCase();
    const match = normalizedPairs.find(([candidate]) => candidate === normalizedKey);
    if (match && match[1] !== undefined && match[1] !== null) {
      return isTrueish(match[1]);
    }
  }

  return undefined;
};

const extractString = (payload: any, keys: string[]): string | undefined => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  for (const key of keys) {
    if (payload[key]) {
      return String(payload[key]);
    }
    const normalizedKey = key.replace(/[_-]/g, "").toLowerCase();
    for (const candidate of Object.keys(payload)) {
      const normalizedCandidate = candidate.replace(/[_-]/g, "").toLowerCase();
      if (normalizedCandidate === normalizedKey && payload[candidate]) {
        return String(payload[candidate]);
      }
    }
  }
  return undefined;
};

const REBOOT_KEYS = ["reboot", "reboot_required", "needs_reboot", "requires_reboot", "restart"];
const TIMESTAMP_KEYS = ["timestamp", "checked_at", "updated_at", "last_checked", "date"];
const SOURCE_KEYS = ["source", "origin", "repository"];

const normalizeMachineUpdates = (payload: unknown, machineName: string): MachineUpdates => {
  const collection = extractUpdateCollection(payload);
  const items = collection
    .map((item, index) => normalizeUpdateEntry(item, index))
    .filter((item): item is UpdateEntry => Boolean(item));

  const rebootRequired =
    extractBoolean(payload, REBOOT_KEYS) ??
    items.some((item) => item.rebootRequired);

  const fetchedAt = extractString(payload, TIMESTAMP_KEYS) ?? new Date().toISOString();
  const source = extractString(payload, SOURCE_KEYS);

  return {
    machineName,
    items,
    rebootRequired,
    fetchedAt,
    source,
    raw: payload,
  };
};

export function useUpdates({machineName, token}: UseUpdatesOptions = {}) {
  const [updates, setUpdates] = useState<MachineUpdates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchUpdates = useCallback(
    async (mode: FetchMode = "refresh") => {
      if (!token || !machineName) {
        if (!isMountedRef.current) return;
        setUpdates(null);
        setError(null);
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
        const payload = await getMachineUpdates(machineName);
        if (!isMountedRef.current) return;
        setUpdates(normalizeMachineUpdates(payload, machineName));
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        const message =
          err instanceof Error ? err.message : "Não foi possível carregar as atualizações.";
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
    [machineName, token]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchUpdates("initial");
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchUpdates]);

  const refresh = useCallback(() => fetchUpdates("refresh"), [fetchUpdates]);

  return {
    updates,
    isLoading,
    isRefreshing,
    error,
    refresh,
    refetch: fetchUpdates,
  };
}
