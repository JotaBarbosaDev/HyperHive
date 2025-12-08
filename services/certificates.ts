import {getApiBaseUrl, setApiBaseUrl} from "@/config/apiConfig";
import {Certificate, CreateLetsEncryptPayload} from "@/types/certificate";
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

export async function listCertificates(): Promise<Certificate[]> {
  const authToken = await resolveToken();
  return apiFetch<Certificate[]>("/certs/list", {token: authToken});
}

export async function createLetsEncryptCertificate(payload: CreateLetsEncryptPayload): Promise<Certificate> {
  const authToken = await resolveToken();
  return apiFetch<Certificate>("/certs/create-lets-encrypt", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function downloadCertificate(id: number): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>("/certs/download", {
    method: "POST",
    token: authToken,
    body: {id},
  });
}

export async function renewCertificate(id: number): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>("/certs/renew", {
    method: "POST",
    token: authToken,
    body: {id},
  });
}

export async function deleteCertificate(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/certs/delete", {
    method: "DELETE",
    token: authToken,
    body: {id},
  });
}
