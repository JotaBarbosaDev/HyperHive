import {API_BASE_URL, DEFAULT_AUTH_TOKEN} from "@/config/apiConfig";

export type ApiRequestOptions = {
  method?: string;
  token?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

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
  {method = "GET", token = DEFAULT_AUTH_TOKEN, headers = {}, body}: ApiRequestOptions = {}
): Promise<T> {
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    Authorization: token,
    ...headers,
  };

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
