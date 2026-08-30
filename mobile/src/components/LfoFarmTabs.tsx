import { ScrollView } from "react-native";
import { Chip } from "./ui";

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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 10 }}
      contentContainerStyle={{ flexDirection: "row", alignItems: "center", paddingRight: 8 }}
    >
      <Chip
        label="Quick Calc."
        active={selectedId === MANUAL_LFO_TAB_ID}
        onPress={() => onSelect(MANUAL_LFO_TAB_ID)}
      />
      {farms.map((f) => (
        <Chip
          key={f.id}
          label={f.farmName}
          active={selectedId === f.id}
          onPress={() => onSelect(f.id)}
        />
      ))}
    </ScrollView>
  );
}
