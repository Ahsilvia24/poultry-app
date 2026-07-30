import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { DatePickerField } from "../../../../../src/components/DatePickerField";
import {
  PairFields,
  SectionTitle,
  TextField,
  YesNoField,
} from "../../../../../src/components/serviceForms/fields";
import { Card, PageHeader } from "../../../../../src/components/ui";
import { createPrebroodDraft } from "../../../../../src/lib/serviceForms/defaults";
import { formatServiceShortDate } from "../../../../../src/lib/serviceForms/format";
import { prefillHouseRows } from "../../../../../src/lib/serviceForms/prefill";
import type { PrebroodForm } from "../../../../../src/lib/serviceForms/types";
import {
  useCompleteServiceForm,
  useServiceFarmContext,
} from "../../../../../src/lib/serviceForms/useServiceFarm";
import { colors, styles } from "../../../../../src/theme";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function withGeneratorComment(form: PrebroodForm): PrebroodForm {
  const hours = form.generatorHours.trim();
  if (form.generatorHoursLoggedOk !== "yes" || !hours) return form;
  const line = `Generator hours: ${hours}`;
  const comments = form.comments.trim();
  if (comments.startsWith("Generator hours:")) return form;
  return {
    ...form,
    comments: comments ? `${line}\n${comments}` : line,
  };
}

export default function PrebroodChecklistScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const { detail, farmName, flockNumber } = useServiceFarmContext(farmId);
  const { complete, saving } = useCompleteServiceForm(farmId);

  const [form, setForm] = useState<PrebroodForm>(() =>
    createPrebroodDraft({
      farmName,
      flockNumber,
      houses: detail ? prefillHouseRows(detail) : [],
    }),
  );

  function patch(p: Partial<PrebroodForm>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function patchHouse(houseNumber: number, p: Partial<PrebroodForm["houses"][number]>) {
    setForm((prev) => ({
      ...prev,
      houses: prev.houses.map((h) =>
        h.houseNumber === houseNumber ? { ...h, ...p } : h,
      ),
    }));
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 }]}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else
              router.replace({
                pathname: "/(tabs)/farms/[id]/service",
                params: { id: farmId },
              });
          }}
          style={{ marginBottom: 8 }}
        >
          <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Checklists</Text>
        </Pressable>
        <PageHeader title="Prebrood Checklist" subtitle={farmName} />

        <Card>
          <TextField label="Farm name" value={form.farmName} onChange={(farmName) => patch({ farmName })} />
          <PairFields
            left={
              <TextField label="Farm #" value={form.farmNumber} onChange={(farmNumber) => patch({ farmNumber })} />
            }
            right={
              <TextField label="Flock" value={form.flockNumber} onChange={(flockNumber) => patch({ flockNumber })} />
            }
          />
          <DatePickerField label="Date" value={form.date} onChange={(date) => patch({ date })} />
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>Window</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            {(["48", "72"] as const).map((opt) => {
              const active = form.windowHours === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => patch({ windowHours: opt })}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: active ? colors.accentDark : "#f5f5f4",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "800", color: active ? "#fff" : colors.text }}>
                    {opt} Hour
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextField
            label="Service tech"
            value={form.serviceTech}
            onChange={(serviceTech) => patch({ serviceTech })}
          />
        </Card>

        <Card style={{ marginTop: 12 }}>
          <SectionTitle title="Feed" />
          <YesNoField label="Feed delivered" value={form.feedDeliveredOk} onChange={(feedDeliveredOk) => patch({ feedDeliveredOk })} />
          <YesNoField label="Feed paper delivered" value={form.feedPaperDeliveredOk} onChange={(feedPaperDeliveredOk) => patch({ feedPaperDeliveredOk })} />
          <YesNoField label="Supplemental feed lids delivered" value={form.supplementalLidsDeliveredOk} onChange={(supplementalLidsDeliveredOk) => patch({ supplementalLidsDeliveredOk })} />

          <SectionTitle title="Light" />
          <YesNoField label="All burnt bulbs replaced" value={form.bulbsReplacedOk} onChange={(bulbsReplacedOk) => patch({ bulbsReplacedOk })} />
          <YesNoField label="Lighting program is present" value={form.lightingProgramOk} onChange={(lightingProgramOk) => patch({ lightingProgramOk })} />

          <SectionTitle title="Air and litter" />
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
            <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
              {(["PLT", "Pure7"] as const).map((opt) => {
                const active = form.litterAmendmentType === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => patch({ litterAmendmentType: opt })}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: active ? colors.accentDark : "#f5f5f4",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: active ? "#fff" : colors.text }}>
                      {opt === "Pure7" ? "Pure 7" : opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <YesNoField label="Min vent is ON" value={form.minVentOnOk} onChange={(minVentOnOk) => patch({ minVentOnOk })} />
          <YesNoField label="Fans are clean" value={form.fansCleanOk} onChange={(fansCleanOk) => patch({ fansCleanOk })} />
          <YesNoField label="Temperature set to Day 1 target" value={form.tempDay1Ok} onChange={(tempDay1Ok) => patch({ tempDay1Ok })} />
          <YesNoField label="Proper cake out completed" value={form.cakeOutOk} onChange={(cakeOutOk) => patch({ cakeOutOk })} />
          <YesNoField label="Clean out and pad treat" value={form.cleanOutPadTreatOk} onChange={(cleanOutPadTreatOk) => patch({ cleanOutPadTreatOk })} />
          <YesNoField label={'Litter depth adequate (min 4–6")'} value={form.litterDepthOk} onChange={(litterDepthOk) => patch({ litterDepthOk })} />
          <YesNoField label="All heaters on and operational" value={form.heatersOk} onChange={(heatersOk) => patch({ heatersOk })} />
        </Card>

        <SectionTitle title="Ammonia PPM by house" />
        <Text style={[styles.muted, { marginBottom: 8 }]}>Optional — blank is fine.</Text>
        {form.houses.map((h) => (
          <Card key={h.houseNumber} style={{ marginBottom: 8 }}>
            <TextField
              label={`House ${h.houseNumber} ammonia PPM`}
              value={h.ammoniaPpm}
              onChange={(ammoniaPpm) => patchHouse(h.houseNumber, { ammoniaPpm })}
              keyboardType="decimal-pad"
            />
          </Card>
        ))}

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
            <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
              {(["CV", "RVO"] as const).map((opt) => {
                const active = form.insecticideType === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => patch({ insecticideType: opt })}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: active ? colors.accentDark : "#f5f5f4",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: active ? "#fff" : colors.text }}>
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
            <View style={{ marginBottom: 10 }}>
              <DatePickerField
                label={`Service date (${formatServiceShortDate(form.generatorServiceDate || form.date) || "dd MMM yy"})`}
                value={form.generatorServiceDate || form.date}
                onChange={(generatorServiceDate) => patch({ generatorServiceDate })}
              />
            </View>
          ) : null}
          <YesNoField
            label="Generator hours logged"
            value={form.generatorHoursLoggedOk}
            onChange={(generatorHoursLoggedOk) => patch({ generatorHoursLoggedOk })}
          />
          {form.generatorHoursLoggedOk === "yes" ? (
            <TextField
              label="Generator hours"
              value={form.generatorHours}
              onChange={(generatorHours) => patch({ generatorHours })}
              keyboardType="decimal-pad"
              placeholder="Hours on meter"
            />
          ) : null}

          <SectionTitle title="Comments" />
          <Text style={[styles.muted, { marginBottom: 6 }]}>
            If you log generator hours, they’ll be added as the first comment line (editable).
          </Text>
          <TextField label="Notes" value={form.comments} onChange={(comments) => patch({ comments })} multiline />
        </Card>

        <Pressable
          disabled={saving}
          onPress={() => {
            const next = withGeneratorComment(form);
            const hours =
              next.generatorHoursLoggedOk === "yes" && next.generatorHours.trim()
                ? Number(next.generatorHours)
                : null;
            void complete({
              form: next,
              generatorHours: hours != null && Number.isFinite(hours) ? hours : null,
            });
          }}
          style={{
            marginTop: 16,
            backgroundColor: colors.accentDark,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: "center",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
              Complete · Log visit · Share PDF
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
