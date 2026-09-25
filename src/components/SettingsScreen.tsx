"use client";

import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { signOutLocalApp } from "@/lib/offline/signOutLocal";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { useOffline } from "@/components/OfflineProvider";
import {
  adoptImportedSnapshot,
  buildPhoneBackup,
  downloadPhoneBackup,
  EXPORT_ALL_APP_DATA,
  farmCountInSnapshot,
  IMPORT_APP_DATA,
  MOVE_DATA_HELP,
  parsePhoneBackupText,
  sharePhoneBackup,
} from "@/lib/offline/phoneBackup";
import { persistOwnerFarms } from "@/lib/offline/persistOwnerFarms";
import {
  phoneFarmSaveStatus,
  SIGN_OUT_ANYWAY,
  SIGN_OUT_STAY,
  SIGN_OUT_UNSAVED_BODY,
  SIGN_OUT_UNSAVED_CONFIRM,
} from "@/lib/offline/phoneFarmSave";
import {
  SYNC_WORKING,
  syncPhoneResultMessage,
  type SyncPhoneResult,
} from "@/lib/offline/syncPhoneToWebsite";
import { SYNC_UI_MS } from "@/lib/offline/syncTimeout";
import {
  SettingsChipInput,
  SettingsFieldRow as SettingsRow,
  SettingsValueChip as ValueChip,
  settingsValueTextClass as valueTextClass,
} from "@/components/SettingsLayout";
import { Button, Card } from "@/components/ui";
import { APP_TIME_ZONES, resolveAppTimeZone } from "@/lib/app-time-zones";
import { FARM_ORDER_OPTIONS, parseFarmOrder } from "@/lib/farm-order";
import {
  applySettings,
  settingsFormValues,
  settingsWriteFromForm,
} from "@/lib/offline/applyLocal";
import { looksLikeEmail } from "@/lib/person-name";

export function SettingsScreen() {
  const {
    snapshot,
    patchSnapshot,
    pendingCount,
    lastBackupAt,
    syncing,
    ready,
    replaceSnapshot,
    enqueue,
    syncNow,
  } = useOffline();
  const farmSave = phoneFarmSaveStatus({ ready, syncing, pendingCount, lastBackupAt });
  const [syncingNow, setSyncingNow] = useState(false);
  const [lastSync, setLastSync] = useState<SyncPhoneResult | null>(null);
  const websiteConfirmed = Boolean(lastSync?.ok && pendingCount === 0);
  const shownSave = syncingNow
    ? { kind: "saving" as const, text: SYNC_WORKING }
    : websiteConfirmed
      ? syncPhoneResultMessage(lastSync!)
      : lastSync && !lastSync.ok
        ? syncPhoneResultMessage(lastSync)
        : farmSave;
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
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
    void enqueue({ kind: "updateSettings", payload: write });
    setSaved(true);
    if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 2500);
  }

  function onSync() {
    if (syncingNow || leaving) return;
    void (async () => {
      setSyncingNow(true);
      setLastSync(null);
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        setLastSync({
          ok: false,
          pending: pendingCount || 1,
          aliases: {},
          reason: "leftover",
        });
        setSyncingNow(false);
      }, SYNC_UI_MS);
      try {
        const result = await syncNow();
        settled = true;
        setLastSync(result);
      } catch {
        settled = true;
        setLastSync({
          ok: false,
          pending: pendingCount || 1,
          aliases: {},
          reason: "unreachable",
        });
      } finally {
        settled = true;
        window.clearTimeout(timer);
        setSyncingNow(false);
      }
    })();
  }

  async function leaveApp(force = false) {
    setLeaving(true);
    try {
      if (!force) {
        setConfirmLeave(true);
        return;
      }
      setConfirmLeave(false);
      await signOutLocalApp();
    } catch {
      setConfirmLeave(false);
      await signOutLocalApp();
    } finally {
      setLeaving(false);
    }
  }

  async function onExportAll() {
    if (!snapshot || backupBusy) return;
    setBackupBusy(true);
    setBackupNote(null);
    try {
      const backup = buildPhoneBackup(snapshot);
      await persistOwnerFarms(snapshot);
      await sharePhoneBackup(backup);
      setBackupNote(
        `Exported ${farmCountInSnapshot(snapshot)} farm${farmCountInSnapshot(snapshot) === 1 ? "" : "s"}. Open that file on the other phone and tap Import app data.`,
      );
    } catch {
      if (snapshot) downloadPhoneBackup(buildPhoneBackup(snapshot));
      setBackupNote("Exported a file. Keep it in Files or email it to yourself, then import it on the other phone.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function applyImportText(text: string) {
    const backup = parsePhoneBackupText(text);
    const next = adoptImportedSnapshot(backup.snapshot, {
      email: snapshot?.userEmail || backup.email,
      userId: snapshot?.userId,
      userName: snapshot?.userName,
    });
    await persistOwnerFarms(next);
    replaceSnapshot(next);
    setBackupNote(
      `Imported ${farmCountInSnapshot(next)} farm${farmCountInSnapshot(next) === 1 ? "" : "s"}. This phone now has that copy.`,
    );
  }

  async function onPickImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBackupNote(null);
    try {
      const text = await file.text();
      parsePhoneBackupText(text);
      setConfirmImport(text);
    } catch (error) {
      setBackupNote(error instanceof Error ? error.message : "Could not read that file.");
    }
  }

  async function onConfirmImport() {
    if (!confirmImport || backupBusy) return;
    setBackupBusy(true);
    try {
      await applyImportText(confirmImport);
      setConfirmImport(null);
    } catch (error) {
      setBackupNote(error instanceof Error ? error.message : "Could not import that file.");
    } finally {
      setBackupBusy(false);
    }
  }

  const actionLinkClass =
    "relative z-10 min-h-11 px-3 py-2 text-sm font-bold text-stone-800 underline disabled:opacity-60";

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

      <div className="relative z-10 mb-5 flex flex-col items-center gap-3 px-1">
        {shownSave.kind === "unsaved" ? (
          <p
            role="status"
            className="max-w-md rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-center text-sm font-semibold text-amber-950"
          >
            {shownSave.text}
          </p>
        ) : (
          <p
            role="status"
            className={
              shownSave.kind === "saved"
                ? "max-w-md text-center text-sm font-semibold text-emerald-800"
                : "max-w-md text-center text-sm font-medium text-stone-600"
            }
          >
            {shownSave.text}
          </p>
        )}
        <Button
          type="button"
          compact
          disabled={leaving || syncingNow || !ready}
          onClick={onSync}
        >
          {syncingNow ? "Syncing…" : "Sync data"}
        </Button>
      </div>

      <Card className="mb-5 max-w-2xl">
        <h2 className="font-bold leading-tight text-stone-900">Move data to another phone</h2>
        <p className="mt-1 text-sm text-stone-600">{MOVE_DATA_HELP}</p>
        {confirmImport ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Replace farms on this phone with this file?"
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3"
          >
            <p className="text-sm font-semibold text-amber-950">
              Import replaces every farm on this phone with the file. Continue?
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-6">
              <button
                type="button"
                disabled={backupBusy}
                onClick={() => setConfirmImport(null)}
                className={actionLinkClass}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={backupBusy}
                onClick={() => {
                  void onConfirmImport();
                }}
                className={actionLinkClass}
              >
                {backupBusy ? "Importing…" : IMPORT_APP_DATA}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              compact
              disabled={leaving || backupBusy || !snapshot}
              onClick={() => {
                void onExportAll();
              }}
            >
              {backupBusy ? "Exporting…" : EXPORT_ALL_APP_DATA}
            </Button>
            <Button
              type="button"
              variant="secondary"
              compact
              disabled={leaving || backupBusy}
              onClick={() => fileRef.current?.click()}
            >
              {IMPORT_APP_DATA}
            </Button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            void onPickImport(event);
          }}
        />
        {backupNote ? (
          <p className="mt-3 text-sm font-medium text-stone-700">{backupNote}</p>
        ) : null}
      </Card>

      <Card className="max-w-2xl overflow-visible">
        <form
          key={snapshot?.userId ?? "empty"}
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
                    defaultValue={looksLikeEmail(values.name) ? "" : values.name}
                    required={false}
                    autoComplete="off"
                    autoCapitalize="words"
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

      <div className="relative z-10 mt-6 flex flex-col items-center gap-3 px-1">
        {confirmLeave ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={SIGN_OUT_UNSAVED_CONFIRM}
            className="max-w-md rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center"
          >
            <p className="text-sm font-semibold text-amber-950">{SIGN_OUT_UNSAVED_BODY}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-6">
              <button
                type="button"
                disabled={leaving}
                onClick={() => setConfirmLeave(false)}
                className={actionLinkClass}
              >
                {SIGN_OUT_STAY}
              </button>
              <button
                type="button"
                disabled={leaving}
                onClick={() => {
                  void leaveApp(true);
                }}
                className={actionLinkClass}
              >
                {leaving ? "Signing out…" : SIGN_OUT_ANYWAY}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={leaving}
            onClick={() => {
              void leaveApp();
            }}
            className={actionLinkClass}
          >
            {leaving ? "Signing out…" : "Sign out"}
          </button>
        )}
      </div>
    </div>
  );
}
