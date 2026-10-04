import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

const databasePath = env.databasePath;
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const globalForDb = globalThis as typeof globalThis & {
  __supportBotSqlite?: Database.Database;
};

export const sqlite =
  globalForDb.__supportBotSqlite ??
  new Database(databasePath, {
    fileMustExist: false,
    timeout: 10_000,
  });

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 10000");
sqlite.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") {
  globalForDb.__supportBotSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });

function hasColumn(tableName: string, columnName: string): boolean {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function migrateLegacyPythonDatabase() {
  // The original SupportBOT repository used aiosqlite with these tables.
  // Detect that layout once, rename the legacy tables, then import the useful
  // history into the unified web/bot schema below. This makes the upgrade
  // safe even when Deplexo already contains an old /data/support_bot.db.
  const userTableExists = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'")
    .get();
  if (!userTableExists || !hasColumn("users", "user_id") || hasColumn("users", "bale_user_id")) return;

  const legacyTables = ["chat_messages", "support_chats", "message_links", "users"];
  for (const table of legacyTables) {
    const exists = sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .get(table);
    if (exists) sqlite.exec(`ALTER TABLE ${table} RENAME TO legacy_${table}`);
  }
  console.log("[DB] Legacy Python SQLite schema detected; migration will be applied.");
}

function ensureSchema() {
  migrateLegacyPythonDatabase();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bale_user_id TEXT NOT NULL UNIQUE,
      chat_id TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      phone TEXT,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_seen_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS bot_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bale_user_id TEXT NOT NULL UNIQUE,
      name TEXT,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      pending_reply_ticket_id INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      subject TEXT,
      assigned_admin_bale_id TEXT,
      assigned_admin_name TEXT,
      ai_paused INTEGER NOT NULL DEFAULT 0,
      rating INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_message_at INTEGER NOT NULL DEFAULT (unixepoch()),
      closed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      sender_label TEXT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS gemini_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      api_key TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_exhausted INTEGER NOT NULL DEFAULT 0,
      last_used_at INTEGER,
      last_error_at INTEGER,
      last_error_message TEXT,
      success_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      hit_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS canned_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      keywords TEXT,
      message_parts TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'quick',
      is_auto_suggest INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS admin_web_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_users_bale_user_id ON users(bale_user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, id);
    CREATE INDEX IF NOT EXISTS idx_faqs_published_sort ON faqs(is_published, sort_order, id);
  `);

  // Import the old Python database once. A marker in settings prevents the
  // import from repeating on later boots.
  const legacyMarker = sqlite.prepare("SELECT value FROM settings WHERE key = 'legacy_python_migrated'").get() as { value?: string } | undefined;
  if (legacyMarker?.value === "true") return;

  const legacyUsers = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='legacy_users'")
    .get();
  if (!legacyUsers) return;

  const migrate = sqlite.transaction(() => {
    const oldUsers = sqlite.prepare(`
      SELECT user_id, username, first_name, last_name, created_at, last_seen_at, is_blocked
      FROM legacy_users ORDER BY user_id
    `).all() as Array<Record<string, unknown>>;

    for (const user of oldUsers) {
      sqlite.prepare(`
        INSERT OR IGNORE INTO users
          (bale_user_id, chat_id, first_name, last_name, username, is_blocked, created_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, COALESCE(strftime('%s', ?), unixepoch()), COALESCE(strftime('%s', ?), unixepoch()))
      `).run(
        String(user.user_id),
        String(user.user_id),
        user.first_name ?? null,
        user.last_name ?? null,
        user.username ?? null,
        Number(user.is_blocked ?? 0),
        user.created_at ?? null,
        user.last_seen_at ?? null,
      );
    }

    const oldChats = sqlite
      .prepare(`SELECT chat_id, user_id, status, created_at, closed_at FROM legacy_support_chats ORDER BY chat_id`)
      .all() as Array<Record<string, unknown>>;

    for (const chat of oldChats) {
      const mapped = sqlite
        .prepare("SELECT id FROM users WHERE bale_user_id = ? LIMIT 1")
        .get(String(chat.user_id)) as { id?: number } | undefined;
      if (!mapped?.id) continue;
      sqlite.prepare(`
        INSERT OR IGNORE INTO tickets
          (id, user_id, status, created_at, last_message_at, closed_at)
        VALUES (?, ?, ?, COALESCE(strftime('%s', ?), unixepoch()), COALESCE(strftime('%s', ?), unixepoch()), strftime('%s', ?))
      `).run(
        Number(chat.chat_id),
        mapped.id,
        chat.status === "closed" ? "closed" : "open",
        chat.created_at ?? null,
        chat.created_at ?? null,
        chat.closed_at ?? null,
      );
    }

    const oldMessages = sqlite
      .prepare(`SELECT id, chat_id, role, content, created_at FROM legacy_chat_messages ORDER BY id`)
      .all() as Array<Record<string, unknown>>;
    for (const msg of oldMessages) {
      const sender = msg.role === "user" ? "user" : msg.role === "assistant" ? "bot" : "system";
      sqlite.prepare(`
        INSERT OR IGNORE INTO ticket_messages (id, ticket_id, sender, sender_label, content, created_at)
        VALUES (?, ?, ?, ?, ?, COALESCE(strftime('%s', ?), unixepoch()))
      `).run(
        Number(msg.id),
        Number(msg.chat_id),
        sender,
        sender === "user" ? "کاربر" : sender === "bot" ? "پاسخ هوشمند" : "سیستم",
        String(msg.content ?? ""),
        msg.created_at ?? null,
      );
    }

    sqlite.prepare(`
      INSERT INTO settings(key, value) VALUES('legacy_python_migrated', 'true')
      ON CONFLICT(key) DO UPDATE SET value='true', updated_at=unixepoch()
    `).run();
  });

  migrate();
  console.log("[DB] Legacy Python data migrated successfully.");
}

ensureSchema();

export function executeSql(query: ReturnType<typeof sql>) {
  return db.run(query);
}
