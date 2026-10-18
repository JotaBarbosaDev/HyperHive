import React from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextStyle,
} from "react-native";
import { ChevronDown, ChevronRight, Info, Search } from "lucide-react-native";

import { useOperationsTheme } from "./OperationsTheme";
export { useOperationsTheme } from "./OperationsTheme";

export function OpsText({
  children,
  muted = false,
  mono = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  mono?: boolean;
  style?: TextStyle;
}) {
  const { ops, s } = useOperationsTheme();
  return (
    <Text
      selectable
      style={[
        muted ? s.muted : mono ? s.mono : s.text,
        mono && { fontFamily: ops.mono },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function OpsButton({
  label,
  onPress,
  active,
  disabled,
  icon: Icon,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  icon?: React.ComponentType<any>;
}) {
  const { ops, s } = useOperationsTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        disabled: Boolean(disabled),
        selected: Boolean(active),
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        s.button,
        {
          backgroundColor: active
            ? ops.selected
            : hovered || pressed
              ? ops.raised
              : ops.panel,
          borderColor: active ? ops.accent : ops.line,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      {Icon ? <Icon size={14} color={active ? ops.accent : ops.muted} /> : null}
      <Text
        style={{
          color: active ? ops.accent : ops.text,
          fontSize: 12,
          fontWeight: "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function OpsField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  search,
  standalone = false,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  search?: boolean;
  standalone?: boolean;
  onSubmit?: () => void;
}) {
  const { ops, s } = useOperationsTheme();
  return (
    <View
      style={{
        flexGrow: standalone ? 0 : 1,
        flexBasis: standalone ? "auto" : search ? 240 : 170,
        minWidth: 0,
        gap: 5,
      }}
    >
      <Text style={s.muted}>{label}</Text>
      <View style={{ justifyContent: "center" }}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          placeholder={placeholder}
          maxLength={maxLength}
          placeholderTextColor={ops.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[s.input, search && { paddingLeft: 33 }]}
        />
        {search ? (
          <Search
            size={14}
            color={ops.muted}
            style={{ position: "absolute", left: 10 }}
          />
        ) : null}
      </View>
    </View>
  );
}
export function Tone({ value }: { value: string }) {
  const { ops, s } = useOperationsTheme();
  const state = value.toLowerCase();
  const color = [
    "fresh",
    "running",
    "healthy",
    "ready",
    "supported",
    "info",
    "ok",
    "current",
    "connected",
    "following",
  ].includes(state)
    ? ops.green
    : [
          "error",
          "fatal",
          "failed",
          "offline",
          "unavailable",
          "degraded",
        ].includes(state)
      ? ops.red
      : ["partial", "stale", "warning", "warn", "pending", "starting"].includes(
            state,
          )
        ? ops.amber
        : ops.muted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }}
      />
      <Text style={{ color, fontSize: 11, fontWeight: "500" }}>{value}</Text>
    </View>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children?: React.ReactNode;
  error?: boolean;
}) {
  const { ops, s } = useOperationsTheme();
  if (!children) return null;
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      style={{
        padding: 11,
        borderLeftWidth: 2,
        borderColor: error ? ops.red : ops.accent,
        backgroundColor: error ? ops.errorBg : ops.infoBg,
        flexDirection: "row",
        gap: 9,
      }}
    >
      <Info size={15} color={error ? ops.red : ops.accent} />
      <OpsText
        style={{ flex: 1, color: error ? ops.red : ops.muted, fontSize: 12 }}
      >
        {children}
      </OpsText>
    </View>
  );
}
export function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { ops, s } = useOperationsTheme();
  return (
    <View style={s.panel}>
      <View style={s.panelHead}>
        <Text style={s.title}>{title}</Text>
        {aside}
      </View>
      {children}
    </View>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  const { ops, s } = useOperationsTheme();
  return (
    <View style={{ padding: 32, gap: 5, alignItems: "center" }}>
      <Search size={23} color={ops.muted} />
      <OpsText style={{ fontWeight: "600", marginTop: 7 }}>{title}</OpsText>
      <OpsText muted style={{ textAlign: "center", maxWidth: 500 }}>
        {detail}
      </OpsText>
    </View>
  );
}
export function Stat({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail?: string;
  color?: string;
}) {
  const { ops, s } = useOperationsTheme();
  return (
    <View
      style={{
        flexBasis: 145,
        flexGrow: 1,
        padding: 16,
        gap: 5,
        backgroundColor: ops.panel,
        borderWidth: 1,
        borderColor: ops.line,
        borderRadius: 5,
      }}
    >
      <Text style={s.muted}>{label}</Text>
      <Text
        selectable
        style={{
          fontFamily: ops.mono,
          color: color ?? ops.text,
          fontSize: 25,
          lineHeight: 34,
        }}
      >
        {value}
      </Text>
      {detail ? <Text style={s.muted}>{detail}</Text> : null}
    </View>
  );
}
export function Disclosure({
  title,
  children,
  aside,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { ops, s } = useOperationsTheme();
  const [open, setOpen] = React.useState(defaultOpen);
  React.useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <View style={s.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={s.panelHead}
      >
        <View style={s.row}>
          <Icon size={15} color={ops.muted} />
          <Text style={s.title}>{title}</Text>
        </View>
        {aside}
      </Pressable>
      {open ? <View style={{ padding: 16, gap: 12 }}>{children}</View> : null}
    </View>
  );
}
export function Table({
  headings,
  widths,
  children,
  minWidth = 750,
}: {
  headings: string[];
  widths?: number[];
  children: React.ReactNode;
  minWidth?: number;
}) {
  const { ops, s } = useOperationsTheme();
  return (
    <ScrollView
      horizontal
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View style={{ flex: 1, minWidth }}>
        <View style={[s.tr, { minHeight: 34, backgroundColor: ops.bg }]}>
          {headings.map((h, i) => (
            <Text key={h} style={[s.th, { flex: widths?.[i] ?? 1 }]}>
              {h}
            </Text>
          ))}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}
export function Cell({
  children,
  flex = 1,
  mono = false,
}: {
  children: React.ReactNode;
  flex?: number;
  mono?: boolean;
}) {
  const { ops, s } = useOperationsTheme();
  return (
    <View style={{ flex, minWidth: 0 }}>
      <OpsText mono={mono}>{children}</OpsText>
    </View>
  );
}
export function SectionIntro({
  title,
  detail,
  actions,
}: {
  title: string;
  detail: string;
  actions?: React.ReactNode;
}) {
  const { ops, s } = useOperationsTheme();
  return (
    <View
      style={[
        s.row,
        { justifyContent: "space-between", alignItems: "flex-start" },
      ]}
    >
      <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
        <Text
          accessibilityRole="header"
          style={{ color: ops.text, fontSize: 21, fontWeight: "600" }}
        >
          {title}
        </Text>
        <OpsText muted>{detail}</OpsText>
      </View>
      {actions}
    </View>
  );
}
