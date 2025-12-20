import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {SpaAllowResponse, SpaPort} from "@/types/spa";
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

export async function listSpaPorts(): Promise<SpaPort[]> {
  const authToken = await resolveToken();
  const response = await apiFetch<{spa_ports?: SpaPort[]}>("/spa", {token: authToken});
  if (response && Array.isArray(response.spa_ports)) {
    return response.spa_ports;
  }
  return [];
}

export async function createSpaPort(payload: {port: number; password: string}) {
  const authToken = await resolveToken();
  return apiFetch<void>("/spa", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function deleteSpaPort(port: number) {
  const authToken = await resolveToken();
  const encodedPort = encodeURIComponent(String(port));
  return apiFetch<void>(`/spa/${encodedPort}`, {
    method: "DELETE",
    token: authToken,
  });
}

export async function getSpaAllow(port: number): Promise<SpaAllowResponse> {
  const authToken = await resolveToken();
  const encodedPort = encodeURIComponent(String(port));
  return apiFetch<SpaAllowResponse>(`/spa/allow/${encodedPort}`, {
    token: authToken,
  });
}
