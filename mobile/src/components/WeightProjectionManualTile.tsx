import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { catchWeightBandFromLbs } from "../lib/weight/projections";
import { colors, styles } from "../theme";

export function WeightProjectionManualTile({
  onInputFocus,
}: {
  /** Scroll the focused input above the software keyboard. */
  onInputFocus?: () => void;
}) {
  const [weightText, setWeightText] = useState("");
  const weight = Number(weightText);
  const valid = Number.isFinite(weight) && weight >= 0 && weightText.trim() !== "";
  const band = valid ? catchWeightBandFromLbs(weight) : null;

  return (
    <View style={{ gap: 10 }}>
      <View>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>
          Catch weight (lb)
        </Text>
        <TextInput
          value={weightText}
          onChangeText={setWeightText}
          onFocus={onInputFocus}
          keyboardType="decimal-pad"
          style={[styles.input, { maxWidth: 140 }]}
          placeholder="e.g. 6.30"
          placeholderTextColor={colors.muted}
        />
      </View>
      {band ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {band.map((p) => (
            <View
              key={p.key}
              style={{
                flex: 1,
                backgroundColor: "#fafaf9",
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.muted }}>{p.label}</Text>
              <Text
                style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 2 }}
              >
                {p.weightLbs.toFixed(2)} lb
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.muted, { fontSize: 13 }]}>Enter catch weight to calculate</Text>
      )}
    </View>
  );
}
