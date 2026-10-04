import { db, sqlite } from "@/db";
import {
  users,
  botAdmins,
  tickets,
  ticketMessages,
  geminiKeys,
  settings,
  faqs,
  cannedResponses,
  adminWebUsers,
  broadcasts,
} from "@/db/schema";

export const BACKUP_VERSION = 2;

export type BackupData = {
  version: number;
  exportedAt: string;
  tables: {
    users: unknown[];
    botAdmins: unknown[];
    tickets: unknown[];
    ticketMessages: unknown[];
    geminiKeys: unknown[];
    settings: unknown[];
    faqs: unknown[];
    cannedResponses: unknown[];
    adminWebUsers: unknown[];
    broadcasts: unknown[];
  };
};

export async function exportBackup(): Promise<BackupData> {
  const [usersRows, adminsRows, ticketsRows, messagesRows, keysRows, settingsRows, faqsRows, cannedRows, webUsersRows, broadcastsRows] =
    await Promise.all([
      db.select().from(users),
      db.select().from(botAdmins),
      db.select().from(tickets),
      db.select().from(ticketMessages),
      db.select().from(geminiKeys),
      db.select().from(settings),
      db.select().from(faqs),
      db.select().from(cannedResponses),
      db.select().from(adminWebUsers),
      db.select().from(broadcasts),
    ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: {
      users: usersRows,
      botAdmins: adminsRows,
      tickets: ticketsRows,
      ticketMessages: messagesRows,
      geminiKeys: keysRows,
      settings: settingsRows,
      faqs: faqsRows,
      cannedResponses: cannedRows,
      adminWebUsers: webUsersRows,
      broadcasts: broadcastsRows,
    },
  };
}

const TABLE_MAP = {
  users,
  botAdmins,
  tickets,
  ticketMessages,
  geminiKeys,
  settings,
  faqs,
  cannedResponses,
  adminWebUsers,
  broadcasts,
} as const;

const DELETE_ORDER: (keyof BackupData["tables"])[] = [
  "ticketMessages",
  "tickets",
  "users",
  "botAdmins",
  "geminiKeys",
  "settings",
  "faqs",
  "cannedResponses",
  "adminWebUsers",
  "broadcasts",
];

const RESTORE_ORDER: (keyof BackupData["tables"])[] = [
  "users",
  "botAdmins",
  "tickets",
  "ticketMessages",
  "geminiKeys",
  "settings",
  "faqs",
  "cannedResponses",
  "adminWebUsers",
  "broadcasts",
];

export async function importBackup(data: BackupData): Promise<{ restored: Record<string, number> }> {
  if (!data || typeof data !== "object" || !data.tables) {
    throw new Error("فایل بکاپ معتبر نیست");
  }

  const restored: Record<string, number> = {};
  const runRestore = sqlite.transaction(() => {
    for (const key of DELETE_ORDER) {
      const table = TABLE_MAP[key];
      sqlite.prepare(`DELETE FROM ${tableName(key)}`).run();
    }

    // Reset AUTOINCREMENT sequences after clearing all data.
    sqlite.prepare("DELETE FROM sqlite_sequence WHERE name IN (?,?,?,?,?,?,?,?,?,?)").run(
      "users",
      "bot_admins",
      "tickets",
      "ticket_messages",
      "gemini_keys",
      "faqs",
      "canned_responses",
      "admin_web_users",
      "broadcasts",
      "settings",
    );

    for (const key of RESTORE_ORDER) {
      const rows = data.tables[key];
      if (!Array.isArray(rows) || rows.length === 0) {
        restored[key] = 0;
        continue;
      }

      const sanitized = rows.map((row) => normalizeBackupRow(key, row as Record<string, unknown>));
      const columns = Object.keys(sanitized[0] as Record<string, unknown>);
      const columnSql = columns.map((column) => camelToSnake(column)).join(", ");
      const placeholders = columns.map(() => "?").join(", ");
      const statement = sqlite.prepare(`INSERT INTO ${tableName(key)} (${columnSql}) VALUES (${placeholders})`);

      for (const row of sanitized) {
        const record = row as Record<string, unknown>;
        statement.run(...columns.map((column) => serializeBackupValue(record[column])));
      }
      restored[key] = sanitized.length;
    }

    for (const tableNameValue of [
      "users",
      "bot_admins",
      "tickets",
      "ticket_messages",
      "gemini_keys",
      "faqs",
      "canned_responses",
      "admin_web_users",
      "broadcasts",
    ]) {
      sqlite.prepare(`
        INSERT INTO sqlite_sequence(name, seq)
        VALUES (?, COALESCE((SELECT MAX(id) FROM ${tableNameValue}), 0))
        ON CONFLICT(name) DO UPDATE SET seq=excluded.seq
      `).run(tableNameValue);
    }
  });

  runRestore();
  return { restored };
}

function tableName(key: keyof BackupData["tables"]): string {
  const names: Record<string, string> = {
    users: "users",
    botAdmins: "bot_admins",
    tickets: "tickets",
    ticketMessages: "ticket_messages",
    geminiKeys: "gemini_keys",
    settings: "settings",
    faqs: "faqs",
    cannedResponses: "canned_responses",
    adminWebUsers: "admin_web_users",
    broadcasts: "broadcasts",
  };
  return names[key];
}

function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function normalizeBackupRow(key: string, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  if (key === "cannedResponses" && typeof out.messageParts === "string") {
    try {
      out.messageParts = JSON.parse(out.messageParts);
    } catch {
      out.messageParts = [out.messageParts];
    }
  }

  // JSON backups serialize Date objects as ISO strings. SQLite stores these
  // timestamps as Unix seconds, so convert known timestamp fields back before
  // inserting a restored row.
  const timestampFields = new Set([
    "createdAt",
    "lastSeenAt",
    "lastMessageAt",
    "closedAt",
    "lastUsedAt",
    "lastErrorAt",
    "updatedAt",
  ]);
  for (const field of timestampFields) {
    if (out[field] == null) continue;
    const value = out[field];
    if (value instanceof Date) {
      out[field] = Math.floor(value.getTime() / 1000);
    } else if (typeof value === "string" && value.trim()) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) out[field] = Math.floor(parsed / 1000);
    }
  }
  return out;
}

function serializeBackupValue(value: unknown): unknown {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return value;
}
