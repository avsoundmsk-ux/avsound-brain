import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/auth/guards";
import { stats, auditLog } from "@/services/admin";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ stats: await stats(), audit: await auditLog(20) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}
