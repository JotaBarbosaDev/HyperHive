export type CertificateMeta = {
  letsencrypt_email?: string;
  letsencrypt_agree?: boolean;
  dns_challenge?: boolean;
  dns_provider?: string;
  dns_provider_credentials?: string;
};

export type Certificate = {
  id: number;
  nice_name?: string;
  status?: string;
  owner_user_id?: number;
  owner_team_id?: number;
  provider?: string;
  domain_names: string[];
  meta?: CertificateMeta;
  created_at?: string;
  updated_at?: string;
  created_on?: string;
  updated_on?: string;
  expires?: string | number;
  expires_at?: string;
  expires_on?: string;
  created?: string | number;
  valid?: boolean;
};

export type CreateLetsEncryptPayload = {
  provider: "letsencrypt";
  domain_names: string[];
  meta: CertificateMeta;
};
