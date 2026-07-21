import { PrismaClient } from "@prisma/client";

const rawUrl = process.env.DATABASE_URL || "";
let cleanUrl = rawUrl.trim().replace(/^["']|["']$/g, "");
if (cleanUrl && (cleanUrl.includes(":6543") || cleanUrl.includes("pooler.supabase.com")) && !cleanUrl.includes("pgbouncer=true")) {
  cleanUrl += cleanUrl.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(cleanUrl ? { datasources: { db: { url: cleanUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
