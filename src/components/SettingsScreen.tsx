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

const labelClass = "min-w-0 flex-1 text-[15px] font-semibold leading-none text-stone-800";
const valueTextClass =
  "w-full border-0 bg-transparent p-0 text-right text-[15px] font-semibold leading-none text-stone-900 outline-none focus:ring-0";
const valueChipClass =
  "flex h-9 items-center justify-end rounded-lg bg-stone-200 px-2.5";

function placeCaretAtEnd(el: HTMLInputElement) {
  const move = () => {
    const n = el.value.length;
    try {
      el.setSelectionRange(n, n);
    } catch {
      /* iOS may ignore selection on some input types */
    }
  };
  move();
  requestAnimationFrame(move);
  window.setTimeout(move, 0);
  window.setTimeout(move, 50);
}

function SettingsChipInput({
  id,
  name,
  defaultValue,
  required,
  autoComplete,
  inputMode = "text",
}: {
  id: string;
  name: string;
  defaultValue: string | number;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "decimal";
}) {
  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode={inputMode}
      autoComplete={autoComplete ?? "off"}
      defaultValue={defaultValue}
      required={required}
      onFocus={(event) => placeCaretAtEnd(event.currentTarget)}
      className={valueTextClass}
    />
  );
}

function SettingsRow({
  label,
  htmlFor,
  children,
  labelClassName,
}: {
  label: ReactNode;
  htmlFor: string;
  children: ReactNode;
  labelClassName?: string;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <label htmlFor={htmlFor} className={cn(labelClass, labelClassName)}>
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
        defaultConsumptionRate: 0.45,
        defaultEfc: 1.75,
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
                  <SettingsChipInput
                    id="name"
                    name="name"
                    defaultValue={values.name}
                    required
                    autoComplete="name"
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
            </div>
          </div>

          <div>
            <h2 className="font-bold leading-tight text-stone-900">Preferences</h2>
            <div className="mt-1">
              <SettingsRow label="Default market age (days):" htmlFor="defaultMarketAgeDays">
                <ValueChip className="w-[4.75rem]">
                  <SettingsChipInput
                    id="defaultMarketAgeDays"
                    name="defaultMarketAgeDays"
                    defaultValue={values.defaultMarketAgeDays}
                    required
                    inputMode="numeric"
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="Default Consumption Rate:" htmlFor="defaultConsumptionRate">
                <ValueChip className="w-[4.75rem]">
                  <SettingsChipInput
                    id="defaultConsumptionRate"
                    name="defaultConsumptionRate"
                    defaultValue={values.defaultConsumptionRate ?? 0.45}
                    required
                    inputMode="decimal"
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="Default EFC:" htmlFor="defaultEfc">
                <ValueChip className="w-[4.75rem]">
                  <SettingsChipInput
                    id="defaultEfc"
                    name="defaultEfc"
                    defaultValue={values.defaultEfc ?? 1.75}
                    required
                    inputMode="decimal"
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="Feed up hours before catch:" htmlFor="lfoFeedUpHoursBeforeCatch">
                <ValueChip className="w-[4.75rem]">
                  <SettingsChipInput
                    id="lfoFeedUpHoursBeforeCatch"
                    name="lfoFeedUpHoursBeforeCatch"
                    defaultValue={values.lfoFeedUpHoursBeforeCatch ?? 5}
                    required
                    inputMode="numeric"
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="Feed off hours before catch:" htmlFor="lfoFeedOffHoursBeforeCatch">
                <ValueChip className="w-[4.75rem]">
                  <SettingsChipInput
                    id="lfoFeedOffHoursBeforeCatch"
                    name="lfoFeedOffHoursBeforeCatch"
                    defaultValue={values.lfoFeedOffHoursBeforeCatch ?? 10}
                    required
                    inputMode="numeric"
                  />
                </ValueChip>
              </SettingsRow>
            </div>
            {values.notifyInApp !== false ? (
              <input type="hidden" name="notifyInApp" value="on" />
            ) : null}
            {values.notifyEmail ? <input type="hidden" name="notifyEmail" value="on" /> : null}
          </div>

          <div>
            <h2 className="font-bold leading-tight text-stone-900">Mortality settings</h2>
            <div className="mt-1">
              <SettingsRow label="Daily warning:" htmlFor="dailyMortalityWarningPct">
                <ValueChip className="w-[4.75rem]">
                  <SettingsChipInput
                    id="dailyMortalityWarningPct"
                    name="dailyMortalityWarningPct"
                    defaultValue={values.dailyMortalityWarningPct}
                    required
                    inputMode="decimal"
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="Daily critical:" htmlFor="dailyMortalityCriticalPct">
                <ValueChip className="w-[4.75rem]">
                  <SettingsChipInput
                    id="dailyMortalityCriticalPct"
                    name="dailyMortalityCriticalPct"
                    defaultValue={values.dailyMortalityCriticalPct}
                    required
                    inputMode="decimal"
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="7-day warning:" htmlFor="sevenDayMortalityWarningPct">
                <ValueChip className="w-[4.75rem]">
                  <SettingsChipInput
                    id="sevenDayMortalityWarningPct"
                    name="sevenDayMortalityWarningPct"
                    defaultValue={values.sevenDayMortalityWarningPct}
                    required
                    inputMode="decimal"
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="7-day critical:" htmlFor="sevenDayMortalityCriticalPct">
                <ValueChip className="w-[4.75rem]">
                  <SettingsChipInput
                    id="sevenDayMortalityCriticalPct"
                    name="sevenDayMortalityCriticalPct"
                    defaultValue={values.sevenDayMortalityCriticalPct}
                    required
                    inputMode="decimal"
                  />
                </ValueChip>
              </SettingsRow>
              <SettingsRow label="3-day rising alert:" htmlFor="alertRisingThreeDays">
                <ValueChip className="w-[4.75rem]">
                  <select
                    id="alertRisingThreeDays"
                    name="alertRisingThreeDays"
                    defaultValue={values.alertRisingThreeDays ? "on" : "off"}
                    className={valueTextClass}
                    aria-label="3-day rising alert"
                  >
                    <option value="on">Yes</option>
                    <option value="off">No</option>
                  </select>
                </ValueChip>
              </SettingsRow>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {saved ? (
              <p className="text-sm font-semibold text-emerald-800" role="status">
                Settings saved.
              </p>
            ) : null}
            <Button type="submit" compact>
              {saved ? "Saved" : "Save settings"}
            </Button>
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
