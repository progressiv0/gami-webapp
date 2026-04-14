import { and, eq } from "drizzle-orm";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gprs } from "@/lib/db/schema";
import { syncGprFile } from "@/lib/gpr-store";
import type { SessionData } from "@/lib/session";
import { sessionOptions } from "@/lib/session";
import type { GPR } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const body = await req.json().catch(() => ({}));
  const { signature, publicKeyHex } = body as {
    signature?: string;
    publicKeyHex?: string;
  };

  if (!signature) {
    return NextResponse.json({ error: "signature is required" }, { status: 400 });
  }

  const row = await db
    .select()
    .from(gprs)
    .where(and(eq(gprs.id, id), eq(gprs.institutionId, session.institutionId)))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const gpr = JSON.parse(row.data) as GPR;
  gpr.proof.signature = signature;
  if (publicKeyHex) gpr.proof.public_key_hex = publicKeyHex;

  const now = new Date().toISOString();
  await db
    .update(gprs)
    .set({ data: JSON.stringify(gpr), status: "signed", updatedAt: now })
    .where(eq(gprs.id, id));

  syncGprFile(gpr);

  return NextResponse.json({ gpr });
}
