import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import { AccessList, AccessListPayload } from "@/types/access-list";
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

export async function listAccessLists(): Promise<AccessList[]> {
  const authToken = await resolveToken();
  return apiFetch<AccessList[]>("/access-lists/list", { token: authToken });
}

export async function createAccessList(payload: AccessListPayload): Promise<AccessList> {
  const authToken = await resolveToken();
  return apiFetch<AccessList>("/access-lists/create", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function editAccessList(id: number, payload: AccessListPayload): Promise<AccessList> {
  const authToken = await resolveToken();
  return apiFetch<AccessList>("/access-lists/edit", {
    method: "PUT",
    token: authToken,
    body: {
      ...payload,
      id,
    },
  });
}

export async function deleteAccessList(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/access-lists/delete", {
    method: "DELETE",
    token: authToken,
    body: { id },
  });
}
