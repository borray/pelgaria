import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const universes = db.prepare("SELECT * FROM universes ORDER BY created_at DESC").all();
  return NextResponse.json(universes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, code, description, status } = await req.json();

  if (!name?.trim())          return NextResponse.json({ error: "Название обязательно" },   { status: 400 });
  if (!code?.trim())          return NextResponse.json({ error: "Код обязателен" },          { status: 400 });
  if (!/^[A-Z]{2,3}$/.test(code)) return NextResponse.json({ error: "Код: 2–3 латинских буквы" }, { status: 400 });

  const exists = db.prepare("SELECT id FROM universes WHERE code = ?").get(code);
  if (exists) return NextResponse.json({ error: `Код ${code} уже занят` }, { status: 409 });

  const result = db.prepare(
    "INSERT INTO universes (name, code, description, status, created_by) VALUES (?, ?, ?, ?, ?)"
  ).run(name.trim(), code, description?.trim() || null, status || "active", session.user.id);

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
