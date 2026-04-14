import { and, eq } from "drizzle-orm";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gprs } from "@/lib/db/schema";
import { stampGpr } from "@/lib/gami-client";
import { syncGprFile } from "@/lib/gpr-store";
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
  if (!gpr.proof.signature) {
    return NextResponse.json(
      { error: "GPR must be signed before stamping" },
      { status: 422 }
    );
  }

  let result;
  try {
    result = await stampGpr(gpr, true);
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 }
    );
  }

  const updatedGpr = result.gpr;
  const now = new Date().toISOString();
  await db
    .update(gprs)
    .set({ data: JSON.stringify(updatedGpr), status: "stamped", updatedAt: now })
    .where(eq(gprs.id, id));

  syncGprFile(updatedGpr);

  return NextResponse.json({
    gpr: updatedGpr,
    calendar: result.calendar,
    ots_error: result.ots_error,
  });
}
