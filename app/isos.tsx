import React from "react";
import { RefreshControl, ScrollView, useColorScheme } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@/components/ui/button";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  FormControlError,
  FormControlErrorText,
} from "@/components/ui/form-control";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Divider } from "@/components/ui/divider";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/ui/icon";
import { ChevronDownIcon } from "@/components/ui/icon";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle,
  Database,
  Hash,
  Folder,
  HardDrive,
  Plus,
  RefreshCw,
  Search,
  Server,
} from "lucide-react-native";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import {
  IsoApiResponse,
  IsoRaw,
  listIsos,
  listMounts,
  downloadIso,
  deleteIso as deleteIsoApi,
} from "@/services/hyperhive";
import { ApiError } from "@/services/api-client";
import { getApiBaseUrl } from "@/config/apiConfig";
import { ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket } from "@/services/websocket-client";
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@/components/ui/select";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";

type IsoItem = {
  id: string;
  name: string;
  description?: string;
  osLabel?: string;
  version?: string;
  sizeLabel?: string;
  dateLabel?: string;
  checksum?: string;
  downloadUrl?: string;
  tags: string[];
  machineName?: string;
  mountName?: string;
  nfsShareId?: number;
  filePath?: string;
  availableOn: string[];
};

type ShareInfo = {
  id: number;
  name?: string;
  fallbackName: string;
  target?: string;
  folderPath?: string;
  machineName: string;
};

type FetchMode = "initial" | "refresh" | "silent";
type IsoLookup = Map<string, unknown>;

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");

const ISO_COLLECTION_KEY_CANDIDATES = [
  "isos",
  "iso",
  "isoarray",
  "isolist",
  "availableisos",
  "availableiso",
  "images",
  "imagelist",
  "files",
  "filelist",
  "downloads",
  "data",
  "result",
  "results",
  "items",
  "records",
  "payload",
  "entries",
  "list",
];

const ISO_COLLECTION_KEY_SET = new Set(
  ISO_COLLECTION_KEY_CANDIDATES.map((key) => normalizeKey(key))
);

const MAX_COLLECTION_DEPTH = 4;

const resolveNormalizedApiBase = () => {
  const base = getApiBaseUrl();
  if (!base) {
    return undefined;
  }
  return base.replace(/\/+$/, "");
};

const tryParseJson = (input: string): unknown => {
  if (!input.trim()) {
    return null;
  }
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
};

const normalizeIsoResponse = (payload: IsoApiResponse | null | undefined): IsoItem[] => {
  if (!payload) {
    return [];
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return [];
    }

    const parsed = tryParseJson(trimmed);
    if (parsed && typeof parsed !== "string") {
      return normalizeIsoResponse(parsed as IsoApiResponse);
    }
    if (typeof parsed === "string") {
      return normalizeIsoResponse(parsed);
    }

    return parseIsoLines(trimmed);
  }

  const collection = extractIsoCollection(payload);
  return collection
    .map((entry, index) => normalizeIsoEntry(entry, index))
    .filter((entry): entry is IsoItem => Boolean(entry));
};

const parseIsoLines = (text: string): IsoItem[] => {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => normalizeIsoEntry(line, index))
    .filter((entry): entry is IsoItem => Boolean(entry));
};

const normalizeIsoEntry = (entry: IsoRaw, index: number): IsoItem | null => {
  if (typeof entry === "string") {
    const downloadUrl = resolveAbsoluteUrl(entry);
    return {
      id: downloadUrl ?? `iso-${index}`,
      name: downloadUrl ? deriveNameFromUrl(downloadUrl, index) : `ISO ${index + 1}`,
      downloadUrl: downloadUrl ?? undefined,
      tags: [],
      availableOn: [],
    };
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const lookup = createLookup(entry as Record<string, unknown>);

  const machineName = getString(lookup, ["machinename", "machine", "host", "server"]);
  const nfsShareId =
    getNumber(lookup, [
      "nfsshareid",
      "nfs_share_id",
      "shareid",
      "mountid",
      "share_id",
      "mount_id",
    ]) ?? undefined;

  const mountNameCandidate = getString(lookup, [
    "mountname",
    "mount",
    "mounttitle",
    "share",
    "sharename",
    "sharelabel",
    "nfs",
    "nfsshare",
    "nfsname",
    "nfs_label",
    "nfssharelabel",
  ]);
  const mountName = mountNameCandidate ?? undefined;
  const filePath =
    getString(lookup, [
      "filepath",
      "file_path",
      "fullpath",
      "full_path",
      "sourcepath",
      "source_path",
    ]) ?? undefined;
  const availability = normalizeAvailability(
    getValue(lookup, ["availableonslaves", "availability", "available", "slaves", "hosts"])
  );

  const idValue = getString(lookup, ["id", "identifier", "slug", "uuid"]);
  const explicitName = getString(lookup, ["name", "title", "label", "filename"]);
  const version = getString(lookup, ["version", "release", "build", "tag", "variant"]);

  const directDownloadCandidate = getString(lookup, [
    "downloadurl",
    "download_url",
    "url",
    "link",
    "href",
    "directlink",
    "direct_url",
  ]);
  const pathCandidate =
    getString(lookup, ["path", "file", "source", "uri", "location"]) ?? filePath;
  const preliminaryTarget = directDownloadCandidate ?? pathCandidate;
  const downloadUrl =
    resolveAbsoluteUrl(preliminaryTarget) ??
    buildDownloadUrl({
      id: idValue,
      name: explicitName,
      machineName,
      filePath: filePath ?? pathCandidate ?? undefined,
    });

  const id =
    idValue ??
    (downloadUrl
      ? `${downloadUrl}-${index}`
      : machineName
        ? `${machineName}-${index}`
        : `iso-${index}`);

  const fallbackNameSource = preliminaryTarget ?? downloadUrl ?? nameFromFilePath(filePath);
  const name =
    explicitName ??
    (fallbackNameSource ? deriveNameFromUrl(fallbackNameSource, index) : `ISO ${index + 1}`);

  const description = getString(lookup, ["description", "desc", "summary", "details", "notes", "info"]);
  const osLabel = getString(lookup, ["os", "operatingsystem", "system", "platform", "category", "type"]);
  const checksum = getString(lookup, ["checksum", "hash", "sha256", "sha", "sha1", "md5"]);

  const sizeLabel =
    formatSizeFromGB(getNumber(lookup, ["sizegb", "size_gb"])) ??
    formatSizeFromMB(getNumber(lookup, ["sizemb", "size_mb"])) ??
    formatSizeFromBytes(getNumber(lookup, ["sizebytes", "bytes"])) ??
    getString(lookup, ["size", "filesize", "sizehuman", "sizelabel"]);

  const dateLabel = formatDateValue(
    getValue(lookup, [
      "releasedate",
      "release_date",
      "date",
      "updatedat",
      "updated_at",
      "createdat",
      "created_at",
      "timestamp",
    ])
  );

  const tags = normalizeTags(
    getValue(lookup, ["tags", "labels", "keywords", "categories"])
  );

  return {
    id,
    name,
    description,
    osLabel,
    version,
    checksum,
    sizeLabel,
    dateLabel,
    downloadUrl: downloadUrl ?? undefined,
    tags,
    machineName,
    mountName,
    nfsShareId: nfsShareId ?? undefined,
    filePath,
    availableOn: availability,
  };
};

const createLookup = (record: Record<string, unknown>): IsoLookup => {
  const lookup = new Map<string, unknown>();
  Object.entries(record).forEach(([key, value]) => {
    lookup.set(normalizeKey(key), value);
  });
  return lookup;
};

const getValue = (lookup: IsoLookup, keys: string[]): unknown => {
  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (lookup.has(normalized)) {
      return lookup.get(normalized);
    }
  }
  return undefined;
};

const getString = (lookup: IsoLookup, keys: string[]): string | undefined => {
  const value = getValue(lookup, keys);
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  return undefined;
};

const getNumber = (lookup: IsoLookup, keys: string[]): number | undefined => {
  const value = getValue(lookup, keys);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const formatSizeNumber = (value: number | undefined, unit: string): string | undefined => {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  const rounded =
    value >= 10 ? Number(value.toFixed(1)) : Number(value.toFixed(2));
  return `${rounded} ${unit}`.trim();
};

const formatSizeFromGB = (value?: number) => formatSizeNumber(value, "GB");

const formatSizeFromMB = (value?: number) => {
  if (value === undefined) {
    return undefined;
  }
  if (value >= 1024) {
    return formatSizeNumber(value / 1024, "GB");
  }
  return formatSizeNumber(value, "MB");
};

const formatSizeFromBytes = (value?: number) => {
  if (value === undefined) {
    return undefined;
  }
  if (value >= 1024 * 1024 * 1024) {
    return formatSizeNumber(value / (1024 * 1024 * 1024), "GB");
  }
  if (value >= 1024 * 1024) {
    return formatSizeNumber(value / (1024 * 1024), "MB");
  }
  if (value >= 1024) {
    return formatSizeNumber(value / 1024, "KB");
  }
  return formatSizeNumber(value, "B");
};

const formatDateValue = (value: unknown): string | undefined => {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const timestamp = value > 0 && value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return undefined;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return formatDateValue(numeric);
    }
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return value;
  }
  return undefined;
};

const normalizeTags = (value: unknown): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        typeof entry === "string"
          ? entry.trim()
          : typeof entry === "number"
            ? entry.toString()
            : ""
      )
      .filter(Boolean)
      .slice(0, 6);
  }
  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 6);
  }
  return [];
};

const resolveAbsoluteUrl = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^\/mnt\//i.test(trimmed) || /^\/media\//i.test(trimmed) || /^[A-Za-z]:\\/.test(trimmed)) {
    return undefined;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  const base = resolveNormalizedApiBase();
  if (!base) {
    return undefined;
  }
  if (trimmed.startsWith("/")) {
    return `${base}${trimmed}`;
  }
  return `${base}/${trimmed.replace(/^\/+/, "")}`;
};

const deriveNameFromUrl = (url: string, index: number) => {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) {
      return decodeURIComponent(last);
    }
  } catch {
    const segments = url.split("/").filter(Boolean);
    const fallback = segments[segments.length - 1];
    if (fallback) {
      return fallback;
    }
  }
  return `ISO ${index + 1}`;
};

const normalizeFsPath = (input?: string | null) => {
  if (!input) return undefined;
  const replaced = input.replace(/\\+/g, "/").replace(/\/{2,}/g, "/");
  const trimmed = replaced.replace(/\/+$/g, "").trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
};

const getShareDisplayName = (share: ShareInfo) => {
  const trimmed = share.name?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }
  return share.fallbackName;
};

const resolveShareName = (iso: IsoItem, shares: ShareInfo[]): string | undefined => {
  if (!shares.length) {
    return undefined;
  }

  if (iso.nfsShareId) {
    const match = shares.find((share) => share.id === iso.nfsShareId);
    if (match) {
      return getShareDisplayName(match);
    }
  }

  const normalizedIsoPath = normalizeFsPath(iso.filePath);
  if (!normalizedIsoPath) {
    return undefined;
  }

  for (const share of shares) {
    const targets = [
      normalizeFsPath(share.target),
      normalizeFsPath(share.folderPath),
    ].filter(Boolean) as string[];
    if (
      targets.some(
        (targetPath) =>
          targetPath &&
          (normalizedIsoPath === targetPath ||
            normalizedIsoPath.startsWith(`${targetPath}/`))
      )
    ) {
      return getShareDisplayName(share);
    }
  }

  return undefined;
};

const clampProgress = (value?: number) => {
  if (value == null || Number.isNaN(value)) {
    return undefined;
  }
  return Math.min(100, Math.max(0, value));
};

const formatBytes = (bytes?: number) => {
  if (bytes == null || !Number.isFinite(bytes)) {
    return undefined;
  }
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return `${formatted} ${units[unitIndex]}`;
};

const parseDownloadMessage = (message: string) => {
  const percentMatch = message.match(/(\d+(?:\.\d+)?)%/);
  const progress = percentMatch ? parseFloat(percentMatch[1]) : undefined;

  const bytesMatch = message.match(/Download:\s*([0-9]+)\s*\/\s*([0-9]+)/i);
  const downloadedBytes = bytesMatch ? Number(bytesMatch[1]) : undefined;
  const totalBytes = bytesMatch ? Number(bytesMatch[2]) : undefined;

  const speedMatch = message.match(/-\s*([0-9.]+\s*[A-Za-z]+\/s)/i);
  const formattedBytes =
    downloadedBytes != null && totalBytes != null
      ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`
      : undefined;
  const detail = formattedBytes
    ? speedMatch?.[1]
      ? `${formattedBytes} • ${speedMatch[1]}`
      : formattedBytes
    : speedMatch?.[1];

  return {
    progress,
    status: message,
    detail,
  };
};

const nameFromFilePath = (path?: string | null) => {
  if (!path) {
    return undefined;
  }
  const normalized = path.trim().replace(/[/\\]+$/, "");
  if (!normalized) {
    return undefined;
  }
  const segments = normalized.split(/[/\\]/).filter(Boolean);
  const last = segments[segments.length - 1];
  return last ?? undefined;
};

const buildDownloadUrl = ({
  id,
  name,
  filePath,
  machineName,
}: {
  id?: string | null;
  name?: string | null;
  filePath?: string | null;
  machineName?: string | null;
}) => {
  const base = resolveNormalizedApiBase();
  if (!base) {
    return undefined;
  }
  const encode = (value: string) => encodeURIComponent(value);
  if (id && id.trim().length > 0) {
    return `${base}/isos/download/${encode(id)}`;
  }
  if (machineName && filePath) {
    return `${base}/isos/download?machine=${encode(machineName)}&path=${encode(filePath)}`;
  }
  if (filePath) {
    return `${base}/isos/download?path=${encode(filePath)}`;
  }
  if (name) {
    return `${base}/isos/download/${encode(name)}`;
  }
  return undefined;
};

const normalizeAvailability = (value: unknown): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") {
          return entry.trim();
        }
        if (entry && typeof entry === "object" && "name" in entry) {
          const candidate = (entry as { name?: unknown }).name;
          return typeof candidate === "string" ? candidate.trim() : "";
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, status]) => isTruthy(status))
      .map(([key]) => key)
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const isTruthy = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return Boolean(value);
};

const isLikelyIsoArray = (value: unknown[]): value is IsoRaw[] => {
  return value.some((entry) => {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed) {
        return false;
      }
      return /^https?:\/\//i.test(trimmed) || /\.iso(\.gz)?$/i.test(trimmed);
    }
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const lookup = createLookup(entry as Record<string, unknown>);
    return Boolean(
      getString(lookup, ["downloadurl", "download_url", "url", "link", "href", "directlink"]) ??
      getString(lookup, ["path", "file", "source"]) ??
      getString(lookup, ["name", "title", "label", "filename"])
    );
  });
};

const extractIsoCollection = (payload: IsoApiResponse | null | undefined): IsoRaw[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload !== "object") {
    return [];
  }

  const visited = new Set<Record<string, unknown>>();
  const queue: Array<{ value: Record<string, unknown>; depth: number }> = [
    { value: payload as Record<string, unknown>, depth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    const { value, depth } = current;
    if (!value || visited.has(value) || depth > MAX_COLLECTION_DEPTH) {
      continue;
    }
    visited.add(value);

    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = normalizeKey(key);
      if (ISO_COLLECTION_KEY_SET.has(normalizedKey)) {
        if (Array.isArray(child)) {
          return child as IsoRaw[];
        }
        if (typeof child === "string") {
          const parsed = tryParseJson(child);
          if (Array.isArray(parsed)) {
            return parsed as IsoRaw[];
          }
          if (parsed && typeof parsed === "object") {
            queue.push({ value: parsed as Record<string, unknown>, depth: depth + 1 });
          }
        } else if (child && typeof child === "object") {
          queue.push({ value: child as Record<string, unknown>, depth: depth + 1 });
        }
        continue;
      }

      if (Array.isArray(child)) {
        if (isLikelyIsoArray(child)) {
          return child as IsoRaw[];
        }
        continue;
      }

      if (child && typeof child === "object") {
        queue.push({ value: child as Record<string, unknown>, depth: depth + 1 });
      } else if (typeof child === "string") {
        const parsed = tryParseJson(child);
        if (Array.isArray(parsed)) {
          if (isLikelyIsoArray(parsed)) {
            return parsed as IsoRaw[];
          }
        } else if (parsed && typeof parsed === "object") {
          queue.push({ value: parsed as Record<string, unknown>, depth: depth + 1 });
        }
      }
    }
  }

  return [];
};

export default function ProfileScreen() {
  const { token, isChecking } = useAuthGuard();
  const [isos, setIsos] = React.useState<IsoItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [showAddIsoModal, setShowAddIsoModal] = React.useState(false);
  const [shareInfos, setShareInfos] = React.useState<ShareInfo[]>([]);
  const [activeDownload, setActiveDownload] = React.useState<DownloadMonitor | null>(null);
  const [deletingIsoId, setDeletingIsoId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<IsoItem | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const colorScheme = useColorScheme();

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  const fetchIsos = React.useCallback(
    async (mode: FetchMode = "initial") => {
      const isSilent = mode === "silent";
      if (!token) {
        if (!isSilent) {
          if (mode === "initial") {
            setIsLoading(false);
          } else if (mode === "refresh") {
            setIsRefreshing(false);
          }
        }
        return;
      }

      if (!isSilent) {
        if (mode === "initial") {
          setIsLoading(true);
        } else if (mode === "refresh") {
          setIsRefreshing(true);
        }
      }

      try {
        const payload = await listIsos({ token });
        const normalized = normalizeIsoResponse(payload);
        setIsos(normalized);
        setError(null);
      } catch (err) {
        let message = "Unable to load ISOs.";
        if (err instanceof ApiError) {
          if (typeof err.data === "string" && err.data.trim()) {
            message = err.data;
          } else if (
            typeof err.data === "object" &&
            err.data !== null &&
            "message" in err.data &&
            typeof (err.data as { message?: unknown }).message === "string"
          ) {
            message = (err.data as { message: string }).message;
          } else if (err.message) {
            message = err.message;
          }
        } else if (err instanceof Error && err.message) {
          message = err.message;
        }
        setError(message);
      } finally {
        if (!isSilent) {
          if (mode === "initial") {
            setIsLoading(false);
          } else if (mode === "refresh") {
            setIsRefreshing(false);
          }
        }
      }
    },
    [token]
  );

  React.useEffect(() => {
    if (!token) {
      return;
    }
    fetchIsos("initial");
  }, [fetchIsos, token]);

  React.useEffect(() => {
    if (!token) {
      return undefined;
    }
    const id = setInterval(() => {
      fetchIsos("silent");
    }, 5000);
    return () => clearInterval(id);
  }, [fetchIsos, token]);

  React.useEffect(() => {
    if (!token) {
      return;
    }
    let isActive = true;
    const fetchShareNames = async () => {
      try {
        const mounts = await listMounts();
        if (!isActive) return;
        const shares: ShareInfo[] = mounts
          .map(({ NfsShare }) => {
            if (!NfsShare) return null;
            return {
              id: NfsShare.Id,
              name: NfsShare.Name?.trim() || undefined,
              fallbackName: `${NfsShare.MachineName} • ${NfsShare.FolderPath}`,
              target: NfsShare.Target,
              folderPath: NfsShare.FolderPath,
              machineName: NfsShare.MachineName,
            } satisfies ShareInfo;
          })
          .filter(Boolean) as ShareInfo[];
        setShareInfos(shares);
      } catch (err) {
        console.warn("Failed to load mount names", err);
      }
    };
    fetchShareNames();
    return () => {
      isActive = false;
    };
  }, [token]);

  const handleOpenAddIso = React.useCallback(() => {
    setShowAddIsoModal(true);
  }, []);

  const handleIsoAdded = React.useCallback(() => {
    fetchIsos("initial");
  }, [fetchIsos]);

  const handleCloseDeleteModal = React.useCallback(() => {
    if (deletingIsoId) {
      return;
    }
    setDeleteTarget(null);
    setDeleteError(null);
  }, [deletingIsoId]);

  const displayIsos = React.useMemo(() => {
    if (shareInfos.length === 0) {
      return isos;
    }
    return isos.map((iso) => {
      const resolvedName = iso.mountName ?? resolveShareName(iso, shareInfos);
      if (resolvedName && resolvedName !== iso.mountName) {
        return { ...iso, mountName: resolvedName };
      }
      return iso;
    });
  }, [isos, shareInfos]);

  const filteredIsos = React.useMemo(() => {
    if (!query.trim()) {
      return displayIsos;
    }
    const needle = query.trim().toLowerCase();
    return displayIsos.filter((iso) =>
      [
        iso.name,
        iso.description,
        iso.version,
        iso.osLabel,
        iso.sizeLabel,
        iso.dateLabel,
        iso.checksum,
        iso.downloadUrl,
        iso.machineName,
        iso.mountName,
        iso.filePath,
        iso.availableOn.join(" "),
        iso.tags.join(" "),
      ]
        .filter(Boolean)
        .some((field) => field?.toLowerCase().includes(needle))
    );
  }, [displayIsos, query]);

  const handleManualRefresh = React.useCallback(() => {
    fetchIsos("refresh");
  }, [fetchIsos]);

  const handleRequestDelete = React.useCallback(
    (iso: IsoItem) => {
      if (deletingIsoId) {
        return;
      }
      setDeleteError(null);
      setDeleteTarget(iso);
    },
    [deletingIsoId]
  );

  const handleDeleteIso = React.useCallback(async () => {
    if (!deleteTarget || deletingIsoId) {
      return;
    }
    setError(null);
    setDeleteError(null);
    setDeletingIsoId(deleteTarget.id);
    try {
      await deleteIsoApi(deleteTarget.id);
      setIsos((prev) => prev.filter((iso) => iso.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      let message = "Unable to delete ISO.";
      if (err instanceof ApiError) {
        if (typeof err.data === "string" && err.data.trim()) {
          message = err.data;
        } else if (
          typeof err.data === "object" &&
          err.data !== null &&
          "message" in err.data &&
          typeof (err.data as { message?: unknown }).message === "string"
        ) {
          message = (err.data as { message: string }).message;
        } else if (err.message) {
          message = err.message;
        }
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }
      setDeleteError(message);
    } finally {
      setDeletingIsoId(null);
    }
  }, [deleteTarget, deletingIsoId, setIsos]);

  const activeDownloadProgress =
    activeDownload?.progress != null ? clampProgress(activeDownload.progress) : undefined;
  const isButtonTrackingDownload = !!(activeDownload && isDownloadActive(activeDownload));
  const downloadProgressLabel =
    isButtonTrackingDownload && activeDownload
      ? activeDownloadProgress != null
        ? `${Math.round(activeDownloadProgress)}%`
        : activeDownload.status ?? "Downloading..."
      : "Add ISO";
  const downloadProgressDetail =
    isButtonTrackingDownload && activeDownload
      ? (activeDownload.detail?.split("•")[0]?.trim() || activeDownload.detail || activeDownload.status)
      : null;

  if (isChecking || !token) {
    return null;
  }

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 32}}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchIsos("refresh")}
            tintColor={refreshControlTint}
            colors={[refreshControlTint]}
            progressBackgroundColor={refreshControlBackground}
          />
        }
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-6xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            ISO Downloads
          </Heading>
          <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
            Browse all ISOs available for your VMs and add new images by
            downloading them straight to the cluster.
          </Text>

          <VStack className="mt-6 gap-4 web:flex-row web:items-end">
            <Box className="flex-1">
              <Text
                className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8] mb-2"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                Filter ISOs
              </Text>
              <Input variant="outline" className="rounded-2xl">
                <InputSlot className="pl-4">
                  <InputIcon
                    as={Search}
                    className="text-typography-500 dark:text-[#8A94A8]"
                  />
                </InputSlot>
                <InputField
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Name, operating system, version..."
                  placeholderTextColor={
                    colorScheme === "dark" ? "#8A94A8" : "#94A3B8"
                  }
                  className="text-base text-typography-900 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_500Medium"}}
                />
              </Input>
            </Box>
            <HStack className="gap-3">
              <Box className="relative  overflow-hidden">
                {isButtonTrackingDownload && activeDownloadProgress != null ? (
                  <Box
                    className="absolute left-0 top-0 h-full bg-primary-500/30 dark:bg-[#5EEAD4]/30"
                    style={{width: `${activeDownloadProgress}%`}}
                    pointerEvents="none"
                  />
                ) : null}
                <Button
                  action="primary"
                  onPress={handleOpenAddIso}
                  className="bg-primary-500 rounded-xl dark:bg-[#2DD4BF] hover:bg-primary-600 dark:hover:bg-[#5EEAD4] active:bg-primary-700 dark:active:bg-[#14B8A6]"
                >
                  <ButtonIcon
                    as={Plus}
                    className="text-typography-0 dark:text-[#0D1420]"
                  />
                  <VStack className="flex-1 items-start">
                    <ButtonText
                      className="text-base font-semibold text-typography-0 dark:text-[#0D1420]"
                      style={{fontFamily: "Inter_600SemiBold"}}
                    >
                      {downloadProgressLabel}
                    </ButtonText>
                    {downloadProgressDetail ? (
                      <Text
                        className="text-xs text-typography-0 dark:text-[#0D1420] opacity-80"
                        style={{fontFamily: "Inter_500Medium"}}
                      >
                        {downloadProgressDetail}
                      </Text>
                    ) : null}
                  </VStack>
                </Button>
              </Box>
              <Button
                variant="outline"
                onPress={handleManualRefresh}
                isDisabled={isLoading || isRefreshing}
                className="border-outline-200 rounded-xl dark:border-[#1E2F47] bg-background-0 dark:bg-[#0F1A2E] hover:bg-background-50 dark:hover:bg-[#0A1628] h-10"
              >
                {isRefreshing ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonIcon
                    as={RefreshCw}
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                )}
                <ButtonText
                  className="text-typography-900 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Refresh
                </ButtonText>
              </Button>
            </HStack>
          </VStack>

          {error ? (
            <Box className="mt-6 rounded-2xl border border-error-300 dark:border-error-700 bg-error-500/5 dark:bg-error-900/20 p-4">
              <HStack className="gap-3">
                <Box className="h-12 w-12 items-center justify-center rounded-2xl bg-error-500/10 dark:bg-error-500/20">
                  <Icon
                    as={AlertCircle}
                    className="text-error-500 dark:text-error-400"
                    size="lg"
                  />
                </Box>
                <VStack className="flex-1 gap-2">
                  <Text
                    className="text-base font-semibold text-error-600 dark:text-error-400"
                    style={{fontFamily: "Inter_600SemiBold"}}
                  >
                    Something went wrong
                  </Text>
                  <Text
                    className="text-sm text-error-600 dark:text-error-400"
                    style={{fontFamily: "Inter_400Regular"}}
                  >
                    {error}
                  </Text>
                  <Button
                    variant="solid"
                    action="secondary"
                    onPress={() => fetchIsos("initial")}
                    className="h-10 rounded-xl bg-error-500/10 dark:bg-error-500/20 hover:bg-error-500/20 dark:hover:bg-error-500/30"
                  >
                    <ButtonText className="text-error-600 dark:text-error-400 font-semibold">
                      Try again
                    </ButtonText>
                  </Button>
                </VStack>
              </HStack>
            </Box>
          ) : null}

          <Divider className="mt-8 bg-outline-100 dark:bg-[#2A3B52]" />

          {isLoading ? (
            <VStack className="items-center justify-center gap-3 py-16">
              <Spinner color="#2DD4BF" />
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                Loading available ISOs...
              </Text>
            </VStack>
          ) : filteredIsos.length === 0 ? (
            <Box className="mt-8 rounded-2xl border border-outline-100 bg-background-0 p-8 text-center shadow-soft-2 dark:border-[#2A3B52] dark:bg-[#0E1524]">
              <Text
                className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                {query.trim()
                  ? "No ISOs found for this filter."
                  : "No ISOs available yet."}
              </Text>
              <Text className="mt-2 text-sm text-typography-600 dark:text-[#8A94A8]">
                {query.trim()
                  ? "Adjust your search or clear the filter to see the full library."
                  : "As soon as your subscriptions are active, images will appear automatically."}
              </Text>
            </Box>
          ) : (
            <Box className="mt-8 flex flex-col gap-5 web:grid web:grid-cols-1 web:gap-6 web:sm:grid-cols-2 web:xl:grid-cols-3">
              {filteredIsos.map((iso) => (
                <IsoCard
                  key={iso.id}
                  iso={iso}
                  onDelete={handleRequestDelete}
                  isDeleting={deletingIsoId === iso.id}
                />
              ))}
            </Box>
          )}
        </Box>
      </ScrollView>
      <Modal isOpen={!!deleteTarget} onClose={handleCloseDeleteModal}>
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent className="max-w-full web:max-w-lg p-5 web:p-6 rounded-2xl bg-background-0 dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52]">
          <ModalHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <HStack className="items-center gap-3">
              <Box className="h-10 w-10 rounded-2xl bg-error-500/10 dark:bg-error-900/20 items-center justify-center">
                <Icon as={AlertCircle} size="sm" className="text-error-600 dark:text-error-400" />
              </Box>
              <VStack>
                <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
                  Remove ISO?
                </Heading>
                <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                  This action permanently deletes the ISO from storage.
                </Text>
              </VStack>
            </HStack>
          </ModalHeader>
          <ModalBody className="pt-5">
            <VStack className="gap-4">
              {deleteTarget ? (
                <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0A1628] p-4">
                  <VStack className="gap-2">
                    <Text className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]">
                      ISO
                    </Text>
                    <Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
                      {deleteTarget.name}
                    </Text>
                    <HStack className="flex-wrap gap-2">
                      {deleteTarget.sizeLabel ? (
                        <Badge action="muted" variant="outline" className="rounded-full border px-3">
                          <BadgeText className="text-xs text-typography-700 dark:text-typography-200">
                            {deleteTarget.sizeLabel}
                          </BadgeText>
                        </Badge>
                      ) : null}
                      {deleteTarget.mountName ? (
                        <Badge action="muted" variant="outline" className="rounded-full border px-3">
                          <BadgeText className="text-xs text-typography-700 dark:text-typography-200">
                            {deleteTarget.mountName}
                          </BadgeText>
                        </Badge>
                      ) : null}
                      {deleteTarget.machineName ? (
                        <Badge action="muted" variant="outline" className="rounded-full border px-3">
                          <BadgeText className="text-xs text-typography-700 dark:text-typography-200">
                            {deleteTarget.machineName}
                          </BadgeText>
                        </Badge>
                      ) : null}
                    </HStack>
                    {deleteTarget.filePath ? (
                      <Text className="text-xs text-typography-600 dark:text-[#8A94A8] break-all">
                        {deleteTarget.filePath}
                      </Text>
                    ) : null}
                  </VStack>
                </Box>
              ) : null}
              {deleteError ? (
                <Box className="rounded-xl border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/20 px-4 py-3">
                  <Text className="text-sm text-error-700 dark:text-error-200">{deleteError}</Text>
                </Box>
              ) : null}
            </VStack>
          </ModalBody>
          <ModalFooter className="gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3B52]">
            <Button
              variant="outline"
              className="rounded-xl px-4"
              onPress={handleCloseDeleteModal}
              isDisabled={Boolean(deletingIsoId)}
            >
              <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Cancel</ButtonText>
            </Button>
            <Button
              action="negative"
              onPress={handleDeleteIso}
              isDisabled={Boolean(deletingIsoId)}
              className="rounded-xl bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#F87171] dark:hover:bg-[#FB7185] dark:active:bg-[#DC2626]"
            >
              {deletingIsoId ? (
                <ButtonSpinner />
              ) : (
                <ButtonText className="text-background-0 dark:text-[#0A1628]">Remove ISO</ButtonText>
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <AddIsoModal
        isOpen={showAddIsoModal}
        onClose={() => setShowAddIsoModal(false)}
        onSuccess={handleIsoAdded}
        authToken={token}
        onDownloadChange={setActiveDownload}
      />
    </Box>
  );
}

type IsoCardProps = {
  iso: IsoItem;
  onDelete?: (iso: IsoItem) => void;
  isDeleting?: boolean;
};

function IsoCard({ iso, onDelete, isDeleting }: IsoCardProps) {
  return (
    <Box className="rounded-3xl border border-outline-100 bg-background-0 p-5 shadow-soft-3 dark:border-[#2A3B52] dark:bg-[#0E1524]">
      <VStack className="gap-5">
        <VStack className="gap-3">
          <Text
            className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#5EEAD4]"
            style={{fontFamily: "Inter_600SemiBold"}}
          >
            ISO image
          </Text>
          <Heading
            size="md"
            className="text-typography-900 dark:text-[#E8EBF0]"
            style={{fontFamily: "Inter_600SemiBold"}}
          >
            {iso.name}
          </Heading>
          {iso.description ? (
            <Text
              className="text-sm text-typography-600 dark:text-[#8A94A8]"
              numberOfLines={3}
              style={{fontFamily: "Inter_400Regular"}}
            >
              {iso.description}
            </Text>
          ) : null}
        </VStack>

        <VStack className="gap-2">
          <HStack className="flex-wrap gap-2">
            {iso.osLabel ? (
              <Badge
                action="info"
                variant="outline"
                className="rounded-full border border-info-300/60 bg-info-500/5 px-3"
              >
                <BadgeText className="text-xs font-semibold text-info-600">
                  {iso.osLabel}
                </BadgeText>
              </Badge>
            ) : null}
            {iso.version ? (
              <Badge
                action="muted"
                variant="outline"
                className="rounded-full border px-3"
              >
                <BadgeText className="text-xs font-medium text-typography-700 dark:text-typography-200">
                  v{iso.version}
                </BadgeText>
              </Badge>
            ) : null}
            {iso.tags.map((tag) => (
              <Badge
                key={`${iso.id}-${tag}`}
                action="muted"
                variant="solid"
                className="rounded-full bg-background-50 px-3 dark:bg-[#1A2637]"
              >
                <BadgeText className="text-xs text-typography-700 dark:text-typography-200">
                  {tag}
                </BadgeText>
              </Badge>
            ))}
          </HStack>
          {iso.availableOn.length > 0 ? (
            <VStack className="gap-2">
              <Text
                className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#5EEAD4]"
                style={{fontFamily: "Inter_500Medium"}}
              >
                Available on
              </Text>
              <HStack className="flex-wrap gap-2 web:flex-wrap">
                {iso.availableOn.map((host) => (
                  <Badge
                    key={`${iso.id}-${host}`}
                    action="muted"
                    variant="outline"
                    className="rounded-full border px-3 max-w-full min-w-0 shrink"
                  >
                    <BadgeText className="text-xs font-semibold text-typography-700 dark:text-typography-950 whitespace-normal break-normal">
                      {host}
                    </BadgeText>
                  </Badge>
                ))}
              </HStack>
            </VStack>
          ) : null}
        </VStack>

        <VStack className="gap-3">
          {iso.sizeLabel ? (
            <IsoInfoRow icon={Database} label="Size" value={iso.sizeLabel} />
          ) : null}
          {iso.dateLabel ? (
            <IsoInfoRow
              icon={CalendarClock}
              label="Updated"
              value={iso.dateLabel}
            />
          ) : null}
          {iso.checksum ? (
            <IsoInfoRow
              icon={Hash}
              label="Checksum"
              value={iso.checksum}
              mono
            />
          ) : null}
          {iso.mountName ? (
            <IsoInfoRow icon={HardDrive} label="Mount" value={iso.mountName} />
          ) : null}
          {iso.machineName ? (
            <IsoInfoRow icon={Server} label="Machine" value={iso.machineName} />
          ) : null}
          {iso.filePath ? (
            <IsoInfoRow icon={Folder} label="Path" value={iso.filePath} mono />
          ) : null}
          <HStack className="justify-end pt-2">
            <Button
              action="negative"
              onPress={() => onDelete?.(iso)}
              isDisabled={!onDelete || isDeleting}
              className="rounded-xl px-4 h-10 bg-error-600 hover:bg-error-500 active:bg-error-700 dark:bg-[#af2b2b] dark:hover:bg-[#be4a4a] dark:active:bg-[#DC2626]"
            >
              {isDeleting ? (
                <ButtonSpinner />
              ) : (
                <ButtonText
                  className="text-background-0 dark:text-typography-950"
                  style={{fontFamily: "Inter_600SemiBold"}}
                >
                  Remove
                </ButtonText>
              )}
            </Button>
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );
}

type IsoInfoRowProps = {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  mono?: boolean;
};

function IsoInfoRow({ icon, label, value, mono = false }: IsoInfoRowProps) {
  return (
    <HStack className="items-start gap-3">
      <Box className="h-10 w-10 rounded-2xl bg-background-50 dark:bg-[#1A2637] items-center justify-center">
        <Icon as={icon} size="sm" className="text-typography-500 dark:text-[#5EEAD4]" />
      </Box>
      <VStack className="flex-1 min-w-0">
        <Text
          className="text-xs uppercase tracking-wide text-typography-500 dark:text-[#8A94A8]"
          style={{ fontFamily: "Inter_500Medium" }}
        >
          {label}
        </Text>
        <Text
          className={`text-sm text-typography-900 dark:text-[#E8EBF0] ${mono ? 'break-all' : ''}`}
          numberOfLines={mono ? 2 : undefined}
          style={{ fontFamily: mono ? "SpaceMono" : "Inter_600SemiBold" }}
        >
          {value}
        </Text>
      </VStack>
    </HStack>
  );
}

type AddIsoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  authToken?: string | null;
  onDownloadChange?: (monitor: DownloadMonitor | null) => void;
};

type ShareOption = {
  id: number;
  name: string;
  description: string;
};

type DownloadMonitor = {
  isoName: string;
  status: string;
  progress?: number;
  stage: "connecting" | "downloading" | "completed" | "error";
  detail?: string;
};

const isDownloadActive = (monitor: DownloadMonitor | null) =>
  !!monitor && (monitor.stage === "connecting" || monitor.stage === "downloading");

const COMPLETION_THRESHOLD = 99.5;

function AddIsoModal({ isOpen, onClose, onSuccess, authToken, onDownloadChange }: AddIsoModalProps) {
  const colorScheme = useColorScheme();
  const [isoUrl, setIsoUrl] = React.useState("");
  const [isoName, setIsoName] = React.useState("");
  const [selectedShareId, setSelectedShareId] = React.useState<string | null>(null);
  const [shareOptions, setShareOptions] = React.useState<ShareOption[]>([]);
  const [isLoadingShares, setIsLoadingShares] = React.useState(false);
  const [shareLoadError, setShareLoadError] = React.useState<string | null>(null);
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [isoNameError, setIsoNameError] = React.useState<string | null>(null);
  const [shareError, setShareError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isMonitoring, setIsMonitoring] = React.useState(false);
  const [downloadMonitor, setDownloadMonitor] = React.useState<DownloadMonitor | null>(null);
  const autoCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOpenRef = React.useRef(false);
  const lastProgressRef = React.useRef(0);
  const isoNameRef = React.useRef<string | null>(null);
  const completionHandledRef = React.useRef(false);
  const downloadMonitorRef = React.useRef<DownloadMonitor | null>(null);
  const clearAutoCloseTimer = React.useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, []);
  const isBusy = isSubmitting || isMonitoring || isDownloadActive(downloadMonitor);
  const progressValue =
    downloadMonitor?.progress != null ? clampProgress(downloadMonitor.progress) : undefined;
  const showFooter =
    !downloadMonitor || downloadMonitor.stage === "error" || downloadMonitor.stage === "completed";
  const footerLabel =
    downloadMonitor?.stage === "completed"
      ? "Close"
      : downloadMonitor?.stage === "error"
        ? "Retry download"
        : "Download ISO";
  const isFooterDisabled =
    downloadMonitor?.stage === "completed"
      ? false
      : downloadMonitor?.stage === "error"
        ? isBusy || isLoadingShares || shareOptions.length === 0
        : isBusy || isLoadingShares || shareOptions.length === 0 || !!downloadMonitor;

  const resetForm = React.useCallback(
    (options?: { preserveDownload?: boolean }) => {
      setIsoUrl("");
      setIsoName("");
      setSelectedShareId(null);
      setUrlError(null);
      setIsoNameError(null);
      setShareError(null);
      setSubmitError(null);
      if (options?.preserveDownload) {
        return;
      }
      clearAutoCloseTimer();
      lastProgressRef.current = 0;
      isoNameRef.current = null;
      completionHandledRef.current = false;
      setDownloadMonitor(null);
      setIsMonitoring(false);
    },
    [clearAutoCloseTimer]
  );

  const handleModalClose = React.useCallback(() => {
    clearAutoCloseTimer();
    if (!isDownloadActive(downloadMonitor)) {
      resetForm();
    }
    onClose();
  }, [clearAutoCloseTimer, downloadMonitor, onClose, resetForm]);

  const scheduleAutoClose = React.useCallback(() => {
    clearAutoCloseTimer();
    autoCloseTimerRef.current = setTimeout(() => {
      handleModalClose();
    }, 10000);
  }, [clearAutoCloseTimer, handleModalClose]);

  React.useEffect(() => {
    return () => {
      clearAutoCloseTimer();
    };
  }, [clearAutoCloseTimer]);

  React.useEffect(() => {
    const isOpening = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!isOpening) return;
    resetForm({ preserveDownload: !!downloadMonitor });
  }, [downloadMonitor, isOpen, resetForm]);

  React.useEffect(() => {
    downloadMonitorRef.current = downloadMonitor;
  }, [downloadMonitor]);

  React.useEffect(() => {
    onDownloadChange?.(downloadMonitor);
  }, [downloadMonitor, onDownloadChange]);

  React.useEffect(() => {
    if (!isOpen) return;
    let isActive = true;
    const fetchShares = async () => {
      setIsLoadingShares(true);
      try {
        const mounts = await listMounts();
        if (!isActive) return;
        const mapped = mounts.map(({ NfsShare }) => ({
          id: NfsShare.Id,
          name:
            NfsShare.Name && NfsShare.Name.trim().length > 0
              ? NfsShare.Name
              : `${NfsShare.MachineName} • ${NfsShare.FolderPath}`,
          description: `${NfsShare.MachineName} • ${NfsShare.FolderPath}`,
        }));
        setShareOptions(mapped);
        setShareLoadError(null);
        setSelectedShareId((prev) => prev ?? (mapped[0] ? String(mapped[0].id) : null));
      } catch (err) {
        if (!isActive) return;
        let message = "Unable to load mounts.";
        if (err instanceof Error && err.message) {
          message = err.message;
        }
        setShareOptions([]);
        setShareLoadError(message);
      } finally {
        if (isActive) {
          setIsLoadingShares(false);
        }
      }
    };
    fetchShares();
    return () => {
      isActive = false;
    };
  }, [isOpen]);

  const toNumber = React.useCallback((value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }, []);

  const applyDownloadUpdate = React.useCallback(
    (payload: Record<string, unknown>) => {
      const rawData =
        typeof payload.data === "string"
          ? payload.data
          : typeof payload.data === "number"
            ? String(payload.data)
            : "";

      const payloadProgress =
        toNumber(payload.progress) ??
        toNumber(payload.percentage) ??
        toNumber(payload.percent);

      const parsedData = rawData ? parseDownloadMessage(rawData) : null;
      const effectiveProgress = clampProgress(
        parsedData?.progress ?? payloadProgress
      );

      if (effectiveProgress != null) {
        lastProgressRef.current = effectiveProgress;
      }

      const statusText =
        parsedData?.status ??
        (typeof payload.status === "string" ? payload.status : undefined) ??
        rawData ??
        "Download in progress...";

      const detailText =
        parsedData?.detail ??
        (typeof payload.detail === "string" ? payload.detail : undefined) ??
        (typeof payload.description === "string" ? payload.description : undefined) ??
        undefined;

      const errorMessage =
        (typeof payload.error === "string" && payload.error) ||
        (typeof (payload as { error_message?: unknown }).error_message === "string"
          ? (payload as { error_message: string }).error_message
          : undefined);

      const extraIsoName =
        typeof payload.extra === "string" && payload.extra.trim().length > 0
          ? payload.extra.trim()
          : undefined;

      const completed =
        payload.completed === true ||
        payload.done === true ||
        (typeof payload.status === "string" &&
          ["completed", "finished", "success"].includes(payload.status.toLowerCase())) ||
        (effectiveProgress ?? 0) >= COMPLETION_THRESHOLD;

      const stage: DownloadMonitor["stage"] = errorMessage
        ? "error"
        : completed
          ? "completed"
          : "downloading";

      const targetIsoName =
        extraIsoName ??
        isoNameRef.current ??
        downloadMonitorRef.current?.isoName ??
        "ISO download";

      const nextMonitor: DownloadMonitor = {
        isoName: targetIsoName,
        status: statusText,
        progress: effectiveProgress ?? undefined,
        stage,
        detail: detailText,
      };

      setDownloadMonitor(nextMonitor);
      setIsMonitoring(stage === "downloading");

      if (stage === "error") {
        setSubmitError(errorMessage ?? statusText);
      }

      if (stage === "completed" && !completionHandledRef.current) {
        completionHandledRef.current = true;
        onSuccess();
        scheduleAutoClose();
      }
    },
    [onSuccess, scheduleAutoClose, toNumber]
  );

  const handleWsMessage = React.useCallback(
    async (payload: any) => {
      let message: any = payload;

      if (typeof Blob !== "undefined" && payload instanceof Blob) {
        try {
          message = await payload.text();
        } catch (err) {
          console.warn("Failed to read WS Blob payload", err);
          return;
        }
      } else if (payload instanceof ArrayBuffer) {
        try {
          const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
          message = decoder ? decoder.decode(payload) : payload;
        } catch (err) {
          console.warn("Failed to decode WS ArrayBuffer payload", err);
          return;
        }
      } else if (ArrayBuffer.isView(payload)) {
        try {
          const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
          message = decoder ? decoder.decode(payload.buffer) : payload;
        } catch (err) {
          console.warn("Failed to decode WS buffer view payload", err);
          return;
        }
      }

      if (typeof message === "string") {
        const trimmed = message.trim();
        if (!trimmed) {
          return;
        }
        try {
          message = JSON.parse(trimmed);
        } catch {
          return;
        }
      }

      if (!message || typeof message !== "object") {
        return;
      }

      const record = message as Record<string, unknown>;
      const type =
        typeof record.type === "string" ? record.type.trim().toLowerCase() : undefined;
      if (type !== "downloadiso") {
        return;
      }
      applyDownloadUpdate(record);
    },
    [applyDownloadUpdate]
  );

  React.useEffect(() => {
    const unsubscribe = subscribeToHyperHiveWebsocket((msg) => {
      void handleWsMessage(msg);
    });
    return () => {
      unsubscribe();
    };
  }, [handleWsMessage]);

  const downloadStage = downloadMonitor?.stage;
  React.useEffect(() => {
    const hasActiveDownload =
      downloadStage === "connecting" || downloadStage === "downloading";
    if (!isOpen && !hasActiveDownload) {
      return;
    }
    ensureHyperHiveWebsocket().catch((err) => {
      console.warn("Erro ao conectar ao WebSocket geral:", err);
    });
  }, [downloadStage, isOpen]);

  const handleSubmit = React.useCallback(async () => {
    if (isBusy) {
      return;
    }
    setSubmitError(null);
    let hasError = false;

    const normalizedUrl = isoUrl.trim();
    if (!normalizedUrl) {
      setUrlError("URL is required.");
      hasError = true;
    } else if (!normalizedUrl.toLowerCase().endsWith(".iso")) {
      setUrlError("The URL must end with .iso");
      hasError = true;
    } else {
      setUrlError(null);
    }

    const normalizedIsoName = isoName.trim();
    if (!normalizedIsoName) {
      setIsoNameError("ISO name is required.");
      hasError = true;
    } else if (!normalizedIsoName.toLowerCase().endsWith(".iso")) {
      setIsoNameError("The name must end with .iso");
      hasError = true;
    } else {
      setIsoNameError(null);
    }

    const shareIdNumber = selectedShareId ? Number(selectedShareId) : NaN;
    if (!selectedShareId || Number.isNaN(shareIdNumber)) {
      setShareError("Select the mount where the ISO will be stored.");
      hasError = true;
    } else {
      setShareError(null);
    }

    if (hasError) {
      return;
    }

    setIsSubmitting(true);
    completionHandledRef.current = false;
    isoNameRef.current = normalizedIsoName;
    lastProgressRef.current = 0;
    try {
      await ensureHyperHiveWebsocket();
    } catch (err) {
      let message = "Could not connect to the WebSocket.";
      if (err instanceof Error && err.message) {
        message = err.message;
      }
      setIsMonitoring(false);
      setDownloadMonitor(null);
      setSubmitError(message);
      setIsSubmitting(false);
      return;
    }
    try {
      await downloadIso({
        url: normalizedUrl,
        isoName: normalizedIsoName,
        nfsShareId: shareIdNumber,
      });
    } catch (err) {
      let message = "Could not start the ISO download.";
      if (err instanceof ApiError) {
        if (typeof err.data === "string" && err.data.trim()) {
          message = err.data;
        } else if (
          typeof err.data === "object" &&
          err.data !== null &&
          "message" in err.data &&
          typeof (err.data as { message?: unknown }).message === "string"
        ) {
          message = (err.data as { message: string }).message;
        } else if (err.message) {
          message = err.message;
        }
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }
      setIsMonitoring(false);
      setDownloadMonitor(null);
      setSubmitError(message);
      setIsSubmitting(false);
      return;
    }
    setDownloadMonitor({
      isoName: normalizedIsoName,
      status: "Download in progress...",
      stage: "connecting",
      progress: 0,
    });
    setIsMonitoring(true);
    setIsSubmitting(false);
  }, [isoUrl, isoName, selectedShareId, isBusy, ensureHyperHiveWebsocket]);

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose}>
      <ModalBackdrop className="bg-background-950/50 dark:bg-black/70" />
      <ModalContent className="max-w-full web:max-w-lg p-5 web:p-8 rounded-2xl bg-background-0 dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52]">
        <ModalHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
          <Heading
            size="lg"
            className="text-typography-900 dark:text-[#E8EBF0] web:text-2xl"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            Add new ISO
          </Heading>
          <Text className="text-sm text-typography-500 dark:text-[#8A94A8] mt-1 web:text-base">
            Download an ISO image directly to a mount
          </Text>
        </ModalHeader>
        <ModalBody className="pt-6">
          {downloadMonitor ? (
            <VStack className="gap-6 items-center">
              <VStack className="gap-1 items-center text-center">
                <Text
                  className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]"
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  Downloading ISO
                </Text>
                <Text className="text-sm text-typography-500 dark:text-[#8A94A8] max-w-md">
                  Keep this window open to follow the progress. You can close it
                  once the download finishes.
                </Text>
              </VStack>
              <Box
                className={`w-full rounded-2xl border px-4 py-4 ${downloadMonitor.stage === "error"
                    ? "border-error-300 dark:border-error-700 bg-error-500/5 dark:bg-error-900/10"
                    : "border-outline-100 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]"
                  }`}
              >
                <VStack className="gap-3">
                  <HStack className="items-center gap-3">
                    {downloadMonitor.stage === "completed" ? (
                      <Icon
                        as={CheckCircle}
                        className="text-success-500 dark:text-success-400"
                        size="lg"
                      />
                    ) : downloadMonitor.stage === "error" ? (
                      <Icon
                        as={AlertCircle}
                        className="text-error-500 dark:text-error-400"
                        size="lg"
                      />
                    ) : (
                      <Spinner
                        color={colorScheme === "dark" ? "#2DD4BF" : "#0F172A"}
                      />
                    )}
                    <VStack className="flex-1 gap-1">
                      <Text
                        className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]"
                        style={{ fontFamily: "Inter_600SemiBold" }}
                      >
                        {downloadMonitor.isoName}
                      </Text>
                      {downloadMonitor.stage === "completed" ? (
                        <Text className="text-sm text-success-600 dark:text-success-400 font-medium">
                          Download completed successfully
                        </Text>
                      ) : downloadMonitor.stage === "error" ? (
                        <Text className="text-sm text-error-600 dark:text-error-400">
                          Download error
                        </Text>
                      ) : (
                        <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                          Downloading...
                        </Text>
                      )}
                    </VStack>
                  </HStack>
                  {progressValue != null &&
                    downloadMonitor.stage === "downloading" ? (
                    <VStack className="gap-3">
                      <HStack className="items-center justify-between">
                        <Text
                          className="text-2xl font-bold text-primary-500 dark:text-[#2DD4BF]"
                          style={{ fontFamily: "Inter_700Bold" }}
                        >
                          {Math.round(progressValue)}%
                        </Text>
                        {downloadMonitor.detail ? (
                          <Text
                            className="text-sm text-typography-600 dark:text-[#8A94A8] font-medium"
                            style={{ fontFamily: "Inter_500Medium" }}
                          >
                            {downloadMonitor.detail}
                            {"adwedqaefweq"}
                          </Text>
                        ) : null}
                      </HStack>
                      <Progress
                        value={progressValue}
                        size="md"
                        className="bg-outline-100 dark:bg-[#1A2637] w-full"
                      >
                        <ProgressFilledTrack className="bg-primary-500 dark:bg-[#2DD4BF]" />
                      </Progress>
                    </VStack>
                  ) : null}
                </VStack>
              </Box>
              {downloadMonitor.stage === "error" && submitError ? (
                <Box className="w-full rounded-2xl border border-error-300 dark:border-error-700 bg-error-500/5 dark:bg-error-900/20 px-4 py-3">
                  <Text
                    className="text-sm text-error-600 dark:text-error-400 font-medium"
                    style={{ fontFamily: "Inter_500Medium" }}
                  >
                    {submitError}
                  </Text>
                </Box>
              ) : null}
            </VStack>
          ) : (
            <VStack className="gap-5">
              <FormControl isInvalid={!!urlError}>
                <FormControlLabel>
                  <FormControlLabelText className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                    ISO URL
                  </FormControlLabelText>
                </FormControlLabel>
                <Input
                  variant="outline"
                  className="rounded-2xl mt-2 bg-background-50 dark:bg-[#0E1524] border-outline-200 dark:border-[#2A3B52]"
                >
                  <InputField
                    value={isoUrl}
                    onChangeText={(value) => {
                      setIsoUrl(value);
                      setUrlError(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="https://example.com/fedora.iso"
                    placeholderTextColor={
                      colorScheme === "dark" ? "#8A94A8" : "#94A3B8"
                    }
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
                <Text className="mt-2 text-xs text-typography-500 dark:text-[#8A94A8]">
                  The link must point directly to a .iso file.
                </Text>
                {urlError ? (
                  <FormControlError>
                    <FormControlErrorText>{urlError}</FormControlErrorText>
                  </FormControlError>
                ) : null}
              </FormControl>

              <FormControl isInvalid={!!isoNameError}>
                <FormControlLabel>
                  <FormControlLabelText className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                    ISO name
                  </FormControlLabelText>
                </FormControlLabel>
                <Input
                  variant="outline"
                  className="rounded-2xl mt-2 bg-background-50 dark:bg-[#0E1524] border-outline-200 dark:border-[#2A3B52]"
                >
                  <InputField
                    value={isoName}
                    onChangeText={(value) => {
                      setIsoName(value);
                      setIsoNameError(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="fedora.iso"
                    placeholderTextColor={
                      colorScheme === "dark" ? "#8A94A8" : "#94A3B8"
                    }
                    className="text-typography-900 dark:text-[#E8EBF0]"
                  />
                </Input>
                {isoNameError ? (
                  <FormControlError>
                    <FormControlErrorText>{isoNameError}</FormControlErrorText>
                  </FormControlError>
                ) : null}
              </FormControl>

              <FormControl isInvalid={!!shareError}>
                <FormControlLabel>
                  <FormControlLabelText className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                    Destination mount
                  </FormControlLabelText>
                </FormControlLabel>
                {isLoadingShares ? (
                  <Box className="mt-3 items-center justify-center py-6">
                    <Spinner color="#2DD4BF" />
                  </Box>
                ) : shareLoadError ? (
                  <Box className="mt-3 rounded-2xl border border-error-300 dark:border-error-700 bg-error-500/5 dark:bg-error-900/20 px-3 py-2">
                    <Text className="text-sm text-error-600 dark:text-error-400">
                      {shareLoadError}
                    </Text>
                  </Box>
                ) : shareOptions.length === 0 ? (
                  <Box className="mt-3 rounded-2xl border border-outline-100 px-3 py-2 dark:border-[#2A3B52]">
                    <Text className="text-sm text-typography-500 dark:text-[#8A94A8]">
                      No mounts configured yet. Create one before downloading
                      ISOs.
                    </Text>
                  </Box>
                ) : (
                  <Select
                    className="mt-2"
                    onValueChange={(next) => {
                      setSelectedShareId(next);
                      setShareError(null);
                    }}
                  >
                    <SelectTrigger className="rounded-2xl border border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] h-12 px-4">
                      <SelectInput
                        placeholder="Select a mount"
                        className="text-base text-typography-900 dark:text-[#E8EBF0]"
                      />
                      <SelectIcon
                        as={ChevronDownIcon}
                        className="text-typography-500 dark:text-[#8A94A8]"
                      />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent className="max-h-72 bg-background-0 dark:bg-[#0E1524] border border-outline-100 dark:border-[#2A3B52] rounded-2xl">
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        {shareOptions.map((option) => (
                          <SelectItem
                            key={option.id}
                            label={option.name}
                            value={String(option.id)}
                            className="text-base text-typography-900 dark:text-[#E8EBF0] hover:bg-background-50 dark:hover:bg-[#1A2637]"
                          >
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                )}
                {shareError ? (
                  <FormControlError>
                    <FormControlErrorText>{shareError}</FormControlErrorText>
                  </FormControlError>
                ) : null}
              </FormControl>

              {submitError ? (
                <Box className="rounded-2xl border border-error-300 dark:border-error-700 bg-error-500/5 dark:bg-error-900/20 px-4 py-3">
                  <Text
                    className="text-sm text-error-600 dark:text-error-400 font-medium"
                    style={{ fontFamily: "Inter_500Medium" }}
                  >
                    {submitError}
                  </Text>
                </Box>
              ) : null}
            </VStack>
          )}
        </ModalBody>
        {showFooter ? (
          <ModalFooter className="gap-3 pt-6 border-t border-outline-100 dark:border-[#2A3B52] mt-2">
            <Button
              action="primary"
              onPress={
                downloadMonitor?.stage === "completed"
                  ? handleModalClose
                  : handleSubmit
              }
              isDisabled={isFooterDisabled}
              className="h-12 w-full rounded-xl bg-primary-500 dark:bg-[#2DD4BF] hover:bg-primary-600 dark:hover:bg-[#5EEAD4] active:bg-primary-700 dark:active:bg-[#14B8A6]"
            >
              {isBusy ? (
                <ButtonText
                  className="text-base font-semibold text-typography-0 dark:text-[#0D1420]"
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  Saving ISO
                </ButtonText>
              ) : (
                <ButtonText
                  className="text-base font-semibold text-typography-0 dark:text-[#0D1420]"
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  {footerLabel}
                </ButtonText>
              )}
            </Button>
          </ModalFooter>
        ) : null}
      </ModalContent>
    </Modal>
  );
}
