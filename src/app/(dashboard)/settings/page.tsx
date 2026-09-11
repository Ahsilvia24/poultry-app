import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SettingsScreen } from "@/components/SettingsScreen";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <SettingsScreen />;
}
