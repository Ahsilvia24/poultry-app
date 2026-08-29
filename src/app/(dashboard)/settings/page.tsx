import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateSettingsAction } from "@/app/actions/ops";
import { Button, Card, Input, Label, PageHeader } from "@/components/ui";

async function submitSettings(formData: FormData) {
  "use server";
  await updateSettingsAction(formData);
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { settings: true },
  });
  if (!user) redirect("/login");

  const s = user.settings;

  return (
    <div>
      <PageHeader title="Settings" />

      <Card className="max-w-2xl">
        <form action={submitSettings} className="space-y-5">
          <div>
            <h2 className="font-bold text-stone-900">Profile</h2>
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={user.name} required />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email} disabled />
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-bold text-stone-900">Mortality thresholds (%)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="dailyMortalityWarningPct">Daily warning</Label>
                <Input
                  id="dailyMortalityWarningPct"
                  name="dailyMortalityWarningPct"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={s?.dailyMortalityWarningPct ?? 0.15}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dailyMortalityCriticalPct">Daily critical</Label>
                <Input
                  id="dailyMortalityCriticalPct"
                  name="dailyMortalityCriticalPct"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={s?.dailyMortalityCriticalPct ?? 0.3}
                  required
                />
              </div>
              <div>
                <Label htmlFor="sevenDayMortalityWarningPct">7-day warning</Label>
                <Input
                  id="sevenDayMortalityWarningPct"
                  name="sevenDayMortalityWarningPct"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={s?.sevenDayMortalityWarningPct ?? 1}
                  required
                />
              </div>
              <div>
                <Label htmlFor="sevenDayMortalityCriticalPct">7-day critical</Label>
                <Input
                  id="sevenDayMortalityCriticalPct"
                  name="sevenDayMortalityCriticalPct"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={s?.sevenDayMortalityCriticalPct ?? 2}
                  required
                />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
              <input
                type="checkbox"
                name="alertRisingThreeDays"
                defaultChecked={s?.alertRisingThreeDays ?? true}
                className="h-5 w-5"
              />
              Alert when mortality rises three consecutive days
            </label>
          </div>

          <div>
            <h2 className="font-bold text-stone-900">Preferences</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="defaultMarketAgeDays">Default market age (days)</Label>
                <Input
                  id="defaultMarketAgeDays"
                  name="defaultMarketAgeDays"
                  type="number"
                  min={1}
                  defaultValue={s?.defaultMarketAgeDays ?? 52}
                  required
                />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
                <input
                  type="checkbox"
                  name="notifyInApp"
                  defaultChecked={s?.notifyInApp ?? true}
                  className="h-5 w-5"
                />
                In-app notifications
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
                <input
                  type="checkbox"
                  name="notifyEmail"
                  defaultChecked={s?.notifyEmail ?? false}
                  className="h-5 w-5"
                />
                Email notifications
              </label>
            </div>
          </div>

          <Button type="submit">Save settings</Button>
        </form>
      </Card>
    </div>
  );
}
