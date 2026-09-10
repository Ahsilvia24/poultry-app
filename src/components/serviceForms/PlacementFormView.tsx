"use client";

import { useState } from "react";
import { BackHeader, Button, Card } from "@/components/ui";
import {
  ChipRow,
  CommentsField,
  CompactBackupSettings,
  CompactHouseValueGrid,
  DateField,
  MultiToggleField,
  PairFields,
  SectionTitle,
  SelectField,
  TextField,
  YesNoField,
} from "@/components/serviceForms/fields";
import {
  useAutosaveServiceFormDraft,
  useCompleteServiceForm,
} from "@/components/serviceForms/useServiceFormSave";
import { createPlacementDraft, withSavedServiceTech } from "@/lib/serviceForms/defaults";
import {
  CFM_FT2_MIN_VENT_LABEL,
  VENT_DOOR_OPTIONS,
  WEEK_OPTIONS,
  ventDoorTypesFromPayload,
} from "@/lib/serviceForms/format";
import type { ServiceFarmContext } from "@/lib/serviceForms/farmContext";
import { applyLiveHouseMetrics, minVentForWeek, prefillHouseRows } from "@/lib/serviceForms/prefill";
import type { StoredServiceForm } from "@/lib/serviceForms/stored";
import type { PlacementForm } from "@/lib/serviceForms/types";

function hydratePlacement(payload: PlacementForm): PlacementForm {
  return { ...payload, ventDoorTypes: ventDoorTypesFromPayload(payload) };
}

export function PlacementFormView({
  farmId,
  context,
  existing,
  draft,
  fresh,
}: {
  farmId: string;
  context: ServiceFarmContext;
  existing: StoredServiceForm | null;
  draft: PlacementForm | null;
  fresh: boolean;
}) {
  const { complete, saving, editing, error } = useCompleteServiceForm(farmId, {
    serviceFormId: existing?.id ?? null,
  });
  const detail = context.detail;

  const [form, setForm] = useState<PlacementForm>(() => {
    if (existing?.payload && typeof existing.payload === "object") {
      return withSavedServiceTech(hydratePlacement(existing.payload as PlacementForm), context.serviceTech);
    }
    if (!fresh && draft?.kind === "placement") {
      const hydrated = withSavedServiceTech(hydratePlacement(draft), context.serviceTech);
      if (!hydrated.farmNumber?.trim() && context.farmNumber) hydrated.farmNumber = context.farmNumber;
      return applyLiveHouseMetrics(hydrated, detail);
    }
    const blank = createPlacementDraft({
      farmName: context.farmName,
      farmNumber: context.farmNumber,
      flockNumber: context.firstFlockNumber,
      serviceTech: context.serviceTech,
      houses: prefillHouseRows(detail),
    });
    const week = blank.minVentRecommendedWeek || 1;
    const minVent = minVentForWeek(detail, week);
    blank.minVentRecommendedWeek = week;
    blank.minVentRecommendedOn = minVent?.on ?? "";
    blank.minVentRecommendedOff = minVent?.off ?? "";
    return blank;
  });

  useAutosaveServiceFormDraft(farmId, "placement", form, !existing && !saving);

  function patch(p: Partial<PlacementForm>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

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

  function patchHouse(houseNumber: number, p: Partial<PlacementForm["houses"][number]>) {
    setForm((prev) => ({
      ...prev,
      houses: prev.houses.map((h) => (h.houseNumber === houseNumber ? { ...h, ...p } : h)),
    }));
  }

  return (
    <div className="pb-20">
      <BackHeader
        href={`/farms/${farmId}/service`}
        backLabel="Checklists"
        title={editing ? "Edit Placement Checklist" : "Placement Checklist"}
      />

      <Card>
        <TextField label="Farm name" value={form.farmName} onChange={(farmName) => patch({ farmName })} />
        <PairFields
          left={<TextField label="Farm #" value={form.farmNumber} onChange={(farmNumber) => patch({ farmNumber })} />}
          right={<TextField label="Flock" value={form.flockNumber} onChange={(flockNumber) => patch({ flockNumber })} />}
        />
        <DateField id="placement-date" label="Date" value={form.date} onChange={(date) => patch({ date })} />
        <TextField label="Service tech" value={form.serviceTech} onChange={(serviceTech) => patch({ serviceTech })} />
      </Card>

      <Card className="mt-3">
        <SectionTitle title="Feed" />
        <YesNoField label="Supplemental feed lids (1 per 1,000)" value={form.supplementalLidsOk} onChange={(supplementalLidsOk) => patch({ supplementalLidsOk })} />
        <YesNoField label="Feeder paper per program" value={form.feederPaperOk} onChange={(feederPaperOk) => patch({ feederPaperOk })} />
        <YesNoField label="Feed tray ribs are covered" value={form.feedTrayRibsOk} onChange={(feedTrayRibsOk) => patch({ feedTrayRibsOk })} />
        <YesNoField label="Turbo feeders full" value={form.turboFeedersFullOk} onChange={(turboFeedersFullOk) => patch({ turboFeedersFullOk })} />

        <SectionTitle title="Light" />
        <YesNoField label="All burnt bulbs replaced" value={form.bulbsReplacedOk} onChange={(bulbsReplacedOk) => patch({ bulbsReplacedOk })} />
        <YesNoField label="Lights at full intensity" value={form.lightsFullIntensityOk} onChange={(lightsFullIntensityOk) => patch({ lightsFullIntensityOk })} />
        <YesNoField label="Call pan lights operational" value={form.callPanLightsOk} onChange={(callPanLightsOk) => patch({ callPanLightsOk })} />
        <YesNoField label="Brood lights are ON" value={form.broodLightsOnOk} onChange={(broodLightsOnOk) => patch({ broodLightsOnOk })} />

        <SectionTitle title="Air and Litter" />
        <YesNoField label="Temperature set to Day 1 target" value={form.tempDay1Ok} onChange={(tempDay1Ok) => patch({ tempDay1Ok })} />
        <YesNoField
          label="Litter amendment has been applied"
          value={form.litterAmendmentOk}
          onChange={(litterAmendmentOk) =>
            patch({
              litterAmendmentOk,
              litterAmendmentType: litterAmendmentOk === "yes" ? form.litterAmendmentType : "",
            })
          }
        />
        {form.litterAmendmentOk === "yes" ? (
          <ChipRow
            options={[
              { value: "PLT", label: "PLT" },
              { value: "Pure7", label: "Pure 7" },
            ]}
            value={form.litterAmendmentType}
            onChange={(litterAmendmentType) => patch({ litterAmendmentType })}
          />
        ) : null}
        <YesNoField label="All heaters on and operational" value={form.heatersOk} onChange={(heatersOk) => patch({ heatersOk })} />
        <YesNoField label="Sensors at bird level" value={form.sensorsBirdLevelOk} onChange={(sensorsBirdLevelOk) => patch({ sensorsBirdLevelOk })} />
        <MultiToggleField
          label="Vent door type"
          options={VENT_DOOR_OPTIONS}
          value={form.ventDoorTypes}
          onChange={(ventDoorTypes) => patch({ ventDoorTypes })}
        />
        <PairFields
          left={<TextField label="S.P." value={form.staticPressure} onChange={(staticPressure) => patch({ staticPressure })} inputMode="decimal" />}
          right={<TextField label="Vent opening (in)" value={form.ventOpeningInches} onChange={(ventOpeningInches) => patch({ ventOpeningInches })} inputMode="decimal" />}
        />
        <TextField label={CFM_FT2_MIN_VENT_LABEL} value={form.cfmPerFt2MinVent} onChange={(cfmPerFt2MinVent) => patch({ cfmPerFt2MinVent })} inputMode="decimal" />
        <TextField label="Size and number of fans" value={form.fansSizeAndCount} onChange={(fansSizeAndCount) => patch({ fansSizeAndCount })} />
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
            : "—"}
        </p>
      </Card>

      <SectionTitle title="Litter Temps" />
      <Card className="mb-2.5">
        <p className="mb-2.5 text-sm leading-snug text-stone-500">
          Optional — leave blank for houses not being placed.
        </p>
        <CompactHouseValueGrid
          houses={form.houses}
          getValue={(n) => form.houses.find((h) => h.houseNumber === n)?.litterTemp ?? ""}
          onChange={(houseNumber, litterTemp) => patchHouse(houseNumber, { litterTemp })}
          placeholder="°F"
        />
      </Card>

      <SectionTitle title="Ammonia PPM" />
      <Card className="mb-2.5">
        <p className="mb-2.5 text-sm leading-snug text-stone-500">
          Optional — leave blank for houses not being placed.
        </p>
        <CompactHouseValueGrid
          houses={form.houses}
          getValue={(n) => form.houses.find((h) => h.houseNumber === n)?.ammoniaPpm ?? ""}
          onChange={(houseNumber, ammoniaPpm) => patchHouse(houseNumber, { ammoniaPpm })}
          placeholder="PPM"
        />
      </Card>

      <Card>
        <SectionTitle title="Water" />
        <YesNoField label="Sight tubes clean" value={form.sightTubesOk} onChange={(sightTubesOk) => patch({ sightTubesOk })} />
        <YesNoField label="Proxy test strip performed" value={form.proxyTestOk} onChange={(proxyTestOk) => patch({ proxyTestOk })} />
        <YesNoField label="Anything currently added to water" value={form.waterAdditive} onChange={(waterAdditive) => patch({ waterAdditive })} />
        <PairFields
          left={<TextField label="PSI before" value={form.psiBefore} onChange={(psiBefore) => patch({ psiBefore })} inputMode="decimal" />}
          right={<TextField label="PSI after" value={form.psiAfter} onChange={(psiAfter) => patch({ psiAfter })} inputMode="decimal" />}
        />
        <PairFields
          left={<TextField label="Water column (in)" value={form.waterColumnInches} onChange={(waterColumnInches) => patch({ waterColumnInches })} placeholder="4-6" />}
          right={<TextField label="P.H." value={form.ph} onChange={(ph) => patch({ ph })} inputMode="decimal" />}
        />

        <SectionTitle title="Space / Sanitation / Emergency" />
        <YesNoField label="Chicks partitioned properly" value={form.partitionedOk} onChange={(partitionedOk) => patch({ partitionedOk })} />
        <YesNoField label="Premise is clean" value={form.premiseCleanOk} onChange={(premiseCleanOk) => patch({ premiseCleanOk })} />
        <YesNoField label="Rodenticide is placed" value={form.rodenticideOk} onChange={(rodenticideOk) => patch({ rodenticideOk })} />
        <YesNoField label="Foot baths utilized" value={form.footBathsOk} onChange={(footBathsOk) => patch({ footBathsOk })} />
        <YesNoField label="Generator is in Auto" value={form.generatorAutoOk} onChange={(generatorAutoOk) => patch({ generatorAutoOk })} />
        <YesNoField label="Dialer alarm is ON" value={form.dialerOnOk} onChange={(dialerOnOk) => patch({ dialerOnOk })} />
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
