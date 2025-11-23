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

export const setApiBaseUrl = (value?: string | null) => {
  apiBaseUrl = value ? sanitizeUrl(value) : null;
  return apiBaseUrl;
};

export const getApiBaseUrl = () => apiBaseUrl;
