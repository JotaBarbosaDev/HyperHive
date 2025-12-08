import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {NotFoundHost, NotFoundHostPayload} from "@/types/nginx";
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

export async function listNotFoundHosts(): Promise<NotFoundHost[]> {
  const authToken = await resolveToken();
  return apiFetch<NotFoundHost[]>("/404/list", {token: authToken});
}

export async function createNotFoundHost(payload: NotFoundHostPayload): Promise<NotFoundHost> {
  const authToken = await resolveToken();
  return apiFetch<NotFoundHost>("/404/create", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function updateNotFoundHost(id: number, payload: NotFoundHostPayload): Promise<NotFoundHost> {
  const authToken = await resolveToken();
  return apiFetch<NotFoundHost>("/404/edit", {
    method: "PUT",
    token: authToken,
    body: {
      id,
      ...payload,
    },
  });
}

export async function deleteNotFoundHost(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/404/delete", {
    method: "DELETE",
    token: authToken,
    body: {id},
  });
}

export async function enableNotFoundHost(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/404/enable", {
    method: "POST",
    token: authToken,
    body: {id},
  });
}

export async function disableNotFoundHost(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/404/disable", {
    method: "POST",
    token: authToken,
    body: {id},
  });
}
