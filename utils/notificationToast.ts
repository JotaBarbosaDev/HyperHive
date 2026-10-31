export type NotificationToastPayload = {
  title: string;
  body: string;
  severity: "info" | "warning" | "error";
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// Non-critical notifications arrive as websocket type "NotificationToast" with a JSON
// body; critical ones keep the "Notification" modal message.
export const normalizeNotificationToast = (raw: unknown): NotificationToastPayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const type = text(record.type) || text(record.Type);
  if (type.toLowerCase() !== "notificationtoast") return null;
  const data = record.data ?? record.Data;
  let parsed: Record<string, unknown> = {};
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data) ?? {};
    } catch {
      parsed = { body: data };
    }
  } else if (data && typeof data === "object") {
    parsed = data as Record<string, unknown>;
  }
  const severity = parsed.severity === "warning" || parsed.severity === "error" ? parsed.severity : "info";
  return { title: text(parsed.title) || "Notification", body: text(parsed.body), severity };
};
