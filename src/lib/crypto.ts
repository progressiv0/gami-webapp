/**
 * Client-side Ed25519 signing helpers (browser only).
 * Mirrors gami-core signing logic: JCS → SHA-256 → Ed25519.
 *
 * Key format: Go crypto/ed25519 stores seed||pubkey (64 bytes = 128 hex chars).
 * @noble/ed25519 v2 needs only the 32-byte seed (first 64 hex chars).
 */
"use client";

import { sha256, sha512 } from "@noble/hashes/sha2.js";
import * as ed from "@noble/ed25519";
import { canonicalize } from "json-canonicalize";
import type { GPR } from "./types";
import { toCanonicalObject } from "./gpr-builder";

// @noble/ed25519 v2 uses crypto.subtle for SHA-512 by default, which is
// unavailable on non-HTTPS origins. Override with @noble/hashes (pure JS).
ed.etc.sha512Async = (...msgs: Uint8Array[]) =>
  Promise.resolve(sha512(ed.etc.concatBytes(...msgs)));

/**
 * Normalise a private key hex string to the 32-byte seed expected by @noble/ed25519.
 * Go's crypto/ed25519 stores keys as seed||pubkey (64 bytes = 128 hex chars).
 * We take only the first 32 bytes (64 hex chars).
 */
function normaliseSeed(hex: string): string {
  const clean = hex.trim();
  if (clean.length === 128) return clean.slice(0, 64);
  return clean;
}

/** Derive the public key hex from a private key hex (32-byte seed or 64-byte Go format). */
export async function derivePublicKey(privateKeyHex: string): Promise<string> {
  const privBytes = hexToBytes(normaliseSeed(privateKeyHex));
  const pubBytes = await ed.getPublicKeyAsync(privBytes);
  return bytesToHex(pubBytes);
}

/**
 * Sign a GPR with the given private key.
 * Returns the hex-encoded Ed25519 signature.
 * The key NEVER leaves the browser.
 */
export async function signGpr(
  gpr: GPR,
  privateKeyHex: string
): Promise<{ signature: string; publicKeyHex: string }> {
  const privBytes = hexToBytes(normaliseSeed(privateKeyHex));

  // Derive public key for embedding
  const pubBytes = await ed.getPublicKeyAsync(privBytes);
  const publicKeyHex = bytesToHex(pubBytes);

  // Build canonical object omitting signature and timestamp (CanonicaliseForSigning)
  const canonical = toCanonicalObject(gpr, ["signature", "timestamp"]);
  const canonicalJson = canonicalize(canonical);

  // SHA-256 the canonical bytes — use @noble/hashes (works in all contexts, no SubtleCrypto needed)
  const msgBytes = new TextEncoder().encode(canonicalJson);
  const hashBytes = sha256(msgBytes);

  // Ed25519 sign
  const sigBytes = await ed.signAsync(hashBytes, privBytes);
  const signature = "ed25519:" + bytesToHex(sigBytes);

  return { signature, publicKeyHex };
}

// ── helpers ───────────────────────────────────────────────────────────────────

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("Invalid hex string length");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}