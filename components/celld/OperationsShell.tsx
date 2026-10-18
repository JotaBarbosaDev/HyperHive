import React from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  useWindowDimensions,
} from "react-native";
import {
  Activity,
  Box as Cube,
  ChartNoAxesCombined,
  ChevronRight,
  FileText,
  GitBranch,
  LayoutDashboard,
  Radio,
  Server,
  X,
} from "lucide-react-native";
import { Modal, ModalBackdrop, ModalContent } from "@/components/ui/modal";
import type { CelldDetailTab } from "@/types/celld";
import { OpsText, Tone } from "./OperationsUI";
import { useAppTheme } from "@/hooks/useAppTheme";
import { operationsTheme, OperationsThemeProvider } from "./OperationsTheme";
const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "workloads", label: "Workloads", icon: Cube },
  { id: "metrics", label: "Metrics", icon: ChartNoAxesCombined },
  { id: "logs", label: "Logs", icon: FileText },
  { id: "events", label: "Events", icon: Radio },
  { id: "trace", label: "Traces", icon: GitBranch },
  { id: "deployment", label: "Deployment", icon: Cube },
];
export function OperationsShell({
  name,
  fleetId,
  status,
  tab,
  onTab,
  onClose,
  historical,
  children,
}: {
  name: string;
  fleetId: string;
  status?: string;
  tab: string;
  onTab: (tab: CelldDetailTab) => void;
  onClose: () => void;
  historical?: boolean;
  children: React.ReactNode;
}) {
  const { resolvedMode } = useAppTheme();
  const mode = resolvedMode === "dark" ? "dark" : "light";
  const { ops, s } = operationsTheme(mode);
  const { width, height } = useWindowDimensions();
  const wide = width >= 1000;
  const compact = width < 600;
  return (
    <Modal isOpen onClose={onClose} size="full">
      <ModalBackdrop />
      <ModalContent
        className="p-0 rounded-lg"
        style={{
          width: compact ? width : width - 48,
          maxWidth: 1540,
          height: compact ? height : height - 48,
          maxHeight: height,
          padding: 0,
          borderColor: ops.line,
          backgroundColor: ops.bg,
        }}
      >
        <OperationsThemeProvider mode={mode}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: compact ? 14 : 22,
              minHeight: 58,
              borderBottomWidth: 1,
              borderColor: ops.line,
              backgroundColor: ops.panel,
            }}
          >
            <Activity size={20} color={ops.accent} />
            <Text style={{ color: ops.text, fontSize: 14, fontWeight: "700" }}>
              celld
            </Text>
            {!compact ? (
              <>
                <ChevronRight size={14} color={ops.muted} />
                <OpsText muted>
                  {historical ? "Retained history" : "Fleet workspace"}
                </OpsText>
              </>
            ) : null}
            <ChevronRight size={14} color={ops.muted} />
            <Text
              numberOfLines={1}
              style={{
                color: ops.text,
                fontSize: 14,
                fontWeight: "600",
                flex: 1,
              }}
            >
              {name}
            </Text>
            {status && !compact ? <Tone value={status} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                historical ? "Close history" : "Close details"
              }
              onPress={onClose}
              style={({ hovered, pressed }: any) => ({
                padding: 10,
                borderRadius: 4,
                backgroundColor: hovered || pressed ? ops.raised : undefined,
              })}
            >
              <X size={19} color={ops.muted} />
            </Pressable>
          </View>
          <View
            style={{
              flex: 1,
              minHeight: 0,
              flexDirection: wide ? "row" : "column",
            }}
          >
            <View
              style={{
                width: wide ? 190 : undefined,
                backgroundColor: ops.panel,
                borderRightWidth: wide ? 1 : 0,
                borderBottomWidth: wide ? 0 : 1,
                borderColor: ops.line,
              }}
            >
              {wide ? (
                <View style={{ padding: 20, paddingBottom: 22, gap: 9 }}>
                  <View style={s.row}>
                    <Server size={15} color={ops.accent} />
                    <OpsText style={{ fontWeight: "600" }}>
                      {historical ? "Historical fleet" : "Fleet resources"}
                    </OpsText>
                  </View>
                  <Text
                    selectable
                    numberOfLines={1}
                    style={[s.mono, { fontSize: 10, color: ops.muted }]}
                  >
                    {fleetId}
                  </Text>
                </View>
              ) : null}
              <ScrollView
                horizontal={!wide}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ padding: wide ? 10 : 7, gap: 4 }}
              >
                {tabs
                  .filter((t) => !historical || t.id !== "deployment")
                  .map(({ id, label, icon: Icon }) => (
                    <Pressable
                      key={id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: tab === id }}
                      accessibilityLabel={label}
                      onPress={() => onTab(id as CelldDetailTab)}
                      style={({ hovered, pressed }: any) => ({
                        flexDirection: "row",
                        gap: 11,
                        alignItems: "center",
                        paddingVertical: 12,
                        paddingHorizontal: 13,
                        borderRadius: 4,
                        backgroundColor:
                          tab === id
                            ? ops.selected
                            : hovered || pressed
                              ? ops.raised
                              : undefined,
                        borderLeftWidth: wide ? 2 : 0,
                        borderLeftColor:
                          tab === id ? ops.accent : "transparent",
                      })}
                    >
                      <Icon
                        size={16}
                        color={tab === id ? ops.accent : ops.muted}
                      />
                      <Text
                        style={{
                          color: tab === id ? ops.accent : ops.muted,
                          fontSize: 13,
                          fontWeight: tab === id ? "600" : "400",
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
              {wide ? (
                <View style={{ marginTop: "auto", padding: 20, gap: 8 }}>
                  <OpsText muted style={{ fontSize: 10, letterSpacing: 1 }}>
                    OBSERVABILITY
                  </OpsText>
                  <OpsText muted>
                    Resource samples ~5s{`\n`}Logs stream live{`\n`}History up
                    to 7 days
                  </OpsText>
                </View>
              ) : null}
            </View>
            <ScrollView
              key={tab}
              style={{ flex: 1, minWidth: 0 }}
              contentContainerStyle={{
                padding: compact ? 12 : 24,
                paddingBottom: 32,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </View>
          <View
            style={{
              paddingHorizontal: 18,
              paddingVertical: 8,
              backgroundColor: ops.panel,
              borderTopWidth: 1,
              borderColor: ops.line,
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <OpsText muted style={{ fontSize: 10 }}>
              {historical ? "READ-ONLY HISTORY" : "FLEET OBSERVABILITY"}
            </OpsText>
            <OpsText muted style={{ fontSize: 10 }}>
              Times shown in your local timezone
            </OpsText>
          </View>
        </OperationsThemeProvider>
      </ModalContent>
    </Modal>
  );
}
