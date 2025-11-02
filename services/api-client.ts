import {API_BASE_URL} from "@/config/apiConfig";

export type ApiRequestOptions = {
  method?: string;
  token?: string | null;
  headers?: Record<string, string>;
  body?: unknown;
};

let currentAuthToken: string | null = null;

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export const onUnauthorized = (listener: UnauthorizedListener) => {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
};

const notifyUnauthorized = () => {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error("Unauthorized listener threw an error", err);
    }
  });
};

export const triggerUnauthorized = () => {
  notifyUnauthorized();
};

export const setAuthToken = (token: string | null) => {
  currentAuthToken = token ?? null;
};

export const getAuthToken = () => currentAuthToken;

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const withBaseUrl = (path: string) => {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  const normalizedBase = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
};

const serializeBody = (body: unknown, headers: Record<string, string>) => {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (
    typeof body === "string" ||
    (typeof FormData !== "undefined" && body instanceof FormData)
  ) {
    return body as BodyInit;
  }

  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return JSON.stringify(body);
};

export async function apiFetch<T = unknown>(
  path: string,
  {method = "GET", token, headers = {}, body}: ApiRequestOptions = {}
): Promise<T> {
  const effectiveToken =
    token === undefined ? currentAuthToken : token ?? null;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (effectiveToken) {
    finalHeaders.Authorization = effectiveToken;
  } else {
    delete finalHeaders.Authorization;
  }

  const serializedBody = serializeBody(body, finalHeaders);

  const response = await fetch(withBaseUrl(path), {
    method,
    headers: finalHeaders,
    body: serializedBody,
  });

  if (!response.ok) {
    let errorPayload: unknown = null;
    try {
      const raw = await response.text();
      if (raw) {
        try {
          errorPayload = JSON.parse(raw);
        } catch {
          errorPayload = raw;
        }
      }
    } catch {
      errorPayload = null;
    }
    if (response.status === 401) {
      notifyUnauthorized();
    }

    throw new ApiError(
      response.statusText || `Request failed with status ${response.status}`,
      response.status,
      errorPayload
    );
  }

  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return (await response.json()) as T;
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  return (await response.text()) as unknown as T;
}
