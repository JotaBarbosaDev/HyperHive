import React from "react";
import { ScrollView, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import Editor, { type Monaco } from "@monaco-editor/react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Modal, ModalBackdrop, ModalContent } from "@/components/ui/modal";
import { X } from "lucide-react-native";
import { Action, ink, muted } from "@/components/support/support-ui";
import { automationExamples } from "./automation-examples";
import { rowClass, subtle } from "./automation-ui";

const VIEW_OPTIONS = { readOnly: true, domReadOnly: true, fontSize: 13, tabSize: 2, scrollBeyondLastLine: false, automaticLayout: true, minimap: { enabled: false }, padding: { top: 8 }, renderLineHighlight: "none" as const };

type Props = {
  theme: string;
  beforeMount: (monaco: Monaco) => void;
  /** File the "Use" action replaces; null when no script file is open. */
  target: string | null;
  onUse: (code: string) => void;
  onClose: () => void;
};

export function ExamplesDialog({ theme, beforeMount, target, onUse, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const narrow = width < 760;
  const [selectedId, setSelectedId] = React.useState(automationExamples[0].id);
  const [copied, setCopied] = React.useState<"code" | "condition" | null>(null);
  const [editorHeight, setEditorHeight] = React.useState(360);
  const example = automationExamples.find((entry) => entry.id === selectedId) ?? automationExamples[0];

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (what: "code" | "condition", text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(what);
  };

  const list = <ScrollView style={narrow ? { maxHeight: 168 } : { flex: 1 }} contentContainerStyle={{ gap: 6, padding: 8 }}>
    {automationExamples.map((entry) => {
      const selected = entry.id === example.id;
      return <Pressable key={entry.id} onPress={() => setSelectedId(entry.id)} accessibilityRole="button" accessibilityState={{ selected }}
        className={"rounded-lg px-3 py-2 gap-0.5 " + rowClass(selected)}>
        <Text numberOfLines={1} className={"text-sm font-semibold " + ink}>{entry.title}</Text>
        {!narrow ? <Text numberOfLines={2} className={subtle}>{entry.summary}</Text> : null}
      </Pressable>;
    })}
  </ScrollView>;

  const detail = <Box className="flex-1 min-w-0 min-h-0">
    <Box className="px-4 py-3 gap-2 border-b border-outline-100 dark:border-[#1F2D40]">
      <Text className={muted}>{example.summary}</Text>
      <Box className="flex-row flex-wrap items-center gap-2">
        <Text className={subtle}>Run when</Text>
        {example.condition ? <>
          <Text selectable className="px-2 py-0.5 rounded bg-background-100 dark:bg-[#1A2638] font-mono text-xs text-typography-900 dark:text-[#E8EBF0]">{example.condition}</Text>
          <Action compact label={copied === "condition" ? "Copied" : "Copy"} onPress={() => void copy("condition", example.condition)} />
        </> : <Text className={subtle + " italic"}>empty: run it manually with RUN</Text>}
      </Box>
    </Box>
    <Box className="flex-1 min-h-0" onLayout={(e) => { const h = Math.floor(e.nativeEvent.layout.height); if (h > 0) setEditorHeight(h); }}>
      <Editor
        height={editorHeight}
        path={`file:///examples/${example.id}.ts`}
        language="typescript"
        value={example.code}
        theme={theme}
        beforeMount={beforeMount}
        options={VIEW_OPTIONS}
      />
    </Box>
  </Box>;

  return <Modal isOpen onClose={onClose} size="full">
    <ModalBackdrop />
    <ModalContent className="p-0 rounded-2xl overflow-hidden border border-outline-100 dark:border-[#26364A] bg-background-0 dark:bg-[#101B2B]"
      style={{ width: "94%", maxWidth: 1180, height: Math.min(height * 0.86, 820) }}>
      <Box className="flex-row items-center gap-3 px-4 border-b border-outline-100 dark:border-[#1F2D40]" style={{ minHeight: 52 }}>
        <Heading size="md" className={ink + " flex-1"} numberOfLines={1}>Examples{narrow ? "" : ` · ${example.title}`}</Heading>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close examples"
          className="w-8 h-8 items-center justify-center rounded web:cursor-pointer hover:bg-background-100 dark:hover:bg-[#1A2638] focus-visible:outline-2 focus-visible:outline-[#2DD4BF]">
          <Icon as={X} size={16} aria-hidden={true} className="text-typography-600 dark:text-[#8A94A8]" />
        </Pressable>
      </Box>
      <Box className={"flex-1 min-h-0 " + (narrow ? "flex-col" : "flex-row")}>
        <Box className={(narrow ? "border-b" : "border-r") + " border-outline-100 dark:border-[#1F2D40] bg-background-50 dark:bg-[#0E1726]"} style={narrow ? undefined : { width: 300 }}>
          {list}
        </Box>
        {detail}
      </Box>
      <Box className="flex-row flex-wrap items-center justify-end gap-2 px-4 py-3 border-t border-outline-100 dark:border-[#1F2D40]">
        <Text className={subtle + " mr-auto"}>{target ? `Replaces ${target} in the editor; nothing is saved until you press Save (Ctrl+Z undoes).` : "Open a script file to use an example."}</Text>
        <Action label={copied === "code" ? "Copied" : "Copy code"} onPress={() => void copy("code", example.code)} />
        <Action label={target ? `Use in ${target}` : "Use"} primary disabled={!target} onPress={() => onUse(example.code)} />
      </Box>
    </ModalContent>
  </Modal>;
}
