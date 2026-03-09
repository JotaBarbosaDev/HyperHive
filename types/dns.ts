export type DnsAliasEntry = {
  alias: string;
  ip: string;
};

export type DnsAliasListResponse = {
  aliases?: DnsAliasEntry[];
};

export type DnsAliasExistsResponse = {
  exists?: boolean;
};

export type DnsAliasPayload = {
  alias: string;
  ip: string;
};
