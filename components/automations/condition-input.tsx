import React from "react";
import { Platform, ScrollView, TextInput, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { errorText, getConditionCatalog, type CatalogApp, type ConditionCatalog } from "@/services/automations";
import { applySuggestion, formatValue, lintCondition, suggest, type Suggestion } from "@/utils/condition-assist";
import { subtle } from "./automation-ui";

const field = "border rounded-md text-sm text-typography-900 dark:text-[#E8EBF0] bg-background-0 dark:bg-[#0A1422] border-outline-200 dark:border-[#2A3B52] focus:border-[#147D78] dark:focus:border-[#2DD4BF] ";
const ROW_HEIGHT = Platform.OS === "web" ? 32 : 44;
const CATALOG_MAX_AGE = 30_000;

type Selection = { start: number; end: number };

// Loads what conditions can read; refreshed on focus when older than 30 s so new streams show up.
function useConditionCatalog() {
  const [catalog, setCatalog] = React.useState<ConditionCatalog | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const loadedAt = React.useRef(0);
  const refresh = React.useCallback((force = false) => {
    if (!force && Date.now() - loadedAt.current < CATALOG_MAX_AGE) return;
    loadedAt.current = Date.now();
    getConditionCatalog().then((c) => { setCatalog(c); setError(null); })
      .catch((err) => { loadedAt.current = 0; setError(errorText(err, "Could not load Apps and streams.")); });
  }, []);
  React.useEffect(() => { refresh(true); }, [refresh]);
  return { catalog, error, refresh };
}

type RowItem = Pick<Suggestion, "label" | "detail" | "type" | "value"> & { kind?: Suggestion["kind"] };
// Name on the left, one muted line of context on the right: a description for Apps and comparisons,
// otherwise the type and current value.
const rowInfo = (item: RowItem) => (item.kind === "app" || item.kind === "operator" || item.kind === "instance"
  ? item.detail ?? "" : [item.type, item.value].filter(Boolean).join(" · "));

function Row({ item, active = false, onPress, onHover, role = "menuitem" }:
  { item: RowItem; active?: boolean; onPress: () => void; onHover?: () => void; role?: "menuitem" | "button" }) {
  const info = rowInfo(item);
  return <Pressable accessibilityRole={role} accessibilityState={role === "menuitem" ? { selected: active } : undefined}
    accessibilityLabel={[item.label, info].filter(Boolean).join(", ")}
    onPress={onPress} onHoverIn={onHover}
    className={"flex-row items-center gap-3 px-3 web:cursor-pointer " + (active ? "bg-background-100 dark:bg-[#1A2A40]" : "hover:bg-background-50 dark:hover:bg-[#15233A]")}
    style={{ minHeight: ROW_HEIGHT }}>
    <Text numberOfLines={1} className="flex-1 font-mono text-[13px] text-typography-900 dark:text-[#E8EBF0]">{item.label}</Text>
    {info ? <Text numberOfLines={1} className={subtle + " shrink-0"} style={{ maxWidth: "50%" }}>{info}</Text> : null}
  </Pressable>;
}

const refText = (app: CatalogApp) => `app('${app.name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}')`;
const keyText = (key: string, clash = false) => (clash ? `.streams['${key}']` : /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? `.${key}` : `['${key.replace(/'/g, "\\'")}']`);
const CLASHES = new Set(["health", "connectivity", "health_message", "streams"]);

// Every App with its fields and streams, filterable; tapping a row inserts it at the cursor.
function VariableBrowser({ catalog, onInsert }: { catalog: ConditionCatalog; onInsert: (snippet: string) => void }) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  if (!catalog.apps.length) return <Text className={subtle}>No HH Support Apps yet. Add one in HH Support to use its streams here.</Text>;
  const apps = catalog.apps.map((app) => {
    const rows: (RowItem & { snippet: string })[] = [
      { label: "health", type: "text", value: `'${app.health}'`, snippet: refText(app) + ".health" },
      { label: "connectivity", type: "text", value: `'${app.connectivity}'`, snippet: refText(app) + ".connectivity" },
      ...app.streams.map((s) => ({ label: s.name, type: s.type || "untyped", value: formatValue(s.value, s.unit), snippet: refText(app) + keyText(s.name, CLASHES.has(s.name)) })),
    ];
    return { app, rows: !q || app.name.toLowerCase().includes(q) ? rows : rows.filter((r) => r.label.toLowerCase().includes(q)) };
  }).filter((entry) => entry.rows.length);

  return <Box className="rounded-md border border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1726] overflow-hidden">
    <TextInput accessibilityLabel="Filter Apps and streams" value={query} onChangeText={setQuery} placeholder="Filter Apps and streams" placeholderTextColor="#8A94A8"
      autoCapitalize="none" autoCorrect={false} className="px-3 py-2 text-sm text-typography-900 dark:text-[#E8EBF0] border-b border-outline-100 dark:border-[#1F2D40] web:outline-none" />
    <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
      {apps.length ? apps.map(({ app, rows }) => <Box key={app.id} className="pb-1">
        <Text className="px-3 pt-2 pb-1 text-xs font-semibold text-typography-600 dark:text-[#8A94A8]">{app.name}</Text>
        {rows.map((row) => <Row key={row.label} item={row} role="button" onPress={() => onInsert(row.snippet)} />)}
      </Box>) : <Text className={subtle + " p-3"}>Nothing matches “{query}”.</Text>}
    </ScrollView>
  </Box>;
}

// Condition editor with completions for Apps, instances, streams, comparisons and enum values,
// plus checks for unknown names and type mismatches before the condition is saved.
export function ConditionInput({ value, onChange, showVariables }: { value: string; onChange: (value: string) => void; showVariables: boolean }) {
  const { catalog, error, refresh } = useConditionCatalog();
  const input = React.useRef<TextInput>(null);
  const [selection, setSelection] = React.useState<Selection>({ start: value.length, end: value.length });
  const [forced, setForced] = React.useState<Selection | undefined>();
  // Some platforms report the old cursor right after a programmatic insert; ignore that briefly.
  const placedAt = React.useRef<{ at: Selection; time: number } | null>(null);
  const [focused, setFocused] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const blurTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(blurTimer.current), []);

  const cursor = Math.min(selection.start, value.length);
  const completion = React.useMemo(() => (focused && !dismissed && selection.start === selection.end ? suggest(value, cursor, catalog) : null),
    [focused, dismissed, selection.start, selection.end, value, cursor, catalog]);
  const items = completion?.items ?? [];
  React.useEffect(() => { setActive(0); }, [completion?.from, items.length]);
  const hints = React.useMemo(() => lintCondition(value, catalog), [value, catalog]);

  const place = (text: string, at: number) => {
    onChange(text);
    const next = { start: at, end: at };
    setSelection(next);
    setForced(next);
    placedAt.current = { at: next, time: Date.now() };
    setDismissed(false);
    input.current?.focus();
  };
  const accept = (item: Suggestion) => {
    if (!completion) return;
    const next = applySuggestion(value, completion, item);
    place(next.text, next.cursor);
  };
  const insert = (snippet: string) => {
    const before = value.slice(0, selection.start);
    const pad = before && !/[\s(!]$/.test(before) ? " " : "";
    place(before + pad + snippet + value.slice(selection.end), before.length + pad.length + snippet.length);
  };

  const onKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const key = e.nativeEvent.key;
    if (key === "Escape") { setDismissed(true); return; }
    if (!items.length) return;
    const prevent = () => (e as unknown as { preventDefault?: () => void }).preventDefault?.();
    if (key === "ArrowDown") { prevent(); setActive((i) => (i + 1) % items.length); }
    else if (key === "ArrowUp") { prevent(); setActive((i) => (i - 1 + items.length) % items.length); }
    else if (key === "Enter" || key === "Tab") { prevent(); accept(items[Math.min(active, items.length - 1)]); }
  };

  const open = items.length > 0;
  return <Box className="gap-2">
    <TextInput
      ref={input}
      accessibilityLabel="Run when"
      accessibilityHint="Condition over HH Support data. Type to get suggestions. Leave empty for manual runs only."
      aria-expanded={open}
      value={value}
      selection={forced}
      onChangeText={(text) => {
        // The cursor sits after the changed region; selection events can arrive late or out of order.
        let prefix = 0;
        while (prefix < text.length && prefix < value.length && text[prefix] === value[prefix]) prefix++;
        let suffix = 0;
        while (suffix < text.length - prefix && suffix < value.length - prefix && text[text.length - 1 - suffix] === value[value.length - 1 - suffix]) suffix++;
        const at = text.length - suffix;
        placedAt.current = null;
        setSelection({ start: at, end: at });
        setForced(undefined);
        onChange(text);
        setDismissed(false);
      }}
      onSelectionChange={(e) => {
        const next = e.nativeEvent.selection;
        const placed = placedAt.current;
        if (placed && Date.now() - placed.time < 150 && (next.start !== placed.at.start || next.end !== placed.at.end)) return;
        placedAt.current = null;
        setSelection(next);
        setForced(undefined);
      }}
      onFocus={() => { clearTimeout(blurTimer.current); setFocused(true); refresh(); }}
      // Delayed so a tap on a suggestion lands before the list closes.
      onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 200); }}
      onKeyPress={onKeyPress}
      autoCapitalize="none" autoCorrect={false} spellCheck={false} multiline
      placeholder="Empty: manual runs only. Type to pick an App."
      placeholderTextColor="#8A94A8"
      className={field + "font-mono px-3 py-2 " + (open ? "border-[#147D78] dark:border-[#2DD4BF]" : "")}
      style={{ minHeight: 64, textAlignVertical: "top" }}
    />
    {open ? <Box accessibilityRole="menu" accessibilityLabel="Suggestions"
      className="rounded-md border border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1726] overflow-hidden">
      <ScrollView style={{ maxHeight: ROW_HEIGHT * 8 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
        {items.map((item, at) => <Row key={item.kind + item.label} item={item} active={at === active} onPress={() => accept(item)} onHover={() => setActive(at)} />)}
      </ScrollView>
    </Box> : null}
    {hints.length && !open ? hints.map((hint) => <Text key={hint.message} accessibilityLiveRegion="polite"
      className={"text-xs " + (hint.tone === "warn" ? "text-[#946A18] dark:text-[#F0CC80]" : "text-typography-600 dark:text-[#8A94A8]")}>{hint.message}</Text>) : null}
    {error ? <Text className={subtle}>Suggestions unavailable: {error}</Text> : null}
    {showVariables && catalog ? <VariableBrowser catalog={catalog} onInsert={insert} /> : null}
  </Box>;
}
