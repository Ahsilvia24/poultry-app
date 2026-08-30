import { useEffect, useMemo, useRef, useState } from "react";
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
  CheckField,
  MultiToggleField,
  PairFields,
  SectionTitle,
  TextField,
  YesNoField,
  CommentsField,
  CompactBackupSettings,
} from "../../../../../src/components/serviceForms/fields";
import { TimeScrollPickerField } from "../../../../../src/components/TimeScrollPicker";
import { BackHeader, Card } from "../../../../../src/components/ui";
import { withSavedServiceTech } from "../../../../../src/lib/appSettings";
import { createServiceReportDraft } from "../../../../../src/lib/serviceForms/defaults";
import {
  CFM_FT2_MIN_VENT_LABEL,
  HUMIDITY_OPTIONS,
  MAX_CFM_FT2_POWER_LABEL,
  VENT_DOOR_OPTIONS,
  WEEK_OPTIONS,
  recommendedWeekLabel,
  ventDoorTypesFromPayload,
} from "../../../../../src/lib/serviceForms/format";
import {
  applyLiveHouseMetrics,
  currentFlockWeek,
  flockAgeDaysFromHouses,
  minVentForWeek,
  prefillHouseRows,
} from "../../../../../src/lib/serviceForms/prefill";
import { recommendedHouseTempF } from "../../../../../src/lib/tools";
import type { ServiceReportForm } from "../../../../../src/lib/serviceForms/types";
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

function hydrateReport(payload: ServiceReportForm): ServiceReportForm {
  return {
    ...payload,
    ventDoorTypes: ventDoorTypesFromPayload(payload),
  };
}

export default function ServiceReportScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; fresh?: string | string[] }>();
  const farmId = paramId(params.id);
  const fresh = paramId(params.fresh) === "1";
  const { detail, farmName, flockNumber } = useServiceFarmContext(farmId);
  const existing = useExistingServiceForm(farmId, "service_report");
  const editVisitId = useEditVisitIdParam(farmId);
  const { complete, saving, editing, error: completeError } = useCompleteServiceForm(farmId, {
    serviceFormId: existing?.id ?? null,
    existingVisitId: existing ? null : editVisitId,
  });

  const initial = useMemo(() => {
    if (existing?.payload && typeof existing.payload === "object") {
      return withSavedServiceTech(hydrateReport(existing.payload as ServiceReportForm));
    }
    if (!detail) return createServiceReportDraft({ farmName, flockNumber });
    return createServiceReportDraft({
      farmName: detail.farm.farmName,
      flockNumber: detail.activeFlock?.flockNumber ?? flockNumber,
      houses: prefillHouseRows(detail),
    });
  }, [detail, farmName, flockNumber, existing]);

  const [form, setForm] = useState<ServiceReportForm>(() => {
    if (existing?.payload && typeof existing.payload === "object") {
      return withSavedServiceTech(hydrateReport(existing.payload as ServiceReportForm));
    }
    const draft = readInProgressDraft<ServiceReportForm>(farmId, "service_report", fresh);
    if (draft?.kind === "service_report") {
      const hydrated = withSavedServiceTech(hydrateReport(draft));
      return detail ? applyLiveHouseMetrics(hydrated, detail) : hydrated;
    }
    if (!detail) return initial;
    const week = currentFlockWeek(detail);
    const minVent = minVentForWeek(detail, week);
    return {
      ...initial,
      minVentRecommendedWeek: week,
      minVentRecommendedOn: minVent?.on ?? "",
      minVentRecommendedOff: minVent?.off ?? "",
    };
  });

  const [timePicker, setTimePicker] = useState<"date" | "on" | "off" | null>(null);
  const [optionPicker, setOptionPicker] = useState<"humidity" | "week" | null>(null);
  const scrollRef = useRef<ScrollViewType>(null);
  useAutosaveServiceFormDraft(farmId, "service_report", form, !existing && !saving);
  useRefreshDraftHouseMetrics(farmId, !existing && !saving, setForm);

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
      patch({
        minVentRecommendedWeek: "",
        minVentRecommendedOn: "",
        minVentRecommendedOff: "",
      });
      return;
    }
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
          title={editing ? "Edit Service Report" : "Service Report"}
          accessibilityLabel="Back to checklists"
          onBack={() => goToServiceFarm(farmId)}
        />

        <Card>
          <TextField
            label="Farm name"
            value={form.farmName}
            onChange={(farmName) => patch({ farmName })}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Farm #"
                value={form.farmNumber ?? ""}
                onChange={(farmNumber) => patch({ farmNumber })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Flock #"
                value={form.flockNumber ?? ""}
                onChange={(flockNumber) => patch({ flockNumber })}
              />
            </View>
          </View>
          <DatePickerField
            label="Date"
            value={form.date}
            expanded={timePicker === "date"}
            onOpen={() => setTimePicker("date")}
            onChange={(date) => patch({ date })}
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
          <TimeScrollPickerField
            label="Lights ON at"
            value={form.lightsOnAt}
            expanded={timePicker === "on"}
            onOpen={() => setTimePicker("on")}
            onChange={(lightsOnAt) => patch({ lightsOnAt })}
          />
          <TimeScrollPickerField
            label="Lights OFF at"
            value={form.lightsOffAt}
            expanded={timePicker === "off"}
            onOpen={() => setTimePicker("off")}
            onChange={(lightsOffAt) => patch({ lightsOffAt })}
          />

          <SectionTitle title="Air and Litter" />
          <YesNoField
            label="Temp targets per recommended program"
            value={form.tempTargetsOk}
            onChange={(tempTargetsOk) => patch({ tempTargetsOk })}
          />
          <PairFields
            left={
              <TextField
                label="Set Temp"
                value={form.actualTempTarget}
                onChange={(actualTempTarget) => patch({ actualTempTarget })}
                keyboardType="decimal-pad"
                placeholder="°F"
              />
            }
            right={
              <TextField
                label="Recommended"
                value={form.recommendedTempTarget}
                onChange={() => {}}
                editable={false}
                placeholder="°F"
              />
            }
          />
          <YesNoField
            label="Ammonia < 25 PPM in all houses"
            value={form.ammoniaOk}
            onChange={(ammoniaOk) => patch({ ammoniaOk })}
          />
          <SelectField
            label="Humidity %"
            valueLabel={
              form.humidityPct === "" ? "Blank" : `${form.humidityPct}%`
            }
            onPress={() => setOptionPicker("humidity")}
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
            <TextField
              label="# of tunnel fans"
              value={form.tunnelFanCount}
              onChange={(tunnelFanCount) => patch({ tunnelFanCount })}
              keyboardType="number-pad"
            />
          ) : null}
          <MultiToggleField
            label="Vent door type"
            options={VENT_DOOR_OPTIONS}
            value={form.ventDoorTypes}
            onChange={(ventDoorTypes) => patch({ ventDoorTypes })}
          />
          <PairFields
            left={
              <TextField
                label="S.P."
                value={form.staticPressure}
                onChange={(staticPressure) => patch({ staticPressure })}
                keyboardType="decimal-pad"
                placeholder="0.1"
              />
            }
            right={
              <TextField
                label="Vent opening (in)"
                value={form.ventOpeningInches}
                onChange={(ventOpeningInches) => patch({ ventOpeningInches })}
                keyboardType="decimal-pad"
              />
            }
          />
          <TextField
            label={CFM_FT2_MIN_VENT_LABEL}
            value={form.cfmPerFt2MinVent}
            onChange={(cfmPerFt2MinVent) => patch({ cfmPerFt2MinVent })}
            keyboardType="decimal-pad"
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
            valueLabel={recommendedWeekLabel(form.minVentRecommendedWeek)}
            onPress={() => setOptionPicker("week")}
          />
          <Text style={[styles.muted, { marginBottom: 8 }]}>
            Recommended:{" "}
            {form.minVentRecommendedOn || form.minVentRecommendedOff
              ? `${form.minVentRecommendedOn} on / ${form.minVentRecommendedOff} off`
              : "—"}
          </Text>
          <TextField
            label={MAX_CFM_FT2_POWER_LABEL}
            value={form.maxCfm}
            onChange={(maxCfm) => patch({ maxCfm })}
            keyboardType="decimal-pad"
          />
          <PairFields
            left={
              <TextField
                label="Cool cell OFF temp"
                value={form.coolCellOffTemp}
                onChange={(coolCellOffTemp) => patch({ coolCellOffTemp })}
                keyboardType="decimal-pad"
              />
            }
            right={
              <TextField
                label="Cool cell ON temp"
                value={form.coolCellOnTemp}
                onChange={(coolCellOnTemp) => patch({ coolCellOnTemp })}
                keyboardType="decimal-pad"
              />
            }
          />
          <PairFields
            left={
              <TextField
                label="Cool cell timer ON"
                value={form.coolCellTimerOn}
                onChange={(coolCellTimerOn) => patch({ coolCellTimerOn })}
                keyboardType="number-pad"
                placeholder="15"
              />
            }
            right={
              <TextField
                label="Cool cell timer OFF"
                value={form.coolCellTimerOff}
                onChange={(coolCellTimerOff) => patch({ coolCellTimerOff })}
                keyboardType="number-pad"
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
                keyboardType="decimal-pad"
              />
            }
            right={
              <TextField
                label="PSI after brass"
                value={form.psiAfter}
                onChange={(psiAfter) => patch({ psiAfter })}
                keyboardType="decimal-pad"
              />
            }
          />
          <TextField
            label="P.H."
            value={form.ph}
            onChange={(ph) => patch({ ph })}
            keyboardType="decimal-pad"
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
                keyboardType="decimal-pad"
              />
            }
            right={
              <TextField
                label="Alarm LOW"
                value={form.alarmLow}
                onChange={(alarmLow) => patch({ alarmLow })}
                keyboardType="decimal-pad"
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
        open={optionPicker === "humidity"}
        title="Humidity %"
        options={HUMIDITY_OPTIONS}
        value={form.humidityPct}
        onSelect={(humidityPct) => patch({ humidityPct })}
        onClose={() => setOptionPicker(null)}
      />
      <OptionPicker
        open={optionPicker === "week"}
        title="Recommended min vent week"
        options={WEEK_OPTIONS}
        value={form.minVentRecommendedWeek === "" ? "" : String(form.minVentRecommendedWeek)}
        onSelect={(v) => applyRecommendedWeek(v === "" ? "" : Number(v))}
        onClose={() => setOptionPicker(null)}
      />
    </SafeAreaView>
  );
}
