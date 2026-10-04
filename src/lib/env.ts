// Centralised environment variables. The app is self-contained and uses the
// SQLite file configured by DATABASE_PATH, so no external PostgreSQL service
// is required for the normal Deplexo deployment.
function readEnv(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export const env = {
  // New name + backwards compatibility with the old Python deployment.
  baleBotToken: readEnv("BALE_BOT_TOKEN", readEnv("BOT_TOKEN")),
  adminIds: readEnv("ADMIN_IDS"),
  groupChatId: readEnv("GROUP_CHAT_ID"),
  geminiApiKey: readEnv("GEMINI_API_KEY"),
  geminiModel: readEnv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
  databasePath: readEnv("DATABASE_PATH", "/data/support_bot.db"),
  sessionSecret: readEnv("SESSION_SECRET", "change-this-session-secret-in-production"),
  adminPanelUsername: readEnv("ADMIN_PANEL_USERNAME", "admin"),
  adminPanelPassword: readEnv("ADMIN_PANEL_PASSWORD", "admin123"),
  publicBaseUrl: readEnv("PUBLIC_BASE_URL"),
  webhookSecret: readEnv("WEBHOOK_SECRET"),
  botName: readEnv("BOT_NAME", "ربات پشتیبانی"),
  organizationName: readEnv("ORGANIZATION_NAME", "تیم پشتیبانی"),
};
