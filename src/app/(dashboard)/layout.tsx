import { auth } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <AppNav userName={session.user.name} />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
