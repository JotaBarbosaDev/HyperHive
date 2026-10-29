import { getApiBaseUrl } from "@/config/apiConfig";

export type ApiRequestOptions = {
  method?: string;
  token?: string | null;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  reportResult?: boolean;
  handledErrorStatuses?: number[];
  acceptedStatuses?: number[];
};

let currentAuthToken: string | null = null;

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();
type ApiResult = {
  ok: boolean;
  method: string;
  path: string;
  status?: number;
  error?: unknown;
  errorText?: string;
};
type ApiResultListener = (result: ApiResult) => void;
const apiResultListeners = new Set<ApiResultListener>();

export const onUnauthorized = (listener: UnauthorizedListener) => {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
};

export const onApiResult = (listener: ApiResultListener) => {
  apiResultListeners.add(listener);
  return () => {
    apiResultListeners.delete(listener);
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

const authTokenListeners = new Set<() => void>();
export const onAuthTokenChange = (listener: () => void) => {
  authTokenListeners.add(listener);
  return () => { authTokenListeners.delete(listener); };
};
export const setAuthToken = (token: string | null) => {
  const next = token ?? null;
  if (next === currentAuthToken) return;
  currentAuthToken = next;
  authTokenListeners.forEach((listener) => listener());
};

export const getAuthToken = () => currentAuthToken;

export class ApiError extends Error {
  status: number;
  data: unknown;
  retryAfter: string | null;

  constructor(message: string, status: number, data: unknown, retryAfter: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.retryAfter = retryAfter;
  }
}

const withBaseUrl = (path: string) => {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("API base URL is not configured.");
  }
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
};

const isBinaryBody = (body: unknown): body is Blob | ArrayBuffer | ArrayBufferView => {
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return true;
  }
  return typeof Blob !== "undefined" && body instanceof Blob;
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

  if (isBinaryBody(body)) {
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/octet-stream";
    }
    return body as BodyInit;
  }

  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return JSON.stringify(body);
};

export async function apiFetch<T = unknown>(
  path: string,
  { method = "GET", token, headers = {}, body, signal, reportResult = true, acceptedStatuses = [], handledErrorStatuses = [] }: ApiRequestOptions = {}
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
  const requestPath = withBaseUrl(path);

  let response: Response;
  try {
    response = await fetch(requestPath, {
      method,
      headers: finalHeaders,
      body: serializedBody,
      signal,
    });
  } catch (networkErr) {
    const isAbort = networkErr instanceof DOMException && networkErr.name === "AbortError";
    if (!isAbort) {
      console.error("[API ERROR]", method, requestPath, networkErr);
      const networkMessage = networkErr instanceof Error ? networkErr.message : undefined;
      if (reportResult) {
        apiResultListeners.forEach((listener) => {
          try {
            listener({
              ok: false,
              method,
              path: requestPath,
              status: undefined,
              error: networkErr,
              errorText: networkMessage,
            });
          } catch (err) {
            console.error("API result listener threw an error", err);
          }
        });
      }
    }
    throw networkErr;
  }

  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    let errorPayload: unknown = null;
    let errorText: string | null = null;
    try {
      const raw = await response.text();
      errorText = raw || null;
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

    if (!handledErrorStatuses.includes(response.status)) {
      console.error("[API]", method, requestPath, "->", response.status, errorPayload);
    }
    if (reportResult) {
      apiResultListeners.forEach((listener) => {
        try {
          listener({
            ok: false,
            method,
            path: requestPath,
            status: response.status,
            error: errorPayload,
            errorText: errorText ?? undefined,
          });
        } catch (err) {
          console.error("API result listener threw an error", err);
        }
      });
    }

    const literalMessage =
      (errorText && errorText.trim()) ||
      response.statusText ||
      `Request failed with status ${response.status}`;

    throw new ApiError(literalMessage, response.status, errorPayload ?? errorText, response.headers.get("Retry-After"));
  }

  console.info("[API]", method, requestPath, "->", response.status);
  if (reportResult) {
    apiResultListeners.forEach((listener) => {
      try {
        listener({ ok: true, method, path: requestPath, status: response.status });
      } catch (err) {
        console.error("API result listener threw an error", err);
      }
    });
  }

  // No-content responses may still carry Content-Type: application/json.
  // Check the status first: parsing their empty body is always an error.
  if (response.status === 204 || response.status === 205 || method.toUpperCase() === "HEAD") {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}

// Shared browser upload transport for VM and managed-disk images.
export function uploadBrowserFile(url: string, token: string | null | undefined, file: Blob, options?: { onProgress?: (percent: number) => void; signal?: AbortSignal }): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => {
      options?.signal?.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(xhr.responseText);
    };
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    if (token) xhr.setRequestHeader("Authorization", token);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) options?.onProgress?.(Math.round(event.loaded / event.total * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 401 || xhr.status === 403) triggerUnauthorized();
      if (xhr.status >= 200 && xhr.status < 300) options?.onProgress?.(100);
      finish(xhr.status >= 200 && xhr.status < 300 ? undefined : new Error(xhr.responseText || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => finish(new Error("Network error while uploading image; check transfer status before retrying."));
    xhr.onabort = () => finish(new Error("Upload cancelled. Check transfer status to discard any staging files."));
    if (options?.signal?.aborted) { finish(new Error("Upload cancelled.")); return; }
    options?.signal?.addEventListener("abort", abort, { once: true });
    xhr.send(file);
  });
}
