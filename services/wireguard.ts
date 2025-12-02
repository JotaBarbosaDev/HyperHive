import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {CreateWireguardPeerInput, WireguardListResponse, WireguardPeer, WireguardPeerId} from "@/types/wireguard";
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
    throw new Error("Domínio/API base não configurado. Inicia sessão novamente.");
  }
  return baseUrl;
};

const resolveToken = async () => {
  await ensureApiBaseUrl();
  const storedToken = await loadAuthToken();
  if (!storedToken) {
    setAuthToken(null);
    triggerUnauthorized();
    throw new Error("Token de autenticação inválida.");
  }
  setAuthToken(storedToken);
  return storedToken;
};

export async function listWireguardPeers(): Promise<WireguardPeer[]> {
  const authToken = await resolveToken();
  const response = await apiFetch<WireguardListResponse>("/wireguard/", {
    token: authToken,
  });
  return response?.peers ?? [];
}

export async function createWireguardVpn(): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/wireguard/createvpn", {
    method: "POST",
    token: authToken,
  });
}

export async function createWireguardPeer(input: CreateWireguardPeerInput): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/wireguard/newPeer", {
    method: "POST",
    token: authToken,
    body: input,
  });
}

export async function deleteWireguardPeer(id: WireguardPeerId): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>(`/wireguard/${id}`, {
    method: "DELETE",
    token: authToken,
  });
}
