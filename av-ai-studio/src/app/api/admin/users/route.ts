import { NextResponse } from "next/server";
import { requireAdmin, requireOwner, AuthError } from "@/auth/guards";
import { assertCsrf, CsrfError } from "@/server/csrf";
import { clientIp } from "@/server/rate-limit";
import { listUsers, setUserStatus, setUserRole, adjustCredits } from "@/services/admin";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await listUsers());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const s = await requireAdmin();
    const ip = clientIp(req);
    const b = (await req.json()) as { action: string; userId: string; status?: "active" | "blocked"; role?: "user" | "admin" | "owner"; delta?: number; note?: string };
    if (!b.userId) return NextResponse.json({ error: "userId" }, { status: 400 });

    if (b.action === "status" && b.status) {
      await setUserStatus(s.user.id, b.userId, b.status, ip);
    } else if (b.action === "adjust" && typeof b.delta === "number") {
      const bal = await adjustCredits(s.user.id, b.userId, b.delta, b.note ?? "admin adjust", ip);
      return NextResponse.json({ ok: true, balance: bal });
    } else if (b.action === "role" && b.role) {
      await requireOwner(); // смена роли — только owner
      await setUserRole(s.user.id, b.userId, b.role, ip);
    } else {
      return NextResponse.json({ error: "bad action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    if (e instanceof CsrfError) return NextResponse.json({ error: "csrf" }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
