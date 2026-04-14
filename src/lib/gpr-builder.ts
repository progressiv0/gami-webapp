/**
 * TypeScript mirror of gami-core/gpr/gpr.go Build() and jcs.go canonicalisation.
 * Keeps the same field-omission rules as Go's json:",omitempty" tags.
 */
import { v4 as uuidv4 } from "uuid";
import type { GPR, GprProof } from "./types";

export interface BuildRequest {
  fileHash: string;
  filename?: string;
  keyId: string;
  publicKeyHex?: string;
  metadata?: Record<string, string>;
  parentId?: string | null;
}

export function buildGpr(req: BuildRequest): GPR {
  const proof: GprProof = {
    created: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    key_id: req.keyId,
  };
  if (req.publicKeyHex) proof.public_key_hex = req.publicKeyHex;

  const gpr: GPR = {
    "@context": "https://authenticmemory.org/schema/v1",
    type: "gami-proof",
    schema: "v1",
    id: `urn:uuid:${uuidv4()}`,
    subject: {
      file_hash: req.fileHash,
    },
    proof,
    parent: req.parentId ?? null,
  };

  if (req.filename) gpr.subject.filename = req.filename;
  if (req.metadata && Object.keys(req.metadata).length > 0) {
    gpr.subject.metadata = req.metadata;
  }

  return gpr;
}

/**
 * Returns a plain object representation of the GPR suitable for JCS
 * canonicalization, omitting the specified proof fields and any empty
 * optional fields (matching Go's omitempty behaviour).
 */
export function toCanonicalObject(
  gpr: GPR,
  omitProofFields: (keyof GprProof)[] = []
): Record<string, unknown> {
  // Build subject — omit empty optional fields
  const subject: Record<string, unknown> = {
    file_hash: gpr.subject.file_hash,
  };
  if (gpr.subject.filename) subject.filename = gpr.subject.filename;
  if (gpr.subject.metadata && Object.keys(gpr.subject.metadata).length > 0) {
    subject.metadata = gpr.subject.metadata;
  }

  // Build proof — omit empty optional fields and requested omissions
  const proof: Record<string, unknown> = {
    created: gpr.proof.created,
    key_id: gpr.proof.key_id,
  };
  if (gpr.proof.public_key_hex) proof.public_key_hex = gpr.proof.public_key_hex;
  if (gpr.proof.signature && !omitProofFields.includes("signature")) {
    proof.signature = gpr.proof.signature;
  }
  if (gpr.proof.timestamp && !omitProofFields.includes("timestamp")) {
    proof.timestamp = gpr.proof.timestamp;
  }

  const obj: Record<string, unknown> = {
    "@context": gpr["@context"],
    type: gpr.type,
    schema: gpr.schema,
    id: gpr.id,
    subject,
    proof,
    parent: gpr.parent,
  };

  return obj;
}

/** Determine GPR status from the proof fields. */
export function gprStatus(
  gpr: GPR
): "unsigned" | "signed" | "stamped" | "upgraded" {
  if (gpr.proof.timestamp?.upgraded) return "upgraded";
  if (gpr.proof.timestamp) return "stamped";
  if (gpr.proof.signature) return "signed";
  return "unsigned";
}
