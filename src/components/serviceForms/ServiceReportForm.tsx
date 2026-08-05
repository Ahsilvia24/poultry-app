"use client";

import { useState } from "react";
import { Button, Card, DateInput, Label, Select } from "@/components/ui";
import { createServiceReportDraft } from "@/lib/serviceForms/defaults";
import {
  HUMIDITY_OPTIONS,
  VENT_DOOR_OPTIONS,
  WEEK_OPTIONS,
} from "@/lib/serviceForms/format";
import {
  currentFlockWeek,
  house1TotalCfm,
  minVentForWeek,
  prefillHouseRows,
  type ServiceFarmDetail,
} from "@/lib/serviceForms/prefill";
import type { ServiceReportForm as ServiceReportFormData } from "@/lib/serviceForms/types";
import {
  CommentsField,
  CompactBackupSettings,
  CompactHouseValueGrid,
  MultiToggleField,
  PairFields,
  SectionTitle,
  TextField,
  YesNoField,
} from "./fields";
import { useCompleteServiceForm } from "./useCompleteServiceForm";

export function ServiceReportForm({
  farmId,
  detail,
  initialPayload,
  serviceFormId,
  existingVisitId,
}: {
  farmId: string;
  detail: ServiceFarmDetail;
  initialPayload?: ServiceReportFormData | null;
  serviceFormId?: string | null;
  existingVisitId?: string | null;
}) {
  const { complete, saving, editing, error } = useCompleteServiceForm(
    farmId,
    "service_report",
    {
      serviceFormId,
      existingVisitId,
    },
  );

  const [form, setForm] = useState<ServiceReportFormData>(() => {
    if (initialPayload) return initialPayload;
    const week = currentFlockWeek(detail);
    const minVent = minVentForWeek(detail, week);
    const draft = createServiceReportDraft({
      farmName: detail.farm.farmName,
      farmNumber: detail.farm.farmNumber ?? "",
      flockNumber: detail.activeFlock?.flockNumber ?? "",
      houses: prefillHouseRows(detail),
    });
    return {
      ...draft,
      maxCfm: house1TotalCfm(detail),
      minVentRecommendedWeek: week,
      minVentRecommendedOn: minVent?.on ?? "",
      minVentRecommendedOff: minVent?.off ?? "",
    };
  });

  function patch(p: Partial<ServiceReportFormData>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  const lights247 = form.lightsOnAt === "24/7";

  function patchHouse(
    houseNumber: number,
    p: Partial<ServiceReportFormData["houses"][number]>,
  ) {
    setForm((prev) => ({
      ...prev,
      houses: prev.houses.map((h) =>
        h.houseNumber === houseNumber ? { ...h, ...p } : h,
      ),
    }));
  }

  function applyRecommendedWeek(week: number) {
    const minVent = minVentForWeek(detail, week);
    patch({
      minVentRecommendedWeek: week,
      minVentRecommendedOn: minVent?.on ?? "",
      minVentRecommendedOff: minVent?.off ?? "",
    });
  }

  return (
    <div className="space-y-3 pb-24">
      <Card>
        <TextField
          label="Farm name"
          value={form.farmName}
          onChange={(farmName) => patch({ farmName })}
        />
        <PairFields
          left={
            <TextField
              label="Farm #"
              value={form.farmNumber ?? ""}
              onChange={(farmNumber) => patch({ farmNumber })}
            />
          }
          right={
            <TextField
              label="Flock #"
              value={form.flockNumber ?? ""}
              onChange={(flockNumber) => patch({ flockNumber })}
            />
          }
        />
        <div className="mb-2.5">
          <Label htmlFor="service-report-date">Date</Label>
          <DateInput
            id="service-report-date"
            value={form.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
        </div>
        <TextField
          label="Service tech"
          value={form.serviceTech}
          onChange={(serviceTech) => patch({ serviceTech })}
        />
      </Card>

      <SectionTitle title="House temps" />
      <Card>
        <p className="mb-2.5 text-sm leading-snug text-stone-500">
          Prefills from today&apos;s Log Temp on each house tile (resets at midnight).
          Age, placed, and weekly mortality still pull into the PDF automatically.
        </p>
        <CompactHouseValueGrid
          houses={form.houses}
          getValue={(n) =>
            form.houses.find((h) => h.houseNumber === n)?.currentTemp ?? ""
          }
          onChange={(houseNumber, currentTemp) =>
            patchHouse(houseNumber, { currentTemp })
          }
          placeholder="°F"
        />
      </Card>

      <Card>
        <SectionTitle title="Feed" />
        <YesNoField
          label="Feeder height adjusted properly"
          value={form.feederHeightOk}
          onChange={(feederHeightOk) => patch({ feederHeightOk })}
        />
        <YesNoField
          label="Feeding equipment fully operational"
          value={form.feedingEquipmentOk}
          onChange={(feedingEquipmentOk) => patch({ feedingEquipmentOk })}
        />
        <YesNoField
          label="Feed availability sufficient for age"
          value={form.feedAvailabilityOk}
          onChange={(feedAvailabilityOk) => patch({ feedAvailabilityOk })}
        />

        <SectionTitle title="Light" />
        <YesNoField
          label="Light intensity per program"
          value={form.lightIntensityOk}
          onChange={(lightIntensityOk) => patch({ lightIntensityOk })}
        />
        <YesNoField
          label="All lights operational"
          value={form.lightsOperationalOk}
          onChange={(lightsOperationalOk) => patch({ lightsOperationalOk })}
        />
        <YesNoField
          label="Lights on 24/7"
          value={lights247 ? "yes" : "no"}
          onChange={(v) => {
            if (v === "yes") {
              patch({ lightsOnAt: "24/7", lightsOffAt: "" });
              return;
            }
            patch({
              lightsOnAt: form.lightsOnAt === "24/7" ? "" : form.lightsOnAt,
            });
          }}
        />
        {lights247 ? (
          <div className="flex items-center justify-between gap-3 border-b border-stone-200 py-2.5">
            <span className="flex-1 text-sm font-semibold text-stone-800">
              Lights ON at
            </span>
            <span className="text-base font-extrabold text-stone-900">24/7</span>
          </div>
        ) : (
          <div className="mb-1 flex flex-wrap gap-3">
            <TextField
              label="Lights ON at"
              value={form.lightsOnAt}
              onChange={(lightsOnAt) => patch({ lightsOnAt })}
              type="time"
              className="mb-2.5 w-[9.25rem]"
            />
            <TextField
              label="Lights OFF at"
              value={form.lightsOffAt}
              onChange={(lightsOffAt) => patch({ lightsOffAt })}
              type="time"
              className="mb-2.5 w-[9.25rem]"
            />
          </div>
        )}

        <SectionTitle title="Air and litter" />
        <YesNoField
          label="Temp targets per recommended program"
          value={form.tempTargetsOk}
          onChange={(tempTargetsOk) => patch({ tempTargetsOk })}
        />
        {form.tempTargetsOk === "no" ? (
          <PairFields
            left={
              <TextField
                label="Actual target"
                value={form.actualTempTarget}
                onChange={(actualTempTarget) => patch({ actualTempTarget })}
              />
            }
            right={
              <TextField
                label="Recommended target"
                value={form.recommendedTempTarget}
                onChange={(recommendedTempTarget) =>
                  patch({ recommendedTempTarget })
                }
              />
            }
          />
        ) : null}
        <YesNoField
          label="Ammonia < 25 PPM in all houses"
          value={form.ammoniaOk}
          onChange={(ammoniaOk) => patch({ ammoniaOk })}
        />
        <div className="mb-2.5">
          <Label htmlFor="humidityPct">Humidity %</Label>
          <Select
            id="humidityPct"
            value={form.humidityPct}
            onChange={(e) => patch({ humidityPct: e.target.value })}
          >
            {HUMIDITY_OPTIONS.map((o) => (
              <option key={o.value || "blank"} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
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
              tunnelFanCount: ventModes.includes("tunnel")
                ? form.tunnelFanCount
                : "",
            })
          }
        />
        {form.ventModes.includes("tunnel") ? (
          <TextField
            label="# of tunnel fans"
            value={form.tunnelFanCount}
            onChange={(tunnelFanCount) => patch({ tunnelFanCount })}
          />
        ) : null}
        <div className="mb-2.5">
          <Label htmlFor="ventDoorType">Vent door type</Label>
          <Select
            id="ventDoorType"
            value={form.ventDoorType}
            onChange={(e) =>
              patch({
                ventDoorType: e.target.value as ServiceReportFormData["ventDoorType"],
              })
            }
          >
            <option value="">Select</option>
            {VENT_DOOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <PairFields
          left={
            <TextField
              label="S.P."
              value={form.staticPressure}
              onChange={(staticPressure) => patch({ staticPressure })}
              placeholder="0.1"
            />
          }
          right={
            <TextField
              label="Vent opening (in)"
              value={form.ventOpeningInches}
              onChange={(ventOpeningInches) => patch({ ventOpeningInches })}
            />
          }
        />
        <TextField
          label="C.F.M. / Ft² min vent"
          value={form.cfmPerFt2MinVent}
          onChange={(cfmPerFt2MinVent) => patch({ cfmPerFt2MinVent })}
        />
        <TextField
          label="Size and number of fans used"
          value={form.fansSizeAndCount}
          onChange={(fansSizeAndCount) => patch({ fansSizeAndCount })}
        />
        <PairFields
          left={
            <TextField
              label="Min vent actual ON"
              value={form.minVentActualOn}
              onChange={(minVentActualOn) => patch({ minVentActualOn })}
              placeholder="30"
            />
          }
          right={
            <TextField
              label="Min vent actual OFF"
              value={form.minVentActualOff}
              onChange={(minVentActualOff) => patch({ minVentActualOff })}
              placeholder="270"
            />
          }
        />
        <div className="mb-2.5">
          <Label htmlFor="minVentWeek">Recommended min vent week</Label>
          <Select
            id="minVentWeek"
            value={String(form.minVentRecommendedWeek)}
            onChange={(e) => applyRecommendedWeek(Number(e.target.value))}
          >
            {WEEK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <p className="mb-2 text-sm text-stone-500">
          Recommended:{" "}
          {form.minVentRecommendedOn || form.minVentRecommendedOff
            ? `${form.minVentRecommendedOn} on / ${form.minVentRecommendedOff} off`
            : "—"}
        </p>
        <TextField
          label="Max CFM (House 1 Total CFM)"
          value={form.maxCfm}
          onChange={(maxCfm) => patch({ maxCfm })}
        />
        <PairFields
          left={
            <TextField
              label="Cool cell OFF temp"
              value={form.coolCellOffTemp}
              onChange={(coolCellOffTemp) => patch({ coolCellOffTemp })}
            />
          }
          right={
            <TextField
              label="Cool cell ON temp"
              value={form.coolCellOnTemp}
              onChange={(coolCellOnTemp) => patch({ coolCellOnTemp })}
            />
          }
        />
        <PairFields
          left={
            <TextField
              label="Cool cell timer ON"
              value={form.coolCellTimerOn}
              onChange={(coolCellTimerOn) => patch({ coolCellTimerOn })}
              placeholder="15"
            />
          }
          right={
            <TextField
              label="Cool cell timer OFF"
              value={form.coolCellTimerOff}
              onChange={(coolCellTimerOff) => patch({ coolCellTimerOff })}
              placeholder="250"
            />
          }
        />

        <SectionTitle title="Water" />
        <YesNoField
          label="Lines adjusted for age"
          value={form.waterLinesOk}
          onChange={(waterLinesOk) => patch({ waterLinesOk })}
        />
        <YesNoField
          label="Sight tubes clean"
          value={form.sightTubesOk}
          onChange={(sightTubesOk) => patch({ sightTubesOk })}
        />
        <YesNoField
          label="Anything currently added to water"
          value={form.waterAdditive}
          onChange={(waterAdditive) => patch({ waterAdditive })}
        />
        <TextField
          label="Inches of water column"
          value={form.waterColumnInches}
          onChange={(waterColumnInches) => patch({ waterColumnInches })}
          placeholder="4-6"
        />
        <PairFields
          left={
            <TextField
              label="PSI before brass"
              value={form.psiBefore}
              onChange={(psiBefore) => patch({ psiBefore })}
            />
          }
          right={
            <TextField
              label="PSI after brass"
              value={form.psiAfter}
              onChange={(psiAfter) => patch({ psiAfter })}
            />
          }
        />
        <TextField
          label="P.H."
          value={form.ph}
          onChange={(ph) => patch({ ph })}
        />

        <SectionTitle title="Space" />
        <YesNoField
          label="Birds partitioned properly"
          value={form.partitionedOk}
          onChange={(partitionedOk) => patch({ partitionedOk })}
        />
        <YesNoField
          label="Comfortable and evenly spread"
          value={form.comfortableSpreadOk}
          onChange={(comfortableSpreadOk) => patch({ comfortableSpreadOk })}
        />

        <SectionTitle title="Sanitation" />
        <YesNoField
          label="Premise is clean"
          value={form.premiseCleanOk}
          onChange={(premiseCleanOk) => patch({ premiseCleanOk })}
        />
        <YesNoField
          label="Rodenticide is placed"
          value={form.rodenticideOk}
          onChange={(rodenticideOk) => patch({ rodenticideOk })}
        />
        <YesNoField
          label="Foot baths are utilized"
          value={form.footBathsOk}
          onChange={(footBathsOk) => patch({ footBathsOk })}
        />

        <SectionTitle title="Emergency" />
        <YesNoField
          label="Generator is in Auto"
          value={form.generatorAutoOk}
          onChange={(generatorAutoOk) => patch({ generatorAutoOk })}
        />
        <YesNoField
          label="Dialer alarm is on (not bypassed)"
          value={form.dialerOnOk}
          onChange={(dialerOnOk) => patch({ dialerOnOk })}
        />
        <PairFields
          left={
            <TextField
              label="Alarm HI"
              value={form.alarmHi}
              onChange={(alarmHi) => patch({ alarmHi })}
            />
          }
          right={
            <TextField
              label="Alarm LOW"
              value={form.alarmLow}
              onChange={(alarmLow) => patch({ alarmLow })}
            />
          }
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

      <CommentsField
        value={form.comments}
        onChange={(comments) => patch({ comments })}
      />

      {error ? (
        <p className="text-sm font-semibold text-red-700">{error}</p>
      ) : null}

      <Button
        type="button"
        disabled={saving}
        className="w-full"
        onClick={() => void complete({ form })}
      >
        {saving
          ? "Saving…"
          : editing
            ? "Save changes · Download PDF"
            : "Complete · Log visit · Download PDF"}
      </Button>
    </div>
  );
}
