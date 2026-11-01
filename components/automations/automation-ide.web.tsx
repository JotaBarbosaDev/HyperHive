import React from "react";
import { ScrollView, TextInput } from "react-native";
import Editor, { loader, type Monaco, type OnMount } from "@monaco-editor/react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { FilePlus, Pencil, Trash2 } from "lucide-react-native";
import { Action, Failure, ink, muted, surface } from "@/components/support/support-ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  deleteAutomationFile, errorText, getAutomationPackage, getAutomationSdkTypes, installAutomationPackage,
  listAutomationFiles, readAutomationFile, renameAutomationFile, updateAutomationPackage, writeAutomationFile, type AutomationFile,
} from "@/services/automations";
import { setAutomationDirty } from "@/hooks/useAutomationNavigation";
import { ConfirmDialog, subtle } from "./automation-ui";
import type { AutomationIdeProps } from "./automation-ide";

// Monaco's AMD build is served from the CDN at the same version as the npm dependency,
// so Metro never has to bundle monaco-editor and its workers.
const MONACO_VERSION = "0.57.0";
loader.config({ paths: { vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs` } });

const PACKAGE_TAB = "__package__";
const EDITOR_HEIGHT = 480;

const languageFor = (path: string) => {
  if (/\.(ts|mts|cts)$/.test(path)) return "typescript";
  if (/\.(js|mjs|cjs)$/.test(path)) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  return "plaintext";
};

// Editor themes share the app's surfaces so the IDE does not look pasted in.
const defineThemes = (monaco: Monaco) => {
  monaco.editor.defineTheme("hh-dark", { base: "vs-dark", inherit: true, rules: [], colors: {
    "editor.background": "#0B1422", "editorGutter.background": "#0B1422", "editor.lineHighlightBackground": "#132036",
    "editorLineNumber.foreground": "#4A5A72", "editorLineNumber.activeForeground": "#B4BECD",
  } });
  monaco.editor.defineTheme("hh-light", { base: "vs", inherit: true, rules: [], colors: {
    "editor.background": "#FFFFFF", "editor.lineHighlightBackground": "#F1F5F9",
    "editorLineNumber.foreground": "#94A3B8", "editorLineNumber.activeForeground": "#334155",
  } });
};

// Monaco >= 0.55 moved the TS API to a top-level `typescript` namespace; older builds use languages.typescript.
const tsApi = (monaco: Monaco) => ((monaco as any).typescript ?? (monaco.languages as any).typescript) as any;

let sdkLoaded = false;
const configureTypescript = async (monaco: Monaco) => {
  const ts = tsApi(monaco);
  if (!ts) return;
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    allowJs: true, checkJs: false, strict: false, allowNonTsExtensions: true, allowImportingTsExtensions: true, noEmit: true,
    lib: ["es2022"],
  };
  ts.typescriptDefaults.setCompilerOptions(options);
  ts.javascriptDefaults.setCompilerOptions(options);
  if (sdkLoaded) return;
  try {
    const dts = await getAutomationSdkTypes();
    if (typeof dts === "string" && dts) {
      ts.typescriptDefaults.addExtraLib(dts, "file:///hh/hh.d.ts");
      ts.javascriptDefaults.addExtraLib(dts, "file:///hh/hh.d.ts");
      sdkLoaded = true;
    }
  } catch (err) {
    console.warn("Automations: could not load hh.d.ts", err);
  }
};

export function AutomationIde({ automationId, onShowRun, fill = false }: AutomationIdeProps) {
  // Follow the app's resolved theme (user preference or system), not the web stub that always says light.
  const { resolvedMode } = useAppTheme();
  const [files, setFiles] = React.useState<AutomationFile[] | null>(null);
  const [listError, setListError] = React.useState<string | null>(null);
  const [active, setActive] = React.useState<string | null>(null);
  const [contents, setContents] = React.useState<Record<string, string>>({});
  const [saved, setSaved] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");
  const [newPath, setNewPath] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<{ from: string; to: string } | null>(null);
  const [installing, setInstalling] = React.useState(false);
  const [editorHeight, setEditorHeight] = React.useState(EDITOR_HEIGHT);
  const state = React.useRef({ active, contents });
  state.current = { active, contents };

  const loadFiles = React.useCallback(async () => {
    try {
      const res = await listAutomationFiles(automationId);
      const list = (res.files ?? []).slice().sort((a, b) => a.path.localeCompare(b.path));
      setFiles(list); setListError(null);
      return list;
    } catch (err) {
      setListError(errorText(err, "Could not list files."));
      return null;
    }
  }, [automationId]);

  const open = React.useCallback(async (path: string) => {
    setActive(path); setError(null); setMessage("");
    if (state.current.contents[path] !== undefined) return;
    try {
      const content = path === PACKAGE_TAB ? (await getAutomationPackage()).content : (await readAutomationFile(automationId, path)).content;
      setContents((c) => ({ ...c, [path]: content }));
      setSaved((s) => ({ ...s, [path]: content }));
    } catch (err) {
      setError(errorText(err, `Could not open ${path === PACKAGE_TAB ? "package.json" : path}.`));
    }
  }, [automationId]);

  React.useEffect(() => {
    setFiles(null); setActive(null); setContents({}); setSaved({}); setError(null); setMessage("");
    void loadFiles().then((list) => {
      const entry = list?.find((f) => /^main\.(ts|js|mjs)$/.test(f.path)) ?? list?.[0];
      if (entry) void open(entry.path);
    });
  }, [loadFiles, open]);

  const save = React.useCallback(async () => {
    const { active: path, contents: all } = state.current;
    if (!path || all[path] === undefined) return;
    const content = all[path];
    setBusy(true); setError(null); setMessage("");
    try {
      if (path === PACKAGE_TAB) {
        try { const parsed = JSON.parse(content); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); }
        catch { throw new Error("package.json must be a JSON object."); }
        await updateAutomationPackage(content);
      } else {
        await writeAutomationFile(automationId, path, content);
        void loadFiles();
      }
      setSaved((s) => ({ ...s, [path]: content }));
      setMessage("Saved");
    } catch (err) {
      setError(errorText(err, "Could not save."));
    } finally {
      setBusy(false);
    }
  }, [automationId, loadFiles]);

  const saveRef = React.useRef(save);
  saveRef.current = save;

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveRef.current());
  };

  const createFile = async () => {
    const path = (newPath ?? "").trim().replace(/^\/+/, "");
    if (!path) return;
    if (files?.some((f) => f.path === path)) { setError(`${path} already exists.`); return; }
    setBusy(true); setError(null);
    try {
      await writeAutomationFile(automationId, path, "");
      setNewPath(null);
      setContents((c) => ({ ...c, [path]: "" })); setSaved((s) => ({ ...s, [path]: "" }));
      await loadFiles();
      setActive(path);
    } catch (err) {
      setError(errorText(err, "Could not create the file."));
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async () => {
    const path = confirmDelete;
    if (!path) return;
    setBusy(true); setError(null);
    try {
      await deleteAutomationFile(automationId, path);
      setContents(({ [path]: _, ...rest }) => rest); setSaved(({ [path]: _, ...rest }) => rest);
      if (active === path) setActive(null);
      setConfirmDelete(null);
      await loadFiles();
    } catch (err) {
      setError(errorText(err, "Could not delete the file."));
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  // The server renames in place and refuses to overwrite; unsaved edits move with the file.
  const renameFile = async () => {
    if (!renaming) return;
    const from = renaming.from;
    const to = renaming.to.trim().replace(/^\/+/, "");
    if (!to || to === from) { setRenaming(null); return; }
    setBusy(true); setError(null);
    try {
      await renameAutomationFile(automationId, from, to);
      const move = (m: Record<string, string>) => { if (m[from] === undefined) return m; const { [from]: value, ...rest } = m; return { ...rest, [to]: value }; };
      setContents(move); setSaved(move);
      if (active === from) setActive(to);
      setRenaming(null);
      await loadFiles();
    } catch (err) {
      setError(errorText(err, `Could not rename ${from}.`));
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    setInstalling(true); setError(null);
    try { const { run_id } = await installAutomationPackage(); onShowRun(run_id); }
    catch (err) { setError(errorText(err, "Could not start npm install.")); }
    finally { setInstalling(false); }
  };

  const dirty = (path: string) => contents[path] !== undefined && contents[path] !== saved[path];
  const anyDirty = Object.keys(contents).some(dirty);
  React.useEffect(() => { setAutomationDirty("code", anyDirty); }, [anyDirty]);
  React.useEffect(() => () => setAutomationDirty("code", false), []);
  const label = (path: string) => (path === PACKAGE_TAB ? "package.json (shared)" : path);
  const iconButton = (name: string, icon: React.ComponentType<any>, onPress: () => void, danger = false) => <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={onPress}
    {...({ title: name } as object)}
    className={"w-7 h-7 items-center justify-center rounded web:cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2DD4BF] " + (danger ? "hover:bg-[#FFF0EC] dark:hover:bg-[#3C2629]" : "hover:bg-background-100 dark:hover:bg-[#1A2638]")}>
    <Icon as={icon} size={14} aria-hidden={true} className={danger ? "text-[#BA4F3D] dark:text-[#F4A293]" : "text-typography-600 dark:text-[#8A94A8]"} />
  </Pressable>;

  const pathInput = (accessibilityLabel: string, value: string, onChange: (v: string) => void, onSubmit: () => void, onCancel: () => void) => <TextInput autoFocus selectTextOnFocus
    accessibilityLabel={accessibilityLabel} value={value} onChangeText={onChange} onSubmitEditing={onSubmit} onBlur={onCancel}
    onKeyPress={(e) => { if ((e.nativeEvent as { key?: string }).key === "Escape") onCancel(); }}
    placeholder="lib/util.ts" placeholderTextColor="#8A94A8" autoCapitalize="none" autoCorrect={false} editable={!busy}
    className="mx-1 border rounded px-2 py-1 font-mono text-xs text-typography-900 dark:text-[#E8EBF0] bg-background-0 dark:bg-[#0A1422] border-[#147D78] dark:border-[#2DD4BF] web:outline-none" />;

  const entryRow = (path: string, editable = true) => {
    const selected = active === path;
    if (renaming?.from === path) return <Box key={path} style={{ minHeight: 30, justifyContent: "center" }}>
      {pathInput(`New path for ${path}`, renaming.to, (to) => setRenaming({ from: path, to }), () => void renameFile(), () => setRenaming(null))}
    </Box>;
    return <Box key={path} className={"flex-row items-center rounded " + (selected ? "bg-[#E7F6F2] dark:bg-[#153B3B]" : "hover:bg-background-100 dark:hover:bg-[#15233A]")}>
      <Pressable onPress={() => void open(path)} accessibilityRole="button" accessibilityLabel={`Open ${label(path)}${dirty(path) ? ", unsaved" : ""}`} accessibilityState={{ selected }}
        className="flex-1 min-w-0 flex-row items-center gap-2 px-2 rounded web:cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2DD4BF]" style={{ minHeight: 30 }}>
        <Text numberOfLines={1} className={"font-mono text-xs flex-1 " + (selected ? "text-typography-900 dark:text-[#E8EBF0] font-semibold" : "text-typography-700 dark:text-[#B4BECD]")}>{label(path)}</Text>
        {dirty(path) ? <Box className="w-1.5 h-1.5 rounded-full bg-[#946A18] dark:bg-[#F0CC80]" /> : null}
      </Pressable>
      {selected && editable ? <Box className="flex-row pr-0.5">
        {iconButton(`Rename ${path}`, Pencil, () => setRenaming({ from: path, to: path }))}
        {iconButton(`Delete ${path}`, Trash2, () => setConfirmDelete(path), true)}
      </Box> : null}
    </Box>;
  };

  const sectionTitle = (text: string) => <Text className="px-2 text-xs font-semibold text-typography-600 dark:text-[#8A94A8]">{text}</Text>;

  const explorer = <Box className={"gap-1 " + (fill ? "p-2 border-r border-outline-100 dark:border-[#1F2D40] bg-background-50 dark:bg-[#0E1726]" : "")} style={{ width: fill ? 240 : 220 }}>
    <Box className="flex-row items-center" style={{ minHeight: 30 }}>
      <Box className="flex-1">{sectionTitle("Files")}</Box>
      {iconButton("New file", FilePlus, () => setNewPath(""))}
    </Box>
    <Failure message={listError} />
    {!files && !listError ? <Text className={subtle + " px-2"}>Loading…</Text> : null}
    {files && !files.length ? <Text className={subtle + " px-2"}>No files.</Text> : null}
    <ScrollView style={fill ? { flex: 1 } : undefined}>
      {files?.map((f) => entryRow(f.path))}
      {newPath !== null ? <Box style={{ minHeight: 30, justifyContent: "center" }}>
        {pathInput("New file path", newPath, setNewPath, () => void createFile(), () => setNewPath(null))}
      </Box> : null}
    </ScrollView>
    <Box className="mt-2 pt-2 border-t border-outline-100 dark:border-[#1F2D40] gap-1">
      {sectionTitle("Dependencies")}
      {entryRow(PACKAGE_TAB, false)}
    </Box>
  </Box>;

  const toolbar = <Box className={"flex-row flex-wrap items-center gap-2 " + (fill ? "px-3 border-b border-outline-100 dark:border-[#1F2D40] bg-background-0 dark:bg-[#0E1726]" : "")} style={{ minHeight: 44 }}>
    <Text numberOfLines={1} className={"font-mono text-sm mr-auto " + ink}>{active ? label(active) : "No file open"}{active && dirty(active) ? <Text className="text-[#946A18] dark:text-[#F0CC80]">  ● unsaved</Text> : null}</Text>
    {active === PACKAGE_TAB ? <Action label={installing ? "Starting…" : "npm install"} onPress={install} disabled={installing || dirty(PACKAGE_TAB)} /> : null}
    <Box className="flex-row items-center gap-2">
      <Text aria-hidden={true} className="px-1.5 py-0.5 rounded border border-outline-200 dark:border-[#2A3B52] font-mono text-[11px] text-typography-600 dark:text-[#8A94A8]">Ctrl+S</Text>
      {/* Action is self-start; its own wrapper lets the row centre it next to the key hint. */}
      <Box><Action label={busy ? "Saving…" : "Save"} primary onPress={() => void save()} disabled={busy || !active || !dirty(active)} /></Box>
    </Box>
  </Box>;

  const editor = <Box className={"flex-1 min-w-0 min-h-0 overflow-hidden " + (fill ? "" : "rounded-xl border border-outline-100 dark:border-[#26364A]")}
    style={fill ? undefined : { height: EDITOR_HEIGHT }}
    onLayout={fill ? (e) => { const h = Math.floor(e.nativeEvent.layout.height); if (h > 0) setEditorHeight(h); } : undefined}>
    {active && contents[active] !== undefined ? <Editor
      height={fill ? editorHeight : EDITOR_HEIGHT}
      path={active === PACKAGE_TAB ? "file:///package.json" : `file:///scripts/${automationId}/${active}`}
      language={active === PACKAGE_TAB ? "json" : languageFor(active)}
      value={contents[active]}
      theme={resolvedMode === "dark" ? "hh-dark" : "hh-light"}
      beforeMount={(monaco) => { defineThemes(monaco); void configureTypescript(monaco); }}
      onMount={onMount}
      onChange={(value) => setContents((c) => ({ ...c, [active]: value ?? "" }))}
      options={{ minimap: { enabled: fill }, fontSize: 13, tabSize: 2, scrollBeyondLastLine: false, automaticLayout: true, padding: { top: 8 } }}
    /> : <Box className="flex-1 items-center justify-center p-6"><Text className={muted}>{active ? "Loading…" : "Select a file to edit."}</Text></Box>}
  </Box>;

  const feedback = error || message ? <Box className={fill ? "px-3 py-2 gap-1 border-b border-outline-100 dark:border-[#1F2D40]" : "gap-1"}>
    <Failure message={error} />
    {message ? <Text accessibilityLiveRegion="polite" className={subtle}>{message}</Text> : null}
  </Box> : null;

  const dialog = confirmDelete ? <ConfirmDialog title="Delete file" message={`Delete ${confirmDelete}? This cannot be undone.`} confirmLabel="Delete" busy={busy} onConfirm={removeFile} onClose={() => setConfirmDelete(null)} /> : null;

  if (fill) return <Box className="flex-1 min-h-0 flex-row">
    {explorer}
    <Box className="flex-1 min-w-0 min-h-0">{toolbar}{feedback}{editor}</Box>
    {dialog}
  </Box>;

  return <Box className={surface + " gap-3"}>
    <Heading size="md" className={ink}>Code</Heading>
    {toolbar}
    {feedback}
    <Box className="flex-row gap-3" style={{ minHeight: EDITOR_HEIGHT }}>{explorer}{editor}</Box>
    {dialog}
  </Box>;
}
