export type StreamMeta = {
  dns_provider_credentials?: string;
  letsencrypt_agree?: boolean;
  dns_challenge?: boolean;
};

export type StreamHost = {
  id: number;
  incoming_port: number;
  forwarding_host: string;
  forwarding_port: number;
  tcp_forwarding?: boolean;
  udp_forwarding?: boolean;
  certificate_id?: number | null;
  meta?: StreamMeta;
  enabled?: boolean;
  created_on?: string;
  updated_on?: string;
};

export type StreamPayload = {
  incoming_port: number;
  forwarding_host: string;
  forwarding_port: number;
  tcp_forwarding: boolean;
  udp_forwarding: boolean;
  certificate_id: number;
  meta: StreamMeta;
};
