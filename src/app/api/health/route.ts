import { sql } from "drizzle-orm";
import { getDatabase } from "@/server/db/client";
import { logger } from "@/server/logging/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    getDatabase().run(sql`select 1`);
    return Response.json({ status: "ok", database: "connected" });
  } catch (error) {
    logger.error("Database health check failed", { errorType: error instanceof Error ? error.name : "unknown" });
    return Response.json({ status: "error" }, { status: 503 });
  }
}
