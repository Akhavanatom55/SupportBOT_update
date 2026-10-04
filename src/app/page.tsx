import { db } from "@/db";

export default async function Home() {
  let status = "Database Offline";

  try {
    await db.run("SELECT 1");
    status = "Database Online";
  } catch {
    status = "Database Error";
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">
        Support BOT
      </h1>

      <p>
        System Status:
        {" "}
        {status}
      </p>

      <a
        href="/admin"
        className="px-5 py-3 rounded-lg bg-black text-white"
      >
        ورود به پنل مدیریت
      </a>
    </main>
  );
}
