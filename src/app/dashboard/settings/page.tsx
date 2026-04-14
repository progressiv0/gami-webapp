"use client";

import { Copy, Download, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bytesToHex, derivePublicKey } from "@/lib/crypto";

interface Settings {
  keyId: string;
  publicKeyHex: string;
  institutionName: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Keygen state
  const [generating, setGenerating] = useState(false);
  const [generatedPriv, setGeneratedPriv] = useState("");
  const [generatedPub, setGeneratedPub] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d as Settings))
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleKeygen() {
    setGenerating(true);
    // Generate random 32-byte Ed25519 seed in the browser
    const privBytes = crypto.getRandomValues(new Uint8Array(32));
    const privHex = bytesToHex(privBytes);
    const pubHex = await derivePublicKey(privHex);
    setGeneratedPriv(privHex);
    setGeneratedPub(pubHex);
    if (settings) setSettings({ ...settings, publicKeyHex: pubHex });
    setGenerating(false);
  }

  function downloadPrivKey() {
    const blob = new Blob([generatedPriv], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ed25519.priv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Institution / key settings */}
      <Card>
        <CardHeader>
          <CardTitle>Institution Key</CardTitle>
          <CardDescription>
            The key ID and public key are embedded in every GPR created by this institution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings ? (
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Institution name</Label>
                <Input value={settings.institutionName} onChange={(e) => setSettings({ ...settings, institutionName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Key ID (DID reference)</Label>
                <Input value={settings.keyId} onChange={(e) => setSettings({ ...settings, keyId: e.target.value })} placeholder="did:web:example.org#key-1" />
              </div>
              <div className="space-y-1.5">
                <Label>Public key (hex)</Label>
                <div className="flex gap-2">
                  <Input value={settings.publicKeyHex} onChange={(e) => setSettings({ ...settings, publicKeyHex: e.target.value })} className="font-mono text-xs" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => copyToClipboard(settings.publicKeyHex)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {saved ? "Saved!" : "Save"}
              </Button>
            </form>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
        </CardContent>
      </Card>

      {/* Keygen */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Key Pair</CardTitle>
          <CardDescription>
            Generate a new Ed25519 key pair entirely in your browser. Save the private key securely — it is never sent to the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleKeygen} variant="outline" disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Generate new key pair
          </Button>

          {generatedPriv && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-destructive">Private key (save this now!)</span>
                <Button size="sm" variant="outline" onClick={downloadPrivKey}>
                  <Download className="mr-1 h-3 w-3" /> Download
                </Button>
              </div>
              <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{generatedPriv}</code>
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Public key</span>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generatedPub)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{generatedPub}</code>
              <p className="text-xs text-muted-foreground">Public key has been filled in the form above. Click Save to apply.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
