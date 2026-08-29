import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

/**
 * Standard copy-to-clipboard control for the mobile app.
 * Always use this (Ionicons `copy-outline` → `checkmark`) for new copy actions.
 * Failures stay visible on the icon — RN Web's Alert.alert is a no-op.
 */
export function ClipboardIconButton({
  getText,
  accessibilityLabel = "Copy",
  emptyMessage = "There is no content to copy yet.",
  color = colors.muted,
  activeColor = colors.accentDark,
  size = 20,
  onNotice,
}: {
  getText: () => string | Promise<string>;
  accessibilityLabel?: string;
  emptyMessage?: string;
  color?: string;
  activeColor?: string;
  size?: number;
  onNotice?: (message: string | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const onNoticeRef = useRef(onNotice);
  onNoticeRef.current = onNotice;

  useEffect(() => {
    if (!copied && !failed) return;
    const t = setTimeout(() => {
      setCopied(false);
      setFailed(false);
      onNoticeRef.current?.(null);
    }, 2200);
    return () => clearTimeout(t);
  }, [copied, failed]);

  return (
    <View>
      <Pressable
        onPress={async () => {
          try {
            const text = await getText();
            if (!text.trim()) {
              setCopied(false);
              setFailed(true);
              onNotice?.(emptyMessage);
              return;
            }
            const Clipboard = await import("expo-clipboard");
            await Clipboard.setStringAsync(text);
            setFailed(false);
            setCopied(true);
            onNotice?.(null);
          } catch {
            setCopied(false);
            setFailed(true);
            onNotice?.("Could not copy to clipboard on this device.");
          }
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          copied ? "Copied" : failed ? "Copy failed" : accessibilityLabel
        }
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={copied ? "checkmark" : failed ? "alert-circle-outline" : "copy-outline"}
          size={size}
          color={copied ? activeColor : failed ? colors.danger : color}
        />
      </Pressable>
    </View>
  );
}
