import {Platform} from "react-native";
import * as SecureStore from "expo-secure-store";

export const AUTH_TOKEN_STORAGE_KEY = "hyperhive.authToken";

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
