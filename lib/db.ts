import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";

const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), "data.db");

function initDb() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    UNIQUE NOT NULL,
      name          TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'observer',
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS universes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      code        TEXT UNIQUE NOT NULL,
      description TEXT,
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  TEXT DEFAULT (datetime('now')),
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  /* Seed initial admin if DB is empty */
  const { c } = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (c === 0) {
    const password = process.env.ADMIN_PASSWORD ?? Math.random().toString(36).slice(2, 10);
    const email    = process.env.ADMIN_EMAIL    ?? "admin@most.local";
    db.prepare(
      "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)"
    ).run(email, "Администратор", bcrypt.hashSync(password, 10), "admin");

    if (!process.env.ADMIN_PASSWORD) {
      console.log("\n── Создан администратор ──────────────────");
      console.log(`   Email:  ${email}`);
      console.log(`   Пароль: ${password}`);
      console.log("   Смените пароль после первого входа!\n");
    }
  }

  return db;
}

declare global { var __db: ReturnType<typeof initDb> | undefined }
export const db = globalThis.__db ?? initDb();
if (process.env.NODE_ENV !== "production") globalThis.__db = db;
