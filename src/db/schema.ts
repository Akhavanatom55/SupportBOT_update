import {
  sqliteTable,
  integer,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const timestamp = (name: string) => integer(name, { mode: "timestamp" });

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    baleUserId: text("bale_user_id").notNull(),
    chatId: text("chat_id").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    username: text("username"),
    phone: text("phone"),
    isBlocked: integer("is_blocked", { mode: "boolean" }).notNull().default(false),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch())`),
    lastSeenAt: timestamp("last_seen_at").notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    baleUserIdx: uniqueIndex("users_bale_user_id_idx").on(table.baleUserId),
  }),
);

export const botAdmins = sqliteTable(
  "bot_admins",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    baleUserId: text("bale_user_id").notNull(),
    name: text("name"),
    isSuperAdmin: integer("is_super_admin", { mode: "boolean" }).notNull().default(false),
    pendingReplyTicketId: integer("pending_reply_ticket_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    baleAdminIdx: uniqueIndex("bot_admins_bale_user_id_idx").on(table.baleUserId),
  }),
);

export const tickets = sqliteTable("tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  status: text("status", { enum: ["open", "closed"] as const }).notNull().default("open"),
  subject: text("subject"),
  assignedAdminBaleId: text("assigned_admin_bale_id"),
  assignedAdminName: text("assigned_admin_name"),
  aiPaused: integer("ai_paused", { mode: "boolean" }).notNull().default(false),
  rating: integer("rating"),
  createdAt: timestamp("created_at").notNull().default(sql`(unixepoch())`),
  lastMessageAt: timestamp("last_message_at").notNull().default(sql`(unixepoch())`),
  closedAt: timestamp("closed_at"),
});

export const ticketMessages = sqliteTable("ticket_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketId: integer("ticket_id").notNull(),
  sender: text("sender", { enum: ["user", "admin", "bot", "system"] as const }).notNull(),
  senderLabel: text("sender_label"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`(unixepoch())`),
});

export const geminiKeys = sqliteTable("gemini_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  apiKey: text("api_key").notNull(),
  priority: integer("priority").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isExhausted: integer("is_exhausted", { mode: "boolean" }).notNull().default(false),
  lastUsedAt: timestamp("last_used_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastErrorMessage: text("last_error_message"),
  successCount: integer("success_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`(unixepoch())`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch())`),
});

export const faqs = sqliteTable("faqs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  hitCount: integer("hit_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`(unixepoch())`),
});

export const cannedResponses = sqliteTable("canned_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  keywords: text("keywords"),
  messageParts: text("message_parts", { mode: "json" }).$type<string[]>().notNull(),
  category: text("category").notNull().default("quick"),
  isAutoSuggest: integer("is_auto_suggest", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`(unixepoch())`),
});

export const adminWebUsers = sqliteTable(
  "admin_web_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    usernameIdx: uniqueIndex("admin_web_users_username_idx").on(table.username),
  }),
);

export const broadcasts = sqliteTable("broadcasts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`(unixepoch())`),
});
