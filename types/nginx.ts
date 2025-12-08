export type NotFoundHostMeta = {
  letsencrypt_agree?: boolean;
  dns_challenge?: boolean;
};

export type NotFoundHost = {
  id: number;
  domain_names: string[];
  certificate_id?: number | null;
  meta?: NotFoundHostMeta;
  advanced_config?: string;
  hsts_enabled?: boolean;
  hsts_subdomains?: boolean;
  http2_support?: boolean;
  ssl_forced?: boolean;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type NotFoundHostPayload = {
  domain_names: string[];
  certificate_id: number;
  meta: NotFoundHostMeta;
  advanced_config: string;
  hsts_enabled: boolean;
  hsts_subdomains: boolean;
  http2_support: boolean;
  ssl_forced: boolean;
};
