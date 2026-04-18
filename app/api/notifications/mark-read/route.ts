import { NextResponse } from "next/server";
import { markAllRead, hideAllRead } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const passportId = (session.user as any)?.passportId;
  if (!passportId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (body.hideRead) {
    hideAllRead(Number(passportId));
  } else {
    markAllRead(Number(passportId));
  }
  return NextResponse.json({ ok: true });
}
