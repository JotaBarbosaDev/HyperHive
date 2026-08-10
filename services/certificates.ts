import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import {
  Certificate,
  CreateLetsEncryptPayload,
  CreateManualCertificatePayload,
  CreateManualCertificateResponse,
} from "@/types/certificate";
import type { DocumentPickerAsset } from "expo-document-picker";
import { Platform } from "react-native";
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

export async function listCertificates(): Promise<Certificate[]> {
  const authToken = await resolveToken();
  return apiFetch<Certificate[]>("/certs/list", { token: authToken });
}

export async function createLetsEncryptCertificate(payload: CreateLetsEncryptPayload): Promise<Certificate> {
  const authToken = await resolveToken();
  return apiFetch<Certificate>("/certs/create-lets-encrypt", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

const appendDocumentAsset = async (
  formData: FormData,
  field: string,
  asset: DocumentPickerAsset
) => {
  if (Platform.OS === "web") {
    if (asset.file) {
      formData.append(field, asset.file);
      return;
    }

    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error(`Unable to read ${asset.name || "selected file"}.`);
    }
    const blob = await response.blob();
    formData.append(field, blob, asset.name || "certificate.pem");
    return;
  }

  formData.append(
    field,
    {
      uri: asset.uri,
      name: asset.name || "certificate.pem",
      type: asset.mimeType || "application/octet-stream",
    } as unknown as Blob
  );
};

export async function createManualCertificate(
  payload: CreateManualCertificatePayload
): Promise<CreateManualCertificateResponse> {
  const token = await resolveToken();
  const formData = new FormData();
  formData.append("name", payload.name);
  await appendDocumentAsset(formData, "certificate", payload.certificate);
  await appendDocumentAsset(formData, "certificate_key", payload.certificateKey);
  if (payload.intermediateCertificate) {
    await appendDocumentAsset(formData, "intermediate_certificate", payload.intermediateCertificate);
  }

  return apiFetch<CreateManualCertificateResponse>("/certs/create", {
    method: "POST",
    token,
    body: formData,
  });
}

export async function downloadCertificate(id: number): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>("/certs/download", {
    method: "POST",
    token: authToken,
    body: { id },
  });
}

export async function renewCertificate(id: number): Promise<unknown> {
  const authToken = await resolveToken();
  return apiFetch<unknown>("/certs/renew", {
    method: "POST",
    token: authToken,
    body: { id },
  });
}

export async function deleteCertificate(id: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>("/certs/delete", {
    method: "DELETE",
    token: authToken,
    body: { id },
  });
}

export type DnsProvider = {
  id: string;
  name: string;
  credentials?: string;
};

export async function listDnsProviders(): Promise<DnsProvider[]> {
  const authToken = await resolveToken();
  return apiFetch<DnsProvider[]>("/certs/dns-providers", { token: authToken });
}
