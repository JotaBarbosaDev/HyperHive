import {Platform} from "react-native";
import * as SecureStore from "expo-secure-store";

export const AUTH_TOKEN_STORAGE_KEY = "hyperhive.authToken";
export const API_BASE_URL_STORAGE_KEY = "hyperhive.apiBaseUrl";

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
    return;
  }

  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_STORAGE_KEY, token);
  } catch (err) {
    console.warn("Failed to store auth token securely", err);
  }
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
    return storage?.getItem(AUTH_TOKEN_STORAGE_KEY) ?? null;
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
    return;
  }

  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear auth token", err);
  }
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
