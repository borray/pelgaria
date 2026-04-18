import { getAllPassports, deletePassport } from "@/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminPassportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const allPassports = getAllPassports();
  const passports = q
    ? allPassports.filter(p =>
        p.passport_number.toLowerCase().includes(q.toLowerCase()) ||
        p.minecraft_nick.toLowerCase().includes(q.toLowerCase()) ||
        (p.full_name ?? "").toLowerCase().includes(q.toLowerCase())
      )
    : allPassports;

  async function handleDelete(formData: FormData) {
    "use server";
    deletePassport(Number(formData.get("id")));
    revalidatePath("/admin/passports");
  }

  const STATUS_MAP: Record<string, string> = {
    active: "Активен", blocked: "Заблокирован", wanted: "В розыске",
    deactivating: "Деактивация", frozen: "Заморожен", temp_frozen: "Вр. заморожен",
    suspended: "Отстранён", deceased: "Выбыл",
  };
  const LEVEL_MAP: Record<string, string> = { resident: "Житель", citizen: "Гражданин", honorary: "Почётный" };

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
            Реестр
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
            Паспорта ({passports.length}{q ? ` из ${allPassports.length}` : ""})
          </h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <a href="/api/passports/export" className="btn-secondary" style={{ fontSize: "12px" }} title="Скачать CSV">
            ⬇ CSV
          </a>
          <Link href="/admin/passports/new" className="btn-primary">Выдать паспорт</Link>
        </div>
      </div>

      {/* Search */}
      <form method="get" style={{ display: "flex", gap: "8px" }}>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Поиск по нику, имени или номеру паспорта…"
          style={{
            flex: 1, padding: "8px 12px", borderRadius: "8px",
            border: "1px solid var(--border)", background: "var(--bg-surface)",
            color: "var(--text)", fontSize: "13px", fontFamily: "inherit", outline: "none",
          }}
        />
        <button type="submit" className="btn-secondary" style={{ fontSize: "13px" }}>Найти</button>
        {q && <Link href="/admin/passports" className="btn-secondary" style={{ fontSize: "13px" }}>Сбросить</Link>}
      </form>

      {passports.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "10px" }}>
          <div style={{ fontSize: "28px", color: "var(--border-strong)", marginBottom: "10px", fontFamily: "monospace" }}>—</div>
          <p style={{ color: "var(--text-muted)" }}>
            {q ? "Ничего не найдено" : "Паспортов ещё нет"}
          </p>
          {!q && <Link href="/admin/passports/new" className="btn-primary" style={{ marginTop: "14px", display: "inline-flex" }}>Создать первый</Link>}
        </div>
      ) : (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {passports.map((p) => (
            <div key={p.id} className="row-item" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                {/* Minecraft avatar */}
                <div style={{ width: "28px", height: "28px", flexShrink: 0, borderRadius: "4px", overflow: "hidden", border: "1px solid var(--border-strong)", background: "var(--bg-elevated)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://mc-heads.net/avatar/${encodeURIComponent(p.minecraft_nick)}/28`}
                    alt=""
                    width={28} height={28}
                    style={{ display: "block", imageRendering: "pixelated" }}
                  />
                </div>
                <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", flexShrink: 0 }}>{p.passport_number}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "13px" }}>{p.minecraft_nick}</div>
                  {p.full_name && <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{p.full_name}</div>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <span className={`badge status-${p.citizenship_level}`}>{LEVEL_MAP[p.citizenship_level] ?? p.citizenship_level}</span>
                <span
                  className={`badge status-${p.status}`}
                  style={p.status === "wanted" ? { animation: "pulse-wanted 1.5s ease-in-out infinite" } : undefined}
                >
                  {STATUS_MAP[p.status] ?? p.status}
                </span>
                <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{fmt(p.created_at)}</span>
                <Link href={`/admin/passports/${p.id}/print`} className="btn-secondary" style={{ fontSize: "12px", padding: "4px 10px" }} title="Распечатать">Печать</Link>
                <Link href={`/admin/passports/${p.id}/edit`} className="btn-secondary" style={{ fontSize: "12px", padding: "4px 10px" }}>Изменить</Link>
                <form action={handleDelete}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmButton type="submit" message={`Удалить паспорт ${p.passport_number}?`} className="btn-danger">Удалить</ConfirmButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
