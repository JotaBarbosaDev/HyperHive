import { Platform, StyleSheet } from "react-native";
import React from "react";

// Match the app's shared page, card, outline and status colors.
export const operationsPalettes = {
  dark: {
    bg: "#070D19",
    panel: "#0E1524",
    raised: "#1A2332",
    line: "#2A3B52",
    text: "#E8EBF0",
    muted: "#8A94A8",
    accent: "#5EEAD4",
    selected: "#122C30",
    green: "#6EE7B7",
    amber: "#FCD34D",
    red: "#FCA5A5",
    errorBg: "#2A1212",
    infoBg: "#12263F",
    chart: ["#38BDF8", "#5EEAD4", "#FBBF24", "#C4B5FD", "#FDA4AF", "#A5F3FC"],
  },
  light: {
    bg: "#F6F6F6",
    panel: "#FFFFFF",
    raised: "#F2F1F1",
    line: "#E6E6E6",
    text: "#262627",
    muted: "#737373",
    accent: "#0F766E",
    selected: "#E6F5F0",
    green: "#047857",
    amber: "#92400E",
    red: "#B91C1C",
    errorBg: "#FEF2F2",
    infoBg: "#EFF6FF",
    chart: ["#0284C7", "#059669", "#B45309", "#7C3AED", "#E11D48", "#0891B2"],
  },
};
function createTheme(mode: "light" | "dark") {
  const ops = {
    ...operationsPalettes[mode],
    mono: Platform.OS === "ios" ? "Menlo" : "monospace",
  };
  const s = StyleSheet.create({
    stack: { gap: 18 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      maxWidth: "100%",
    },
    panel: {
      backgroundColor: ops.panel,
      borderWidth: 1,
      borderColor: ops.line,
      borderRadius: 6,
      overflow: "hidden",
    },
    panelHead: {
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderColor: ops.line,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    title: { color: ops.text, fontSize: 14, fontWeight: "600" },
    text: { color: ops.text, fontSize: 13, lineHeight: 20 },
    muted: { color: ops.muted, fontSize: 12, lineHeight: 19 },
    mono: {
      fontFamily: ops.mono,
      fontSize: 12,
      color: ops.text,
      lineHeight: 20,
    },
    button: {
      minHeight: 34,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: ops.line,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    input: {
      backgroundColor: ops.bg,
      color: ops.text,
      borderWidth: 1,
      borderColor: ops.line,
      borderRadius: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      minHeight: 36,
      fontSize: 12,
      fontFamily: ops.mono,
    },
    th: {
      color: ops.muted,
      fontSize: 10,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },
    tr: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderColor: ops.line,
      paddingHorizontal: 14,
      minHeight: 48,
      gap: 14,
    },
  });
  return { ops, s };
}
const themes = { light: createTheme("light"), dark: createTheme("dark") };
type OperationsMode = "light" | "dark";
const OperationsThemeContext = React.createContext<OperationsMode>("dark");
export function OperationsThemeProvider({
  mode,
  children,
}: {
  mode: OperationsMode;
  children: React.ReactNode;
}) {
  return React.createElement(
    OperationsThemeContext.Provider,
    { value: mode },
    children,
  );
}
export function operationsTheme(mode: OperationsMode) {
  return themes[mode];
}
export function useOperationsTheme() {
  return themes[React.useContext(OperationsThemeContext)];
}
