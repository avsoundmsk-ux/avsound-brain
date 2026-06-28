/**
 * GET /api/health — liveness/readiness. Пингует БД. Без секретов в ответе.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET() {
  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch { dbOk = false; }
  return NextResponse.json(
    { ok: dbOk, db: dbOk ? "up" : "down", time: new Date().toISOString() },
    { status: dbOk ? 200 : 503 },
  );
}
