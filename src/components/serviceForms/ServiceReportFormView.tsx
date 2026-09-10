"use client";

import { useEffect, useRef, useState } from "react";
import { BackHeader, Button, Card } from "@/components/ui";
import {
  CheckField,
  CommentsField,
  CompactBackupSettings,
  DateField,
  MultiToggleField,
  PairFields,
  SectionTitle,
  SelectField,
  TextField,
  TimeField,
  YesNoField,
} from "@/components/serviceForms/fields";
import {
  useAutosaveServiceFormDraft,
  useCompleteServiceForm,
} from "@/components/serviceForms/useServiceFormSave";
import { createServiceReportDraft, withSavedServiceTech } from "@/lib/serviceForms/defaults";
import {
  CFM_FT2_MIN_VENT_LABEL,
  HUMIDITY_OPTIONS,
  MAX_CFM_FT2_POWER_LABEL,
  VENT_DOOR_OPTIONS,
  WEEK_OPTIONS,
  recommendedWeekLabel,
  ventDoorTypesFromPayload,
} from "@/lib/serviceForms/format";
import type { ServiceFarmContext } from "@/lib/serviceForms/farmContext";
import {
  applyLiveHouseMetrics,
  currentFlockWeek,
  flockAgeDaysFromHouses,
  house1CfmPerFt2,
  minVentForWeek,
  prefillHouseRows,
} from "@/lib/serviceForms/prefill";
import type { StoredServiceForm } from "@/lib/serviceForms/stored";
import type { ServiceReportForm } from "@/lib/serviceForms/types";
import { recommendedHouseTempF } from "@/lib/tools/temp-curve";

function hydrateReport(payload: ServiceReportForm): ServiceReportForm {
  return { ...payload, ventDoorTypes: ventDoorTypesFromPayload(payload) };
}

export function ServiceReportFormView({
  farmId,
  context,
  existing,
  draft,
  fresh,
}: {
  farmId: string;
  context: ServiceFarmContext;
  existing: StoredServiceForm | null;
  draft: ServiceReportForm | null;
  fresh: boolean;
}) {
  const { complete, saving, editing, error } = useCompleteServiceForm(farmId, {
    serviceFormId: existing?.id ?? null,
    existingVisitId: existing ? null : null,
  });
  const detail = context.detail;

  const [form, setForm] = useState<ServiceReportForm>(() => {
    if (existing?.payload && typeof existing.payload === "object") {
      return withSavedServiceTech(hydrateReport(existing.payload as ServiceReportForm), context.serviceTech);
    }
    if (!fresh && draft?.kind === "service_report") {
      const hydrated = withSavedServiceTech(hydrateReport(draft), context.serviceTech);
      if (!hydrated.farmNumber?.trim() && context.farmNumber) hydrated.farmNumber = context.farmNumber;
      return applyLiveHouseMetrics(hydrated, detail);
    }
    const initial = createServiceReportDraft({
      farmName: context.farmName,
      farmNumber: context.farmNumber,
      flockNumber: context.flockNumber,
      serviceTech: context.serviceTech,
      houses: prefillHouseRows(detail),
    });
    const week = currentFlockWeek(detail);
    const minVent = minVentForWeek(detail, week);
    return {
      ...initial,
      minVentRecommendedWeek: week,
      minVentRecommendedOn: minVent?.on ?? "",
      minVentRecommendedOff: minVent?.off ?? "",
    };
  });

  const cfmPrefillDone = useRef(false);
  useEffect(() => {
    if (cfmPrefillDone.current) return;
    cfmPrefillDone.current = true;
    const { minVent, maxPower } = house1CfmPerFt2(detail);
    setForm((prev) => ({
      ...prev,
      cfmPerFt2MinVent: prev.cfmPerFt2MinVent.trim() ? prev.cfmPerFt2MinVent : minVent,
      maxCfm: prev.maxCfm.trim() ? prev.maxCfm : maxPower,
    }));
  }, [detail]);

  useAutosaveServiceFormDraft(farmId, "service_report", form, !existing && !saving);

  function patch(p: Partial<ServiceReportForm>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  useEffect(() => {
    const age = flockAgeDaysFromHouses(form.houses);
    const next = age == null ? "" : String(recommendedHouseTempF(age));
    if (next === form.recommendedTempTarget) return;
    setForm((prev) => ({ ...prev, recommendedTempTarget: next }));
  }, [form.houses, form.recommendedTempTarget]);

  function applyRecommendedWeek(week: number | "") {
    if (week === "" || week < 1) {
      patch({ minVentRecommendedWeek: "", minVentRecommendedOn: "", minVentRecommendedOff: "" });
      return;
    }
    const minVent = minVentForWeek(detail, week);
    patch({
      minVentRecommendedWeek: week,
      minVentRecommendedOn: minVent?.on ?? "",
      minVentRecommendedOff: minVent?.off ?? "",
    });
  }

  return (
    <div className="pb-20">
      <BackHeader
        href={`/farms/${farmId}/service`}
        backLabel="Checklists"
        title={editing ? "Edit Service Report" : "Service Report"}
      />

      <Card>
        <TextField label="Farm name" value={form.farmName} onChange={(farmName) => patch({ farmName })} />
        <PairFields
          left={<TextField label="Farm #" value={form.farmNumber ?? ""} onChange={(farmNumber) => patch({ farmNumber })} />}
          right={<TextField label="Flock #" value={form.flockNumber ?? ""} onChange={(flockNumber) => patch({ flockNumber })} />}
        />
        <DateField id="service-date" label="Date" value={form.date} onChange={(date) => patch({ date })} />
        <TextField label="Service tech" value={form.serviceTech} onChange={(serviceTech) => patch({ serviceTech })} />
      </Card>

      <Card className="mt-3">
        <SectionTitle title="Feed" />
        <YesNoField label="Feeder height adjusted properly" value={form.feederHeightOk} onChange={(feederHeightOk) => patch({ feederHeightOk })} />
        <YesNoField label="Feeding equipment fully operational" value={form.feedingEquipmentOk} onChange={(feedingEquipmentOk) => patch({ feedingEquipmentOk })} />
        <YesNoField label="Feed availability sufficient for age" value={form.feedAvailabilityOk} onChange={(feedAvailabilityOk) => patch({ feedAvailabilityOk })} />

        <SectionTitle title="Light" />
        <YesNoField label="Light intensity per program" value={form.lightIntensityOk} onChange={(lightIntensityOk) => patch({ lightIntensityOk })} />
        <YesNoField label="All lights operational" value={form.lightsOperationalOk} onChange={(lightsOperationalOk) => patch({ lightsOperationalOk })} />
        <CheckField
          label="Lights on 24/7"
          checked={form.lightsOnAt === "24/7"}
          onChange={(on) =>
            patch(
              on
                ? { lightsOnAt: "24/7", lightsOffAt: "24/7" }
                : {
                    lightsOnAt: form.lightsOnAt === "24/7" ? "" : form.lightsOnAt,
                    lightsOffAt: form.lightsOffAt === "24/7" ? "" : form.lightsOffAt,
                  },
            )
          }
        />
        <TimeField label="Lights ON at" value={form.lightsOnAt} onChange={(lightsOnAt) => patch({ lightsOnAt })} />
        <TimeField label="Lights OFF at" value={form.lightsOffAt} onChange={(lightsOffAt) => patch({ lightsOffAt })} />

        <SectionTitle title="Air and Litter" />
        <YesNoField label="Temp targets per recommended program" value={form.tempTargetsOk} onChange={(tempTargetsOk) => patch({ tempTargetsOk })} />
        <PairFields
          left={<TextField label="Set Temp" value={form.actualTempTarget} onChange={(actualTempTarget) => patch({ actualTempTarget })} inputMode="decimal" placeholder="°F" />}
          right={<TextField label="Recommended" value={form.recommendedTempTarget} onChange={() => {}} readOnly placeholder="°F" />}
        />
        <YesNoField label="Ammonia < 25 PPM in all houses" value={form.ammoniaOk} onChange={(ammoniaOk) => patch({ ammoniaOk })} />
        <SelectField
          label="Humidity %"
          value={form.humidityPct}
          options={HUMIDITY_OPTIONS}
          onChange={(humidityPct) => patch({ humidityPct })}
        />
        <MultiToggleField
          label="Current ventilation"
          options={[
            { value: "min", label: "Min" },
            { value: "power", label: "Power" },
            { value: "tunnel", label: "Tunnel" },
          ]}
          value={form.ventModes}
          onChange={(ventModes) =>
            patch({
              ventModes,
              tunnelFanCount: ventModes.includes("tunnel") ? form.tunnelFanCount : "",
            })
          }
        />
        {form.ventModes.includes("tunnel") ? (
          <TextField label="# of tunnel fans" value={form.tunnelFanCount} onChange={(tunnelFanCount) => patch({ tunnelFanCount })} inputMode="numeric" />
        ) : null}
        <MultiToggleField
          label="Vent door type"
          options={VENT_DOOR_OPTIONS}
          value={form.ventDoorTypes}
          onChange={(ventDoorTypes) => patch({ ventDoorTypes })}
        />
        <PairFields
          left={<TextField label="S.P." value={form.staticPressure} onChange={(staticPressure) => patch({ staticPressure })} inputMode="decimal" placeholder="0.1" />}
          right={<TextField label="Vent opening (in)" value={form.ventOpeningInches} onChange={(ventOpeningInches) => patch({ ventOpeningInches })} inputMode="decimal" />}
        />
        <TextField label={CFM_FT2_MIN_VENT_LABEL} value={form.cfmPerFt2MinVent} onChange={(cfmPerFt2MinVent) => patch({ cfmPerFt2MinVent })} inputMode="decimal" />
        <TextField label="Size and number of fans used" value={form.fansSizeAndCount} onChange={(fansSizeAndCount) => patch({ fansSizeAndCount })} />
        <PairFields
          left={<TextField label="Min vent actual ON" value={form.minVentActualOn} onChange={(minVentActualOn) => patch({ minVentActualOn })} inputMode="numeric" placeholder="30" />}
          right={<TextField label="Min vent actual OFF" value={form.minVentActualOff} onChange={(minVentActualOff) => patch({ minVentActualOff })} inputMode="numeric" placeholder="270" />}
        />
        <SelectField
          label="Recommended min vent week"
          value={form.minVentRecommendedWeek === "" ? "" : String(form.minVentRecommendedWeek)}
          options={WEEK_OPTIONS}
          onChange={(v) => applyRecommendedWeek(v === "" ? "" : Number(v))}
        />
        <p className="mb-2 text-sm text-stone-500">
          Recommended:{" "}
          {form.minVentRecommendedOn || form.minVentRecommendedOff
            ? `${form.minVentRecommendedOn} on / ${form.minVentRecommendedOff} off`
            : recommendedWeekLabel(form.minVentRecommendedWeek) === "Blank"
              ? "—"
              : "—"}
        </p>
        <TextField label={MAX_CFM_FT2_POWER_LABEL} value={form.maxCfm} onChange={(maxCfm) => patch({ maxCfm })} inputMode="decimal" />
        <PairFields
          left={<TextField label="Cool cell OFF temp" value={form.coolCellOffTemp} onChange={(coolCellOffTemp) => patch({ coolCellOffTemp })} inputMode="decimal" />}
          right={<TextField label="Cool cell ON temp" value={form.coolCellOnTemp} onChange={(coolCellOnTemp) => patch({ coolCellOnTemp })} inputMode="decimal" />}
        />
        <PairFields
          left={<TextField label="Cool cell timer ON" value={form.coolCellTimerOn} onChange={(coolCellTimerOn) => patch({ coolCellTimerOn })} inputMode="numeric" placeholder="15" />}
          right={<TextField label="Cool cell timer OFF" value={form.coolCellTimerOff} onChange={(coolCellTimerOff) => patch({ coolCellTimerOff })} inputMode="numeric" placeholder="250" />}
        />

        <SectionTitle title="Water" />
        <YesNoField label="Lines adjusted for age" value={form.waterLinesOk} onChange={(waterLinesOk) => patch({ waterLinesOk })} />
        <YesNoField label="Sight tubes clean" value={form.sightTubesOk} onChange={(sightTubesOk) => patch({ sightTubesOk })} />
        <YesNoField label="Anything currently added to water" value={form.waterAdditive} onChange={(waterAdditive) => patch({ waterAdditive })} />
        <TextField label="Inches of water column" value={form.waterColumnInches} onChange={(waterColumnInches) => patch({ waterColumnInches })} placeholder="4-6" />
        <PairFields
          left={<TextField label="PSI before brass" value={form.psiBefore} onChange={(psiBefore) => patch({ psiBefore })} inputMode="decimal" />}
          right={<TextField label="PSI after brass" value={form.psiAfter} onChange={(psiAfter) => patch({ psiAfter })} inputMode="decimal" />}
        />
        <TextField label="P.H." value={form.ph} onChange={(ph) => patch({ ph })} inputMode="decimal" />

        <SectionTitle title="Space" />
        <YesNoField label="Birds partitioned properly" value={form.partitionedOk} onChange={(partitionedOk) => patch({ partitionedOk })} />
        <YesNoField label="Comfortable and evenly spread" value={form.comfortableSpreadOk} onChange={(comfortableSpreadOk) => patch({ comfortableSpreadOk })} />

        <SectionTitle title="Sanitation" />
        <YesNoField label="Premise is clean" value={form.premiseCleanOk} onChange={(premiseCleanOk) => patch({ premiseCleanOk })} />
        <YesNoField label="Rodenticide is placed" value={form.rodenticideOk} onChange={(rodenticideOk) => patch({ rodenticideOk })} />
        <YesNoField label="Foot baths are utilized" value={form.footBathsOk} onChange={(footBathsOk) => patch({ footBathsOk })} />

        <SectionTitle title="Emergency" />
        <YesNoField label="Generator is in Auto" value={form.generatorAutoOk} onChange={(generatorAutoOk) => patch({ generatorAutoOk })} />
        <YesNoField label="Dialer alarm is on (not bypassed)" value={form.dialerOnOk} onChange={(dialerOnOk) => patch({ dialerOnOk })} />
        <PairFields
          left={<TextField label="Alarm HI" value={form.alarmHi} onChange={(alarmHi) => patch({ alarmHi })} inputMode="decimal" />}
          right={<TextField label="Alarm LOW" value={form.alarmLow} onChange={(alarmLow) => patch({ alarmLow })} inputMode="decimal" />}
        />
        <CompactBackupSettings
          heat={form.backupHeat}
          cool={form.backupCool}
          stage1={form.backupStage1}
          stage2={form.backupStage2}
          stage3={form.backupStage3}
          onChange={patch}
        />
      </Card>

      <div className="mt-3">
        <CommentsField value={form.comments} onChange={(comments) => patch({ comments })} />
      </div>

      {error ? <p className="mt-3 font-bold text-red-700">{error}</p> : null}
      <Button className="mt-4 w-full" disabled={saving} onClick={() => void complete(form)}>
        {saving ? "Saving…" : editing ? "Save changes · Share PDF" : "Complete · Log visit · Share PDF"}
      </Button>
    </div>
  );
}
