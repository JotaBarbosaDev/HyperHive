export type SpaPort = {
  port: number;
  description: string;
  created_at: string;
};

export type SpaPortPayload = {
  port: number;
  password: string;
  description: string;
};

export type SpaAllowEntry = {
  ip: string;
  remaining_seconds: number;
};

export type SpaAllowResponse = {
  allows: SpaAllowEntry[];
  port: number;
};
