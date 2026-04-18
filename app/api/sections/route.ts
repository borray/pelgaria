import { auth } from "@/auth";
import { createSection, getAllSections } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const sections = getAllSections();
  return NextResponse.json(sections);
}

export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const result = createSection({
    title: body.title,
    parent_id: body.parent_id ?? null,
    department_id: Number(body.department_id),
    sort_order: body.sort_order ?? 0,
  });
  return NextResponse.json({ id: (result as any).lastInsertRowid });
}
