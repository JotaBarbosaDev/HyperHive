export type WireguardEndpoint = {
  IP: string;
  Port: number;
  Zone?: string | null;
};

export type WireguardAllowedIP = {
  IP: string;
  Mask: string;
};

export type WireguardRuntime = {
  PublicKey: number[];
  PresharedKey: number[];
  Endpoint: WireguardEndpoint | null;
  PersistentKeepaliveInterval: number;
  LastHandshakeTime: string;
  ReceiveBytes: number;
  TransmitBytes: number;
  AllowedIPs: WireguardAllowedIP[];
  ProtocolVersion: number;
};

export type WireguardPeer = {
  id: number;
  name: string;
  client_ip: string;
  public_key: string;
  wireguard?: WireguardRuntime | null;
  config?: string | null;
};

export type WireguardListResponse = {
  peers: WireguardPeer[];
};

export type CreateWireguardPeerInput = {
  name: string;
  endpoint: string;
  keepalive_seconds?: number;
};

export type WireguardPeerId = number | string;
