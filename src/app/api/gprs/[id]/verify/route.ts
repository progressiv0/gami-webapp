import { and, eq } from "drizzle-orm";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gprs } from "@/lib/db/schema";
import { verifyExternal } from "@/lib/gami-client";
import type { SessionData } from "@/lib/session";
import { sessionOptions } from "@/lib/session";
import type { GPR } from "@/lib/types";

export async function POST(
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
  const body = await req.json().catch(() => ({})) as {
    fileHash?: string;
    publicKeyHex?: string;
  };

  if (!body.fileHash) {
    return NextResponse.json({ error: "fileHash is required" }, { status: 400 });
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

  try {
    const result = await verifyExternal(body.fileHash, gpr, body.publicKeyHex);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 }
    );
  }
}
