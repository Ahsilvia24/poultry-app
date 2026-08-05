import { useMemo, useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { OptionPicker, SelectField } from "../../../../../src/components/OptionPicker";
import {
  MultiToggleField,
  PairFields,
  SectionTitle,
  TextField,
  YesNoField,
  CommentsField,
  CompactBackupSettings,
  CompactHouseValueGrid,
  FarmNameDateRow,
} from "../../../../../src/components/serviceForms/fields";
import { TimeScrollPickerField } from "../../../../../src/components/TimeScrollPicker";
import { Card } from "../../../../../src/components/ui";
import { createServiceReportDraft } from "../../../../../src/lib/serviceForms/defaults";
import {
  HUMIDITY_OPTIONS,
  normalizeVentDoorTypes,
  WEEK_OPTIONS,
} from "../../../../../src/lib/serviceForms/format";
import {
  currentFlockWeek,
  house1TotalCfm,
  minVentForWeek,
  prefillHouseRows,
} from "../../../../../src/lib/serviceForms/prefill";
import type { ServiceReportForm } from "../../../../../src/lib/serviceForms/types";
import {
  useCompleteServiceForm,
  useEditVisitIdParam,
  useExistingServiceForm,
  useServiceFarmContext,
} from "../../../../../src/lib/serviceForms/useServiceFarm";
import { colors, styles } from "../../../../../src/theme";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function ServiceReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const { detail, farmName, flockNumber } = useServiceFarmContext(farmId);
  const existing = useExistingServiceForm(farmId, "service_report");
  const editVisitId = useEditVisitIdParam();
  const { complete, saving, editing } = useCompleteServiceForm(
    farmId,
    "service_report",
    {
      serviceFormId: existing?.id ?? null,
      existingVisitId: existing ? null : editVisitId,
    },
  );

  const initial = useMemo(() => {
    if (existing?.payload && typeof existing.payload === "object") {
      const payload = existing.payload as ServiceReportForm;
      return {
        ...payload,
        ventDoorTypes: normalizeVentDoorTypes(payload),
      };
    }
    if (!detail) return createServiceReportDraft({ farmName, flockNumber });
    return createServiceReportDraft({
      farmName: detail.farm.farmName,
      flockNumber: detail.activeFlock?.flockNumber ?? flockNumber,
      houses: prefillHouseRows(detail),
      serviceTech: "",
    });
  }, [detail, farmName, flockNumber, existing]);

  const [form, setForm] = useState<ServiceReportForm>(() => {
    if (existing?.payload && typeof existing.payload === "object") {
      const payload = existing.payload as ServiceReportForm;
      return {
        ...payload,
        ventDoorTypes: normalizeVentDoorTypes(payload),
      };
    }
    if (!detail) return initial;
    const week = currentFlockWeek(detail);
    const minVent = minVentForWeek(detail, week);
    return {
      ...initial,
      maxCfm: house1TotalCfm(detail),
      minVentRecommendedWeek: week,
      minVentRecommendedOn: minVent?.on ?? "",
      minVentRecommendedOff: minVent?.off ?? "",
    };
  });

  const [humidityOpen, setHumidityOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const scrollRef = useRef<ScrollViewType>(null);
  const lights247 = form.lightsOnAt === "24/7";

  function patch(p: Partial<ServiceReportForm>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function patchHouse(houseNumber: number, p: Partial<ServiceReportForm["houses"][number]>) {
    setForm((prev) => ({
      ...prev,
      houses: prev.houses.map((h) =>
        h.houseNumber === houseNumber ? { ...h, ...p } : h,
      ),
    }));
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
        automaticallyAdjustKeyboardInsets
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else
              router.replace({
                pathname: "/(tabs)/farms/[id]/service",
                params: { id: farmId },
              });
          }}
          style={{
            flexShrink: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            marginBottom: 4,
          }}
          accessibilityRole="button"
          accessibilityLabel="Back to checklists"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} style={{ marginRight: -4 }} />
          <Text style={styles.title}>Service</Text>
        </Pressable>
        <Text style={[styles.title, { marginBottom: 4 }]}>
          {editing ? "Edit Service Report" : "Service Report"}
        </Text>
        <Text style={[styles.subtitle, { marginBottom: 16 }]}>{farmName}</Text>

        <Card>
          <FarmNameDateRow
            farmName={form.farmName}
            onFarmNameChange={(farmName) => patch({ farmName })}
            date={form.date}
            onDateChange={(date) => patch({ date })}
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
          <TextField
            label="Service tech"
            value={form.serviceTech}
            onChange={(serviceTech) => patch({ serviceTech })}
          />
        </Card>

        <SectionTitle title="House temps" />
        <Card style={{ marginBottom: 10 }}>
          <Text style={[styles.muted, { marginBottom: 10, lineHeight: 18 }]}>
            Prefills from today’s Log Temp on each house tile (resets at midnight). Age, placed,
            and weekly mortality still pull into the PDF automatically.
          </Text>
          <CompactHouseValueGrid
            houses={form.houses}
            getValue={(n) => form.houses.find((h) => h.houseNumber === n)?.currentTemp ?? ""}
            onChange={(houseNumber, currentTemp) => patchHouse(houseNumber, { currentTemp })}
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ flex: 1, fontWeight: "600", color: colors.text, fontSize: 14 }}>
                Lights ON at
              </Text>
              <Text style={{ fontWeight: "800", color: colors.text, fontSize: 16 }}>24/7</Text>
            </View>
          ) : (
            <PairFields
              left={
                <TimeScrollPickerField
                  label="Lights ON at"
                  value={form.lightsOnAt}
                  onChange={(lightsOnAt) => patch({ lightsOnAt })}
                />
              }
              right={
                <TimeScrollPickerField
                  label="Lights OFF at"
                  value={form.lightsOffAt}
                  onChange={(lightsOffAt) => patch({ lightsOffAt })}
                />
              }
            />
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
                  keyboardType="decimal-pad"
                />
              }
              right={
                <TextField
                  label="Recommended target"
                  value={form.recommendedTempTarget}
                  onChange={(recommendedTempTarget) => patch({ recommendedTempTarget })}
                  keyboardType="decimal-pad"
                />
              }
            />
          ) : null}
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
            onPress={() => setHumidityOpen(true)}
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
            label="C.F.M. / Ft² min vent"
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
            valueLabel={`Week ${form.minVentRecommendedWeek}`}
            onPress={() => setWeekOpen(true)}
          />
          <Text style={[styles.muted, { marginBottom: 8 }]}>
            Recommended:{" "}
            {form.minVentRecommendedOn || form.minVentRecommendedOff
              ? `${form.minVentRecommendedOn} on / ${form.minVentRecommendedOff} off`
              : "—"}
          </Text>
          <TextField
            label="Max CFM (House 1 Total CFM)"
            value={form.maxCfm}
            onChange={(maxCfm) => patch({ maxCfm })}
            keyboardType="number-pad"
          />
          <PairFields
            left={
              <TextField
                label="Cool cell OFF temp"
                value={form.coolCellOffTemp}
                onChange={(coolCellOffTemp) => patch({ coolCellOffTemp })}
                keyboardType="number-pad"
              />
            }
            right={
              <TextField
                label="Cool cell ON temp"
                value={form.coolCellOnTemp}
                onChange={(coolCellOnTemp) => patch({ coolCellOnTemp })}
                keyboardType="number-pad"
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
                keyboardType="number-pad"
              />
            }
            right={
              <TextField
                label="Alarm LOW"
                value={form.alarmLow}
                onChange={(alarmLow) => patch({ alarmLow })}
                keyboardType="number-pad"
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
        open={humidityOpen}
        title="Humidity %"
        options={HUMIDITY_OPTIONS}
        value={form.humidityPct}
        onSelect={(humidityPct) => patch({ humidityPct })}
        onClose={() => setHumidityOpen(false)}
      />
      <OptionPicker
        open={weekOpen}
        title="Recommended min vent week"
        options={WEEK_OPTIONS}
        value={String(form.minVentRecommendedWeek)}
        onSelect={(v) => applyRecommendedWeek(Number(v))}
        onClose={() => setWeekOpen(false)}
      />
    </SafeAreaView>
  );
}
