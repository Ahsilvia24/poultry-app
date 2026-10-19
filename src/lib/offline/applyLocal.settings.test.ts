import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySettings,
  settingsWriteFromForm,
  type SettingsWrite,
} from "./applyLocal.ts";
import type { OfflineSnapshot } from "./types.ts";

const baseWrite: SettingsWrite = {
  name: "Alex",
  farmOrder: "age_desc",
  dailyMortalityWarningPct: 0.15,
  dailyMortalityCriticalPct: 0.3,
  sevenDayMortalityWarningPct: 1,
  sevenDayMortalityCriticalPct: 2,
  alertRisingThreeDays: true,
  appTimeZone: "America/Chicago",
  defaultMarketAgeDays: 52,
  notifyEmail: false,
  notifyInApp: true,
};

const snapshot = {
  settings: null,
  userName: "Alex",
  userEmail: "alex@example.com",
} as OfflineSnapshot;

describe("settings WP defaults", () => {
  it("defaults consumption rate to 0.45 and EFC to 1.75", () => {
    const next = applySettings(snapshot, baseWrite);
    assert.equal(next.settings.defaultConsumptionRate, 0.45);
    assert.equal(next.settings.defaultEfc, 1.75);

    const form = new FormData();
    form.set("name", "Alex");
    form.set("farmOrder", "age_desc");
    form.set("dailyMortalityWarningPct", "0.15");
    form.set("dailyMortalityCriticalPct", "0.3");
    form.set("sevenDayMortalityWarningPct", "1");
    form.set("sevenDayMortalityCriticalPct", "2");
    form.set("alertRisingThreeDays", "on");
    form.set("appTimeZone", "America/Chicago");
    form.set("defaultMarketAgeDays", "52");
    form.set("notifyInApp", "on");
    const fromForm = settingsWriteFromForm(form);
    assert.equal(fromForm.defaultConsumptionRate, 0.45);
    assert.equal(fromForm.defaultEfc, 1.75);
  });

  it("saves custom CR and EFC", () => {
    const next = applySettings(snapshot, {
      ...baseWrite,
      defaultConsumptionRate: 0.5,
      defaultEfc: 1.7,
    });
    assert.equal(next.settings.defaultConsumptionRate, 0.5);
    assert.equal(next.settings.defaultEfc, 1.7);
  });

  it("keeps an explicit temp curve and falls back to the calendar season", () => {
    const winter = applySettings(snapshot, { ...baseWrite, tempCurveSeason: "winter" });
    assert.equal(winter.settings.tempCurveSeason, "winter");

    const kept = applySettings(winter, baseWrite);
    assert.equal(kept.settings.tempCurveSeason, "winter");

    const form = new FormData();
    form.set("name", "Alex");
    form.set("tempCurveSeason", "summer");
    const fromForm = settingsWriteFromForm(form);
    assert.equal(fromForm.tempCurveSeason, "summer");
  });
});
