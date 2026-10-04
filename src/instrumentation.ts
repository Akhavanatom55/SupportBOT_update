// Runs once when a new Next.js server instance boots (Node.js runtime only).
// Used to seed default data and run lightweight periodic maintenance jobs:
// auto-closing stale tickets and nudging idle Gemini keys back into rotation.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const globalForJobs = globalThis as typeof globalThis & {
    __supportBotJobsStarted?: boolean;
  };
  if (globalForJobs.__supportBotJobsStarted) return;
  globalForJobs.__supportBotJobsStarted = true;

  const { ensureSeedData } = await import("@/lib/seed");
  try {
    await ensureSeedData();
  } catch (error) {
    console.error("seed error on startup", error);
  }

  const { runMaintenanceTasks } = await import("@/lib/maintenance");

  const THIRTY_MINUTES = 30 * 60 * 1000;
  setInterval(() => {
    runMaintenanceTasks().catch((error: unknown) => console.error("maintenance job error", error));
  }, THIRTY_MINUTES);

  // Also run once shortly after boot.
  setTimeout(() => {
    runMaintenanceTasks().catch((error: unknown) => console.error("maintenance job error", error));
  }, 15_000);
}
