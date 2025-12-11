import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {StreamHost, StreamPayload} from "@/types/stream";
import {apiFetch, setAuthToken, triggerUnauthorized} from "./api-client";
import {loadApiBaseUrl, loadAuthToken} from "./auth-storage";

const ensureApiBaseUrl = async () => {
  let baseUrl = getApiBaseUrl();
  if (baseUrl) {
    return baseUrl;
  }
  const storedBaseUrl = await loadApiBaseUrl();
  if (storedBaseUrl) {
    baseUrl = setApiBaseUrl(storedBaseUrl) ?? null;
  }
  if (!baseUrl) {
    throw new Error("Base domain/API not configured. Sign in again.");
  }
  return baseUrl;
};

const resolveToken = async () => {
  await ensureApiBaseUrl();
  const storedToken = await loadAuthToken();
  if (!storedToken) {
    setAuthToken(null);
    triggerUnauthorized();
    throw new Error("Invalid authentication token.");
  }
  setAuthToken(storedToken);
  return storedToken;
};

export async function listStreams(): Promise<StreamHost[]> {
  const authToken = await resolveToken();
  return apiFetch<StreamHost[]>("/stream/list", {token: authToken});
}

export async function createStream(payload: StreamPayload): Promise<StreamHost> {
  const authToken = await resolveToken();
  return apiFetch<StreamHost>("/stream/create", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function editStream(id: number, payload: StreamPayload): Promise<StreamHost> {
  const authToken = await resolveToken();
  return apiFetch<StreamHost>("/stream/edit", {
    method: "POST",
    token: authToken,
    body: {
      ...payload,
      id,
    },
  });
}

export async function deleteStream(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/stream/delete", {
    method: "DELETE",
    token: authToken,
    body: {id},
  });
}

export async function enableStream(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/stream/enable", {
    method: "POST",
    token: authToken,
    body: {id},
  });
}

export async function disableStream(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/stream/disable", {
    method: "POST",
    token: authToken,
    body: {id},
  });
}
