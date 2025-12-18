import {Platform} from "react-native";
import * as SecureStore from "expo-secure-store";

export const AUTH_TOKEN_STORAGE_KEY = "hyperhive.authToken";
export const API_BASE_URL_STORAGE_KEY = "hyperhive.apiBaseUrl";

const AUTH_COOKIE_NAME = "Authorization";
const isWebPlatform = Platform.OS === "web";

type JwtPayload = {
  exp?: number | string;
  [key: string]: unknown;
};

const isDocumentAccessible = () =>
  isWebPlatform && typeof document !== "undefined" && typeof document.cookie === "string";

const base64UrlDecode = (value: string): string | null => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const safeValue = `${normalized}${padding}`;

  if (typeof globalThis !== "undefined" && typeof globalThis.atob === "function") {
    try {
      return globalThis.atob(safeValue);
    } catch {
      return null;
    }
  }

  return null;
};

const parseJwtPayload = (token: string): JwtPayload | null => {
  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }
  const decoded = base64UrlDecode(segments[1]);
  if (!decoded) {
    return null;
  }
  try {
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
};

const getTokenExpiryMs = (token: string): number | null => {
  const payload = parseJwtPayload(token);
  if (!payload) {
    return null;
  }
  const expValue = payload.exp;
  if (typeof expValue === "number") {
    return expValue * 1000;
  }
  if (typeof expValue === "string") {
    const parsed = Number(expValue);
    if (!Number.isNaN(parsed)) {
      return parsed * 1000;
    }
  }
  return null;
};

const isTokenExpired = (token: string): boolean => {
  const expiryMs = getTokenExpiryMs(token);
  if (expiryMs === null) {
    return false;
  }
  return Date.now() >= expiryMs;
};

const getCookieValue = (name: string): string | null => {
  if (!isDocumentAccessible()) {
    return null;
  }
  const cookiePairs = document.cookie.split(";");
  for (const pair of cookiePairs) {
    const [rawName, ...rest] = pair.split("=");
    if (!rawName) continue;
    if (rawName.trim() === name) {
      return decodeURIComponent(rest.join("=").trim());
    }
  }
  return null;
};

const getCookieExpiresAttribute = (token: string): string | null => {
  const expiryMs = getTokenExpiryMs(token);
  if (expiryMs === null) {
    return null;
  }
  const expiryDate = new Date(expiryMs);
  if (Number.isNaN(expiryDate.getTime())) {
    return null;
  }
  return `Expires=${expiryDate.toUTCString()}`;
};

const isWebSessionExpired = (token: string): boolean => {
  if (!isWebPlatform) {
    return false;
  }
  if (isTokenExpired(token)) {
    return true;
  }
  if (isDocumentAccessible() && getCookieValue(AUTH_COOKIE_NAME) === null) {
    return true;
  }
  return false;
};

const setAuthCookie = (token: string | null) => {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }

  if (token) {
    const attributes = ["path=/", "SameSite=Lax"];
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      attributes.push("Secure");
    }
    const expiresAttribute = getCookieExpiresAttribute(token);
    if (expiresAttribute) {
      attributes.push(expiresAttribute);
    }
    document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; ${attributes.join(
      "; "
    )}`;
  } else {
    document.cookie = `${AUTH_COOKIE_NAME}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; path=/`;
  }
};

const getWebStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const saveAuthToken = async (token: string) => {
  if (Platform.OS === "web") {
    const storage = getWebStorage();
    try {
      storage?.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } catch (err) {
      console.warn("Failed to persist auth token in local storage", err);
    }
    setAuthCookie(token);
    return;
  }

  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_STORAGE_KEY, token);
  } catch (err) {
    console.warn("Failed to store auth token securely", err);
  }
  setAuthCookie(token);
};

export const saveApiBaseUrl = async (baseUrl: string) => {
  if (Platform.OS === "web") {
    const storage = getWebStorage();
    try {
      storage?.setItem(API_BASE_URL_STORAGE_KEY, baseUrl);
    } catch (err) {
      console.warn("Failed to persist API base URL in local storage", err);
    }
    return;
  }

  try {
    await SecureStore.setItemAsync(API_BASE_URL_STORAGE_KEY, baseUrl);
  } catch (err) {
    console.warn("Failed to store API base URL securely", err);
  }
};


export const loadAuthToken = async (): Promise<string | null> => {
  if (Platform.OS === "web") {
    const storage = getWebStorage();
    const storedToken = storage?.getItem(AUTH_TOKEN_STORAGE_KEY) ?? null;
    if (storedToken && isWebSessionExpired(storedToken)) {
      console.warn("Clearing stored auth token because the web session is stale or expired.");
      try {
        await clearAuthToken();
      } catch (err) {
        console.warn("Failed to clear expired auth token", err);
      }
      return null;
    }
    return storedToken;
  }

  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to load auth token from secure storage", err);
    return null;
  }
};

export const loadApiBaseUrl = async (): Promise<string | null> => {
  if (Platform.OS === "web") {
    const storage = getWebStorage();
    return storage?.getItem(API_BASE_URL_STORAGE_KEY) ?? null;
  }

  try {
    return await SecureStore.getItemAsync(API_BASE_URL_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to load API base URL from secure storage", err);
    return null;
  }
};

export const clearAuthToken = async () => {
  if (Platform.OS === "web") {
    const storage = getWebStorage();
    storage?.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setAuthCookie(null);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear auth token", err);
  }
  setAuthCookie(null);
};

export const clearApiBaseUrl = async () => {
  if (Platform.OS === "web") {
    const storage = getWebStorage();
    storage?.removeItem(API_BASE_URL_STORAGE_KEY);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(API_BASE_URL_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear API base URL", err);
  }
};
