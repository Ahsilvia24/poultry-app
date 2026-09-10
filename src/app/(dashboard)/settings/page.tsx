import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateSettingsAction } from "@/app/actions/ops";
import { signOutAction } from "@/app/actions/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { FarmOrderStepper } from "@/components/FarmOrderStepper";
import { FARM_ORDER_OPTIONS, parseFarmOrder } from "@/lib/farm-order";

const inlineInputClass =
  "min-h-0 flex-1 border-0 bg-transparent px-0 py-1 text-base font-semibold shadow-none focus:border-transparent focus:ring-0";

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
    <div className="flex items-center gap-3">
      <label htmlFor={htmlFor} className="shrink-0 text-sm font-semibold text-stone-800">
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

  return (
    <div>
      <PageHeader title="Settings" />

      <Card className="max-w-2xl">
        <form action={submitSettings} className="space-y-5">
          <div>
            <h2 className="font-bold text-stone-900">Profile</h2>
            <div className="mt-3 space-y-2">
              <SettingsLine label="Service Tech:" htmlFor="name">
                <Input
                  id="name"
                  name="name"
                  defaultValue={user.name}
                  required
                  className={inlineInputClass}
                />
              </SettingsLine>
              <div className="flex items-start gap-3">
                <p className="shrink-0 pt-2 text-sm font-semibold text-stone-800">Order Farms By:</p>
                <FarmOrderStepper
                  name="farmOrder"
                  defaultValue={parseFarmOrder(s?.farmOrder)}
                  options={FARM_ORDER_OPTIONS}
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-bold text-stone-900">Mortality Thresholds (%)</h2>
            <div className="mt-3 space-y-2">
              <SettingsLine label="Daily warning:" htmlFor="dailyMortalityWarningPct">
                <Input
                  id="dailyMortalityWarningPct"
                  name="dailyMortalityWarningPct"
                  type="number"
                  step="0.01"
                  min={0}
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
                  defaultValue={s?.sevenDayMortalityCriticalPct ?? 2}
                  required
                  className={inlineInputClass}
                />
              </SettingsLine>
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
            <div className="mt-3 space-y-2">
              <SettingsLine label="Default market age (days):" htmlFor="defaultMarketAgeDays">
                <Input
                  id="defaultMarketAgeDays"
                  name="defaultMarketAgeDays"
                  type="number"
                  min={1}
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

        <div className="mt-8 space-y-5 border-t border-stone-200 pt-5">
          <div className="flex items-center gap-3">
            <p className="shrink-0 text-sm font-semibold text-stone-800">Email:</p>
            <p id="email" className="min-w-0 flex-1 py-1 text-base font-semibold text-stone-900">
              {user.email}
            </p>
          </div>
          <ChangePasswordForm />
        </div>
      </Card>

      <form action={signOutAction} className="mt-8 flex justify-center">
        <button
          type="submit"
          className="px-3 py-4 text-sm font-bold text-stone-800 underline"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
