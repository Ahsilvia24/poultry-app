"use client";

import { useState } from "react";
import { Button, Card, DateInput, Label, Select } from "@/components/ui";
import { createPlacementDraft } from "@/lib/serviceForms/defaults";
import { normalizeVentDoorTypes, WEEK_OPTIONS } from "@/lib/serviceForms/format";
import {
  minVentForWeek,
  prefillHouseRows,
  type ServiceFarmDetail,
} from "@/lib/serviceForms/prefill";
import type { PlacementForm as PlacementFormData } from "@/lib/serviceForms/types";
import {
  ChoiceToggle,
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

export function PlacementForm({
  farmId,
  detail,
  initialPayload,
  serviceFormId,
  existingVisitId,
}: {
  farmId: string;
  detail: ServiceFarmDetail;
  initialPayload?: PlacementFormData | null;
  serviceFormId?: string | null;
  existingVisitId?: string | null;
}) {
  const { complete, saving, editing, error } = useCompleteServiceForm(
    farmId,
    "placement",
    {
      serviceFormId,
      existingVisitId,
    },
  );

  const firstFlockNumber =
    detail.activeFlocks?.[0]?.flockNumber ??
    detail.activeFlock?.flockNumber?.split(/\s*·\s*/)[0]?.trim() ??
    "";

  const [form, setForm] = useState<PlacementFormData>(() => {
    if (initialPayload) {
      return {
        ...initialPayload,
        ventDoorTypes: normalizeVentDoorTypes(initialPayload),
      };
    }
    const draft = createPlacementDraft({
      farmName: detail.farm.farmName,
      farmNumber: detail.farm.farmNumber ?? "",
      flockNumber: firstFlockNumber,
      houses: prefillHouseRows(detail),
    });
    const week = draft.minVentRecommendedWeek || 1;
    const minVent = minVentForWeek(detail, week);
    draft.minVentRecommendedWeek = week;
    draft.minVentRecommendedOn = minVent?.on ?? "";
    draft.minVentRecommendedOff = minVent?.off ?? "";
    return draft;
  });

  function patch(p: Partial<PlacementFormData>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function patchHouse(
    houseNumber: number,
    p: Partial<PlacementFormData["houses"][number]>,
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
              value={form.farmNumber}
              onChange={(farmNumber) => patch({ farmNumber })}
            />
          }
          right={
            <TextField
              label="Flock"
              value={form.flockNumber}
              onChange={(flockNumber) => patch({ flockNumber })}
            />
          }
        />
        <div className="mb-2.5">
          <Label htmlFor="placement-date">Date</Label>
          <DateInput
            id="placement-date"
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

      <Card>
        <SectionTitle title="Feed" />
        <YesNoField
          label="Supplemental feed lids (1 per 1,000)"
          value={form.supplementalLidsOk}
          onChange={(supplementalLidsOk) => patch({ supplementalLidsOk })}
        />
        <YesNoField
          label="Feeder paper per program"
          value={form.feederPaperOk}
          onChange={(feederPaperOk) => patch({ feederPaperOk })}
        />
        <YesNoField
          label="Feed tray ribs are covered"
          value={form.feedTrayRibsOk}
          onChange={(feedTrayRibsOk) => patch({ feedTrayRibsOk })}
        />
        <YesNoField
          label="Turbo feeders full"
          value={form.turboFeedersFullOk}
          onChange={(turboFeedersFullOk) => patch({ turboFeedersFullOk })}
        />

        <SectionTitle title="Light" />
        <YesNoField
          label="All burnt bulbs replaced"
          value={form.bulbsReplacedOk}
          onChange={(bulbsReplacedOk) => patch({ bulbsReplacedOk })}
        />
        <YesNoField
          label="Lights at full intensity"
          value={form.lightsFullIntensityOk}
          onChange={(lightsFullIntensityOk) => patch({ lightsFullIntensityOk })}
        />
        <YesNoField
          label="Call pan lights operational"
          value={form.callPanLightsOk}
          onChange={(callPanLightsOk) => patch({ callPanLightsOk })}
        />
        <YesNoField
          label="Brood lights are ON"
          value={form.broodLightsOnOk}
          onChange={(broodLightsOnOk) => patch({ broodLightsOnOk })}
        />

        <SectionTitle title="Air and litter" />
        <YesNoField
          label="Temperature set to Day 1 target"
          value={form.tempDay1Ok}
          onChange={(tempDay1Ok) => patch({ tempDay1Ok })}
        />
        <YesNoField
          label="Litter amendment has been applied"
          value={form.litterAmendmentOk}
          onChange={(litterAmendmentOk) =>
            patch({
              litterAmendmentOk,
              litterAmendmentType:
                litterAmendmentOk === "yes"
                  ? form.litterAmendmentType || "PLT"
                  : "",
            })
          }
        />
        {form.litterAmendmentOk === "yes" ? (
          <ChoiceToggle
            options={[
              { value: "PLT", label: "PLT" },
              { value: "Pure7", label: "Pure 7" },
            ]}
            value={form.litterAmendmentType || "PLT"}
            onChange={(litterAmendmentType) =>
              patch({
                litterAmendmentType: litterAmendmentType as "PLT" | "Pure7",
              })
            }
          />
        ) : null}
        <YesNoField
          label="All heaters on and operational"
          value={form.heatersOk}
          onChange={(heatersOk) => patch({ heatersOk })}
        />
        <YesNoField
          label="Sensors at bird level"
          value={form.sensorsBirdLevelOk}
          onChange={(sensorsBirdLevelOk) => patch({ sensorsBirdLevelOk })}
        />
        <MultiToggleField
          label="Vent door type"
          options={[
            { value: "ceiling", label: "Ceiling" },
            { value: "sidewall", label: "Sidewall" },
          ]}
          value={form.ventDoorTypes}
          onChange={(ventDoorTypes) => patch({ ventDoorTypes })}
        />
        <PairFields
          left={
            <TextField
              label="S.P."
              value={form.staticPressure}
              onChange={(staticPressure) => patch({ staticPressure })}
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
          label="Size and number of fans"
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
          <Label htmlFor="placement-week">Recommended min vent week</Label>
          <Select
            id="placement-week"
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
      </Card>

      <SectionTitle title="Litter temps" />
      <Card>
        <p className="mb-2.5 text-sm text-stone-500">
          Optional — leave blank for houses not being placed.
        </p>
        <CompactHouseValueGrid
          houses={form.houses}
          getValue={(n) =>
            form.houses.find((h) => h.houseNumber === n)?.litterTemp ?? ""
          }
          onChange={(houseNumber, litterTemp) =>
            patchHouse(houseNumber, { litterTemp })
          }
          placeholder="°F"
        />
      </Card>

      <SectionTitle title="Ammonia PPM" />
      <Card>
        <p className="mb-2.5 text-sm text-stone-500">
          Optional — leave blank for houses not being placed.
        </p>
        <CompactHouseValueGrid
          houses={form.houses}
          getValue={(n) =>
            form.houses.find((h) => h.houseNumber === n)?.ammoniaPpm ?? ""
          }
          onChange={(houseNumber, ammoniaPpm) =>
            patchHouse(houseNumber, { ammoniaPpm })
          }
          placeholder="PPM"
        />
      </Card>

      <Card>
        <SectionTitle title="Water" />
        <YesNoField
          label="Sight tubes clean"
          value={form.sightTubesOk}
          onChange={(sightTubesOk) => patch({ sightTubesOk })}
        />
        <YesNoField
          label="Proxy test strip performed"
          value={form.proxyTestOk}
          onChange={(proxyTestOk) => patch({ proxyTestOk })}
        />
        <YesNoField
          label="Anything currently added to water"
          value={form.waterAdditive}
          onChange={(waterAdditive) => patch({ waterAdditive })}
        />
        <PairFields
          left={
            <TextField
              label="PSI before"
              value={form.psiBefore}
              onChange={(psiBefore) => patch({ psiBefore })}
            />
          }
          right={
            <TextField
              label="PSI after"
              value={form.psiAfter}
              onChange={(psiAfter) => patch({ psiAfter })}
            />
          }
        />
        <PairFields
          left={
            <TextField
              label="Water column (in)"
              value={form.waterColumnInches}
              onChange={(waterColumnInches) => patch({ waterColumnInches })}
              placeholder="4-6"
            />
          }
          right={
            <TextField
              label="P.H."
              value={form.ph}
              onChange={(ph) => patch({ ph })}
            />
          }
        />

        <SectionTitle title="Space / Sanitation / Emergency" />
        <YesNoField
          label="Chicks partitioned properly"
          value={form.partitionedOk}
          onChange={(partitionedOk) => patch({ partitionedOk })}
        />
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
          label="Foot baths utilized"
          value={form.footBathsOk}
          onChange={(footBathsOk) => patch({ footBathsOk })}
        />
        <YesNoField
          label="Generator is in Auto"
          value={form.generatorAutoOk}
          onChange={(generatorAutoOk) => patch({ generatorAutoOk })}
        />
        <YesNoField
          label="Dialer alarm is ON"
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
