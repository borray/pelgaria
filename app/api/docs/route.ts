import { NextRequest, NextResponse } from "next/server";
import { createDocument } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, content = "", departmentId, sectionId, accessLevel = "public", docNumber, published = false } = body;

  if (!title || !departmentId) {
    return NextResponse.json({ error: "title and departmentId required" }, { status: 400 });
  }

  const authorId = Number((session.user as { id?: string })?.id ?? 1);
  const result = createDocument(
    title, content, Number(departmentId), authorId, published, accessLevel,
    docNumber || undefined, undefined, undefined, sectionId || undefined, undefined
  );

  return NextResponse.json({ id: (result as { lastInsertRowid: number }).lastInsertRowid });
}
