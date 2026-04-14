import { and, asc, desc, eq, like, or } from "drizzle-orm";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gprs, institutions } from "@/lib/db/schema";
import { buildGpr, gprStatus } from "@/lib/gpr-builder";
import { syncGprFile } from "@/lib/gpr-store";
import type { SessionData } from "@/lib/session";
import { sessionOptions } from "@/lib/session";
import type { GPR } from "@/lib/types";

// ── GET /api/gprs ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const collection = searchParams.get("collection") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(gprs.institutionId, session.institutionId)];
  if (status) conditions.push(eq(gprs.status, status as "unsigned" | "signed" | "stamped" | "upgraded"));
  if (collection) conditions.push(eq(gprs.collection, collection));
  if (search) {
    conditions.push(
      or(
        like(gprs.filename, `%${search}%`),
        like(gprs.fileHash, `%${search}%`),
        like(gprs.collection, `%${search}%`)
      )!
    );
  }

  const where = and(...conditions);

  const rows = await db
    .select()
    .from(gprs)
    .where(where)
    .orderBy(desc(gprs.createdAt))
    .limit(pageSize)
    .offset(offset);

  const total = await db
    .select({ id: gprs.id })
    .from(gprs)
    .where(where)
    .then((r) => r.length);

  // Distinct collections for filter dropdown
  const collections = await db
    .selectDistinct({ collection: gprs.collection })
    .from(gprs)
    .where(eq(gprs.institutionId, session.institutionId))
    .orderBy(asc(gprs.collection))
    .then((r) => r.map((x) => x.collection).filter(Boolean));

  return NextResponse.json({
    rows: rows.map((r) => ({
      ...r,
      data: JSON.parse(r.data) as GPR,
    })),
    total,
    page,
    pageSize,
    collections,
  });
}

// ── POST /api/gprs ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { fileHash, filename, metadata, parentId } = body as {
    fileHash?: string;
    filename?: string;
    metadata?: Record<string, string>;
    parentId?: string;
  };

  if (!fileHash) {
    return NextResponse.json({ error: "fileHash is required" }, { status: 400 });
  }

  // Get institution key_id for the GPR
  const institution = await db
    .select()
    .from(institutions)
    .where(eq(institutions.id, session.institutionId))
    .limit(1)
    .then((r) => r[0]);

  const keyId = institution?.keyId || "did:web:localhost#key-1";

  const gpr = buildGpr({
    fileHash,
    filename,
    keyId,
    metadata,
    parentId,
  });

  const now = new Date().toISOString();
  await db.insert(gprs).values({
    id: gpr.id,
    institutionId: session.institutionId,
    data: JSON.stringify(gpr),
    status: gprStatus(gpr),
    filename: gpr.subject.filename ?? "",
    fileHash: gpr.subject.file_hash,
    collection: gpr.subject.metadata?.collection ?? "",
    createdAt: now,
    updatedAt: now,
  });

  syncGprFile(gpr);

  return NextResponse.json({ gpr }, { status: 201 });
}
