export type ProxyLocation = {
  path: string;
  forward_scheme: string;
  forward_host: string;
  forward_port: number;
};

export type ProxyMeta = Record<string, unknown>;

export type ProxyHost = {
  id: number;
  domain_names: string[];
  forward_scheme: string;
  forward_host: string;
  forward_port: number;
  caching_enabled?: boolean;
  block_exploits?: boolean;
  allow_websocket_upgrade?: boolean;
  access_list_id?: string | number;
  certificate_id?: number | null;
  meta?: ProxyMeta;
  advanced_config?: string;
  locations?: ProxyLocation[];
  http2_support?: boolean;
  hsts_enabled?: boolean;
  hsts_subdomains?: boolean;
  ssl_forced?: boolean;
  enabled?: boolean;
  created_on?: string;
  updated_on?: string;
};

export type ProxyPayload = {
  id?: number;
  domain_names: string[];
  forward_scheme: string;
  forward_host: string;
  forward_port: number;
  caching_enabled: boolean;
  block_exploits: boolean;
  allow_websocket_upgrade: boolean;
  access_list_id: string | number;
  certificate_id: number;
  meta: ProxyMeta;
  advanced_config: string;
  locations: ProxyLocation[];
  http2_support: boolean;
  hsts_enabled: boolean;
  hsts_subdomains: boolean;
  ssl_forced: boolean;
  enabled: boolean;
};
