export type SpaPort = {
  port: number;
  created_at: string;
};

export type SpaAllowEntry = {
  ip: string;
  remaining_seconds: number;
};

export type SpaAllowResponse = {
  allows: SpaAllowEntry[];
  port: number;
};
