import { eq } from "drizzle-orm";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import type { SessionData } from "@/lib/session";
import { sessionOptions } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inst = await db
    .select()
    .from(institutions)
    .where(eq(institutions.id, session.institutionId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!inst) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    institutionName: inst.name,
    keyId: inst.keyId ?? "",
    publicKeyHex: inst.publicKeyHex ?? "",
  });
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { institutionName, keyId, publicKeyHex } = body as {
    institutionName?: string;
    keyId?: string;
    publicKeyHex?: string;
  };

  await db
    .update(institutions)
    .set({
      ...(institutionName !== undefined && { name: institutionName }),
      ...(keyId !== undefined && { keyId }),
      ...(publicKeyHex !== undefined && { publicKeyHex }),
    })
    .where(eq(institutions.id, session.institutionId));

  return NextResponse.json({ ok: true });
}
