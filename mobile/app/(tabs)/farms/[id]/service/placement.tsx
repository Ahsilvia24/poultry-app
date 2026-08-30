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
import { OptionPicker, SelectField } from "../../../../../src/components/OptionPicker";
import {
  MultiToggleField,
  PairFields,
  SectionTitle,
  TextField,
  YesNoField,
  CommentsField,
  CompactHouseValueGrid,
  CompactBackupSettings,
} from "../../../../../src/components/serviceForms/fields";
import { BackHeader, Card } from "../../../../../src/components/ui";
import { withSavedServiceTech } from "../../../../../src/lib/appSettings";
import { createPlacementDraft } from "../../../../../src/lib/serviceForms/defaults";
import {
  CFM_FT2_MIN_VENT_LABEL,
  VENT_DOOR_OPTIONS,
  WEEK_OPTIONS,
  ventDoorTypesFromPayload,
} from "../../../../../src/lib/serviceForms/format";
import {
  applyLiveHouseMetrics,
  minVentForWeek,
  prefillHouseRows,
} from "../../../../../src/lib/serviceForms/prefill";
import type { PlacementForm } from "../../../../../src/lib/serviceForms/types";
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

function hydratePlacement(payload: PlacementForm): PlacementForm {
  return {
    ...payload,
    ventDoorTypes: ventDoorTypesFromPayload(payload),
  };
}

export default function PlacementChecklistScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; fresh?: string | string[] }>();
  const farmId = paramId(params.id);
  const fresh = paramId(params.fresh) === "1";
  const { detail, farmName, firstFlockNumber } = useServiceFarmContext(farmId);
  const existing = useExistingServiceForm(farmId, "placement");
  const editVisitId = useEditVisitIdParam(farmId);
  const { complete, saving, editing, error: completeError } = useCompleteServiceForm(farmId, {
    serviceFormId: existing?.id ?? null,
    existingVisitId: existing ? null : editVisitId,
  });

  const [form, setForm] = useState<PlacementForm>(() => {
    if (existing?.payload && typeof existing.payload === "object") {
      return withSavedServiceTech(hydratePlacement(existing.payload as PlacementForm));
    }
    const draft = readInProgressDraft<PlacementForm>(farmId, "placement", fresh);
    if (draft?.kind === "placement") {
      const hydrated = withSavedServiceTech(hydratePlacement(draft));
      return detail ? applyLiveHouseMetrics(hydrated, detail) : hydrated;
    }
    const blank = createPlacementDraft({
      farmName,
      flockNumber: firstFlockNumber,
      houses: detail ? prefillHouseRows(detail) : [],
    });
    if (detail) {
      const week = blank.minVentRecommendedWeek || 1;
      const minVent = minVentForWeek(detail, week);
      blank.minVentRecommendedWeek = week;
      blank.minVentRecommendedOn = minVent?.on ?? "";
      blank.minVentRecommendedOff = minVent?.off ?? "";
    }
    return blank;
  });
  const [optionPicker, setOptionPicker] = useState<"date" | "week" | null>(null);
  const scrollRef = useRef<ScrollViewType>(null);
  useAutosaveServiceFormDraft(farmId, "placement", form, !existing && !saving);
  useRefreshDraftHouseMetrics(farmId, !existing && !saving, setForm);

  function patch(p: Partial<PlacementForm>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function applyRecommendedWeek(week: number) {
    if (!detail) {
      patch({ minVentRecommendedWeek: week });
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
          title={editing ? "Edit Placement Checklist" : "Placement Checklist"}
          accessibilityLabel="Back to checklists"
          onBack={() => goToServiceFarm(farmId)}
        />

        <Card>
          <TextField label="Farm name" value={form.farmName} onChange={(farmName) => patch({ farmName })} />
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
          <DatePickerField
            label="Date"
            value={form.date}
            expanded={optionPicker === "date"}
            onOpen={() => setOptionPicker("date")}
            onChange={(date) => patch({ date })}
          />
          <TextField
            label="Service tech"
            value={form.serviceTech}
            onChange={(serviceTech) => patch({ serviceTech })}
          />
        </Card>

        <Card style={{ marginTop: 12 }}>
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
          <YesNoField label="All heaters on and operational" value={form.heatersOk} onChange={(heatersOk) => patch({ heatersOk })} />
          <YesNoField label="Sensors at bird level" value={form.sensorsBirdLevelOk} onChange={(sensorsBirdLevelOk) => patch({ sensorsBirdLevelOk })} />
          <MultiToggleField
            label="Vent door type"
            options={VENT_DOOR_OPTIONS}
            value={form.ventDoorTypes}
            onChange={(ventDoorTypes) => patch({ ventDoorTypes })}
          />
          <PairFields
            left={
              <TextField label="S.P." value={form.staticPressure} onChange={(staticPressure) => patch({ staticPressure })} keyboardType="decimal-pad" />
            }
            right={
              <TextField label="Vent opening (in)" value={form.ventOpeningInches} onChange={(ventOpeningInches) => patch({ ventOpeningInches })} keyboardType="decimal-pad" />
            }
          />
          <TextField label={CFM_FT2_MIN_VENT_LABEL} value={form.cfmPerFt2MinVent} onChange={(cfmPerFt2MinVent) => patch({ cfmPerFt2MinVent })} keyboardType="decimal-pad" />
          <TextField label="Size and number of fans" value={form.fansSizeAndCount} onChange={(fansSizeAndCount) => patch({ fansSizeAndCount })} />
          <PairFields
            left={
              <TextField
                label="Min vent actual ON"
                value={form.minVentActualOn}
                onChange={(minVentActualOn) => patch({ minVentActualOn })}
                keyboardType="number-pad"
                placeholder="30"
              />
            }
            right={
              <TextField
                label="Min vent actual OFF"
                value={form.minVentActualOff}
                onChange={(minVentActualOff) => patch({ minVentActualOff })}
                keyboardType="number-pad"
                placeholder="270"
              />
            }
          />
          <SelectField
            label="Recommended min vent week"
            valueLabel={`Week ${form.minVentRecommendedWeek}`}
            onPress={() => setOptionPicker("week")}
          />
          <Text style={[styles.muted, { marginBottom: 8 }]}>
            Recommended:{" "}
            {form.minVentRecommendedOn || form.minVentRecommendedOff
              ? `${form.minVentRecommendedOn} on / ${form.minVentRecommendedOff} off`
              : "—"}
          </Text>
        </Card>

        <SectionTitle title="Litter Temps" />
        <Card style={{ marginBottom: 10 }}>
          <Text style={[styles.muted, { marginBottom: 10, lineHeight: 18 }]}>
            Optional — leave blank for houses not being placed.
          </Text>
          <CompactHouseValueGrid
            houses={form.houses}
            getValue={(n) => form.houses.find((h) => h.houseNumber === n)?.litterTemp ?? ""}
            onChange={(houseNumber, litterTemp) => patchHouse(houseNumber, { litterTemp })}
            placeholder="°F"
          />
        </Card>

        <SectionTitle title="Ammonia PPM" />
        <Card style={{ marginBottom: 10 }}>
          <Text style={[styles.muted, { marginBottom: 10, lineHeight: 18 }]}>
            Optional — leave blank for houses not being placed.
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
          <YesNoField label="Proxy test strip performed" value={form.proxyTestOk} onChange={(proxyTestOk) => patch({ proxyTestOk })} />
          <YesNoField label="Anything currently added to water" value={form.waterAdditive} onChange={(waterAdditive) => patch({ waterAdditive })} />
          <PairFields
            left={<TextField label="PSI before" value={form.psiBefore} onChange={(psiBefore) => patch({ psiBefore })} keyboardType="decimal-pad" />}
            right={<TextField label="PSI after" value={form.psiAfter} onChange={(psiAfter) => patch({ psiAfter })} keyboardType="decimal-pad" />}
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
            right={<TextField label="P.H." value={form.ph} onChange={(ph) => patch({ ph })} keyboardType="decimal-pad" />}
          />

          <SectionTitle title="Space / Sanitation / Emergency" />
          <YesNoField label="Chicks partitioned properly" value={form.partitionedOk} onChange={(partitionedOk) => patch({ partitionedOk })} />
          <YesNoField label="Premise is clean" value={form.premiseCleanOk} onChange={(premiseCleanOk) => patch({ premiseCleanOk })} />
          <YesNoField label="Rodenticide is placed" value={form.rodenticideOk} onChange={(rodenticideOk) => patch({ rodenticideOk })} />
          <YesNoField label="Foot baths utilized" value={form.footBathsOk} onChange={(footBathsOk) => patch({ footBathsOk })} />
          <YesNoField label="Generator is in Auto" value={form.generatorAutoOk} onChange={(generatorAutoOk) => patch({ generatorAutoOk })} />
          <YesNoField label="Dialer alarm is ON" value={form.dialerOnOk} onChange={(dialerOnOk) => patch({ dialerOnOk })} />
          <PairFields
            left={<TextField label="Alarm HI" value={form.alarmHi} onChange={(alarmHi) => patch({ alarmHi })} keyboardType="decimal-pad" />}
            right={<TextField label="Alarm LOW" value={form.alarmLow} onChange={(alarmLow) => patch({ alarmLow })} keyboardType="decimal-pad" />}
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
          scrollRef={scrollRef}
        />

        {completeError ? (
          <Text style={{ color: colors.danger, fontWeight: "700", marginTop: 12 }}>
            {completeError}
          </Text>
        ) : null}
        <Pressable
          disabled={saving}
          onPress={() => complete({ form })}
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

      <OptionPicker
        open={optionPicker === "week"}
        title="Recommended min vent week"
        options={WEEK_OPTIONS}
        value={String(form.minVentRecommendedWeek)}
        onSelect={(v) => applyRecommendedWeek(Number(v))}
        onClose={() => setOptionPicker(null)}
      />
    </SafeAreaView>
  );
}
