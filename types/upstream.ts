export type UpstreamContext = "http" | "stream";
export type UpstreamMember = {ip: string; port: number; settings_string: string};
export type UpstreamPayload = {
  name: string;
  context: UpstreamContext;
  loadbalancer_type: string;
  loadbalancer_options?: {hash_key?: string};
  server_arr: UpstreamMember[];
  revision?: number;
};
export type Upstream = UpstreamPayload & {
  id: number;
  revision: number;
  apply_status: string;
  applied_generation: number;
  last_error?: string;
  references: {consumer_type: string; npm_id: number; location_path?: string}[];
  warnings?: string[];
};
export type UpstreamCapabilities = {
  image_digest: string;
  status: string;
  contexts: Record<UpstreamContext, {name: string; status: string; requires_hash_key: boolean; hash_keys?: string[]}[]>;
  server_parameters: string[];
  unsupported: string[];
  shared_zone: boolean;
  connection_limit_scope: string;
  max_members: number;
};
