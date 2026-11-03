// Normalizes VM progress websocket messages (backup, migrate, revert) for toasts.

export type VmProgressSocketMessage = {
  type?: unknown;
  data?: unknown;
  extra?: unknown;
};

export type NormalizedVmProgressMessage = {
  id: string;
  title: string;
  description: string;
  vmName?: string;
};

const TYPE_LABELS: Record<string, string> = {
  backupvm: "Copy VM",
  migratevm: "Migrate VM",
  revertvm: "Revert VM",
};
export const SUPPORTED_TYPES = new Set(Object.keys(TYPE_LABELS));

export const normalizeVmProgressMessage = (raw: VmProgressSocketMessage): NormalizedVmProgressMessage | null => {
  const rawType = typeof raw.type === "string" ? raw.type : "";
  const normalizedType = rawType.toLowerCase();
  if (!SUPPORTED_TYPES.has(normalizedType)) {
    return null;
  }

  const description =
    typeof raw.data === "string"
      ? raw.data
      : raw.data !== undefined
      ? String(raw.data)
      : "";
  if (!description) {
    return null;
  }

  const rawExtra = typeof raw.extra === "string" ? raw.extra.trim() : "";
  const idSource = rawExtra || `${normalizedType}-${Date.now()}`;
  let vmName: string | undefined;

  // Progress ids are "<vmName>-<unix seconds>"; VM names may contain hyphens,
  // so split on the last one.
  if (rawExtra) {
    const lastHyphen = rawExtra.lastIndexOf("-");
    if (lastHyphen > 0) {
      const left = rawExtra.slice(0, lastHyphen).trim();
      const right = rawExtra.slice(lastHyphen + 1).trim();
      if (left && /^\d+$/.test(right)) {
        vmName = left;
      }
    }
  }

  const typeLabel = TYPE_LABELS[normalizedType] ?? "Copy VM";
  const title = vmName ? `${vmName} — ${typeLabel}` : typeLabel;

  return {
    id: idSource,
    title,
    description,
    vmName,
  };
};
