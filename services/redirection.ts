import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {RedirectionHost, RedirectionPayload} from "@/types/redirection";
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

export async function listRedirections(): Promise<RedirectionHost[]> {
  const authToken = await resolveToken();
  return apiFetch<RedirectionHost[]>("/redirection/list", {token: authToken});
}

export async function createRedirection(payload: RedirectionPayload): Promise<RedirectionHost> {
  const authToken = await resolveToken();
  return apiFetch<RedirectionHost>("/redirection/create", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function editRedirection(id: number, payload: RedirectionPayload): Promise<RedirectionHost> {
  const authToken = await resolveToken();
  return apiFetch<RedirectionHost>("/redirection/edit", {
    method: "PUT",
    token: authToken,
    body: {
      ...payload,
      id,
    },
  });
}

export async function deleteRedirection(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/redirection/delete", {
    method: "DELETE",
    token: authToken,
    body: {id},
  });
}

export async function enableRedirection(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/redirection/enable", {
    method: "POST",
    token: authToken,
    body: {id},
  });
}

export async function disableRedirection(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/redirection/disable", {
    method: "POST",
    token: authToken,
    body: {id},
  });
}
