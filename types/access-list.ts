export type AccessListAuthItem = {
  id?: number;
  username: string;
  password: string;
};

export type AccessListClientRule = {
  id?: number;
  directive: "allow" | "deny" | string;
  address: string;
};

export type AccessList = {
  id: number;
  name: string;
  satisfy_any: boolean;
  pass_auth: boolean;
  items?: AccessListAuthItem[];
  clients?: AccessListClientRule[];
  created_on?: string;
  updated_on?: string;
};

export type AccessListPayload = {
  name: string;
  satisfy_any: boolean;
  pass_auth: boolean;
  items: AccessListAuthItem[];
  clients: AccessListClientRule[];
};
