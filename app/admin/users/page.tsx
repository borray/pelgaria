import { getAllUsers, createUser, deleteUser, updateUserRole } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import ConfirmButton from "@/components/ConfirmButton";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminUsersPage() {
  const users = getAllUsers();
  const session = await auth();
  const currentUserId = (session?.user as { id?: string })?.id;

  async function handleCreate(formData: FormData) {
    "use server";
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as "admin" | "citizen";
    if (username && password) createUser(username, password, role);
    revalidatePath("/admin/users");
  }

  async function handleDelete(formData: FormData) {
    "use server";
    deleteUser(Number(formData.get("id")));
    revalidatePath("/admin/users");
  }

  async function handleRoleChange(formData: FormData) {
    "use server";
    updateUserRole(Number(formData.get("id")), formData.get("role") as "admin" | "citizen");
    revalidatePath("/admin/users");
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--bg)",
    border: "1px solid var(--border-strong)",
    color: "var(--text)",
    padding: "7px 11px",
    borderRadius: "7px",
    fontSize: "13px",
    outline: "none",
  };

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* User list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <h2 style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
          Пользователи ({users.length})
        </h2>
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {users.map((user) => (
            <div
              key={user.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: "8px", gap: "12px",
                background: "var(--bg-subtle)", border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "26px", height: "26px", borderRadius: "50%",
                  background: "var(--accent)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "10px", fontWeight: 700, flexShrink: 0,
                }}>
                  {user.username[0]?.toUpperCase()}
                </div>
                <div>
                  <span style={{ fontWeight: 500, color: "var(--text)", fontSize: "13px" }}>{user.username}</span>
                  <span style={{ marginLeft: "8px", fontSize: "12px", color: "var(--text-muted)" }}>{formatDate(user.created_at)}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <form action={handleRoleChange} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <input type="hidden" name="id" value={user.id} />
                  <select name="role" defaultValue={user.role} style={inputStyle}>
                    <option value="citizen">Гражданин</option>
                    <option value="admin">Администратор</option>
                  </select>
                  <button type="submit" className="btn-primary" style={{ padding: "6px 12px", fontSize: "12px" }}>
                    OK
                  </button>
                </form>
                {String(user.id) !== currentUserId && (
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={user.id} />
                    <ConfirmButton
                      type="submit"
                      message={`Удалить пользователя "${user.username}"?`}
                      className="btn-danger"
                    >
                      Удалить
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create user */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2 style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
          Новый пользователь
        </h2>
        <form action={handleCreate} style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Имя</label>
            <input name="username" placeholder="Имя пользователя" required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Пароль</label>
            <input name="password" type="password" placeholder="Пароль" required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Роль</label>
            <select name="role" style={inputStyle}>
              <option value="citizen">Гражданин</option>
              <option value="admin">Администратор</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Создать
          </button>
        </form>
      </div>
    </div>
  );
}
