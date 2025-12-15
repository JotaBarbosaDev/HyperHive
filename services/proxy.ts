import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import { ProxyHost, ProxyPayload } from "@/types/proxy";
import { apiFetch, setAuthToken, triggerUnauthorized } from "./api-client";
import { loadApiBaseUrl, loadAuthToken } from "./auth-storage";

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

export async function listProxyHosts(): Promise<ProxyHost[]> {
  const authToken = await resolveToken();
  return apiFetch<ProxyHost[]>("/proxy/list", { token: authToken });
}

export async function createProxyHost(payload: ProxyPayload): Promise<ProxyHost> {
  const authToken = await resolveToken();
  return apiFetch<ProxyHost>("/proxy/create", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function editProxyHost(id: number, payload: ProxyPayload): Promise<ProxyHost> {
  const authToken = await resolveToken();
  return apiFetch<ProxyHost>("/proxy/edit", {
    method: "PUT",
    token: authToken,
    body: {
      ...payload,
      id,
    },
  });
}

export async function deleteProxyHost(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/proxy/delete", {
    method: "DELETE",
    token: authToken,
    body: { id },
  });
}

export async function enableProxyHost(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/proxy/enable", {
    method: "POST",
    token: authToken,
    body: { id },
  });
}

export async function disableProxyHost(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/proxy/disable", {
    method: "POST",
    token: authToken,
    body: { id },
  });
}

export async function setupFrontEnd(payload: { domain: string; certificate_id: number }): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/proxy/setupFrontEnd", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}
