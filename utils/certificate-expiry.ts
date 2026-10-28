import type { Certificate } from "@/types/certificate";

export function certificateExpiry(cert: Certificate, now = Date.now()) {
  const value = cert.expires_at ?? cert.expires_on ?? cert.expires;
  if (value == null || value === "") return { time: null, days: null, label: "Expiry unknown" };
  if (typeof value === "string") {
    const date = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/.exec(value);
    if (!date) return { time: null, days: null, label: "Expiry unknown" };
    const check = new Date(Date.UTC(+date[1], +date[2] - 1, +date[3]));
    if (check.getUTCFullYear() !== +date[1] || check.getUTCMonth() !== +date[2] - 1 || check.getUTCDate() !== +date[3]) return { time: null, days: null, label: "Expiry unknown" };
  }
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return { time: null, days: null, label: "Expiry unknown" };
  const days = Math.ceil((time - now) / 86400000);
  return { time, days, label: time <= now ? "Expired" : `Expires in ${days} day${days === 1 ? "" : "s"}` };
}
