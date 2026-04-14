"use client";

import { sha256 } from "@noble/hashes/sha2.js";
import { CheckCircle2, ChevronDown, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VerifyResult } from "@/lib/gami-client";
import type { GPR } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = sha256(new Uint8Array(buf));
  const hex = Array.from(digest)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "sha256:" + hex;
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:<mime>;base64,<data>" — strip the prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

type Mode = "gpr_file" | "db" | "ots";

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: VerifyResult }) {
  const isOtsOnly = result.mode === "ots_only";
  return (
    <Card className={result.valid ? "border-green-400" : "border-destructive"}>
      <CardHeader className="pb-2">
        <CardTitle
          className={`flex items-center gap-2 text-base ${
            result.valid ? "text-green-700" : "text-destructive"
          }`}
        >
          {result.valid ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          {result.valid ? "Verified" : "Verification failed"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {!isOtsOnly && (
          <>
            <Check label="File hash match" ok={result.checks.file_hash_match} />
            <Check
              label={
                result.checks.signature_key_status
                  ? `Signature valid (key: ${result.checks.signature_key_status})`
                  : "Signature valid"
              }
              ok={result.checks.signature_valid}
            />
          </>
        )}
        {isOtsOnly && result.checks.canonical_checked && (
          <Check label="Canonical file matches .ots digest" ok={result.checks.file_hash_match} />
        )}
        <Check
          label={
            result.bitcoin_block
              ? `OTS timestamp verified — Bitcoin block ${result.bitcoin_block}`
              : "OTS timestamp verified"
          }
          ok={result.checks.ots_verified}
        />

        {result.errors && Object.keys(result.errors).length > 0 && (
          <div className="mt-2 space-y-1 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            {Object.entries(result.errors).map(([k, v]) => (
              <p key={k}>
                <span className="font-semibold">{k}:</span> {v}
              </p>
            ))}
          </div>
        )}

        {result.gpr_id && (
          <p className="pt-1 text-xs text-muted-foreground font-mono">{result.gpr_id}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const [mode, setMode] = useState<Mode>("gpr_file");

  // Shared
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");

  // Mode: gpr_file — external GPR JSON + file
  const [gprJson, setGprJson] = useState<GPR | null>(null);
  const [gprFileName, setGprFileName] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [hashingFile, setHashingFile] = useState(false);
  const [publicKeyHex, setPublicKeyHex] = useState("");
  const [showKeyOverride, setShowKeyOverride] = useState(false);
  const gprFileRef = useRef<HTMLInputElement>(null);
  const hashFileRef = useRef<HTMLInputElement>(null);

  // Mode: db — GPR from database by ID
  const [gprId, setGprId] = useState("");
  const [dbFileHash, setDbFileHash] = useState("");
  const [dbHashingFile, setDbHashingFile] = useState(false);
  const [dbPublicKeyHex, setDbPublicKeyHex] = useState("");
  const [dbShowKeyOverride, setDbShowKeyOverride] = useState(false);
  const dbFileRef = useRef<HTMLInputElement>(null);

  // Mode: ots — .ots DetachedTimestampFile + optional .canonical
  const [otsData, setOtsData] = useState<string>("");
  const [otsFileName, setOtsFileName] = useState("");
  const [canonicalText, setCanonicalText] = useState<string>("");
  const [canonicalFileName, setCanonicalFileName] = useState("");
  const otsFileRef = useRef<HTMLInputElement>(null);
  const canonicalFileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setResult(null);
    setError("");
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleGprFile(file: File) {
    reset();
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text) as GPR;
      setGprJson(parsed);
      setGprFileName(file.name);
    } catch {
      setError("Invalid GPR JSON file");
    }
  }

  async function handleHashFile(file: File) {
    setHashingFile(true);
    setFileHash(await hashFile(file));
    setHashingFile(false);
  }

  async function handleDbHashFile(file: File) {
    setDbHashingFile(true);
    setDbFileHash(await hashFile(file));
    setDbHashingFile(false);
  }

  async function handleOtsFile(file: File) {
    reset();
    const b64 = await readFileAsBase64(file);
    setOtsData(b64);
    setOtsFileName(file.name);
  }

  async function handleCanonicalFile(file: File) {
    const text = await readFileAsText(file);
    setCanonicalText(text);
    setCanonicalFileName(file.name);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function submit(body: Record<string, unknown>, endpoint: string) {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        setResult(json as VerifyResult);
      } else {
        setError((json as { error?: string }).error ?? "Verification failed");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGprSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gprJson || !fileHash) return;
    await submit(
      {
        fileHash,
        gpr: gprJson,
        ...(publicKeyHex.trim() ? { publicKeyHex: publicKeyHex.trim() } : {}),
      },
      "/api/verify"
    );
  }

  async function handleDbSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gprId || !dbFileHash) return;
    await submit(
      {
        fileHash: dbFileHash,
        ...(dbPublicKeyHex.trim() ? { publicKeyHex: dbPublicKeyHex.trim() } : {}),
      },
      `/api/gprs/${encodeURIComponent(gprId)}/verify`
    );
  }

  async function handleOtsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!otsData) return;
    await submit(
      {
        otsFile: otsData,
        ...(canonicalText ? { canonicalText } : {}),
      },
      "/api/verify"
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Verify</h1>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg border p-1 text-sm">
        {(
          [
            ["gpr_file", "External GPR"],
            ["db", "From database"],
            ["ots", "OTS file only"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); reset(); }}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Mode: External GPR + file ── */}
      {mode === "gpr_file" && (
        <form onSubmit={handleGprSubmit} className="space-y-4">
          {/* GPR JSON file */}
          <div className="space-y-1.5">
            <Label>GPR file (.gpr.json)</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={gprFileName || "No file selected"}
                className="text-xs text-muted-foreground cursor-pointer"
                onClick={() => gprFileRef.current?.click()}
              />
              <Button type="button" variant="outline" onClick={() => gprFileRef.current?.click()}>
                Browse
              </Button>
              <input
                ref={gprFileRef}
                type="file"
                accept=".json,.gpr.json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleGprFile(e.target.files[0])}
              />
            </div>
          </div>

          {/* File to verify */}
          <div className="space-y-1.5">
            <Label>File to verify</Label>
            <div className="flex gap-2">
              <Input
                value={fileHash}
                onChange={(e) => setFileHash(e.target.value)}
                placeholder="sha256:… or hash a file"
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => hashFileRef.current?.click()}
                disabled={hashingFile}
              >
                {hashingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hash file"}
              </Button>
              <input
                ref={hashFileRef}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleHashFile(e.target.files[0])}
              />
            </div>
          </div>

          {/* Optional key override */}
          <button
            type="button"
            onClick={() => setShowKeyOverride((v) => !v)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showKeyOverride ? "rotate-180" : ""}`} />
            Use custom public key
          </button>
          {showKeyOverride && (
            <div className="space-y-1.5">
              <Label>Public key override (hex)</Label>
              <Input
                value={publicKeyHex}
                onChange={(e) => setPublicKeyHex(e.target.value)}
                placeholder="64-char hex Ed25519 public key"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Overrides DID resolution and embedded key. Leave empty to use normal key resolution.
              </p>
            </div>
          )}

          <Button type="submit" disabled={loading || !gprJson || !fileHash}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      )}

      {/* ── Mode: DB lookup ── */}
      {mode === "db" && (
        <form onSubmit={handleDbSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>GPR ID (urn:uuid:…)</Label>
            <Input
              value={gprId}
              onChange={(e) => setGprId(e.target.value)}
              placeholder="urn:uuid:…"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>File to verify</Label>
            <div className="flex gap-2">
              <Input
                value={dbFileHash}
                onChange={(e) => setDbFileHash(e.target.value)}
                placeholder="sha256:… or hash a file"
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => dbFileRef.current?.click()}
                disabled={dbHashingFile}
              >
                {dbHashingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hash file"}
              </Button>
              <input
                ref={dbFileRef}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleDbHashFile(e.target.files[0])}
              />
            </div>
          </div>

          {/* Optional key override */}
          <button
            type="button"
            onClick={() => setDbShowKeyOverride((v) => !v)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${dbShowKeyOverride ? "rotate-180" : ""}`} />
            Use custom public key
          </button>
          {dbShowKeyOverride && (
            <div className="space-y-1.5">
              <Label>Public key override (hex)</Label>
              <Input
                value={dbPublicKeyHex}
                onChange={(e) => setDbPublicKeyHex(e.target.value)}
                placeholder="64-char hex Ed25519 public key"
                className="font-mono text-xs"
              />
            </div>
          )}

          <Button type="submit" disabled={loading || !gprId || !dbFileHash}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      )}

      {/* ── Mode: OTS file only ── */}
      {mode === "ots" && (
        <form onSubmit={handleOtsSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Verify only the OpenTimestamps proof structure. No GPR or signature check is
            performed. Confirms whether the OTS data contains a Bitcoin attestation.
          </p>

          {/* OTS binary file */}
          <div className="space-y-1.5">
            <Label>OTS file (.ots)</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={otsFileName || "No file selected"}
                className="text-xs text-muted-foreground cursor-pointer"
                onClick={() => otsFileRef.current?.click()}
              />
              <Button type="button" variant="outline" onClick={() => otsFileRef.current?.click()}>
                Browse
              </Button>
              <input
                ref={otsFileRef}
                type="file"
                accept=".ots"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleOtsFile(e.target.files[0])}
              />
            </div>
          </div>

          {/* Optional: .canonical file */}
          <div className="space-y-1.5">
            <Label>
              Canonical file (.canonical){" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={canonicalFileName || "No file selected"}
                className="text-xs text-muted-foreground cursor-pointer"
                onClick={() => canonicalFileRef.current?.click()}
              />
              <Button type="button" variant="outline" onClick={() => canonicalFileRef.current?.click()}>
                Browse
              </Button>
              <input
                ref={canonicalFileRef}
                type="file"
                accept=".canonical,.json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleCanonicalFile(e.target.files[0])}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Generated by <code className="font-mono">gami extract ots</code>. If provided,
              verifies that its SHA-256 matches the digest embedded in the .ots file.
            </p>
          </div>

          <Button type="submit" disabled={loading || !otsData}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify OTS
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      )}

      {/* Result */}
      {result && <ResultCard result={result} />}
    </div>
  );
}
