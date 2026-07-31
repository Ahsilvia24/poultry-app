import { Alert, Pressable, Text } from "react-native";
import { getFarmDetail } from "../../repos/data";
import {
  house1FlockNumber,
  house1TotalCfm,
  mergeLiveHouseRows,
  minVentForWeek,
} from "../../lib/serviceForms/prefill";
import type {
  AnyServiceForm,
  PlacementForm,
  PrebroodForm,
  ServiceReportForm,
} from "../../lib/serviceForms/types";
import { colors } from "../../theme";

function pullIntoForm(farmId: string, form: AnyServiceForm): AnyServiceForm | null {
  let detail: ReturnType<typeof getFarmDetail>;
  try {
    detail = getFarmDetail(farmId);
  } catch {
    return null;
  }

  const houses = mergeLiveHouseRows(detail, form.houses);
  // Header flock field: house 1 only — never the joined "12 · 13 · 14" list.
  const flockNumber = house1FlockNumber(detail) || form.flockNumber;

  if (form.kind === "service_report") {
    const week = form.minVentRecommendedWeek || 1;
    const minVent = minVentForWeek(detail, week);
    const next: ServiceReportForm = {
      ...form,
      farmName: detail.farm.farmName || form.farmName,
      flockNumber,
      houses,
      maxCfm: house1TotalCfm(detail) || form.maxCfm,
      minVentRecommendedOn: minVent?.on ?? form.minVentRecommendedOn,
      minVentRecommendedOff: minVent?.off ?? form.minVentRecommendedOff,
    };
    return next;
  }

  if (form.kind === "placement") {
    const week = form.minVentRecommendedWeek || 1;
    const minVent = minVentForWeek(detail, week);
    const next: PlacementForm = {
      ...form,
      farmName: detail.farm.farmName || form.farmName,
      flockNumber,
      houses,
      minVentRecommendedOn: minVent?.on ?? form.minVentRecommendedOn,
      minVentRecommendedOff: minVent?.off ?? form.minVentRecommendedOff,
    };
    return next;
  }

  const next: PrebroodForm = {
    ...form,
    farmName: detail.farm.farmName || form.farmName,
    flockNumber,
    houses,
  };
  return next;
}

/**
 * Shown while editing a saved Service Report / Placement / Prebrood form.
 * Reloads live farm fields (temps, age, mortality, flock) without wiping checklist answers.
 */
export function PullFarmDataButton({
  farmId,
  form,
  onPulled,
}: {
  farmId: string;
  form: AnyServiceForm;
  onPulled: (next: AnyServiceForm) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        const next = pullIntoForm(farmId, form);
        if (!next) {
          Alert.alert("Could not pull data", "Farm data is unavailable right now.");
          return;
        }
        onPulled(next);
        Alert.alert(
          "Farm data pulled",
          "Updated house age, mortality, temps, and flock info from the farm. Checklist answers were left as-is.",
        );
      }}
      accessibilityRole="button"
      accessibilityLabel="Pull farm data"
      style={{
        alignSelf: "flex-start",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.accentDark,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ color: colors.accentDark, fontWeight: "800", fontSize: 14 }}>
        Pull farm data
      </Text>
    </Pressable>
  );
}
