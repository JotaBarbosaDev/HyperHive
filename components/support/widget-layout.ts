import type { Widget } from "@/types/support";
import { minimumWidgetHeight, minimumWidgetWidth } from "./widget-format";

export function normalizeWidgetLayout(widgets: Widget[]): Widget[] {
  const placed: Widget[] = [];
  for (const widget of widgets) {
    const w = Math.min(12, Math.max(minimumWidgetWidth(widget.kind), widget.w));
    const h = Math.max(minimumWidgetHeight(widget.kind), widget.h);
    let x = Math.min(widget.x, 12 - w);
    let y = widget.y;
    const overlaps = () => placed.some(other => x < other.x + other.w && x + w > other.x && y < other.y + other.h && y + h > other.y);
    while (overlaps()) y++;
    placed.push({ ...widget, x, y, w, h });
  }
  return placed;
}
