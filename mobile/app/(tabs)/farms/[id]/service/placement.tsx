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
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { DatePickerField } from "../../../../../src/components/DatePickerField";
import { OptionPicker, SelectField } from "../../../../../src/components/OptionPicker";
import {
  PairFields,
  SectionTitle,
  TextField,
  YesNoField,
  CommentsField,
  CompactHouseValueGrid,
  CompactBackupSettings,
} from "../../../../../src/components/serviceForms/fields";
import { Card } from "../../../../../src/components/ui";
import { createPlacementDraft } from "../../../../../src/lib/serviceForms/defaults";
import {
  VENT_DOOR_OPTIONS,
  WEEK_OPTIONS,
} from "../../../../../src/lib/serviceForms/format";
import {
  minVentForWeek,
  prefillHouseRows,
} from "../../../../../src/lib/serviceForms/prefill";
import type { PlacementForm } from "../../../../../src/lib/serviceForms/types";
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

export default function PlacementChecklistScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const { detail, farmName, firstFlockNumber } = useServiceFarmContext(farmId);
  const existing = useExistingServiceForm(farmId, "placement");
  const editVisitId = useEditVisitIdParam();
  const { complete, saving, editing } = useCompleteServiceForm(farmId, {
    serviceFormId: existing?.id ?? null,
    existingVisitId: existing ? null : editVisitId,
  });

  const [form, setForm] = useState<PlacementForm>(() => {
    if (existing?.payload && typeof existing.payload === "object") {
      return existing.payload as PlacementForm;
    }
    const draft = createPlacementDraft({
      farmName,
      flockNumber: firstFlockNumber,
      houses: detail ? prefillHouseRows(detail) : [],
    });
    if (detail) {
      const week = draft.minVentRecommendedWeek || 1;
      const minVent = minVentForWeek(detail, week);
      draft.minVentRecommendedWeek = week;
      draft.minVentRecommendedOn = minVent?.on ?? "";
      draft.minVentRecommendedOff = minVent?.off ?? "";
    }
    return draft;
  });
  const [ventDoorOpen, setVentDoorOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const scrollRef = useRef<ScrollViewType>(null);

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
          {editing ? "Edit Placement Checklist" : "Placement Checklist"}
        </Text>
        <Text style={[styles.subtitle, { marginBottom: 16 }]}>{farmName}</Text>

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
            onChange={(date) => patch({ date })}
            compact
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

          <SectionTitle title="Air and litter" />
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
          <SelectField
            label="Vent door type"
            valueLabel={VENT_DOOR_OPTIONS.find((o) => o.value === form.ventDoorType)?.label ?? "Select"}
            onPress={() => setVentDoorOpen(true)}
          />
          <PairFields
            left={
              <TextField label="S.P." value={form.staticPressure} onChange={(staticPressure) => patch({ staticPressure })} keyboardType="decimal-pad" />
            }
            right={
              <TextField label="Vent opening (in)" value={form.ventOpeningInches} onChange={(ventOpeningInches) => patch({ ventOpeningInches })} keyboardType="decimal-pad" />
            }
          />
          <TextField label="C.F.M. / Ft² min vent" value={form.cfmPerFt2MinVent} onChange={(cfmPerFt2MinVent) => patch({ cfmPerFt2MinVent })} keyboardType="decimal-pad" />
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
            onPress={() => setWeekOpen(true)}
          />
          <Text style={[styles.muted, { marginBottom: 8 }]}>
            Recommended:{" "}
            {form.minVentRecommendedOn || form.minVentRecommendedOff
              ? `${form.minVentRecommendedOn} on / ${form.minVentRecommendedOff} off`
              : "—"}
          </Text>
        </Card>

        <SectionTitle title="Litter temps" />
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
            left={<TextField label="Alarm HI" value={form.alarmHi} onChange={(alarmHi) => patch({ alarmHi })} keyboardType="number-pad" />}
            right={<TextField label="Alarm LOW" value={form.alarmLow} onChange={(alarmLow) => patch({ alarmLow })} keyboardType="number-pad" />}
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
        open={ventDoorOpen}
        title="Vent door type"
        options={VENT_DOOR_OPTIONS}
        value={form.ventDoorType}
        onSelect={(ventDoorType) =>
          patch({ ventDoorType: ventDoorType as PlacementForm["ventDoorType"] })
        }
        onClose={() => setVentDoorOpen(false)}
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
