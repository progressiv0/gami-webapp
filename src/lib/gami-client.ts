/**
 * Typed fetch wrapper for the gami-api (Go REST server).
 * Only stamp, upgrade, and verify are needed — sign happens client-side.
 */
import type { GPR } from "./types";

function apiBase(): string {
  return process.env.GAMI_API_URL ?? "http://localhost:8080";
}

async function gamiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      (json as { error?: string }).error ?? `gami-api error ${res.status}`
    );
  }
  return json as T;
}

// ── Stamp ─────────────────────────────────────────────────────────────────────

export interface StampResult {
  gpr: GPR;
  calendar?: string;
  ots_error?: string;
}

export async function stampGpr(
  gpr: GPR,
  submitOts = true
): Promise<StampResult> {
  return gamiPost<StampResult>("/v1/stamp", { gpr, submit_ots: submitOts });
}

// ── Upgrade ───────────────────────────────────────────────────────────────────

export interface UpgradeResult {
  gpr: GPR;
  confirmed: boolean;
  calendar: string;
}

export async function upgradeGpr(gpr: GPR): Promise<UpgradeResult> {
  return gamiPost<UpgradeResult>("/v1/upgrade", { gpr });
}

// ── Verify ────────────────────────────────────────────────────────────────────

export interface VerifyChecks {
  file_hash_match: boolean;
  canonical_checked?: boolean; // only set in ots_file mode
  signature_valid: boolean;
  signature_key_status?: string;
  ots_verified: boolean;
}

export interface VerifyResult {
  valid: boolean;
  mode: "full" | "ots_only";
  gpr_id?: string;
  key_id?: string;
  checks: VerifyChecks;
  anchored_at?: string;
  bitcoin_block?: number;
  errors?: Record<string, string>;
}

/**
 * Full or key-override verification against an explicit GPR (not from DB).
 * publicKeyHex is optional — if omitted normal DID/embedded key resolution is used.
 */
export async function verifyExternal(
  fileHash: string,
  gpr: GPR,
  publicKeyHex?: string
): Promise<VerifyResult> {
  return gamiPost<VerifyResult>("/v1/verify", {
    file_hash: fileHash,
    gpr,
    ...(publicKeyHex ? { public_key_hex: publicKeyHex } : {}),
  });
}

/**
 * OTS-only from a GPR's raw ots_data field (tree bytes, no file header).
 * fileHash is optional — if provided enables hash-chain consistency checking.
 */
export async function verifyOts(
  otsData: string,
  fileHash?: string
): Promise<VerifyResult> {
  return gamiPost<VerifyResult>("/v1/verify", {
    ots_data: otsData,
    ...(fileHash ? { file_hash: fileHash } : {}),
  });
}

/**
 * OTS-only from an exported .ots DetachedTimestampFile (base64-encoded binary).
 * Equivalent to `ots verify --no-bitcoin`.
 * canonicalText is optional; if provided its SHA-256 is checked against the digest
 * embedded in the .ots file (use the output of `gami extract ots` .canonical file).
 */
export async function verifyOtsFile(
  otsFileBase64: string,
  canonicalText?: string
): Promise<VerifyResult> {
  return gamiPost<VerifyResult>("/v1/verify", {
    ots_file: otsFileBase64,
    ...(canonicalText ? { canonical: canonicalText } : {}),
  });
}
