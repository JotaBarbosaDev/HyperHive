import { Platform } from "react-native";
import { create } from "zustand";
import type { Automation } from "@/services/automations";

type AutomationNavigation = {
  automations: Automation[];
  loaded: boolean;
  selectedId: string | null;
  // Unsaved edits per editor part ("config", "code") of the open automation.
  dirty: Record<string, boolean>;
};
const initial: AutomationNavigation = { automations: [], loaded: false, selectedId: null, dirty: {} };
// The Automations page feeds this from its poll; the sidebar polls it on other pages.
export const useAutomationNavigation = create<AutomationNavigation>(() => initial);

export const isAutomationDirty = () => Object.values(useAutomationNavigation.getState().dirty).some(Boolean);
export const setAutomationDirty = (part: string, value: boolean) => {
  if (!!useAutomationNavigation.getState().dirty[part] === value) return;
  useAutomationNavigation.setState((s) => ({ dirty: { ...s.dirty, [part]: value } }));
};

// Switching automations or leaving the page drops unsaved edits, so ask first. Editing is web-only.
export function confirmDiscardAutomationChanges() {
  if (!isAutomationDirty()) return true;
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  if (!window.confirm("This automation has unsaved changes. Discard them?")) return false;
  useAutomationNavigation.setState({ dirty: {} });
  return true;
}

export function selectAutomation(id: string | null) {
  if (useAutomationNavigation.getState().selectedId === id) return true;
  if (!confirmDiscardAutomationChanges()) return false;
  useAutomationNavigation.setState({ selectedId: id, dirty: {} });
  return true;
}
