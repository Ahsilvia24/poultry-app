import { Pressable, Text, View, type View as ViewType } from "react-native";
import { consumptionRateFromWater } from "../lib/lfo/consumptionRate";
import { colors, fonts, styles } from "../theme";
import { Card } from "./ui";

function formatNum(n: number, digits = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function LineValue({
  label,
  value,
  display,
  active,
  onPress,
  fieldRef,
}: {
  label: string;
  value: string;
  display: string;
  active: boolean;
  onPress: () => void;
  fieldRef?: (node: ViewType | null) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${label}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ alignSelf: "flex-start", paddingVertical: 4 }}
    >
      <View ref={fieldRef} collapsable={false}>
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 16,
            fontWeight: "600",
            color: colors.text,
          }}
        >
          {label}:{" "}
          <Text
            style={{
              fontWeight: "800",
              textDecorationLine: "underline",
              color: active ? colors.accentDark : colors.text,
            }}
          >
            {active ? value || " " : display}
          </Text>
        </Text>
      </View>
    </Pressable>
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
  const waterDisplay = waterGal.trim()
    ? Number(waterGal).toLocaleString()
    : "—";
  const headDisplay = headCount.trim()
    ? Number(headCount).toLocaleString()
    : "—";

  return (
    <Card style={style}>
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 8 }}>
        Consumption Rate Calculator
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <LineValue
            label="Daily Water (gal)"
            value={waterGal}
            display={waterDisplay}
            active={waterActive}
            onPress={onFocusWater}
            fieldRef={waterRef}
          />
          <LineValue
            label="Cur. Head Count"
            value={headCount}
            display={headDisplay}
            active={headActive}
            onPress={onFocusHead}
            fieldRef={headRef}
          />
          {result ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 16,
                fontWeight: "800",
                color: colors.text,
                marginTop: 8,
              }}
            >
              Consumption Rate: {formatNum(result.rate, 2)} lb/bird/day
            </Text>
          ) : (
            <Text style={[styles.muted, { marginTop: 8 }]}>
              Enter water and head count to calculate.
            </Text>
          )}
        </View>
        {result ? (
          <View style={{ alignItems: "flex-end", paddingTop: 4, gap: 4 }}>
            <Text style={styles.muted}>WC {formatNum(result.wc, 1)} lbs/day</Text>
            <Text style={styles.muted}>FC {formatNum(result.fc, 1)} lbs/day</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
