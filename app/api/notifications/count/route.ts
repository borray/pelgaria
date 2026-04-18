import { NextResponse } from "next/server";
import { getUnreadCount } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ count: 0 });
  const passportId = (session.user as any)?.passportId;
  if (!passportId) return NextResponse.json({ count: 0 });
  const count = getUnreadCount(Number(passportId));
  return NextResponse.json({ count });
}
