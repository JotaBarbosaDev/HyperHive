import React from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const SIDEBAR_STORAGE_KEY = "hyperhive.sidebar";
export const SIDEBAR_RAIL_WIDTH = 64;
export const clampSidebarWidth = (width: number) => Math.max(240, Math.min(400, width));
export const parseSidebarLayout = (raw: string | null) => {
  try {
    const value = JSON.parse(raw ?? "null");
    return {
      open: typeof value?.open === "boolean" ? value.open : true,
      width: typeof value?.width === "number" && Number.isFinite(value.width) ? clampSidebarWidth(value.width) : 280,
    };
  } catch {
    return { open: true, width: 280 };
  }
};

export function useSidebarLayout() {
  const [layout, setLayout] = React.useState(() => parseSidebarLayout(null));
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = Platform.OS === "web" ? window.localStorage.getItem(SIDEBAR_STORAGE_KEY) : await SecureStore.getItemAsync(SIDEBAR_STORAGE_KEY);
        if (active) setLayout(parseSidebarLayout(raw));
      } catch {
        // Storage may be disabled; navigation remains usable for this session.
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, []);
  React.useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const raw = JSON.stringify(layout);
      try {
        if (Platform.OS === "web") window.localStorage.setItem(SIDEBAR_STORAGE_KEY, raw);
        else SecureStore.setItemAsync(SIDEBAR_STORAGE_KEY, raw).catch(() => {});
      } catch {
        // Browsers can reject storage writes in private or restricted sessions.
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [layout, ready]);
  return { ...layout, setOpen: (open: boolean) => setLayout((prev) => ({ ...prev, open })), setWidth: (width: number) => setLayout((prev) => ({ ...prev, width: clampSidebarWidth(width) })) };
}
