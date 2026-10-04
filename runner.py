"""Production entrypoint for the Bale support bot.

The original main.py initializes the database in an asyncio entrypoint, but it
returns without starting Bale's updater. This runner intentionally separates
those two lifecycle steps: initialize the database, then start bot.run().
"""

from __future__ import annotations

import asyncio
import main


def start() -> None:
    print("[BOOT] Initializing database...", flush=True)
    asyncio.run(main.bootstrap())
    print("[BOOT] Database initialized.", flush=True)
    print("[BOOT] Starting Bale bot updater...", flush=True)
    main.bot.run()


if __name__ == "__main__":
    start()
