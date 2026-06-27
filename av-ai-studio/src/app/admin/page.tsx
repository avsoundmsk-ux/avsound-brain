import { redirect } from "next/navigation";
import { getSession } from "@/auth/guards";
import { AdminUI } from "./ui";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  const role = (s.user as { role?: string }).role ?? "user";
  if (role !== "admin" && role !== "owner") redirect("/dashboard");
  return <AdminUI email={s.user.email} role={role} />;
}
