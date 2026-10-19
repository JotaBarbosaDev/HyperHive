export type DnsAliasEntry = {
  alias: string;
  ip: string;
  ssh_username: string;
  related_vm: string;
};

export type DnsAliasListResponse = {
  aliases?: DnsAliasEntry[];
};

export type DnsAliasExistsResponse = {
  exists?: boolean;
};

export type DnsAliasKey = {
  alias: string;
  ip: string;
};

export type DnsAliasPayload = DnsAliasKey & {
  ssh_username?: string;
  related_vm?: string;
};
