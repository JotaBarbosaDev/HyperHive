import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { ink, muted } from "./support-ui";
import { measurementText } from "./widget-format";

export function WidgetDetails({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <Box style={{ gap: 6 }}>{value.length ? value.map((item, index) => <Box key={index} className="border-l border-outline-200 dark:border-[#26364A]" style={{ paddingLeft: 8 }}><WidgetDetails value={item} /></Box>) : <Text size="xs" className={muted}>None</Text>}</Box>;
  if (value && typeof value === "object") return <Box style={{ gap: 4 }}>{Object.entries(value).map(([key, field]) => <Box key={key} style={{ gap: 2 }}>
    <Text size="xs" className={muted} style={{ fontSize: 11 }}>{key.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase())}</Text>
    {field && typeof field === "object" ? <WidgetDetails value={field} /> : <Text size="xs" selectable className={ink} style={{ fontSize: 12 }}>{typeof field === "number" && key.endsWith("_bytes") ? measurementText(field, "bytes") : typeof field === "number" && key.endsWith("_bytes_per_second") ? measurementText(field, "bytes/s") : typeof field === "number" && key.endsWith("_percent") ? measurementText(field, "%") : field == null ? "Unavailable" : String(field)}</Text>}
  </Box>)}</Box>;
  return <Text size="xs" selectable className={ink}>{value == null ? "Unavailable" : String(value)}</Text>;
}
