import { redirect } from "next/navigation";
import { getSession } from "@/auth/guards";
import { getBalance } from "@/services/credits";
import { BillingUI } from "./ui";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  const balance = await getBalance(s.user.id);
  return <BillingUI balance={balance} devMode={process.env.NODE_ENV !== "production"} />;
}
