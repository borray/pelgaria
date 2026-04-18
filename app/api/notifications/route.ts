import { NextResponse } from "next/server";
import { getNotificationsByPassport } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const passportId = (session.user as any)?.passportId;
  if (!passportId) return NextResponse.json([]);
  const notifications = getNotificationsByPassport(Number(passportId));
  return NextResponse.json(notifications);
}
