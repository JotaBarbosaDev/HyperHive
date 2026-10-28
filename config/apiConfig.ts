let apiBaseUrl: string | null = null;

const sanitizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    parsed.hash = "";
    parsed.search = "";
    const pathname = parsed.pathname.replace(/\/+$/, "");
    const normalizedPath = pathname === "/" ? "" : pathname;
    return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
  } catch {
    return null;
  }
};

export const normalizeApiBaseUrl = (value?: string | null) => {
  if (value == null) {
    return null;
  }
  return sanitizeUrl(value);
};

const apiBaseUrlListeners = new Set<() => void>();
export const onApiBaseUrlChange = (listener: () => void) => {
  apiBaseUrlListeners.add(listener);
  return () => { apiBaseUrlListeners.delete(listener); };
};

export const setApiBaseUrl = (value?: string | null) => {
  const next = value ? sanitizeUrl(value) : null;
  if (next === apiBaseUrl) return apiBaseUrl;
  apiBaseUrl = next;
  apiBaseUrlListeners.forEach((listener) => listener());
  return apiBaseUrl;
};

export const getApiBaseUrl = () => apiBaseUrl;
