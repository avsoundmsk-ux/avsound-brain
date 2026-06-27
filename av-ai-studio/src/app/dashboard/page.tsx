import { redirect } from "next/navigation";
import { getSession } from "@/auth/guards";
import { getBalance } from "@/services/credits";
import { DashboardUI } from "./ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  if ((s.user as { status?: string }).status === "blocked") redirect("/sign-in");

  const balance = await getBalance(s.user.id);
  const role = (s.user as { role?: string }).role ?? "user";
  return <DashboardUI email={s.user.email} role={role} balance={balance} />;
}
