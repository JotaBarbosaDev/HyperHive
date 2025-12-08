import {Platform} from "react-native";
import * as SecureStore from "expo-secure-store";

export type ThemePreference = "light" | "dark" | "system";
export const THEME_PREFERENCE_KEY = "hyperhive.themePreference";

const getWebStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const saveThemePreference = async (pref: ThemePreference) => {
  if (Platform.OS === "web") {
    try {
      getWebStorage()?.setItem(THEME_PREFERENCE_KEY, pref);
    } catch (err) {
      console.warn("Failed to persist theme preference", err);
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, pref);
  } catch (err) {
    console.warn("Failed to store theme preference", err);
  }
};

export const loadThemePreference = async (): Promise<ThemePreference | null> => {
  if (Platform.OS === "web") {
    return (getWebStorage()?.getItem(THEME_PREFERENCE_KEY) as ThemePreference | null) ?? null;
  }
  try {
    return (await SecureStore.getItemAsync(THEME_PREFERENCE_KEY)) as ThemePreference | null;
  } catch (err) {
    console.warn("Failed to load theme preference", err);
    return null;
  }
};
