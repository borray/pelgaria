import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const universe = db.prepare("SELECT * FROM universes WHERE id = ?").get(id);
  if (!universe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(universe);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, description, status } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: "Название обязательно" }, { status: 400 });

  const universe = db.prepare("SELECT id FROM universes WHERE id = ?").get(id);
  if (!universe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare(
    "UPDATE universes SET name = ?, description = ?, status = ? WHERE id = ?"
  ).run(name.trim(), description?.trim() || null, status, id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  db.prepare("DELETE FROM universes WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
