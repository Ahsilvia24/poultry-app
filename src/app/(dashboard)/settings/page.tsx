import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateSettingsAction } from "@/app/actions/ops";
import { signOutAction } from "@/app/actions/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { FarmOrderStepper } from "@/components/FarmOrderStepper";
import { APP_TIME_ZONES, resolveAppTimeZone } from "@/lib/app-time-zones";
import { FARM_ORDER_OPTIONS, parseFarmOrder } from "@/lib/farm-order";

const inlineInputClass =
  "!min-h-7 flex-1 border-0 bg-transparent px-0 py-0 leading-tight text-base font-semibold shadow-none focus:border-transparent focus:ring-0";

function SettingsLine({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 leading-tight">
      <label htmlFor={htmlFor} className="shrink-0 text-sm font-semibold leading-tight text-stone-800">
        {label}
      </label>
      {children}
    </div>
  );
}

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
  const timeZone = resolveAppTimeZone(s?.appTimeZone);

  return (
    <div>
      <PageHeader title="Settings" />

      <Card className="max-w-2xl">
        <form action={submitSettings} className="space-y-3">
          <div>
            <h2 className="font-bold leading-tight text-stone-900">Profile</h2>
            <div className="mt-1 space-y-0">
              <SettingsLine label="Service Tech:" htmlFor="name">
                <Input
                  id="name"
                  name="name"
                  compact
                  defaultValue={user.name}
                  required
                  className={inlineInputClass}
                />
              </SettingsLine>
              <div className="flex items-start gap-2">
                <p className="shrink-0 pt-1 text-sm font-semibold leading-tight text-stone-800">
                  Order Farms By:
                </p>
                <FarmOrderStepper
                  name="farmOrder"
                  defaultValue={parseFarmOrder(s?.farmOrder)}
                  options={FARM_ORDER_OPTIONS}
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-bold leading-tight text-stone-900">Mortality Thresholds (%)</h2>
            <div className="mt-1 space-y-0">
              <SettingsLine label="Daily warning:" htmlFor="dailyMortalityWarningPct">
                <Input
                  id="dailyMortalityWarningPct"
                  name="dailyMortalityWarningPct"
                  type="number"
                  step="0.01"
                  min={0}
                  compact
                  defaultValue={s?.dailyMortalityWarningPct ?? 0.15}
                  required
                  className={inlineInputClass}
                />
              </SettingsLine>
              <SettingsLine label="Daily critical:" htmlFor="dailyMortalityCriticalPct">
                <Input
                  id="dailyMortalityCriticalPct"
                  name="dailyMortalityCriticalPct"
                  type="number"
                  step="0.01"
                  min={0}
                  compact
                  defaultValue={s?.dailyMortalityCriticalPct ?? 0.3}
                  required
                  className={inlineInputClass}
                />
              </SettingsLine>
              <SettingsLine label="7-day warning:" htmlFor="sevenDayMortalityWarningPct">
                <Input
                  id="sevenDayMortalityWarningPct"
                  name="sevenDayMortalityWarningPct"
                  type="number"
                  step="0.01"
                  min={0}
                  compact
                  defaultValue={s?.sevenDayMortalityWarningPct ?? 1}
                  required
                  className={inlineInputClass}
                />
              </SettingsLine>
              <SettingsLine label="7-day critical:" htmlFor="sevenDayMortalityCriticalPct">
                <Input
                  id="sevenDayMortalityCriticalPct"
                  name="sevenDayMortalityCriticalPct"
                  type="number"
                  step="0.01"
                  min={0}
                  compact
                  defaultValue={s?.sevenDayMortalityCriticalPct ?? 2}
                  required
                  className={inlineInputClass}
                />
              </SettingsLine>
            </div>
            <label className="mt-1 flex items-center gap-2 text-sm font-semibold leading-tight text-stone-700">
              <input
                type="checkbox"
                name="alertRisingThreeDays"
                defaultChecked={s?.alertRisingThreeDays ?? true}
                className="h-4 w-4"
              />
              Alert when mortality rises three consecutive days
            </label>
          </div>

          <div>
            <h2 className="font-bold leading-tight text-stone-900">Preferences</h2>
            <div className="mt-1 space-y-0">
              <SettingsLine label="Timezone:" htmlFor="appTimeZone">
                <Select
                  id="appTimeZone"
                  name="appTimeZone"
                  compact
                  defaultValue={timeZone}
                  className="!min-h-7 max-w-56 border-0 bg-transparent px-0 py-0 text-base font-semibold shadow-none focus:border-transparent focus:ring-0"
                >
                  {APP_TIME_ZONES.map((zone) => (
                    <option key={zone.value} value={zone.value}>
                      {zone.label}
                    </option>
                  ))}
                </Select>
              </SettingsLine>
              <SettingsLine label="Default market age (days):" htmlFor="defaultMarketAgeDays">
                <Input
                  id="defaultMarketAgeDays"
                  name="defaultMarketAgeDays"
                  type="number"
                  min={1}
                  compact
                  defaultValue={s?.defaultMarketAgeDays ?? 52}
                  required
                  className={inlineInputClass}
                />
              </SettingsLine>
            </div>
            {s?.notifyInApp !== false ? (
              <input type="hidden" name="notifyInApp" value="on" />
            ) : null}
            {s?.notifyEmail ? <input type="hidden" name="notifyEmail" value="on" /> : null}
          </div>

          <Button type="submit">Save settings</Button>
        </form>

        <div className="mt-5 space-y-2 border-t border-stone-200 pt-3">
          <div className="flex items-center gap-2">
            <p className="shrink-0 text-sm font-semibold leading-tight text-stone-800">Email:</p>
            <p id="email" className="min-w-0 flex-1 py-0 text-base font-semibold leading-tight text-stone-900">
              {user.email}
            </p>
          </div>
          <ChangePasswordForm />
        </div>
      </Card>

      <form action={signOutAction} className="mt-6 flex justify-center">
        <button
          type="submit"
          className="px-3 py-2 text-sm font-bold text-stone-800 underline"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
