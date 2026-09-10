import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

export function SharePdfIconButton({
  onPress,
  accessibilityLabel = "Share PDF",
  color = colors.muted,
  size = 20,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
  color?: string;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="share-outline" size={size} color={color} />
    </Pressable>
  );
}
