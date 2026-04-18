import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDb, updateUsername, usernameExists, getPassportById, getPassportByUserId, changePassportPin } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import Link from "next/link";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as any;
  const { msg, err } = await searchParams;
  const isPassportLogin = String(user.id ?? "").startsWith("passport:");

  // Find linked passport for either login method
  let passport: ReturnType<typeof getPassportById> = undefined;
  if (user?.passportId) passport = getPassportById(Number(user.passportId));
  if (!passport && !isPassportLogin && user?.id) passport = getPassportByUserId(Number(user.id));

  /* ─── Server Actions ─── */

  async function handleChangePassword(formData: FormData) {
    "use server";
    const s = await auth();
    const u = s?.user as any;
    if (!u?.id || String(u.id).startsWith("passport:")) return;
    const current = formData.get("current_password") as string;
    const newPass  = formData.get("new_password") as string;
    const confirm  = formData.get("confirm_password") as string;
    if (!current || !newPass || newPass !== confirm || newPass.length < 6) {
      redirect("/settings?err=Проверьте поля: пароль минимум 6 символов, пароли должны совпадать");
    }
    const db = getDb();
    const dbUser = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(u.id)) as any;
    if (!dbUser) redirect("/settings?err=Пользователь не найден");
    const ok = await bcrypt.compare(current, dbUser.password_hash);
    if (!ok) redirect("/settings?err=Неверный текущий пароль");
    const hash = bcrypt.hashSync(newPass, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, Number(u.id));
    redirect("/settings?msg=Пароль успешно обновлён");
  }

  async function handleChangeUsername(formData: FormData) {
    "use server";
    const s = await auth();
    const u = s?.user as any;
    if (!u?.id || String(u.id).startsWith("passport:")) return;
    const newName = (formData.get("new_username") as string)?.trim();
    if (!newName || newName.length < 2 || newName.length > 32) {
      redirect("/settings?err=Имя: от 2 до 32 символов");
    }
    if (usernameExists(newName, Number(u.id))) redirect("/settings?err=Это имя уже занято");
    updateUsername(Number(u.id), newName);
    redirect("/login?msg=Имя изменено, войдите снова");
  }

  async function handleChangePin(formData: FormData) {
    "use server";
    const s = await auth();
    const u = s?.user as any;
    // Must be passport login
    const pid = u?.passportId;
    if (!pid) redirect("/settings?err=Паспорт не найден");
    const current = (formData.get("current_pin") as string)?.trim() || null;
    const newPin  = (formData.get("new_pin") as string)?.trim();
    const confirm = (formData.get("confirm_pin") as string)?.trim();
    if (!newPin || newPin !== confirm) {
      redirect("/settings?err=PIN-коды не совпадают");
    }
    const result = await changePassportPin(Number(pid), current, newPin);
    if (!result.ok) redirect(`/settings?err=${encodeURIComponent(result.error ?? "Ошибка")}`);
    redirect("/settings?msg=PIN-код успешно обновлён");
  }

  /* ─── Styles ─── */
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: "8px",
    border: "1px solid var(--border-strong)", background: "var(--bg-elevated)",
    color: "var(--text)", fontSize: "13.5px", outline: "none",
    fontFamily: "var(--font-body)",
  };
  const sectionStyle: React.CSSProperties = { borderRadius: "10px", border: "1px solid var(--border)", overflow: "hidden" };
  const sectionHeader: React.CSSProperties = {
    padding: "12px 18px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)",
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)",
  };

  return (
    <div className="page-enter" style={{ maxWidth: "500px" }}>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Личный кабинет
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
          Настройки аккаунта
        </h1>
      </div>

      {/* Account card */}
      <div className="card-glow" style={{ padding: "16px 20px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: "50%", background: "var(--accent)", color: "var(--bg)",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "17px", flexShrink: 0,
        }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>{user?.name}</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {user?.role === "admin" ? "Администратор" : "Гражданин"}
            {user?.passportNumber ? ` · ${user.passportNumber}` : ""}
          </div>
        </div>
        <Link href="/profile" style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "12px", textDecoration: "none" }}>← Профиль</Link>
      </div>

      {/* Feedback messages */}
      {msg && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", background: "var(--green-bg)", border: "1px solid var(--green)", color: "var(--green)", fontSize: "13px", marginBottom: "16px" }}>
          ✓ {msg}
        </div>
      )}
      {err && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", background: "var(--red-bg)", border: "1px solid var(--red)", color: "var(--red)", fontSize: "13px", marginBottom: "16px" }}>
          ✕ {err}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* ── Passport-login: change PIN ─────────────────── */}
        {isPassportLogin && (
          <div style={sectionStyle}>
            <div style={sectionHeader}>Смена PIN-кода паспорта</div>
            <form action={handleChangePin} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Текущий PIN {!passport?.pin_hash && <span style={{ fontWeight: 400, textTransform: "none" }}>(оставьте пустым, если PIN не задан)</span>}
                </label>
                <input name="current_pin" type="password" inputMode="numeric" placeholder="••••"
                  style={{ ...inputStyle, letterSpacing: "0.3em", fontFamily: "monospace" }} autoComplete="current-password" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Новый PIN
                  </label>
                  <input name="new_pin" type="password" inputMode="numeric" required minLength={4} placeholder="••••"
                    style={{ ...inputStyle, letterSpacing: "0.3em", fontFamily: "monospace" }} autoComplete="new-password" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Повторите
                  </label>
                  <input name="confirm_pin" type="password" inputMode="numeric" required minLength={4} placeholder="••••"
                    style={{ ...inputStyle, letterSpacing: "0.3em", fontFamily: "monospace" }} autoComplete="new-password" />
                </div>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Минимум 4 символа. PIN используется для входа по паспорту.
              </p>
              <button type="submit" className="btn-primary" style={{ fontSize: "13px" }}>
                Обновить PIN
              </button>
            </form>
          </div>
        )}

        {/* ── Username/password login: change username + password ── */}
        {!isPassportLogin && (
          <>
            <div style={sectionStyle}>
              <div style={sectionHeader}>Имя пользователя</div>
              <form action={handleChangeUsername} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Новое имя пользователя
                  </label>
                  <input name="new_username" defaultValue={user?.name} required minLength={2} maxLength={32}
                    placeholder="2–32 символа" style={inputStyle} />
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px" }}>
                    ⚠ После смены имени вас попросят войти снова
                  </p>
                </div>
                <button type="submit" className="btn-primary" style={{ fontSize: "13px" }}>
                  Сменить имя
                </button>
              </form>
            </div>

            <div style={sectionStyle}>
              <div style={sectionHeader}>Смена пароля</div>
              <form action={handleChangePassword} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Текущий пароль
                  </label>
                  <input name="current_password" type="password" required style={inputStyle} autoComplete="current-password" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Новый пароль
                    </label>
                    <input name="new_password" type="password" required minLength={6} style={inputStyle} autoComplete="new-password" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Повторите
                    </label>
                    <input name="confirm_password" type="password" required minLength={6} style={inputStyle} autoComplete="new-password" />
                  </div>
                </div>
                <button type="submit" className="btn-primary" style={{ fontSize: "13px" }}>
                  Обновить пароль
                </button>
              </form>
            </div>
          </>
        )}

        {/* ── Linked passport info (for password-login users) ── */}
        {!isPassportLogin && passport && (
          <div style={sectionStyle}>
            <div style={sectionHeader}>Привязанный паспорт</div>
            <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
              <img
                src={`https://mc-heads.net/avatar/${encodeURIComponent(passport.minecraft_nick)}/36`}
                alt={passport.minecraft_nick}
                width={36} height={36}
                style={{ borderRadius: "4px", imageRendering: "pixelated", border: "1px solid var(--border-strong)", display: "block" }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--text)" }}>{passport.minecraft_nick}</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "monospace" }}>{passport.passport_number}</div>
              </div>
              <Link href="/profile" style={{ marginLeft: "auto", fontSize: "12px", color: "var(--blue)", textDecoration: "none" }}>Открыть →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
