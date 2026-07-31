import { useEffect, useState } from "react";
import { Alert, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

/**
 * Standard copy-to-clipboard control for the mobile app.
 * Always use this component for any new copy action — do not invent a
 * different icon or inline clipboard Pressable.
 * Icon: Ionicons `copy-outline` → `checkmark` while feedback shows.
 * Web equivalent: `src/components/ClipboardIconButton.tsx` (same glyph).
 */
export function ClipboardIconButton({
  getText,
  accessibilityLabel = "Copy",
  emptyMessage = "There is no content to copy yet.",
  color = colors.muted,
  activeColor = colors.accentDark,
  size = 20,
}: {
  getText: () => string | Promise<string>;
  accessibilityLabel?: string;
  emptyMessage?: string;
  color?: string;
  activeColor?: string;
  size?: number;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <Pressable
      onPress={async () => {
        try {
          const text = await getText();
          if (!text.trim()) {
            Alert.alert("Nothing to copy", emptyMessage);
            return;
          }
          const Clipboard = await import("expo-clipboard");
          await Clipboard.setStringAsync(text);
          setCopied(true);
        } catch {
          Alert.alert("Copy failed", "Could not copy to clipboard on this device.");
        }
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={copied ? "Copied" : accessibilityLabel}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons
        name={copied ? "checkmark" : "copy-outline"}
        size={size}
        color={copied ? activeColor : color}
      />
    </Pressable>
  );
}
