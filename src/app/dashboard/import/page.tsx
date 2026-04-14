"use client";

import { sha256 } from "@noble/hashes/sha2.js";
import { v4 as uuidv4 } from "uuid";
import { FileUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FileEntry {
  id: string;
  filename: string;
  fileHash: string;
  title: string;
  collection: string;
  language: string;
  rights: string;
  classificationCode: string;
}

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = sha256(new Uint8Array(buf));
  const hex = Array.from(digest)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "sha256:" + hex;
}

function emptyEntry(filename = "", fileHash = ""): FileEntry {
  return {
    id: uuidv4(),
    filename,
    fileHash,
    title: "",
    collection: "",
    language: "en",
    rights: "",
    classificationCode: "",
  };
}

export default function ImportPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<FileEntry[]>([emptyEntry()]);
  const [hashing, setHashing] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update(id: string, field: keyof FileEntry, value: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }

  async function handleFiles(files: FileList) {
    const newEntries: FileEntry[] = [];
    setHashing(new Set(files.length > 0 ? ["loading"] : []));
    for (const file of Array.from(files)) {
      const hash = await hashFile(file);
      newEntries.push(emptyEntry(file.name, hash));
    }
    setHashing(new Set());
    setEntries((prev) => {
      // Replace the single empty entry if it's the only one
      if (prev.length === 1 && !prev[0].fileHash && !prev[0].filename) {
        return newEntries;
      }
      return [...prev, ...newEntries];
    });
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = entries.filter((en) => en.fileHash);
    if (valid.length === 0) return;

    setSubmitting(true);
    const errors: string[] = [];
    let created = 0;

    for (const entry of valid) {
      const metadata: Record<string, string> = {};
      if (entry.title) metadata.title = entry.title;
      if (entry.collection) metadata.collection = entry.collection;
      if (entry.language) metadata.language = entry.language;
      if (entry.rights) metadata.rights = entry.rights;
      if (entry.classificationCode) metadata.classificationCode = entry.classificationCode;

      try {
        const res = await fetch("/api/gprs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileHash: entry.fileHash,
            filename: entry.filename || undefined,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          }),
        });
        if (res.ok) {
          created++;
        } else {
          const err = await res.json().catch(() => ({}));
          errors.push(`${entry.filename || entry.fileHash}: ${(err as { error?: string }).error ?? "failed"}`);
        }
      } catch (err) {
        errors.push(`${entry.filename}: ${err}`);
      }
    }

    setSubmitting(false);
    setResult({ created, errors });
    if (errors.length === 0) {
      setTimeout(() => router.push("/dashboard/gprs?status=unsigned"), 1200);
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Import Files</h1>

      {result ? (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-green-700 font-medium">✓ Created {result.created} GPR{result.created !== 1 ? "s" : ""}</p>
            {result.errors.map((e, i) => (
              <p key={i} className="text-sm text-destructive">{e}</p>
            ))}
            {result.errors.length === 0 && (
              <p className="text-sm text-muted-foreground">Redirecting to archive…</p>
            )}
            <Button variant="outline" size="sm" onClick={() => { setResult(null); setEntries([emptyEntry()]); }}>
              Import more
            </Button>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-10 text-center text-muted-foreground transition-colors hover:border-primary hover:bg-muted/20"
          >
            <FileUp className="mb-2 h-8 w-8" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs mt-1">Files will be hashed client-side (SHA-256). No upload to server.</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            {hashing.size > 0 && (
              <Loader2 className="mt-2 h-4 w-4 animate-spin" />
            )}
          </div>

          {/* Entries */}
          {entries.map((entry, idx) => (
            <Card key={entry.id}>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">
                  {entry.filename || `Entry ${idx + 1}`}
                </CardTitle>
                {entries.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2 space-y-1">
                  <Label>File hash (sha256:…)</Label>
                  <Input
                    value={entry.fileHash}
                    onChange={(e) => update(entry.id, "fileHash", e.target.value)}
                    placeholder="sha256:…"
                    className="font-mono text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Filename (optional)</Label>
                  <Input value={entry.filename} onChange={(e) => update(entry.id, "filename", e.target.value)} placeholder="document.pdf" />
                </div>
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input value={entry.title} onChange={(e) => update(entry.id, "title", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Collection</Label>
                  <Input value={entry.collection} onChange={(e) => update(entry.id, "collection", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Language</Label>
                  <Input value={entry.language} onChange={(e) => update(entry.id, "language", e.target.value)} placeholder="en" />
                </div>
                <div className="space-y-1">
                  <Label>Rights</Label>
                  <Input value={entry.rights} onChange={(e) => update(entry.id, "rights", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Classification code</Label>
                  <Input value={entry.classificationCode} onChange={(e) => update(entry.id, "classificationCode", e.target.value)} />
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEntries((prev) => [...prev, emptyEntry()])}
            >
              <Plus className="mr-1 h-4 w-4" /> Add entry
            </Button>
            <Button type="submit" disabled={submitting || entries.every((e) => !e.fileHash)}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create {entries.filter((e) => e.fileHash).length} GPR{entries.filter((e) => e.fileHash).length !== 1 ? "s" : ""}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
