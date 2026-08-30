import { Pressable, Text, View, type View as ViewType } from "react-native";
import { colors, fonts, styles } from "../theme";
import { Card } from "./ui";

/** Gallons of water → lbs (approx). Matches web calculator. */
const LBS_PER_GALLON = 8.34;
/** Water:feed weight ratio used to back into feed. */
const WATER_TO_FEED_RATIO = 1.9;

export const DEFAULT_WATER_GAL = "2500";
export const DEFAULT_HEAD_COUNT = "24360";

export function consumptionRateFromWater(
  waterGal: string,
  headCount: string,
): { wc: number; fc: number; rate: number } | null {
  if (!waterGal.trim() || !headCount.trim()) return null;
  const water = Number(waterGal);
  const heads = Number(headCount);
  if (!Number.isFinite(water) || water <= 0 || !Number.isFinite(heads) || heads <= 0) {
    return null;
  }
  const wc = water * LBS_PER_GALLON;
  const fc = wc / WATER_TO_FEED_RATIO;
  return { wc, fc, rate: fc / heads };
}

function formatNum(n: number, digits = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function CalcFieldButton({
  label,
  value,
  placeholder,
  active,
  onPress,
  fieldRef,
}: {
  label: string;
  value: string;
  placeholder: string;
  active: boolean;
  onPress: () => void;
  fieldRef?: (node: ViewType | null) => void;
}) {
  const showPlaceholder = !value;
  return (
    <View ref={fieldRef} collapsable={false} style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={{
          minHeight: 48,
          borderWidth: active ? 2 : 1,
          borderColor: active ? colors.accentDark : "#d6d3d1",
          borderRadius: 12,
          paddingHorizontal: 14,
          backgroundColor: "#fff",
          marginBottom: 12,
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 16,
            lineHeight: 20,
            fontWeight: "600",
            color: showPlaceholder ? "rgba(120,113,108,0.55)" : colors.text,
          }}
          numberOfLines={1}
        >
          {showPlaceholder ? placeholder : value}
        </Text>
      </Pressable>
    </View>
  );
}

export function ConsumptionRateCalculator({
  waterGal,
  headCount,
  waterActive,
  headActive,
  onFocusWater,
  onFocusHead,
  waterRef,
  headRef,
  style,
}: {
  waterGal: string;
  headCount: string;
  waterActive: boolean;
  headActive: boolean;
  onFocusWater: () => void;
  onFocusHead: () => void;
  waterRef?: (node: ViewType | null) => void;
  headRef?: (node: ViewType | null) => void;
  style?: object;
}) {
  const result = consumptionRateFromWater(waterGal, headCount);
  return (
    <Card style={style}>
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 12 }}>
        Consumption Rate Calculator
      </Text>
      <View style={styles.row}>
        <CalcFieldButton
          label="Daily water (gal)"
          value={waterGal}
          placeholder=""
          active={waterActive}
          onPress={onFocusWater}
          fieldRef={waterRef}
        />
        <CalcFieldButton
          label="Current head count"
          value={headCount}
          placeholder=""
          active={headActive}
          onPress={onFocusHead}
          fieldRef={headRef}
        />
      </View>
      {result ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
            <Text style={styles.muted}>WC (water lbs)</Text>
            <Text style={{ fontWeight: "600" }}>{formatNum(result.wc, 1)} lbs</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
            <Text style={styles.muted}>FC (feed / day)</Text>
            <Text style={{ fontWeight: "600" }}>{formatNum(result.fc, 1)} lbs</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
            <Text style={styles.muted}>Consumption rate</Text>
            <Text style={{ fontWeight: "800" }}>{formatNum(result.rate, 3)} lbs/bird/day</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.muted}>Enter water and head count to calculate.</Text>
      )}
    </Card>
  );
}
