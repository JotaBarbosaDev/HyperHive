import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import { apiFetch, setAuthToken, triggerUnauthorized } from "@/services/api-client";
import { loadApiBaseUrl, loadAuthToken } from "@/services/auth-storage";
import { Note, NotePayload } from "@/types/notes";

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

export async function listNotes(): Promise<Note[]> {
  const authToken = await resolveToken();
  return apiFetch<Note[]>("/notes/", { token: authToken });
}

export async function getNote(id: number): Promise<Note> {
  const authToken = await resolveToken();
  return apiFetch<Note>(`/notes/${id}`, { token: authToken });
}

export async function createNote(payload: NotePayload): Promise<Note> {
  const authToken = await resolveToken();
  return apiFetch<Note>("/notes/", {
    method: "POST",
    token: authToken,
    body: payload,
  });
}

export async function updateNote(id: number, payload: NotePayload): Promise<Note> {
  const authToken = await resolveToken();
  return apiFetch<Note>(`/notes/${id}`, {
    method: "PUT",
    token: authToken,
    body: payload,
  });
}
