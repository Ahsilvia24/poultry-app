import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

/**
 * Compact Apple-style stepper: selected value only, up/down arrows on the right.
 */
export function WheelPicker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[index] ?? options[0];
  const last = options.length - 1;
  const canUp = index > 0;
  const canDown = index < last;

  function step(delta: number) {
    const next = index + delta;
    if (next < 0 || next > last) return;
    const option = options[next];
    if (option) onChange(option.value);
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 36,
      }}
    >
      <Text
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 17,
          fontWeight: "600",
          color: colors.text,
        }}
        numberOfLines={1}
      >
        {selected?.label ?? ""}
      </Text>
      <View style={{ marginLeft: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous option"
          disabled={!canUp}
          onPress={() => step(-1)}
          hitSlop={{ top: 6, bottom: 2, left: 8, right: 8 }}
          style={{ alignItems: "center", justifyContent: "center", height: 18 }}
        >
          <Ionicons
            name="chevron-up"
            size={16}
            color={canUp ? colors.text : "#d6d3d1"}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next option"
          disabled={!canDown}
          onPress={() => step(1)}
          hitSlop={{ top: 2, bottom: 6, left: 8, right: 8 }}
          style={{ alignItems: "center", justifyContent: "center", height: 18 }}
        >
          <Ionicons
            name="chevron-down"
            size={16}
            color={canDown ? colors.text : "#d6d3d1"}
          />
        </Pressable>
      </View>
    </View>
  );
}
