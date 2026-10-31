import { create } from "zustand";
import type { SupportApp, SupportTab } from "@/types/support";

type SupportNavigation = {
  tabs: SupportTab[];
  apps: SupportApp[];
  selectedId: string | null;
  tabId: string | null;
  connection: string;
  dirty: boolean;
};
const initial: SupportNavigation = { tabs: [], apps: [], selectedId: null, tabId: null, connection: "disconnected", dirty: false };
// Support page feeds this from its websocket; the sidebar polls it on other pages.
export const useSupportNavigation = create<SupportNavigation>(() => initial);
export const resetSupportNavigation = () => useSupportNavigation.setState(initial);
export function selectSupportApp(tabId: string | null, selectedId: string | null) {
  if (useSupportNavigation.getState().dirty) return false;
  useSupportNavigation.setState({ tabId, selectedId });
  return true;
}
