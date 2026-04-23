"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Stamp,
  TrendingUp,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { GprExtractPanel } from "@/components/gprs/GprExtractPanel";
import { GprStatusBadge } from "@/components/gprs/GprStatusBadge";
import { SignDialog } from "@/components/gprs/SignDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GprRow } from "@/lib/types";

export default function GprDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = decodeURIComponent(rawId);
  const [row, setRow] = useState<GprRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [signOpen, setSignOpen] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/gprs/${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      setRow({ ...data, data: data.data });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function doStamp() {
    setActionLoading(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/gprs/${encodeURIComponent(id)}/stamp`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setActionMsg({ ok: true, text: `Stamped via ${json.calendar ?? "calendar"}` });
        load();
      } else {
        setActionMsg({ ok: false, text: json.error ?? "Stamp failed" });
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function doUpgrade() {
    setActionLoading(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/gprs/${encodeURIComponent(id)}/upgrade`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        if (json.confirmed) {
          setActionMsg({ ok: true, text: `Bitcoin confirmed via ${json.calendar}` });
          load();
        } else {
          setActionMsg({ ok: false, text: "Not yet confirmed. Try again later." });
        }
      } else {
        setActionMsg({ ok: false, text: json.error ?? "Upgrade failed" });
      }
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!row) {
    return <div className="p-6 text-muted-foreground">GPR not found.</div>;
  }

  const gpr = row.data;

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/gprs" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold truncate">
          {row.filename || <span className="italic text-muted-foreground">unnamed</span>}
        </h1>
        <GprStatusBadge status={row.status} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {row.status === "unsigned" && (
          <Button size="sm" onClick={() => setSignOpen(true)}>
            Sign
          </Button>
        )}
        {row.status === "signed" && (
          <Button size="sm" onClick={doStamp} disabled={actionLoading}>
            {actionLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Stamp className="mr-1 h-4 w-4" />}
            Stamp (submit to OTS)
          </Button>
        )}
        {row.status === "stamped" && (
          <Button size="sm" onClick={doUpgrade} disabled={actionLoading}>
            {actionLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-1 h-4 w-4" />}
            Upgrade (fetch Bitcoin proof)
          </Button>
        )}
        {actionMsg && (
          <span className={`flex items-center gap-1 text-sm ${actionMsg.ok ? "text-green-700" : "text-destructive"}`}>
            {actionMsg.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {actionMsg.text}
          </span>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">File</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <div className="font-mono text-xs break-all">{gpr.subject.file_hash}</div>
            {gpr.subject.metadata && Object.keys(gpr.subject.metadata).length > 0 && (
              <div className="mt-2 space-y-0.5">
                {Object.entries(gpr.subject.metadata).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-muted-foreground min-w-[90px]">{k}:</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Proof</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-[70px]">Key ID:</span>
              <span className="font-mono text-xs break-all">{gpr.proof.key_id}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-[70px]">Created:</span>
              <span>{new Date(gpr.proof.created).toLocaleString()}</span>
            </div>
            {gpr.proof.timestamp && (
              <>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[70px]">Calendar:</span>
                  <span className="text-xs break-all">{gpr.proof.timestamp.calendar}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[70px]">Submitted:</span>
                  <span>{gpr.proof.timestamp.submitted_at ? new Date(gpr.proof.timestamp.submitted_at).toLocaleString() : "—"}</span>
                </div>
              </>
            )}
            {gpr.parent && (
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[70px]">Parent:</span>
                <Link href={`/dashboard/gprs/${encodeURIComponent(gpr.parent)}`} className="text-primary text-xs hover:underline font-mono break-all">
                  {gpr.parent}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <GprExtractPanel gpr={gpr} />

      {/* Raw JSON */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Raw GPR JSON</CardTitle></CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs leading-relaxed">
            {JSON.stringify(gpr, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <SignDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        gprs={[row]}
        onDone={() => { setSignOpen(false); load(); }}
      />
    </div>
  );
}
