import { eq, sql } from "drizzle-orm";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gprs } from "@/lib/db/schema";
import type { SessionData } from "@/lib/session";
import { sessionOptions } from "@/lib/session";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      status: gprs.status,
      count: sql<number>`count(*)`,
    })
    .from(gprs)
    .where(eq(gprs.institutionId, session.institutionId))
    .groupBy(gprs.status);

  const counts: Record<string, number> = {
    unsigned: 0,
    signed: 0,
    stamped: 0,
    upgraded: 0,
  };
  for (const r of rows) {
    counts[r.status] = Number(r.count);
  }
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0);

  return NextResponse.json(counts);
}
