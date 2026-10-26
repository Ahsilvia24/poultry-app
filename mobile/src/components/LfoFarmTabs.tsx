import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { OptionPicker } from "./OptionPicker";

export const MANUAL_LFO_TAB_ID = "__manual__";

export function LfoFarmTabs({
  farms,
  selectedId,
  onSelect,
}: {
  farms: Array<{ id: string; farmName: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = [
    { value: MANUAL_LFO_TAB_ID, label: "Quick Calc." },
    ...farms.map((farm) => ({ value: farm.id, label: farm.farmName })),
  ];
  const label = options.find((option) => option.value === selectedId)?.label ?? "Quick Calc.";

  return (
    <View style={{ marginBottom: 10 }}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Last feed order, ${label}`}
        style={{
          height: 36,
          borderRadius: 8,
          backgroundColor: "#e7e5e4",
          paddingHorizontal: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: 15, fontWeight: "600", color: "#1c1917" }}
        >
          {label}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#78716c" />
      </Pressable>
      <OptionPicker
        open={open}
        title="Last Feed Order"
        options={options}
        value={selectedId}
        onSelect={onSelect}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
