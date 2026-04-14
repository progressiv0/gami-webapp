/** Mirror of gami-core/gpr/gpr.go GPR structs */

export interface GprTimestamp {
  type: string;
  document_hash: string;
  calendar?: string;
  submitted_at?: string;
  ots_data?: string;
  upgraded: boolean;
}

export interface GprProof {
  created: string;
  key_id: string;
  public_key_hex?: string;
  signature?: string;
  timestamp?: GprTimestamp;
}

export interface GprSubject {
  filename?: string;
  file_hash: string;
  metadata?: Record<string, string>;
}

export interface GPR {
  "@context": string;
  type: string;
  schema: string;
  id: string;
  subject: GprSubject;
  proof: GprProof;
  parent: string | null;
}

export type GprStatus = "unsigned" | "signed" | "stamped" | "upgraded";

export interface GprRow {
  id: string;
  status: GprStatus;
  filename: string;
  fileHash: string;
  collection: string;
  createdAt: string;
  updatedAt: string;
  data: GPR;
}
