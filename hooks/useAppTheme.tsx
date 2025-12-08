import React from "react";
import {ColorSchemeName} from "react-native";
import {ThemePreference} from "@/services/theme-preference";

export type AppThemeContextValue = {
  preference: ThemePreference;
  resolvedMode: Exclude<ColorSchemeName, null>;
  setPreference: (pref: ThemePreference) => void;
};

const AppThemeContext = React.createContext<AppThemeContextValue | undefined>(undefined);

export function AppThemeProvider({
  children,
  preference,
  resolvedMode,
  setPreference,
}: {
  children: React.ReactNode;
  preference: ThemePreference;
  resolvedMode: Exclude<ColorSchemeName, null>;
  setPreference: (pref: ThemePreference) => void;
}) {
  const value = React.useMemo(
    () => ({preference, resolvedMode, setPreference}),
    [preference, resolvedMode, setPreference]
  );
  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = React.useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used inside AppThemeProvider");
  }
  return ctx;
}
