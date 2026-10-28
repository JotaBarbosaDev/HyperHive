import type { Certificate } from "@/types/certificate";

export function certificateAction(cert: Certificate) {
  return cert.provider?.toLowerCase() === "letsencrypt" ? "renew" : cert.provider?.toLowerCase() === "other" ? "upload" : null;
}
