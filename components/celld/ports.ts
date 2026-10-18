import type { CelldPorts } from "@/types/celld";

export function parseFleetPorts(http: string, internal: string): CelldPorts | undefined {
  const httpText = http.trim();
  const internalText = internal.trim();
  if (!httpText && !internalText) return undefined;
  const parse = (value: string, label: string) => {
    const port = /^\d+$/.test(value) ? Number(value) : 0;
    if (port < 1 || port > 65535) throw new Error(label + " port must be a whole number from 1 to 65535.");
    return port;
  };
  const httpPort = parse(httpText, "HTTP");
  const internalPort = parse(internalText || String(httpPort + 1), "Internal");
  if (httpPort === internalPort) throw new Error("HTTP and internal ports must be different.");
  return { http: httpPort, internal: internalPort };
}
