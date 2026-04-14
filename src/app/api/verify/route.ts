/**
 * POST /api/verify
 *
 * External verification — GPR is provided by the caller, not fetched from the DB.
 * Modes determined by which fields are present:
 *   - Full:       { fileHash, gpr }
 *   - Override:   { fileHash, gpr, publicKeyHex }
 *   - OTS raw:    { otsData }  (fileHash optional — raw tree bytes from GPR ots_data)
 *   - OTS file:   { otsFile }  (base64 of .ots DetachedTimestampFile, canonicalText optional)
 */
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { SessionData } from "@/lib/session";
import { sessionOptions } from "@/lib/session";
import type { GPR } from "@/lib/types";
import { verifyExternal, verifyOts, verifyOtsFile } from "@/lib/gami-client";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    fileHash?: string;
    gpr?: GPR;
    publicKeyHex?: string;
    otsData?: string;
    otsFile?: string;
    canonicalText?: string;
  };

  try {
    // .ots DetachedTimestampFile mode (exported .ots + optional .canonical)
    if (body.otsFile && !body.gpr) {
      const result = await verifyOtsFile(body.otsFile, body.canonicalText);
      return NextResponse.json(result);
    }

    // Raw OTS tree bytes from GPR ots_data field
    if (body.otsData && !body.gpr) {
      const result = await verifyOts(body.otsData, body.fileHash);
      return NextResponse.json(result);
    }

    // Full or key-override GPR verification
    if (!body.gpr) {
      return NextResponse.json({ error: "gpr, otsFile, or otsData is required" }, { status: 400 });
    }
    if (!body.fileHash) {
      return NextResponse.json({ error: "fileHash is required" }, { status: 400 });
    }

    const result = await verifyExternal(body.fileHash, body.gpr, body.publicKeyHex);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 }
    );
  }
}
