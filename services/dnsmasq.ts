import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import {
  DnsAliasEntry,
  DnsAliasExistsResponse,
  DnsAliasListResponse,
  DnsAliasPayload,
} from "@/types/dns";
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

const buildAliasQuery = (alias: string, ip: string) => {
  const params = new URLSearchParams();
  params.set("alias", alias);
  params.set("ip", ip);
  return params.toString();
};

export async function listDnsAliases(): Promise<DnsAliasEntry[]> {
  const authToken = await resolveToken();
  const response = await apiFetch<DnsAliasListResponse>("/dnsmasq/alias/all", {
    token: authToken,
  });
  if (response && Array.isArray(response.aliases)) {
    return response.aliases;
  }
  return [];
}

export async function checkDnsAliasExists(payload: DnsAliasPayload): Promise<boolean> {
  const authToken = await resolveToken();
  const query = buildAliasQuery(payload.alias, payload.ip);
  const response = await apiFetch<DnsAliasExistsResponse>(`/dnsmasq/alias/get?${query}`, {
    token: authToken,
  });
  return Boolean(response?.exists);
}

export async function addDnsAlias(payload: DnsAliasPayload): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/dnsmasq/alias/add", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function removeDnsAlias(payload: DnsAliasPayload): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/dnsmasq/alias/remove", {
    method: "DELETE",
    token: authToken,
    body: payload,
  });
}
