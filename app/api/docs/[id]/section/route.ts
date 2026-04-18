import { auth } from "@/auth";
import { updateDocumentSection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const sectionId = body.sectionId === null ? null : Number(body.sectionId);

  updateDocumentSection(Number(id), sectionId);
  return NextResponse.json({ ok: true });
}
