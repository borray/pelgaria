import { NextResponse } from "next/server";
import { getAllPassports } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const user = session?.user as any;
  if (!session || user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const passports = getAllPassports();

  const STATUS_RU: Record<string, string> = {
    active: "Активен", blocked: "Заблокирован", wanted: "В розыске",
    deactivating: "Деактивируется", frozen: "Заморожен",
    temp_frozen: "Вр. заморожен", suspended: "Отстранён", deceased: "Выбыл",
  };
  const LEVEL_RU: Record<string, string> = {
    resident: "Житель", citizen: "Гражданин", honorary: "Почётный гражданин",
  };

  const header = ["Номер паспорта", "Никнейм", "Полное имя", "Уровень", "Статус", "Дата выдачи", "Выдан"].join(";");

  const rows = passports.map(p => [
    p.passport_number,
    p.minecraft_nick,
    p.full_name ?? "",
    LEVEL_RU[p.citizenship_level] ?? p.citizenship_level,
    STATUS_RU[p.status] ?? p.status,
    p.issue_date ?? p.created_at.slice(0, 10),
    p.issued_by_custom ?? p.issued_by_name ?? "Администрация",
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"));

  const csv = [header, ...rows].join("\r\n");
  const bom = "\uFEFF"; // UTF-8 BOM for Excel

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pelgaria-passports-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
