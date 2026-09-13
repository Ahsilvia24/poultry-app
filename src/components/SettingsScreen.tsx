"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { updateSettingsAction } from "@/app/actions/ops";
import { signOutAction } from "@/app/actions/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { useOffline } from "@/components/OfflineProvider";
import { Button, Card } from "@/components/ui";
import { APP_TIME_ZONES, resolveAppTimeZone } from "@/lib/app-time-zones";
import { FARM_ORDER_OPTIONS, parseFarmOrder } from "@/lib/farm-order";
import {
  applySettings,
  settingsFormValues,
  settingsWriteFromForm,
} from "@/lib/offline/applyLocal";
import { cn } from "@/lib/utils";

const labelClass = "shrink-0 text-[15px] font-semibold leading-none text-stone-800";
const valueTextClass =
  "w-full border-0 bg-transparent p-0 text-right text-[15px] font-semibold leading-none text-stone-900 outline-none focus:ring-0";
const valueChipClass =
  "flex h-9 items-center justify-end rounded-lg bg-stone-200 px-2.5";

function SettingsRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ValueChip({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(valueChipClass, className)}>{children}</div>;
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
        lfoFeedUpHoursBeforeCatch: 5,
        lfoFeedOffHoursBeforeCatch: 10,
      };
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
    };
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!snapshot) return;
    event.preventDefault();
    const write = settingsWriteFromForm(new FormData(event.currentTarget));
    patchSnapshot((current) => applySettings(current, write));
    enqueue({ kind: "updateSettings", payload: write });
    setSaved(true);
    if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4 md:mb-6">
        <h1 className="min-w-0 flex-1 text-[28px] font-extrabold leading-tight tracking-tight text-stone-900 md:text-3xl">
          Settings
        </h1>
        {values.email ? (
          <p
            id="email"
            aria-label="Email"
            className="w-[min(11.5rem,36vw)] shrink-0 pt-2.5 text-right text-[11px] font-medium leading-4 text-stone-400 break-all"
          >
            {values.email}
          </p>
        ) : null}
      </div>

      <Card className="max-w-2xl overflow-visible">
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
            <div className="mt-1">
              <SettingsRow label="Service Tech:" htmlFor="name">
                <ValueChip className="min-w-[9.5rem] max-w-[14rem] flex-1">
                  <input
                    id="name"
                    name="name"
                    defaultValue={values.name}
                    required
                    autoComplete="name"
                    className={valueTextClass}
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="Order Farms By:" htmlFor="farmOrder">
                <ValueChip className="min-w-[9.5rem] max-w-[14rem]">
                  <select
                    id="farmOrder"
                    name="farmOrder"
                    defaultValue={parseFarmOrder(values.farmOrder)}
                    className={valueTextClass}
                  >
                    {FARM_ORDER_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </ValueChip>
              </SettingsRow>
            </div>
          </div>

          <div>
            <h2 className="font-bold leading-tight text-stone-900">Mortality Thresholds (%)</h2>
            <div className="mt-1">
              <SettingsRow label="Daily warning:" htmlFor="dailyMortalityWarningPct">
                <ValueChip className="w-[4.75rem]">
                  <input
                    id="dailyMortalityWarningPct"
                    name="dailyMortalityWarningPct"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={values.dailyMortalityWarningPct}
                    required
                    className={valueTextClass}
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="Daily critical:" htmlFor="dailyMortalityCriticalPct">
                <ValueChip className="w-[4.75rem]">
                  <input
                    id="dailyMortalityCriticalPct"
                    name="dailyMortalityCriticalPct"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={values.dailyMortalityCriticalPct}
                    required
                    className={valueTextClass}
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="7-day warning:" htmlFor="sevenDayMortalityWarningPct">
                <ValueChip className="w-[4.75rem]">
                  <input
                    id="sevenDayMortalityWarningPct"
                    name="sevenDayMortalityWarningPct"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={values.sevenDayMortalityWarningPct}
                    required
                    className={valueTextClass}
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="7-day critical:" htmlFor="sevenDayMortalityCriticalPct">
                <ValueChip className="w-[4.75rem]">
                  <input
                    id="sevenDayMortalityCriticalPct"
                    name="sevenDayMortalityCriticalPct"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={values.sevenDayMortalityCriticalPct}
                    required
                    className={valueTextClass}
                  />
                </ValueChip>
              </SettingsRow>
            </div>
            <label className="mt-1 flex items-center gap-2 text-[15px] font-semibold leading-tight text-stone-700">
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
            <div className="mt-1">
              <SettingsRow label="Timezone:" htmlFor="appTimeZone">
                <ValueChip className="min-w-[9.5rem] max-w-[14rem]">
                  <select
                    id="appTimeZone"
                    name="appTimeZone"
                    defaultValue={values.appTimeZone}
                    className={valueTextClass}
                  >
                    {APP_TIME_ZONES.map((zone) => (
                      <option key={zone.value} value={zone.value}>
                        {zone.label}
                      </option>
                    ))}
                  </select>
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="Default market age (days):" htmlFor="defaultMarketAgeDays">
                <ValueChip className="w-[4.75rem]">
                  <input
                    id="defaultMarketAgeDays"
                    name="defaultMarketAgeDays"
                    type="number"
                    min={1}
                    defaultValue={values.defaultMarketAgeDays}
                    required
                    className={valueTextClass}
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="Feed up hours before catch:" htmlFor="lfoFeedUpHoursBeforeCatch">
                <ValueChip className="w-[4.75rem]">
                  <input
                    id="lfoFeedUpHoursBeforeCatch"
                    name="lfoFeedUpHoursBeforeCatch"
                    type="number"
                    min={1}
                    max={48}
                    defaultValue={values.lfoFeedUpHoursBeforeCatch ?? 5}
                    required
                    className={valueTextClass}
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="Feed off hours before catch:" htmlFor="lfoFeedOffHoursBeforeCatch">
                <ValueChip className="w-[4.75rem]">
                  <input
                    id="lfoFeedOffHoursBeforeCatch"
                    name="lfoFeedOffHoursBeforeCatch"
                    type="number"
                    min={1}
                    max={72}
                    defaultValue={values.lfoFeedOffHoursBeforeCatch ?? 10}
                    required
                    className={valueTextClass}
                  />
                </ValueChip>
              </SettingsRow>
            </div>
            {values.notifyInApp !== false ? (
              <input type="hidden" name="notifyInApp" value="on" />
            ) : null}
            {values.notifyEmail ? <input type="hidden" name="notifyEmail" value="on" /> : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">{saved ? "Saved" : "Save settings"}</Button>
            {saved ? (
              <p className="text-sm font-semibold text-emerald-800" role="status">
                Settings saved.
              </p>
            ) : null}
          </div>
        </form>

        <div className="mt-5 overflow-visible border-t border-stone-200 pt-3">
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
