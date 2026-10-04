from __future__ import annotations

from pathlib import Path

import aiosqlite

from config import DATABASE_PATH


async def init_db() -> None:
    Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_blocked INTEGER DEFAULT 0
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS message_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                bot_message_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                user_message_id TEXT,
                message_kind TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(chat_id, bot_message_id)
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS support_chats (
                chat_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP
            )
        ''')
        await db.execute('''
            CREATE INDEX IF NOT EXISTS idx_support_chats_user_status
            ON support_chats(user_id, status)
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        await db.execute('''
            CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id
            ON chat_messages(chat_id, id)
        ''')
        await db.commit()


async def upsert_user(user_id: int, username: str, first_name: str, last_name: str) -> None:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute('''
            INSERT INTO users (user_id, username, first_name, last_name, last_seen_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                username = excluded.username,
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                last_seen_at = CURRENT_TIMESTAMP,
                is_blocked = 0
        ''', (user_id, username, first_name, last_name))
        await db.commit()


async def get_user(user_id: int) -> dict | None:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute('''
            SELECT user_id, username, first_name, last_name, created_at, last_seen_at, is_blocked
            FROM users
            WHERE user_id = ?
        ''', (user_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            return {
                "user_id": row[0],
                "username": row[1],
                "first_name": row[2],
                "last_name": row[3],
                "created_at": row[4],
                "last_seen_at": row[5],
                "is_blocked": row[6],
            }


async def get_all_users() -> list[dict]:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute('''
            SELECT user_id, username, first_name, last_name, created_at, last_seen_at
            FROM users
            WHERE is_blocked = 0
            ORDER BY last_seen_at DESC, user_id DESC
        ''') as cursor:
            rows = await cursor.fetchall()
            return [
                {
                    "user_id": row[0],
                    "username": row[1],
                    "first_name": row[2],
                    "last_name": row[3],
                    "created_at": row[4],
                    "last_seen_at": row[5],
                }
                for row in rows
            ]


async def get_users_count() -> int:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute('SELECT COUNT(*) FROM users WHERE is_blocked = 0') as cursor:
            row = await cursor.fetchone()
            return int(row[0] or 0) if row else 0


async def save_message_link(
    chat_id: str | int,
    bot_message_id: str | int,
    user_id: int,
    user_message_id: str | int,
    message_kind: str,
) -> None:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute('''
            INSERT OR REPLACE INTO message_links
            (chat_id, bot_message_id, user_id, user_message_id, message_kind)
            VALUES (?, ?, ?, ?, ?)
        ''', (str(chat_id), str(bot_message_id), int(user_id), str(user_message_id), message_kind))
        await db.commit()


async def get_user_id_by_bot_message(chat_id: str | int, bot_message_id: str | int) -> int | None:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute('''
            SELECT user_id
            FROM message_links
            WHERE chat_id = ? AND bot_message_id = ?
            ORDER BY id DESC
            LIMIT 1
        ''', (str(chat_id), str(bot_message_id))) as cursor:
            row = await cursor.fetchone()
            return int(row[0]) if row else None


async def get_open_chat(user_id: int) -> dict | None:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute('''
            SELECT chat_id, user_id, status, created_at, closed_at
            FROM support_chats
            WHERE user_id = ? AND status = 'open'
            ORDER BY chat_id DESC
            LIMIT 1
        ''', (user_id,)) as cursor:
            row = await cursor.fetchone()
            return (
                {
                    "chat_id": int(row[0]),
                    "user_id": int(row[1]),
                    "status": row[2],
                    "created_at": row[3],
                    "closed_at": row[4],
                }
                if row else None
            )


async def create_support_chat(user_id: int) -> int:
    existing = await get_open_chat(user_id)
    if existing:
        return int(existing["chat_id"])

    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO support_chats (user_id, status) VALUES (?, 'open')",
            (user_id,),
        )
        chat_id = int(cursor.lastrowid)
        await db.commit()
        return chat_id


async def close_support_chat(user_id: int) -> int | None:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute('''
            SELECT chat_id FROM support_chats
            WHERE user_id = ? AND status = 'open'
            ORDER BY chat_id DESC LIMIT 1
        ''', (user_id,)) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        chat_id = int(row[0])
        await db.execute('''
            UPDATE support_chats
            SET status = 'closed', closed_at = CURRENT_TIMESTAMP
            WHERE chat_id = ?
        ''', (chat_id,))
        await db.commit()
        return chat_id


async def save_chat_message(chat_id: int, role: str, content: str) -> None:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute('''
            INSERT INTO chat_messages (chat_id, role, content)
            VALUES (?, ?, ?)
        ''', (chat_id, role, content))
        await db.commit()


async def get_chat_messages(chat_id: int, limit: int = 12) -> list[dict]:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute('''
            SELECT role, content, created_at
            FROM chat_messages
            WHERE chat_id = ?
            ORDER BY id DESC
            LIMIT ?
        ''', (chat_id, int(limit))) as cursor:
            rows = await cursor.fetchall()

    rows.reverse()
    return [{"role": row[0], "content": row[1], "created_at": row[2]} for row in rows]
