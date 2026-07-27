import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

export function CopyHouseSummaryButton({ lines }: { lines: string[] }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  if (lines.length === 0) return null;

  return (
    <Pressable
      onPress={async () => {
        await Clipboard.setStringAsync(lines.join("\n"));
        setCopied(true);
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={copied ? "Copied" : "Copy house summary"}
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
        size={20}
        color={copied ? colors.accentDark : colors.muted}
      />
    </Pressable>
  );
}

/** Stacked H1/H2/… summary with copy-to-clipboard. Shows every line (no truncation). */
export function LfoHouseSummaryBlock({
  lines,
  fontSize = 13,
}: {
  lines: string[];
  fontSize?: number;
}) {
  if (lines.length === 0) return null;

  return (
    <View style={{ marginTop: 4, flexShrink: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2, flexShrink: 0 }}>
          {lines.map((line) => (
            <Text
              key={line}
              style={{ fontWeight: "700", color: colors.text, fontSize }}
            >
              {line}
            </Text>
          ))}
        </View>
        <CopyHouseSummaryButton lines={lines} />
      </View>
    </View>
  );
}
