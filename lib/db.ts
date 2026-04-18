import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";

const DB_PATH = path.join(process.cwd(), "pelgaria.db");
let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'citizen' CHECK(role IN ('admin', 'citizen')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT NOT NULL DEFAULT '📂'
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      department_id INTEGER REFERENCES departments(id),
      author_id INTEGER REFERENCES users(id),
      published INTEGER NOT NULL DEFAULT 0,
      access_level TEXT NOT NULL DEFAULT 'public'
        CHECK(access_level IN ('public', 'restricted', 'secret')),
      doc_number TEXT,
      file_name TEXT,
      file_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS passports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      passport_number TEXT NOT NULL UNIQUE,
      minecraft_nick TEXT NOT NULL,
      full_name TEXT,
      citizenship_level TEXT NOT NULL DEFAULT 'citizen'
        CHECK(citizenship_level IN ('resident', 'citizen', 'honorary')),
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'blocked', 'wanted')),
      notes TEXT,
      issued_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'info'
        CHECK(type IN ('info', 'warning', 'ban', 'fine')),
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations for old documents table
  for (const col of [
    "ALTER TABLE documents ADD COLUMN file_name TEXT",
    "ALTER TABLE documents ADD COLUMN file_path TEXT",
    "ALTER TABLE documents ADD COLUMN access_level TEXT NOT NULL DEFAULT 'public'",
    "ALTER TABLE documents ADD COLUMN doc_number TEXT",
    "ALTER TABLE documents ADD COLUMN department_id INTEGER REFERENCES departments(id)",
  ]) {
    try { db.exec(col); } catch {}
  }

  // Add section_id and doc_date to documents
  try { db.prepare("ALTER TABLE documents ADD COLUMN section_id INTEGER REFERENCES sections(id)").run(); } catch {}
  try { db.prepare("ALTER TABLE documents ADD COLUMN doc_date TEXT").run(); } catch {}

  // Notifications: TTL and user soft-delete
  try { db.prepare("ALTER TABLE notifications ADD COLUMN expires_at TEXT").run(); } catch {}
  try { db.prepare("ALTER TABLE notifications ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0").run(); } catch {}

  // Migrations for passports: PIN, user link, extended fields
  for (const col of [
    "ALTER TABLE passports ADD COLUMN pin_hash TEXT",
    "ALTER TABLE passports ADD COLUMN pin_visible TEXT",
    "ALTER TABLE passports ADD COLUMN user_id INTEGER REFERENCES users(id)",
    "ALTER TABLE passports ADD COLUMN issued_by_custom TEXT",
    "ALTER TABLE passports ADD COLUMN issue_date TEXT DEFAULT (date('now'))",
  ]) {
    try { db.exec(col); } catch {}
  }

  // Extended passport statuses — recreate table without restrictive CHECK
  try {
    const cols = (db.prepare("PRAGMA table_info(passports)").all() as any[]).map((c) => c.name);
    if (!cols.includes("pin_visible")) throw new Error("needs migration");
    // Check if status column still has the old CHECK by trying to insert a new status value
    db.prepare("INSERT INTO passports (passport_number,minecraft_nick,status) VALUES ('__test__','__test__','deactivating')").run();
    db.prepare("DELETE FROM passports WHERE passport_number = '__test__'").run();
  } catch {
    // Recreate passports table without the status CHECK constraint
    db.exec(`
      CREATE TABLE IF NOT EXISTS passports_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        passport_number TEXT NOT NULL UNIQUE,
        minecraft_nick TEXT NOT NULL,
        full_name TEXT,
        citizenship_level TEXT NOT NULL DEFAULT 'citizen'
          CHECK(citizenship_level IN ('resident','citizen','honorary')),
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        issued_by INTEGER REFERENCES users(id),
        issued_by_custom TEXT,
        issue_date TEXT DEFAULT (date('now')),
        pin_hash TEXT,
        pin_visible TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    try {
      db.exec(`
        INSERT OR IGNORE INTO passports_v2
          (id,passport_number,minecraft_nick,full_name,citizenship_level,status,notes,issued_by,pin_hash,user_id,created_at,updated_at)
        SELECT id,passport_number,minecraft_nick,full_name,citizenship_level,status,notes,issued_by,pin_hash,user_id,created_at,updated_at
        FROM passports;
        DROP TABLE passports;
        ALTER TABLE passports_v2 RENAME TO passports;
      `);
    } catch { /* already migrated or passports_v2 already final */ }
  }

  // System notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info','warning','alert')),
      title TEXT NOT NULL,
      content TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      show_before_login INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Sections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      parent_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
      department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Appeals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS appeals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      passport_id INTEGER REFERENCES passports(id) ON DELETE CASCADE,
      department_id INTEGER REFERENCES departments(id),
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','in_review','resolved','rejected')),
      response TEXT,
      responded_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed departments
  const deptCount = db.prepare("SELECT COUNT(*) as c FROM departments").get() as { c: number };
  if (deptCount.c === 0) {
    const ins = db.prepare("INSERT INTO departments (name, slug, description, icon) VALUES (?, ?, ?, ?)");
    ins.run("Законодательное собрание", "assembly", "Законы и нормативные акты Пельгарии", "📜");
    ins.run("Правительство", "government", "Указы и постановления правительства", "🏛️");
    ins.run("Служба безопасности", "security", "Внутренние и секретные документы", "🔒");
    ins.run("Архив", "archive", "Историческая летопись и архивные документы", "📂");
  }

  // Seed admin user
  const adminCount = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (adminCount.c === 0) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run("admin", hash, "admin");
  }

  // Indexes for frequently queried columns
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_passports_passport_number ON passports(passport_number);
    CREATE INDEX IF NOT EXISTS idx_passports_user_id ON passports(user_id);
    CREATE INDEX IF NOT EXISTS idx_passports_status ON passports(status);
    CREATE INDEX IF NOT EXISTS idx_documents_published ON documents(published);
    CREATE INDEX IF NOT EXISTS idx_documents_department_id ON documents(department_id);
    CREATE INDEX IF NOT EXISTS idx_documents_section_id ON documents(section_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_passport_id ON notifications(passport_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_appeals_passport_id ON appeals(passport_id);
    CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);
  `);
}

// ─── Users ────────────────────────────────────────────────
export function getUserByUsername(username: string) {
  return getDb().prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | { id: number; username: string; password_hash: string; role: string } | undefined;
}

export function getAllUsers() {
  return getDb().prepare("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC").all() as
    { id: number; username: string; role: string; created_at: string }[];
}

export function createUser(username: string, password: string, role: "admin" | "citizen" = "citizen") {
  const hash = bcrypt.hashSync(password, 10);
  return getDb().prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(username, hash, role);
}

export function deleteUser(id: number) {
  return getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function updateUserRole(id: number, role: "admin" | "citizen") {
  return getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}

// ─── Departments ──────────────────────────────────────────
export function getAllDepartments() {
  return getDb().prepare("SELECT * FROM departments ORDER BY id").all() as DepartmentRow[];
}

export function getDepartmentBySlug(slug: string) {
  return getDb().prepare("SELECT * FROM departments WHERE slug = ?").get(slug) as DepartmentRow | undefined;
}

export type DepartmentRow = {
  id: number; name: string; slug: string; description: string; icon: string;
};

// ─── Documents ────────────────────────────────────────────
const DOC_SELECT = `
  SELECT d.id, d.title, d.content, d.created_at, d.updated_at, d.published,
         d.access_level, d.doc_number, d.file_name, d.file_path, d.department_id,
         dep.name as department_name, dep.slug as department_slug, dep.icon as department_icon,
         u.username as author, d.section_id, sec.title as section_title, d.doc_date
  FROM documents d
  LEFT JOIN departments dep ON d.department_id = dep.id
  LEFT JOIN users u ON d.author_id = u.id
  LEFT JOIN sections sec ON d.section_id = sec.id
`;

export function getPublishedDocuments(departmentSlug?: string, role?: string) {
  const accessFilter = role === "admin"
    ? ""
    : role === "citizen"
    ? "AND d.access_level IN ('public', 'restricted')"
    : "AND d.access_level = 'public'";

  const deptFilter = departmentSlug ? "AND dep.slug = ?" : "";
  const sql = `${DOC_SELECT} WHERE d.published = 1 ${accessFilter} ${deptFilter} ORDER BY d.doc_date DESC, d.created_at DESC`;
  return (departmentSlug
    ? getDb().prepare(sql).all(departmentSlug)
    : getDb().prepare(sql).all()) as DocumentRow[];
}

export function getAllDocuments() {
  return getDb().prepare(`${DOC_SELECT} ORDER BY d.created_at DESC`).all() as DocumentRow[];
}

export function getDocumentById(id: number) {
  return getDb().prepare(`${DOC_SELECT} WHERE d.id = ?`).get(id) as DocumentRow | undefined;
}

export function createDocument(
  title: string, content: string, departmentId: number, authorId: number,
  published: boolean, accessLevel: string, docNumber?: string,
  fileName?: string, filePath?: string, sectionId?: number, docDate?: string
) {
  return getDb().prepare(
    `INSERT INTO documents (title, content, department_id, author_id, published, access_level, doc_number, file_name, file_path, section_id, doc_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(title, content, departmentId, authorId, published ? 1 : 0, accessLevel,
    docNumber ?? null, fileName ?? null, filePath ?? null,
    sectionId ?? null, docDate ?? null);
}

export function updateDocument(
  id: number, title: string, content: string, departmentId: number,
  published: boolean, accessLevel: string, docNumber?: string,
  fileName?: string | null, filePath?: string | null,
  sectionId?: number | null, docDate?: string | null
) {
  if (fileName !== undefined) {
    return getDb().prepare(
      `UPDATE documents SET title=?, content=?, department_id=?, published=?, access_level=?,
       doc_number=?, file_name=?, file_path=?, section_id=?, doc_date=?, updated_at=datetime('now') WHERE id=?`
    ).run(title, content, departmentId, published ? 1 : 0, accessLevel, docNumber ?? null, fileName, filePath,
      sectionId ?? null, docDate ?? null, id);
  }
  return getDb().prepare(
    `UPDATE documents SET title=?, content=?, department_id=?, published=?, access_level=?,
     doc_number=?, section_id=?, doc_date=?, updated_at=datetime('now') WHERE id=?`
  ).run(title, content, departmentId, published ? 1 : 0, accessLevel, docNumber ?? null,
    sectionId ?? null, docDate ?? null, id);
}

export function deleteDocument(id: number) {
  return getDb().prepare("DELETE FROM documents WHERE id = ?").run(id);
}

export type DocumentRow = {
  id: number; title: string; content: string;
  created_at: string; updated_at: string;
  department_id: number; department_name: string;
  department_slug: string; department_icon: string;
  author: string; published: number;
  access_level: string; doc_number: string | null;
  file_name: string | null; file_path: string | null;
  section_id: number | null; section_title: string | null;
  doc_date: string | null;
};

// ─── Sections ─────────────────────────────────────────────
export type SectionRow = {
  id: number; title: string; parent_id: number | null;
  department_id: number | null; sort_order: number; created_at: string;
  department_name?: string; parent_title?: string;
};

export function getAllSections() {
  return getDb().prepare(`
    SELECT s.*, d.name as department_name, p.title as parent_title
    FROM sections s
    LEFT JOIN departments d ON s.department_id = d.id
    LEFT JOIN sections p ON s.parent_id = p.id
    ORDER BY s.department_id, s.parent_id NULLS FIRST, s.sort_order, s.title
  `).all() as SectionRow[];
}

export function getSectionsByDepartment(departmentId: number) {
  return getDb().prepare(`
    SELECT * FROM sections WHERE department_id = ?
    ORDER BY parent_id NULLS FIRST, sort_order, title
  `).all(departmentId) as SectionRow[];
}

export function getSectionById(id: number) {
  return getDb().prepare(`
    SELECT s.*, d.name as department_name
    FROM sections s LEFT JOIN departments d ON s.department_id = d.id
    WHERE s.id = ?
  `).get(id) as SectionRow | undefined;
}

export function createSection(data: { title: string; parent_id?: number | null; department_id: number; sort_order?: number }) {
  return getDb().prepare(
    "INSERT INTO sections (title, parent_id, department_id, sort_order) VALUES (?, ?, ?, ?)"
  ).run(data.title, data.parent_id ?? null, data.department_id, data.sort_order ?? 0);
}

export function updateSection(id: number, data: { title: string; parent_id?: number | null; sort_order?: number }) {
  return getDb().prepare(
    "UPDATE sections SET title=?, parent_id=?, sort_order=? WHERE id=?"
  ).run(data.title, data.parent_id ?? null, data.sort_order ?? 0, id);
}

export function deleteSection(id: number) {
  return getDb().prepare("DELETE FROM sections WHERE id = ?").run(id);
}

export function updateDocumentSection(id: number, sectionId: number | null) {
  return getDb().prepare("UPDATE documents SET section_id = ? WHERE id = ?").run(sectionId, id);
}

export function getPublishedDocumentsBySection(sectionId: number, role?: string) {
  const accessFilter = role === "admin" ? "" : role === "citizen" ? "AND d.access_level IN ('public','restricted')" : "AND d.access_level = 'public'";
  return getDb().prepare(`${DOC_SELECT} WHERE d.published=1 AND d.section_id=? ${accessFilter} ORDER BY d.doc_date DESC, d.created_at DESC`).all(sectionId) as DocumentRow[];
}

export function searchDocuments(query: string, role?: string) {
  const q = `%${query}%`;
  const accessFilter = role === "admin" ? "" : role === "citizen" ? "AND d.access_level IN ('public','restricted')" : "AND d.access_level = 'public'";
  return getDb().prepare(`
    ${DOC_SELECT}
    WHERE d.published = 1 ${accessFilter}
    AND (d.title LIKE ? OR d.content LIKE ? OR d.doc_number LIKE ?)
    ORDER BY d.created_at DESC
    LIMIT 50
  `).all(q, q, q) as DocumentRow[];
}

// ─── Passports ────────────────────────────────────────────
export function getAllPassports() {
  return getDb().prepare(`
    SELECT p.*, u.username as issued_by_name
    FROM passports p LEFT JOIN users u ON p.issued_by = u.id
    ORDER BY p.created_at DESC
  `).all() as PassportRow[];
}

export function getPassportById(id: number) {
  return getDb().prepare(`
    SELECT p.*, u.username as issued_by_name
    FROM passports p LEFT JOIN users u ON p.issued_by = u.id
    WHERE p.id = ?
  `).get(id) as PassportRow | undefined;
}

export function getPassportByNumber(passportNumber: string) {
  return getDb().prepare("SELECT * FROM passports WHERE passport_number = ?").get(passportNumber) as PassportRow | undefined;
}

export function getPassportByIdentifier(ident: string) {
  // Identifier is deterministic from id+number, so scan active passports
  const { generateIdentifier } = require("./passport-identifier");
  const all = getDb().prepare("SELECT id, passport_number FROM passports").all() as { id: number; passport_number: string }[];
  const match = all.find(p => generateIdentifier(p.id, p.passport_number) === ident.toUpperCase());
  if (!match) return undefined;
  return getDb().prepare(`
    SELECT p.*, u.username as issued_by_name
    FROM passports p LEFT JOIN users u ON p.issued_by = u.id
    WHERE p.id = ?
  `).get(match.id) as PassportRow | undefined;
}

export function getRandomPassportNumber(): string {
  const db = getDb();
  const existing = new Set(
    (db.prepare("SELECT passport_number FROM passports").all() as { passport_number: string }[])
      .map((r) => r.passport_number)
  );
  let num: string;
  do {
    const n = Math.floor(Math.random() * 99999) + 1;
    num = `PG-${String(n).padStart(5, "0")}`;
  } while (existing.has(num));
  return num;
}

export function createPassport(data: {
  passport_number: string; minecraft_nick: string; full_name?: string;
  citizenship_level?: string; status?: string; notes?: string;
  issued_by: number; issued_by_custom?: string; issue_date?: string;
  pin?: string; user_id?: number;
}) {
  const pin_hash = data.pin?.trim() ? bcrypt.hashSync(data.pin.trim(), 10) : null;
  return getDb().prepare(`
    INSERT INTO passports (passport_number, minecraft_nick, full_name, citizenship_level, status, notes, issued_by, issued_by_custom, issue_date, pin_hash, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.passport_number, data.minecraft_nick, data.full_name ?? null,
    data.citizenship_level ?? "citizen", data.status ?? "active",
    data.notes ?? null, data.issued_by,
    data.issued_by_custom ?? null,
    data.issue_date ?? null,
    pin_hash, data.user_id ?? null
  );
}

export function updatePassport(id: number, data: {
  minecraft_nick: string; full_name?: string;
  citizenship_level: string; status: string; notes?: string;
  pin?: string; clearPin?: boolean; user_id?: number | null;
  issued_by_custom?: string; issue_date?: string;
  notify?: boolean; notifyAdminId?: number; // auto-send change notification
}) {
  const db = getDb();
  const old = db.prepare("SELECT status, minecraft_nick FROM passports WHERE id = ?").get(id) as { status: string; minecraft_nick: string } | undefined;

  let pin_hash: string | null | undefined = undefined;
  if (data.clearPin) { pin_hash = null; }
  else if (data.pin?.trim()) {
    pin_hash = bcrypt.hashSync(data.pin.trim(), 10);
  }

  if (pin_hash !== undefined) {
    db.prepare(`
      UPDATE passports SET minecraft_nick=?, full_name=?, citizenship_level=?, status=?, notes=?,
        pin_hash=?, pin_visible=NULL, user_id=?, issued_by_custom=?, issue_date=COALESCE(?,issue_date), updated_at=datetime('now')
      WHERE id=?
    `).run(data.minecraft_nick, data.full_name ?? null, data.citizenship_level, data.status,
      data.notes ?? null, pin_hash, data.user_id ?? null,
      data.issued_by_custom ?? null, data.issue_date ?? null, id);
  } else {
    db.prepare(`
      UPDATE passports SET minecraft_nick=?, full_name=?, citizenship_level=?, status=?, notes=?,
        user_id=?, issued_by_custom=?, issue_date=COALESCE(?,issue_date), updated_at=datetime('now')
      WHERE id=?
    `).run(data.minecraft_nick, data.full_name ?? null, data.citizenship_level, data.status,
      data.notes ?? null, data.user_id ?? null,
      data.issued_by_custom ?? null, data.issue_date ?? null, id);
  }

  // Auto-notify citizen if status changed
  if (old && old.status !== data.status && data.notifyAdminId) {
    const passport = db.prepare("SELECT id FROM passports WHERE id = ?").get(id) as { id: number } | undefined;
    if (passport) {
      const STATUS_RU: Record<string, string> = {
        active: "Активен", blocked: "Заблокирован", wanted: "В розыске",
        deactivating: "Проходит деактивацию", frozen: "Заморожен",
        temp_frozen: "Временно заморожен", suspended: "Отстранён", deceased: "Выбыл",
      };
      createNotificationInternal({
        passport_id: passport.id,
        type: "info",
        title: "Статус паспорта изменён",
        content: `Ваш статус изменён: ${STATUS_RU[old.status] ?? old.status} → ${STATUS_RU[data.status] ?? data.status}`,
        created_by: data.notifyAdminId,
      });
    }
  }
}

export function getPassportByUserId(userId: number) {
  return getDb().prepare(`
    SELECT p.*, u.username as issued_by_name
    FROM passports p LEFT JOIN users u ON p.issued_by = u.id
    WHERE p.user_id = ?
  `).get(userId) as PassportRow | undefined;
}

export function linkPassportToUser(passportId: number, userId: number | null) {
  // Unlink any passport currently linked to this user first
  if (userId !== null) {
    getDb().prepare("UPDATE passports SET user_id = NULL WHERE user_id = ?").run(userId);
  }
  return getDb().prepare("UPDATE passports SET user_id = ? WHERE id = ?").run(userId, passportId);
}

export function deletePassport(id: number) {
  return getDb().prepare("DELETE FROM passports WHERE id = ?").run(id);
}

export function getNextPassportNumber() {
  const last = getDb().prepare(
    "SELECT passport_number FROM passports ORDER BY id DESC LIMIT 1"
  ).get() as { passport_number: string } | undefined;

  if (!last) return "PG-00001";
  const num = parseInt(last.passport_number.replace("PG-", ""), 10);
  return `PG-${String(num + 1).padStart(5, "0")}`;
}

export type PassportRow = {
  id: number; passport_number: string; minecraft_nick: string;
  full_name: string | null; citizenship_level: string; status: string;
  notes: string | null; issued_by: number; issued_by_name: string;
  issued_by_custom: string | null; issue_date: string | null;
  pin_hash: string | null; pin_visible: string | null; user_id: number | null;
  created_at: string; updated_at: string;
};

// ─── Notifications ────────────────────────────────────────

const NOTIF_ACTIVE = `
  n.is_hidden = 0
  AND (n.expires_at IS NULL OR n.expires_at > datetime('now'))
`;

export function getNotificationsByPassport(passportId: number) {
  return getDb().prepare(`
    SELECT n.*, u.username as created_by_name
    FROM notifications n LEFT JOIN users u ON n.created_by = u.id
    WHERE n.passport_id = ? AND ${NOTIF_ACTIVE}
    ORDER BY n.created_at DESC
  `).all(passportId) as NotificationRow[];
}

export function getUnreadCount(passportId: number) {
  const r = getDb().prepare(`
    SELECT COUNT(*) as c FROM notifications n
    WHERE n.passport_id = ? AND n.is_read = 0 AND ${NOTIF_ACTIVE}
  `).get(passportId) as { c: number };
  return r.c;
}

export function createNotification(data: {
  passport_id: number; type: string; title: string; content?: string;
  created_by: number; expires_at?: string;
}) {
  return getDb().prepare(`
    INSERT INTO notifications (passport_id, type, title, content, created_by, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.passport_id, data.type, data.title,
    data.content ?? "", data.created_by, data.expires_at ?? null,
  );
}

export function markAllRead(passportId: number) {
  return getDb().prepare(`UPDATE notifications SET is_read = 1 WHERE passport_id = ? AND ${NOTIF_ACTIVE}`).run(passportId);
}

export function markOneRead(id: number, passportId: number) {
  return getDb().prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND passport_id = ?").run(id, passportId);
}

export function hideNotification(id: number, passportId: number) {
  return getDb().prepare("UPDATE notifications SET is_hidden = 1 WHERE id = ? AND passport_id = ?").run(id, passportId);
}

export function hideAllRead(passportId: number) {
  return getDb().prepare("UPDATE notifications SET is_hidden = 1 WHERE passport_id = ? AND is_read = 1").run(passportId);
}

export function deleteNotification(id: number) {
  return getDb().prepare("DELETE FROM notifications WHERE id = ?").run(id);
}

export function updateNotification(id: number, data: { type: string; title: string; content?: string }) {
  return getDb().prepare(
    "UPDATE notifications SET type=?, title=?, content=? WHERE id=?"
  ).run(data.type, data.title, data.content ?? "", id);
}

export function getAllNotifications() {
  return getDb().prepare(`
    SELECT n.*, u.username as created_by_name, p.passport_number, p.minecraft_nick
    FROM notifications n
    LEFT JOIN users u ON n.created_by = u.id
    LEFT JOIN passports p ON n.passport_id = p.id
    ORDER BY n.created_at DESC
  `).all() as (NotificationRow & { passport_number: string; minecraft_nick: string })[];
}

export function getNotificationById(id: number) {
  return getDb().prepare(`
    SELECT n.*, u.username as created_by_name, p.passport_number, p.minecraft_nick
    FROM notifications n
    LEFT JOIN users u ON n.created_by = u.id
    LEFT JOIN passports p ON n.passport_id = p.id
    WHERE n.id = ?
  `).get(id) as (NotificationRow & { passport_number: string; minecraft_nick: string }) | undefined;
}

// Internal helper used by updatePassport
function createNotificationInternal(data: {
  passport_id: number; type: string; title: string; content?: string; created_by: number;
}) {
  getDb().prepare(`
    INSERT INTO notifications (passport_id, type, title, content, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.passport_id, data.type, data.title, data.content ?? "", data.created_by);
}

export type NotificationRow = {
  id: number; passport_id: number; type: string; title: string;
  content: string; is_read: number; is_hidden: number; created_by: number;
  created_by_name: string; created_at: string; expires_at: string | null;
};

// ─── System Notifications ─────────────────────────────────
export function getSystemNotifications(activeOnly = true) {
  const q = activeOnly
    ? "SELECT * FROM system_notifications WHERE is_active = 1 ORDER BY created_at DESC"
    : "SELECT * FROM system_notifications ORDER BY created_at DESC";
  return getDb().prepare(q).all() as SystemNotificationRow[];
}

export function getPreLoginNotifications() {
  return getDb().prepare(
    "SELECT * FROM system_notifications WHERE is_active = 1 AND show_before_login = 1 ORDER BY created_at DESC"
  ).all() as SystemNotificationRow[];
}

export function createSystemNotification(data: {
  type: string; title: string; content?: string;
  is_active?: boolean; show_before_login?: boolean; created_by: number;
}) {
  return getDb().prepare(`
    INSERT INTO system_notifications (type, title, content, is_active, show_before_login, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.type, data.title, data.content ?? null,
    data.is_active !== false ? 1 : 0,
    data.show_before_login ? 1 : 0,
    data.created_by);
}

export function updateSystemNotification(id: number, data: {
  type: string; title: string; content?: string;
  is_active: boolean; show_before_login: boolean;
}) {
  return getDb().prepare(`
    UPDATE system_notifications SET type=?, title=?, content=?, is_active=?, show_before_login=? WHERE id=?
  `).run(data.type, data.title, data.content ?? null,
    data.is_active ? 1 : 0, data.show_before_login ? 1 : 0, id);
}

export function deleteSystemNotification(id: number) {
  return getDb().prepare("DELETE FROM system_notifications WHERE id = ?").run(id);
}

export type SystemNotificationRow = {
  id: number; type: string; title: string; content: string | null;
  is_active: number; show_before_login: number;
  created_by: number; created_at: string;
};

// ─── Appeals ──────────────────────────────────────────────
export function getAppealsByPassport(passportId: number) {
  return getDb().prepare(`
    SELECT a.*, d.name as dept_name, d.icon as dept_icon, u.username as responded_by_name
    FROM appeals a
    LEFT JOIN departments d ON a.department_id = d.id
    LEFT JOIN users u ON a.responded_by = u.id
    WHERE a.passport_id = ?
    ORDER BY a.created_at DESC
  `).all(passportId) as AppealRow[];
}

export function getAllAppeals() {
  return getDb().prepare(`
    SELECT a.*, d.name as dept_name, d.icon as dept_icon, u.username as responded_by_name,
           p.passport_number, p.minecraft_nick
    FROM appeals a
    LEFT JOIN departments d ON a.department_id = d.id
    LEFT JOIN users u ON a.responded_by = u.id
    LEFT JOIN passports p ON a.passport_id = p.id
    ORDER BY a.created_at DESC
  `).all() as (AppealRow & { passport_number: string; minecraft_nick: string })[];
}

export function createAppeal(data: {
  passport_id: number; department_id: number; subject: string; content: string;
}) {
  return getDb().prepare(`
    INSERT INTO appeals (passport_id, department_id, subject, content)
    VALUES (?, ?, ?, ?)
  `).run(data.passport_id, data.department_id, data.subject, data.content);
}

export function respondToAppeal(id: number, data: {
  status: string; response: string; responded_by: number;
}) {
  getDb().prepare(`
    UPDATE appeals SET status=?, response=?, responded_by=?, updated_at=datetime('now') WHERE id=?
  `).run(data.status, data.response, data.responded_by, id);

  // Auto-notify the citizen
  const appeal = getDb().prepare("SELECT * FROM appeals WHERE id = ?").get(id) as AppealRow | undefined;
  if (appeal) {
    const STATUS_RU: Record<string, string> = {
      resolved: "рассмотрено", rejected: "отклонено", in_review: "принято в работу",
    };
    createNotificationInternal({
      passport_id: appeal.passport_id,
      type: data.status === "resolved" ? "info" : data.status === "rejected" ? "warning" : "info",
      title: `Обращение ${STATUS_RU[data.status] ?? data.status}`,
      content: `Тема: «${appeal.subject}». Ответ: ${data.response}`,
      created_by: data.responded_by,
    });
  }
}

export type AppealRow = {
  id: number; passport_id: number; department_id: number;
  subject: string; content: string; status: string;
  response: string | null; responded_by: number | null;
  dept_name: string; dept_icon: string; responded_by_name: string | null;
  created_at: string; updated_at: string;
};

// ─── Passport PIN change ──────────────────────────────────
export async function changePassportPin(passportId: number, currentPin: string | null, newPin: string): Promise<{ ok: boolean; error?: string }> {
  const passport = getDb().prepare("SELECT pin_hash FROM passports WHERE id = ?").get(passportId) as { pin_hash: string | null } | undefined;
  if (!passport) return { ok: false, error: "Паспорт не найден" };

  // If passport has a PIN — verify current one
  if (passport.pin_hash) {
    if (!currentPin) return { ok: false, error: "Введите текущий PIN" };
    const ok = await bcrypt.compare(currentPin, passport.pin_hash);
    if (!ok) return { ok: false, error: "Неверный текущий PIN" };
  }

  if (!newPin || newPin.length < 4) return { ok: false, error: "Новый PIN — минимум 4 символа" };

  const hash = bcrypt.hashSync(newPin, 10);
  getDb().prepare("UPDATE passports SET pin_hash = ?, pin_visible = NULL, updated_at = datetime('now') WHERE id = ?").run(hash, passportId);
  return { ok: true };
}

// ─── Users — extended ─────────────────────────────────────
export function updateUsername(id: number, newUsername: string) {
  return getDb().prepare("UPDATE users SET username = ? WHERE id = ?").run(newUsername, id);
}

export function usernameExists(username: string, excludeId?: number) {
  const r = excludeId
    ? getDb().prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, excludeId)
    : getDb().prepare("SELECT id FROM users WHERE username = ?").get(username);
  return !!r;
}
