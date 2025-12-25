import { getApiBaseUrl } from "@/config/apiConfig";
import { apiFetch, getAuthToken } from "@/services/api-client";

type NewSlaveCountPayload = {
  newSlaveCount?: number | string;
  new_slave_count?: number | string;
};

const parseCount = (payload: unknown): number | null => {
  if (payload === null || payload === undefined) {
    return null;
  }
  if (typeof payload === "number") {
    return Number.isFinite(payload) ? payload : null;
  }
  if (typeof payload === "string") {
    const parsed = Number(payload);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof payload === "object") {
    const data = payload as NewSlaveCountPayload;
    const raw = data.newSlaveCount ?? data.new_slave_count;
    return parseCount(raw);
  }
  return null;
};

export async function getNewSlaveCount(): Promise<number | null> {
  const token = getAuthToken();
  const baseUrl = getApiBaseUrl();
  if (!token || !baseUrl) {
    return null;
  }
  const data = await apiFetch<unknown>("/new-slave-count", { token });
  const count = parseCount(data);
  if (count === null) {
    return null;
  }
  return Math.max(0, Math.floor(count));
}
