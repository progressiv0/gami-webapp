"use client";

import { useState } from "react";
import { FileText, Clock, FileJson } from "lucide-react";
import { canonicalize } from "json-canonicalize";
import { sha256 } from "@noble/hashes/sha2.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GPR } from "@/lib/types";
import { toCanonicalObject } from "@/lib/gpr-builder";
import { bytesToHex, hexToBytes } from "@/lib/crypto";

// 31-byte magic that starts every .ots DetachedTimestampFile:
// "\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94"
const OTS_MAGIC = new Uint8Array([
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61,
  0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf,
  0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
]);

function downloadBlob(data: Uint8Array | string, filename: string, mime: string) {
  const blob = typeof data === "string"
    ? new Blob([data], { type: mime })
    : new Blob([data.buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function shortId(id: string): string {
  return id.replace(/^urn:uuid:/, "");
}

interface Props {
  gpr: GPR;
}

export function GprExtractPanel({ gpr }: Props) {
  const hasSignature = Boolean(gpr.proof.signature);
  const hasOTS = Boolean(gpr.proof.timestamp?.ots_data);

  const [signingInfo, setSigningInfo] = useState<{
    digestHex: string;
    sigHex: string;
    pubKeyHex: string;
  } | null>(null);

  if (!hasSignature && !hasOTS) return null;

  const base = shortId(gpr.id);

  function downloadOTS() {
    const ts = gpr.proof.timestamp!;
    const treeBytes = base64ToBytes(ts.ots_data!);
    const docHashHex = ts.document_hash.replace("sha256:", "");
    const docHash = hexToBytes(docHashHex);

    const otsFile = new Uint8Array(OTS_MAGIC.length + 1 + 1 + 32 + treeBytes.length);
    let pos = 0;
    otsFile.set(OTS_MAGIC, pos); pos += OTS_MAGIC.length;
    otsFile[pos++] = 0x01;
    otsFile[pos++] = 0x08;
    otsFile.set(docHash, pos); pos += 32;
    otsFile.set(treeBytes, pos);

    downloadBlob(otsFile, `${base}.ots`, "application/octet-stream");
  }

  function downloadCanonical() {
    const canonical = canonicalize(toCanonicalObject(gpr, ["timestamp"]));
    downloadBlob(canonical, `${base}.canonical.json`, "application/json");
  }

  function downloadSigning() {
    const canonical = canonicalize(toCanonicalObject(gpr, ["signature", "timestamp"]));
    downloadBlob(canonical, `${base}.signing.json`, "application/json");

    const hashBytes = sha256(new TextEncoder().encode(canonical));
    const digestHex = bytesToHex(hashBytes);
    const sigHex = gpr.proof.signature?.replace("ed25519:", "") ?? "";
    const pubKeyHex = gpr.proof.public_key_hex ?? `<resolve from ${gpr.proof.key_id}>`;

    setSigningInfo({ digestHex, sigHex, pubKeyHex });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
          Extract
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* OTS extract */}
        {hasOTS && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Download the OTS proof and canonical document for external verification
              via the <code>ots</code> CLI or{" "}
              <a href="https://opentimestamps.org" target="_blank" rel="noreferrer" className="underline">
                opentimestamps.org
              </a>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={downloadOTS}>
                <Clock className="mr-1 h-3.5 w-3.5" />
                Download .ots
              </Button>
              <Button size="sm" variant="outline" onClick={downloadCanonical}>
                <FileJson className="mr-1 h-3.5 w-3.5" />
                Download .canonical.json
              </Button>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              ots verify {base}.canonical.json {base}.ots
            </p>
          </div>
        )}

        {hasSignature && hasOTS && <hr className="border-border" />}

        {/* Signing extract */}
        {hasSignature && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Download the exact bytes that were signed (JCS payload without{" "}
              <code>proof.signature</code> and <code>proof.timestamp</code>).
            </p>
            <Button size="sm" variant="outline" onClick={downloadSigning}>
              <FileText className="mr-1 h-3.5 w-3.5" />
              Download .signing.json
            </Button>

            {signingInfo && (
              <div className="rounded bg-muted p-3 space-y-2 text-xs font-mono break-all">
                <div>
                  <span className="text-muted-foreground">SHA-256 of payload:</span>
                  <div>{signingInfo.digestHex}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Signature (ed25519, hex):</span>
                  <div>{signingInfo.sigHex}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Public key (ed25519, hex){signingInfo.pubKeyHex.startsWith("<") ? " — DID resolution required" : ""}:
                  </span>
                  <div>{signingInfo.pubKeyHex}</div>
                </div>
                <div className="mt-2">
                  <span className="text-muted-foreground block mb-1">Verify with Python:</span>
                  <pre className="whitespace-pre-wrap leading-relaxed text-[11px]">{`from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
import hashlib, binascii
pub = Ed25519PublicKey.from_public_bytes(binascii.unhexlify('${signingInfo.pubKeyHex}'))
data = open('${base}.signing.json', 'rb').read()
sig  = binascii.unhexlify('${signingInfo.sigHex}')
pub.verify(sig, hashlib.sha256(data).digest())
print('Signature VALID')`}</pre>
                </div>
              </div>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
