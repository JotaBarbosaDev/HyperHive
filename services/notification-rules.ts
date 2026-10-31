import { apiFetch } from "./api-client";

export type NotificationSeverity = "info" | "warning" | "error" | "critical";

export type NotificationRule = {
  category: string;
  description: string;
  enabled: boolean;
  minPushSeverity: NotificationSeverity;
  quietStart: string;
  quietEnd: string;
};

export type NotificationRuleUpdate = Omit<NotificationRule, "category" | "description">;

export const notificationSeverities: NotificationSeverity[] = ["info", "warning", "error", "critical"];

export const listNotificationRules = (signal?: AbortSignal) =>
  apiFetch<NotificationRule[]>("/notification/rules", { signal, reportResult: false });

export const updateNotificationRule = (category: string, rule: NotificationRuleUpdate) =>
  apiFetch<NotificationRule>(`/notification/rules/${encodeURIComponent(category)}`, { method: "PUT", body: rule, reportResult: false });

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

// Mirrors the backend rule validation so the form can explain problems before saving.
export const validateQuietHours = (start: string, end: string): string | null => {
  if (!start && !end) return null;
  if (!start || !end) return "Set both quiet hours start and end, or leave both empty.";
  if (!timePattern.test(start) || !timePattern.test(end)) return "Quiet hours use HH:MM, for example 22:00.";
  return null;
};
