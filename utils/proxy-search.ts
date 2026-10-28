import type { ProxyHost } from "@/types/proxy";

export function matchesProxySearch(host: ProxyHost, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const target = host.upstream_id ? `upstream #${host.upstream_id}` : `${host.forward_scheme}://${host.forward_host}:${host.forward_port}`;
  return [...(host.domain_names ?? []), target].some(value => value.toLowerCase().includes(term));
}
