"use client";

import { CheckCircle2, KeyRound, Loader2, UploadCloud, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { derivePublicKey, signGpr } from "@/lib/crypto";
import type { GPR, GprRow } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  gprs: GprRow[];
  onDone: () => void;
}

type ItemState = "pending" | "signing" | "ok" | "error";

export function SignDialog({ open, onClose, gprs, onDone }: Props) {
  const [privateKey, setPrivateKey] = useState("");
  const [derivedPubKey, setDerivedPubKey] = useState("");
  const [pubKeyError, setPubKeyError] = useState("");
  const [items, setItems] = useState<{ id: string; label: string; state: ItemState; error?: string }[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleKeyChange(value: string) {
    setPrivateKey(value);
    setDerivedPubKey("");
    setPubKeyError("");
    const hex = value.trim();
    if (hex.length === 64 || hex.length === 128) {
      try {
        const pub = await derivePublicKey(hex);
        setDerivedPubKey(pub);
      } catch (err) {
        setPubKeyError(`Invalid key: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  async function loadKeyFile(file: File) {
    const text = (await file.text()).trim();
    handleKeyChange(text);
  }

  function handleOpen() {
    setItems(
      gprs.map((g) => ({
        id: g.id,
        label: g.filename || g.id.slice(9, 17),
        state: "pending",
      }))
    );
    setPrivateKey("");
    setDerivedPubKey("");
    setPubKeyError("");
    setRunning(false);
    setDragging(false);
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────────

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadKeyFile(file);
  }

  // ── Signing ──────────────────────────────────────────────────────────────────

  async function handleSign() {
    if (!privateKey.trim() || !derivedPubKey) return;
    setRunning(true);

    for (let i = 0; i < gprs.length; i++) {
      const row = gprs[i];
      setItems((prev) =>
        prev.map((it) => (it.id === row.id ? { ...it, state: "signing" } : it))
      );

      try {
        const gpr = row.data as GPR;
        const { signature, publicKeyHex } = await signGpr(gpr, privateKey.trim());

        const res = await fetch(`/api/gprs/${encodeURIComponent(row.id)}/sign`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signature, publicKeyHex }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? "Server error");
        }

        setItems((prev) =>
          prev.map((it) => (it.id === row.id ? { ...it, state: "ok" } : it))
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === row.id
              ? { ...it, state: "error", error: String(err instanceof Error ? err.message : err) }
              : it
          )
        );
      }
    }

    setRunning(false);
    setPrivateKey(""); // zero the key
    onDone();
  }

  const allDone = items.length > 0 && items.every((it) => it.state === "ok" || it.state === "error");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !running) onClose(); }}>
      <DialogContent className="max-w-lg" onOpenAutoFocus={() => handleOpen()}>
        <DialogHeader>
          <DialogTitle>Sign GPRs</DialogTitle>
          <DialogDescription>
            Load or paste your Ed25519 private key (64 hex chars). Signing happens entirely
            in your browser — the key never leaves this page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* GPR list */}
          <div className="rounded-md border divide-y text-sm max-h-36 overflow-y-auto">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between px-3 py-2">
                <span className="truncate text-muted-foreground">{it.label}</span>
                <span className="ml-2 shrink-0">
                  {it.state === "pending" && <span className="text-muted-foreground">—</span>}
                  {it.state === "signing" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                  {it.state === "ok" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {it.state === "error" && (
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-4 w-4" />
                      <span className="text-xs">{it.error}</span>
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Key input — drop zone + textarea */}
          <div className="space-y-2">
            <Label>Private key (hex)</Label>

            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => !running && !allDone && fileRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && !running && !allDone && fileRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-4 text-sm transition-colors cursor-pointer select-none
                ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}
                ${running || allDone ? "pointer-events-none opacity-50" : ""}
              `}
            >
              <UploadCloud className="h-6 w-6 text-muted-foreground" />
              <span className="font-medium">
                {dragging ? "Drop to load key" : "Drop .priv file here, or click to browse"}
              </span>
              <span className="text-xs text-muted-foreground">Accepts any plain-text file containing 64 hex chars</span>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".priv,.txt,.hex"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && loadKeyFile(e.target.files[0])}
            />

            {/* Manual paste */}
            <Textarea
              placeholder="…or paste the 64-hex key here"
              value={privateKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              className="font-mono text-xs"
              rows={2}
              disabled={running || allDone}
            />

            {/* Key status */}
            {derivedPubKey && (
              <div className="flex items-center gap-1.5 text-xs text-green-700">
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono truncate">pub: {derivedPubKey.slice(0, 24)}…</span>
              </div>
            )}
            {pubKeyError && (
              <p className="text-xs text-destructive">{pubKeyError}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={running}>
              Cancel
            </Button>
            {allDone ? (
              <Button onClick={onClose}>Done</Button>
            ) : (
              <Button onClick={handleSign} disabled={running || !derivedPubKey}>
                {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign {gprs.length} GPR{gprs.length !== 1 ? "s" : ""}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
