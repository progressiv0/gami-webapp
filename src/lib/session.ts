import type { SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export interface SessionData {
  userId: number;
  username: string;
  institutionId: number;
  role: string;
}

export const sessionOptions: SessionOptions = {
  cookieName: "gami_session",
  password: process.env.SESSION_SECRET ?? "change-me-to-a-random-32-char-secret",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
  },
};

/** Get the session from a Next.js API route request. */
export async function getSession(req: NextRequest, res: NextResponse) {
  return getIronSession<SessionData>(req, res, sessionOptions);
}

/**
 * Route helper that rejects unauthenticated requests.
 * Usage:
 *   const { session, response } = await requireAuth(req);
 *   if (response) return response;
 */
export async function requireAuth(req: NextRequest): Promise<
  | { session: SessionData; response: null }
  | { session: null; response: NextResponse }
> {
  const res = new NextResponse();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, response: null };
}
