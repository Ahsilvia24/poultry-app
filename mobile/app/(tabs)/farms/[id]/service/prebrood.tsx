import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ScrollView as ScrollViewType,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { DatePickerField } from "../../../../../src/components/DatePickerField";
import {
  PairFields,
  SectionTitle,
  TextField,
  YesNoField,
  CommentsField,
  CompactHouseValueGrid,
} from "../../../../../src/components/serviceForms/fields";
import { BackHeader, Card } from "../../../../../src/components/ui";
import { withSavedServiceTech } from "../../../../../src/lib/appSettings";
import { createPrebroodDraft } from "../../../../../src/lib/serviceForms/defaults";
import { formatServiceShortDate } from "../../../../../src/lib/serviceForms/format";
import { applyLiveHouseMetrics, prefillHouseRows } from "../../../../../src/lib/serviceForms/prefill";
import type { PrebroodForm } from "../../../../../src/lib/serviceForms/types";
import {
  readInProgressDraft,
  useAutosaveServiceFormDraft,
  useCompleteServiceForm,
  useEditVisitIdParam,
  useExistingServiceForm,
  useRefreshDraftHouseMetrics,
  useServiceFarmContext,
  goToServiceFarm,
} from "../../../../../src/lib/serviceForms/useServiceFarm";
import { colors, styles } from "../../../../../src/theme";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function PrebroodChecklistScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; fresh?: string | string[] }>();
  const farmId = paramId(params.id);
  const fresh = paramId(params.fresh) === "1";
  const { detail, farmName, firstFlockNumber } = useServiceFarmContext(farmId);
  const existing = useExistingServiceForm(farmId, "prebrood");
  const editVisitId = useEditVisitIdParam(farmId);
  const { complete, saving, editing, error: completeError } = useCompleteServiceForm(farmId, {
    serviceFormId: existing?.id ?? null,
    existingVisitId: existing ? null : editVisitId,
  });

  const [datePicker, setDatePicker] = useState<"form" | "generator" | null>(null);
  const [form, setForm] = useState<PrebroodForm>(() => {
    if (existing?.payload && typeof existing.payload === "object") {
      return withSavedServiceTech(existing.payload as PrebroodForm);
    }
    const draft = readInProgressDraft<PrebroodForm>(farmId, "prebrood", fresh);
    if (draft?.kind === "prebrood") {
      const hydrated = withSavedServiceTech(draft);
      return detail ? applyLiveHouseMetrics(hydrated, detail) : hydrated;
    }
    return createPrebroodDraft({
      farmName,
      flockNumber: firstFlockNumber,
      houses: detail ? prefillHouseRows(detail) : [],
    });
  });
  const scrollRef = useRef<ScrollViewType>(null);
  useAutosaveServiceFormDraft(farmId, "prebrood", form, !existing && !saving);
  useRefreshDraftHouseMetrics(farmId, !existing && !saving, setForm);

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
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: 280 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS !== "web"}
      >
        <BackHeader
          backLabel="Checklists"
          title={editing ? "Edit Prebrood Checklist" : "Prebrood Checklist"}
          accessibilityLabel="Back to checklists"
          onBack={() => goToServiceFarm(farmId)}
        />

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
          <DatePickerField
            label="Date"
            value={form.date}
            expanded={datePicker === "form"}
            onOpen={() => setDatePicker("form")}
            onChange={(date) => patch({ date })}
          />
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

        <SectionTitle title="Ammonia PPM" />
        <Card style={{ marginBottom: 10 }}>
          <Text style={[styles.muted, { marginBottom: 10, lineHeight: 18 }]}>
            Optional — blank is fine.
          </Text>
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
                expanded={datePicker === "generator"}
                onOpen={() => setDatePicker("generator")}
                onChange={(generatorServiceDate) => patch({ generatorServiceDate })}
              />
            </View>
          ) : null}
        </Card>

        <CommentsField
          value={form.comments}
          onChange={(comments) => patch({ comments })}
          scrollRef={scrollRef}
        />

        {completeError ? (
          <Text style={{ color: colors.danger, fontWeight: "700", marginTop: 12 }}>
            {completeError}
          </Text>
        ) : null}
        <Pressable
          disabled={saving}
          onPress={() => {
            void complete({ form });
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
              {editing ? "Save changes · Share PDF" : "Complete · Log visit · Share PDF"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
