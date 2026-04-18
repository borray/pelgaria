import { NextRequest, NextResponse } from "next/server";
import { getNotificationById, updateNotification, markOneRead, hideNotification } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const notif = getNotificationById(Number(id));
  if (!notif) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(notif);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const role = (session.user as any)?.role;
  const passportId = (session.user as any)?.passportId;

  if (role !== "admin") {
    if (!passportId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (body.is_read === 1) {
      markOneRead(Number(id), Number(passportId));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  updateNotification(Number(id), { type: body.type, title: body.title, content: body.content });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const passportId = (session.user as any)?.passportId;
  if (!passportId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  hideNotification(Number(id), Number(passportId));
  return NextResponse.json({ ok: true });
}
