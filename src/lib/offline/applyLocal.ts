import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { parseFarmOrder } from "@/lib/farm-order";
import type { OfflineSettings, OfflineSnapshot } from "@/lib/offline/types";

export type HouseTempWrite = {
  farmId: string;
  houseId: string;
  temp: string | null;
  dateKey: string;
};

export type SettingsWrite = {
  name: string;
  farmOrder: string;
  dailyMortalityWarningPct: number;
  dailyMortalityCriticalPct: number;
  sevenDayMortalityWarningPct: number;
  sevenDayMortalityCriticalPct: number;
  alertRisingThreeDays: boolean;
  appTimeZone: string;
  defaultMarketAgeDays: number;
  notifyEmail: boolean;
  notifyInApp: boolean;
};

const DEFAULT_SETTINGS: OfflineSettings = {
  farmOrder: "age_desc",
  appTimeZone: "America/Chicago",
  dailyMortalityWarningPct: 0.15,
  dailyMortalityCriticalPct: 0.3,
  sevenDayMortalityWarningPct: 1,
  sevenDayMortalityCriticalPct: 2,
  alertRisingThreeDays: true,
  defaultMarketAgeDays: 52,
  notifyEmail: false,
  notifyInApp: true,
};

export function applyHouseTemp(snapshot: OfflineSnapshot, write: HouseTempWrite): OfflineSnapshot {
  const trimmed = write.temp?.trim() || null;
  return {
    ...snapshot,
    houses: (snapshot.houses ?? []).map((house) =>
      house.id === write.houseId && house.farmId === write.farmId
        ? {
            ...house,
            loggedTemp: trimmed,
            loggedTempAt: trimmed ? write.dateKey : null,
          }
        : house,
    ),
  };
}

export function applySettings(snapshot: OfflineSnapshot, write: SettingsWrite): OfflineSnapshot {
  const next: OfflineSettings = {
    ...(snapshot.settings ?? DEFAULT_SETTINGS),
    farmOrder: parseFarmOrder(write.farmOrder),
    appTimeZone: resolveAppTimeZone(write.appTimeZone),
    dailyMortalityWarningPct: write.dailyMortalityWarningPct,
    dailyMortalityCriticalPct: write.dailyMortalityCriticalPct,
    sevenDayMortalityWarningPct: write.sevenDayMortalityWarningPct,
    sevenDayMortalityCriticalPct: write.sevenDayMortalityCriticalPct,
    alertRisingThreeDays: write.alertRisingThreeDays,
    defaultMarketAgeDays: write.defaultMarketAgeDays,
    notifyEmail: write.notifyEmail,
    notifyInApp: write.notifyInApp,
  };
  return {
    ...snapshot,
    userName: write.name.trim() || snapshot.userName,
    settings: next,
  };
}

export function settingsWriteFromForm(formData: FormData): SettingsWrite {
  return {
    name: String(formData.get("name") ?? "").trim(),
    farmOrder: String(formData.get("farmOrder") ?? "age_desc"),
    dailyMortalityWarningPct: Number(formData.get("dailyMortalityWarningPct")),
    dailyMortalityCriticalPct: Number(formData.get("dailyMortalityCriticalPct")),
    sevenDayMortalityWarningPct: Number(formData.get("sevenDayMortalityWarningPct")),
    sevenDayMortalityCriticalPct: Number(formData.get("sevenDayMortalityCriticalPct")),
    alertRisingThreeDays: formData.get("alertRisingThreeDays") === "on",
    appTimeZone: String(formData.get("appTimeZone") ?? ""),
    defaultMarketAgeDays: Number(formData.get("defaultMarketAgeDays")),
    notifyEmail: formData.get("notifyEmail") === "on",
    notifyInApp: formData.get("notifyInApp") === "on",
  };
}

export function formDataFromSettingsWrite(write: SettingsWrite): FormData {
  const formData = new FormData();
  formData.set("name", write.name);
  formData.set("farmOrder", write.farmOrder);
  formData.set("dailyMortalityWarningPct", String(write.dailyMortalityWarningPct));
  formData.set("dailyMortalityCriticalPct", String(write.dailyMortalityCriticalPct));
  formData.set("sevenDayMortalityWarningPct", String(write.sevenDayMortalityWarningPct));
  formData.set("sevenDayMortalityCriticalPct", String(write.sevenDayMortalityCriticalPct));
  if (write.alertRisingThreeDays) formData.set("alertRisingThreeDays", "on");
  formData.set("appTimeZone", write.appTimeZone);
  formData.set("defaultMarketAgeDays", String(write.defaultMarketAgeDays));
  if (write.notifyEmail) formData.set("notifyEmail", "on");
  if (write.notifyInApp) formData.set("notifyInApp", "on");
  return formData;
}

export function settingsFormValues(snapshot: OfflineSnapshot) {
  const settings = snapshot.settings ?? DEFAULT_SETTINGS;
  return {
    name: snapshot.userName,
    email: snapshot.userEmail,
    ...settings,
    farmOrder: parseFarmOrder(settings.farmOrder),
    appTimeZone: resolveAppTimeZone(settings.appTimeZone),
  };
}
