"use client";

import { useState } from "react";
import { BackHeader, Button, Card } from "@/components/ui";
import {
  ChipRow,
  CommentsField,
  CompactHouseValueGrid,
  DateField,
  PairFields,
  SectionTitle,
  TextField,
  YesNoField,
} from "@/components/serviceForms/fields";
import {
  useAutosaveServiceFormDraft,
  useCompleteServiceForm,
} from "@/components/serviceForms/useServiceFormSave";
import {
  createPrebroodDraft,
  hydratePrebroodForm,
  withSavedServiceTech,
} from "@/lib/serviceForms/defaults";
import { formatServiceShortDate } from "@/lib/serviceForms/format";
import type { ServiceFarmContext } from "@/lib/serviceForms/farmContext";
import { applyLiveHouseMetrics, prefillHouseRows } from "@/lib/serviceForms/prefill";
import type { StoredServiceForm } from "@/lib/serviceForms/stored";
import type { PrebroodForm } from "@/lib/serviceForms/types";
import { withPrebroodLoggedHours } from "@/lib/generator/format";

export function PrebroodFormView({
  farmId,
  context,
  existing,
  draft,
  fresh,
}: {
  farmId: string;
  context: ServiceFarmContext;
  existing: StoredServiceForm | null;
  draft: PrebroodForm | null;
  fresh: boolean;
}) {
  const { complete, saving, editing, error } = useCompleteServiceForm(farmId, {
    serviceFormId: existing?.id ?? null,
  });
  const detail = context.detail;

  const [form, setForm] = useState<PrebroodForm>(() => {
    if (existing?.payload && typeof existing.payload === "object") {
      return withSavedServiceTech(
        hydratePrebroodForm(existing.payload as PrebroodForm),
        context.serviceTech,
      );
    }
    if (!fresh && draft?.kind === "prebrood") {
      const hydrated = withSavedServiceTech(hydratePrebroodForm(draft), context.serviceTech);
      if (!hydrated.farmNumber?.trim() && context.farmNumber) hydrated.farmNumber = context.farmNumber;
      return applyLiveHouseMetrics(hydrated, detail);
    }
    return createPrebroodDraft({
      farmName: context.farmName,
      farmNumber: context.farmNumber,
      flockNumber: context.firstFlockNumber,
      serviceTech: context.serviceTech,
      houses: prefillHouseRows(detail),
    });
  });

  useAutosaveServiceFormDraft(farmId, "prebrood", form, !existing && !saving);

  function pullLoggedHours(next: PrebroodForm): PrebroodForm {
    if (next.generatorHoursCheckedOk !== "yes") {
      return { ...next, generatorHoursLogged: "" };
    }
    return withPrebroodLoggedHours(next, context.generatorHours);
  }

  function patch(p: Partial<PrebroodForm>) {
    setForm((prev) => pullLoggedHours({ ...prev, ...p }));
  }

  function patchHouse(houseNumber: number, p: Partial<PrebroodForm["houses"][number]>) {
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
        title={editing ? "Edit Prebrood Checklist" : "Prebrood Checklist"}
      />

      <Card>
        <TextField label="Farm name" value={form.farmName} onChange={(farmName) => patch({ farmName })} />
        <PairFields
          left={<TextField label="Farm #" value={form.farmNumber} onChange={(farmNumber) => patch({ farmNumber })} />}
          right={<TextField label="Flock" value={form.flockNumber} onChange={(flockNumber) => patch({ flockNumber })} />}
        />
        <DateField id="prebrood-date" label="Date" value={form.date} onChange={(date) => patch({ date })} />
        <p className="mb-1.5 font-bold text-stone-900">Window</p>
        <ChipRow
          options={[
            { value: "48", label: "48 Hour" },
            { value: "72", label: "72 Hour" },
          ]}
          value={form.windowHours}
          onChange={(windowHours) => patch({ windowHours })}
        />
        <TextField label="Service tech" value={form.serviceTech} onChange={(serviceTech) => patch({ serviceTech })} />
      </Card>

      <Card className="mt-3">
        <SectionTitle title="Feed" />
        <YesNoField label="Feed delivered" value={form.feedDeliveredOk} onChange={(feedDeliveredOk) => patch({ feedDeliveredOk })} />
        <YesNoField label="Feed paper delivered" value={form.feedPaperDeliveredOk} onChange={(feedPaperDeliveredOk) => patch({ feedPaperDeliveredOk })} />
        <YesNoField label="Supplemental feed lids delivered" value={form.supplementalLidsDeliveredOk} onChange={(supplementalLidsDeliveredOk) => patch({ supplementalLidsDeliveredOk })} />

        <SectionTitle title="Light" />
        <YesNoField label="All burnt bulbs replaced" value={form.bulbsReplacedOk} onChange={(bulbsReplacedOk) => patch({ bulbsReplacedOk })} />
        <YesNoField label="Lighting program is present" value={form.lightingProgramOk} onChange={(lightingProgramOk) => patch({ lightingProgramOk })} />

        <SectionTitle title="Air and Litter" />
        <YesNoField label="Moisture removal chart present" value={form.moistureChartOk} onChange={(moistureChartOk) => patch({ moistureChartOk })} />
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
        <YesNoField label="Min vent is ON" value={form.minVentOnOk} onChange={(minVentOnOk) => patch({ minVentOnOk })} />
        <YesNoField label="Fans are clean" value={form.fansCleanOk} onChange={(fansCleanOk) => patch({ fansCleanOk })} />
        <YesNoField label="Temperature set to Day 1 target" value={form.tempDay1Ok} onChange={(tempDay1Ok) => patch({ tempDay1Ok })} />
        <YesNoField label="Proper cake out completed" value={form.cakeOutOk} onChange={(cakeOutOk) => patch({ cakeOutOk })} />
        <YesNoField label="Clean out and pad treat" value={form.cleanOutPadTreatOk} onChange={(cleanOutPadTreatOk) => patch({ cleanOutPadTreatOk })} />
        <YesNoField label={'Litter depth adequate (min 4–6")'} value={form.litterDepthOk} onChange={(litterDepthOk) => patch({ litterDepthOk })} />
        <YesNoField label="All heaters on and operational" value={form.heatersOk} onChange={(heatersOk) => patch({ heatersOk })} />
      </Card>

      <SectionTitle title="Ammonia PPM" />
      <Card className="mb-2.5">
        <p className="mb-2.5 text-sm leading-snug text-stone-500">Optional — blank is fine.</p>
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
        <YesNoField label="Water lines sanitized" value={form.waterLinesSanitizedOk} onChange={(waterLinesSanitizedOk) => patch({ waterLinesSanitizedOk })} />

        <SectionTitle title="Sanitation" />
        <YesNoField label="Premise is clean" value={form.premiseCleanOk} onChange={(premiseCleanOk) => patch({ premiseCleanOk })} />
        <YesNoField
          label="Current insecticide has been applied"
          value={form.insecticideOk}
          onChange={(insecticideOk) =>
            patch({
              insecticideOk,
              insecticideType: insecticideOk === "yes" ? form.insecticideType : "",
            })
          }
        />
        {form.insecticideOk === "yes" ? (
          <ChipRow
            options={[
              { value: "CV", label: "CV" },
              { value: "RVO", label: "RVO" },
            ]}
            value={form.insecticideType}
            onChange={(insecticideType) => patch({ insecticideType })}
          />
        ) : null}

        <SectionTitle title="Emergency" />
        <YesNoField label="Generator block heater" value={form.blockHeaterOk} onChange={(blockHeaterOk) => patch({ blockHeaterOk })} />
        <YesNoField label="Generator battery maintainer" value={form.batteryMaintainerOk} onChange={(batteryMaintainerOk) => patch({ batteryMaintainerOk })} />
        <YesNoField label="Performed generator test" value={form.generatorTestOk} onChange={(generatorTestOk) => patch({ generatorTestOk })} />
        <YesNoField label="Performed dialer alarm test" value={form.dialerTestOk} onChange={(dialerTestOk) => patch({ dialerTestOk })} />
        <YesNoField
          label="Generator serviced"
          value={form.generatorServicedOk}
          onChange={(generatorServicedOk) =>
            patch({
              generatorServicedOk,
              generatorServiceDate:
                generatorServicedOk === "yes" ? form.generatorServiceDate || form.date : "",
            })
          }
        />
        {form.generatorServicedOk === "yes" ? (
          <DateField
            id="prebrood-gen-service"
            label={`Service date (${formatServiceShortDate(form.generatorServiceDate || form.date) || "dd MMM yy"})`}
            value={form.generatorServiceDate || form.date}
            onChange={(generatorServiceDate) => patch({ generatorServiceDate })}
          />
        ) : null}
        <YesNoField
          label="Generator hours checked"
          value={form.generatorHoursCheckedOk}
          onChange={(generatorHoursCheckedOk) => patch({ generatorHoursCheckedOk })}
        />
        {form.generatorHoursCheckedOk === "yes" && form.generatorHoursLogged ? (
          <p className="mb-2 font-semibold text-stone-500">{form.generatorHoursLogged}</p>
        ) : null}
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
