export type RedirectionMeta = {
  letsencrypt_agree?: boolean;
  dns_challenge?: boolean;
};

export type RedirectionHost = {
  id: number;
  domain_names: string[];
  forward_scheme: string;
  forward_domain_name: string;
  forward_http_code: string;
  preserve_path?: boolean;
  block_exploits?: boolean;
  certificate_id?: number | null;
  meta?: RedirectionMeta;
  advanced_config?: string;
  http2_support?: boolean;
  hsts_enabled?: boolean;
  hsts_subdomains?: boolean;
  ssl_forced?: boolean;
  enabled?: boolean;
  created_on?: string;
  updated_on?: string;
};

export type RedirectionPayload = {
  domain_names: string[];
  forward_scheme: string;
  forward_domain_name: string;
  forward_http_code: string;
  preserve_path: boolean;
  block_exploits: boolean;
  certificate_id: number;
  meta: RedirectionMeta;
  advanced_config: string;
  http2_support: boolean;
  hsts_enabled: boolean;
  hsts_subdomains: boolean;
  ssl_forced: boolean;
};
