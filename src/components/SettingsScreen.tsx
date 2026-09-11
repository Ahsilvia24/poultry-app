"use client";

import type { FormEvent, ReactNode } from "react";
import { updateSettingsAction } from "@/app/actions/ops";
import { signOutAction } from "@/app/actions/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { useOffline } from "@/components/OfflineProvider";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { FarmOrderStepper } from "@/components/FarmOrderStepper";
import { APP_TIME_ZONES, resolveAppTimeZone } from "@/lib/app-time-zones";
import { FARM_ORDER_OPTIONS, parseFarmOrder } from "@/lib/farm-order";
import {
  applySettings,
  settingsFormValues,
  settingsWriteFromForm,
} from "@/lib/offline/applyLocal";
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

export function SettingsScreen() {
  const { snapshot, patchSnapshot, enqueue } = useOffline();
  const values = snapshot
    ? settingsFormValues(snapshot)
    : {
        name: "",
        email: "",
        farmOrder: parseFarmOrder(undefined),
        appTimeZone: resolveAppTimeZone(undefined),
        dailyMortalityWarningPct: 0.15,
        dailyMortalityCriticalPct: 0.3,
        sevenDayMortalityWarningPct: 1,
        sevenDayMortalityCriticalPct: 2,
        alertRisingThreeDays: true,
        defaultMarketAgeDays: 52,
        notifyEmail: false,
        notifyInApp: true,
      };

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!snapshot) return;
    event.preventDefault();
    const write = settingsWriteFromForm(new FormData(event.currentTarget));
    patchSnapshot((current) => applySettings(current, write));
    enqueue({ kind: "updateSettings", payload: write });
  }

  return (
    <div>
      <PageHeader title="Settings" />

      <Card className="max-w-2xl">
        <form
          key={snapshot?.pulledAt ?? "empty"}
          action={async (formData) => {
            await updateSettingsAction(formData);
          }}
          onSubmit={onSubmit}
          className="space-y-3"
        >
          <div>
            <h2 className="font-bold leading-tight text-stone-900">Profile</h2>
            <div className="mt-1 space-y-0">
              <SettingsLine label="Service Tech:" htmlFor="name">
                <Input
                  id="name"
                  name="name"
                  compact
                  defaultValue={values.name}
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
                  defaultValue={parseFarmOrder(values.farmOrder)}
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
                  defaultValue={values.dailyMortalityWarningPct}
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
                  defaultValue={values.dailyMortalityCriticalPct}
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
                  defaultValue={values.sevenDayMortalityWarningPct}
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
                  defaultValue={values.sevenDayMortalityCriticalPct}
                  required
                  className={inlineInputClass}
                />
              </SettingsLine>
            </div>
            <label className="mt-1 flex items-center gap-2 text-sm font-semibold leading-tight text-stone-700">
              <input
                type="checkbox"
                name="alertRisingThreeDays"
                defaultChecked={values.alertRisingThreeDays}
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
                  defaultValue={values.appTimeZone}
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
                  defaultValue={values.defaultMarketAgeDays}
                  required
                  className={inlineInputClass}
                />
              </SettingsLine>
            </div>
            {values.notifyInApp !== false ? (
              <input type="hidden" name="notifyInApp" value="on" />
            ) : null}
            {values.notifyEmail ? <input type="hidden" name="notifyEmail" value="on" /> : null}
          </div>

          <Button type="submit">Save settings</Button>
        </form>

        <div className="mt-5 space-y-2 border-t border-stone-200 pt-3">
          <div className="flex items-center gap-2">
            <p className="shrink-0 text-sm font-semibold leading-tight text-stone-800">Email:</p>
            <p id="email" className="min-w-0 flex-1 py-0 text-base font-semibold leading-tight text-stone-900">
              {values.email || "—"}
            </p>
          </div>
          <ChangePasswordForm />
        </div>
      </Card>

      <form action={signOutAction} className="mt-6 flex justify-center">
        <button type="submit" className="px-3 py-2 text-sm font-bold text-stone-800 underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
