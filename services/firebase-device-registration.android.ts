import { firebaseNotifications } from "./firebase-notifications.android";
import { apiFetch, getAuthToken } from "./api-client";
import { getApiBaseUrl } from "@/config/apiConfig";

// Last backend, session and FCM token registered, so foreground refreshes skip repeat calls.
let lastRegistered: string | null = null;

// Registers this device for real HyperHive notifications. FCM can rotate tokens, so callers
// run this after login, on startup and whenever the app returns to the foreground.
export async function registerFirebaseDevice(): Promise<boolean> {
  const native = firebaseNotifications;
  if (!native) return false;
  const status = native.getStatus();
  if (!status.enabled || !status.projectId || status.restartRequired || !status.permissionGranted) return false;
  const session = getAuthToken();
  const backend = getApiBaseUrl();
  if (!session || !backend) return false;
  const token = await native.getToken();
  const key = `${backend}|${session}|${token}`;
  if (key === lastRegistered) return true;
  await apiFetch("/notification/firebase/devices", { method: "POST", token: session, body: { token, projectId: status.projectId }, reportResult: false });
  lastRegistered = key;
  return true;
}

// Stops real notifications to this device, e.g. before disabling Firebase or logging out.
export async function unregisterFirebaseDevice(): Promise<void> {
  const native = firebaseNotifications;
  const session = getAuthToken();
  lastRegistered = null;
  if (!native || !session || !getApiBaseUrl() || !native.getStatus().enabled) return;
  const token = await native.getToken();
  await apiFetch("/notification/firebase/devices/unregister", { method: "POST", token: session, body: { token }, reportResult: false });
}
