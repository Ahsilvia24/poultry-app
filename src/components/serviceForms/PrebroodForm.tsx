"use client";

import { useState } from "react";
import { Button, Card, DateInput, Label } from "@/components/ui";
import { createPrebroodDraft } from "@/lib/serviceForms/defaults";
import { formatServiceShortDate } from "@/lib/serviceForms/format";
import {
  prefillHouseRows,
  type ServiceFarmDetail,
} from "@/lib/serviceForms/prefill";
import type { PrebroodForm as PrebroodFormData } from "@/lib/serviceForms/types";
import {
  ChoiceToggle,
  CommentsField,
  CompactHouseValueGrid,
  PairFields,
  SectionTitle,
  TextField,
  YesNoField,
} from "./fields";
import { useCompleteServiceForm } from "./useCompleteServiceForm";

export function PrebroodForm({
  farmId,
  detail,
  initialPayload,
  serviceFormId,
  existingVisitId,
}: {
  farmId: string;
  detail: ServiceFarmDetail;
  initialPayload?: PrebroodFormData | null;
  serviceFormId?: string | null;
  existingVisitId?: string | null;
}) {
  const { complete, saving, editing, error } = useCompleteServiceForm(farmId, {
    serviceFormId,
    existingVisitId,
  });

  const firstFlockNumber =
    detail.activeFlocks?.[0]?.flockNumber ??
    detail.activeFlock?.flockNumber?.split(/\s*·\s*/)[0]?.trim() ??
    "";

  const [form, setForm] = useState<PrebroodFormData>(() => {
    if (initialPayload) return initialPayload;
    return createPrebroodDraft({
      farmName: detail.farm.farmName,
      farmNumber: detail.farm.farmNumber ?? "",
      flockNumber: firstFlockNumber,
      houses: prefillHouseRows(detail),
    });
  });

  function patch(p: Partial<PrebroodFormData>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function patchHouse(
    houseNumber: number,
    p: Partial<PrebroodFormData["houses"][number]>,
  ) {
    setForm((prev) => ({
      ...prev,
      houses: prev.houses.map((h) =>
        h.houseNumber === houseNumber ? { ...h, ...p } : h,
      ),
    }));
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
          <Label htmlFor="prebrood-date">Date</Label>
          <DateInput
            id="prebrood-date"
            value={form.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
        </div>
        <p className="mb-1.5 font-bold text-stone-800">Window</p>
        <ChoiceToggle
          options={[
            { value: "48", label: "48 Hour" },
            { value: "72", label: "72 Hour" },
          ]}
          value={form.windowHours}
          onChange={(windowHours) =>
            patch({ windowHours: windowHours as "48" | "72" })
          }
        />
        <TextField
          label="Service tech"
          value={form.serviceTech}
          onChange={(serviceTech) => patch({ serviceTech })}
        />
      </Card>

      <Card>
        <SectionTitle title="Feed" />
        <YesNoField
          label="Feed delivered"
          value={form.feedDeliveredOk}
          onChange={(feedDeliveredOk) => patch({ feedDeliveredOk })}
        />
        <YesNoField
          label="Feed paper delivered"
          value={form.feedPaperDeliveredOk}
          onChange={(feedPaperDeliveredOk) => patch({ feedPaperDeliveredOk })}
        />
        <YesNoField
          label="Supplemental feed lids delivered"
          value={form.supplementalLidsDeliveredOk}
          onChange={(supplementalLidsDeliveredOk) =>
            patch({ supplementalLidsDeliveredOk })
          }
        />

        <SectionTitle title="Light" />
        <YesNoField
          label="All burnt bulbs replaced"
          value={form.bulbsReplacedOk}
          onChange={(bulbsReplacedOk) => patch({ bulbsReplacedOk })}
        />
        <YesNoField
          label="Lighting program is present"
          value={form.lightingProgramOk}
          onChange={(lightingProgramOk) => patch({ lightingProgramOk })}
        />

        <SectionTitle title="Air and litter" />
        <YesNoField
          label="Moisture removal chart present"
          value={form.moistureChartOk}
          onChange={(moistureChartOk) => patch({ moistureChartOk })}
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
          label="Min vent is ON"
          value={form.minVentOnOk}
          onChange={(minVentOnOk) => patch({ minVentOnOk })}
        />
        <YesNoField
          label="Fans are clean"
          value={form.fansCleanOk}
          onChange={(fansCleanOk) => patch({ fansCleanOk })}
        />
        <YesNoField
          label="Temperature set to Day 1 target"
          value={form.tempDay1Ok}
          onChange={(tempDay1Ok) => patch({ tempDay1Ok })}
        />
        <YesNoField
          label="Proper cake out completed"
          value={form.cakeOutOk}
          onChange={(cakeOutOk) => patch({ cakeOutOk })}
        />
        <YesNoField
          label="Clean out and pad treat"
          value={form.cleanOutPadTreatOk}
          onChange={(cleanOutPadTreatOk) => patch({ cleanOutPadTreatOk })}
        />
        <YesNoField
          label={'Litter depth adequate (min 4–6")'}
          value={form.litterDepthOk}
          onChange={(litterDepthOk) => patch({ litterDepthOk })}
        />
        <YesNoField
          label="All heaters on and operational"
          value={form.heatersOk}
          onChange={(heatersOk) => patch({ heatersOk })}
        />
      </Card>

      <SectionTitle title="Ammonia PPM" />
      <Card>
        <p className="mb-2.5 text-sm text-stone-500">Optional — blank is fine.</p>
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
          label="Water lines sanitized"
          value={form.waterLinesSanitizedOk}
          onChange={(waterLinesSanitizedOk) =>
            patch({ waterLinesSanitizedOk })
          }
        />

        <SectionTitle title="Sanitation" />
        <YesNoField
          label="Premise is clean"
          value={form.premiseCleanOk}
          onChange={(premiseCleanOk) => patch({ premiseCleanOk })}
        />
        <YesNoField
          label="Current insecticide has been applied"
          value={form.insecticideOk}
          onChange={(insecticideOk) =>
            patch({
              insecticideOk,
              insecticideType:
                insecticideOk === "yes" ? form.insecticideType || "CV" : "",
            })
          }
        />
        {form.insecticideOk === "yes" ? (
          <ChoiceToggle
            options={[
              { value: "CV", label: "CV" },
              { value: "RVO", label: "RVO" },
            ]}
            value={form.insecticideType || "CV"}
            onChange={(insecticideType) =>
              patch({ insecticideType: insecticideType as "CV" | "RVO" })
            }
          />
        ) : null}

        <SectionTitle title="Emergency" />
        <YesNoField
          label="Generator block heater"
          value={form.blockHeaterOk}
          onChange={(blockHeaterOk) => patch({ blockHeaterOk })}
        />
        <YesNoField
          label="Generator battery maintainer"
          value={form.batteryMaintainerOk}
          onChange={(batteryMaintainerOk) => patch({ batteryMaintainerOk })}
        />
        <YesNoField
          label="Performed generator test"
          value={form.generatorTestOk}
          onChange={(generatorTestOk) => patch({ generatorTestOk })}
        />
        <YesNoField
          label="Performed dialer alarm test"
          value={form.dialerTestOk}
          onChange={(dialerTestOk) => patch({ dialerTestOk })}
        />
        <YesNoField
          label="Generator serviced"
          value={form.generatorServicedOk}
          onChange={(generatorServicedOk) =>
            patch({
              generatorServicedOk,
              generatorServiceDate:
                generatorServicedOk === "yes"
                  ? form.generatorServiceDate || form.date
                  : "",
            })
          }
        />
        {form.generatorServicedOk === "yes" ? (
          <div className="mb-2.5">
            <Label htmlFor="generatorServiceDate">
              Service date (
              {formatServiceShortDate(form.generatorServiceDate || form.date) ||
                "dd MMM yy"}
              )
            </Label>
            <DateInput
              id="generatorServiceDate"
              value={form.generatorServiceDate || form.date}
              onChange={(e) => patch({ generatorServiceDate: e.target.value })}
            />
          </div>
        ) : null}
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
