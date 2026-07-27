import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

const keyStyle = {
  flex: 1,
  minHeight: 48,
  borderRadius: 10,
  backgroundColor: "#fff",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const keyText = {
  fontSize: 22,
  fontWeight: "700" as const,
  color: colors.text,
};

export function NumberKeypad({
  onDigit,
  onBackspace,
  onEnter,
  allowDecimal = false,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  allowDecimal?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: "#e7e5e4",
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
        gap: 8,
      }}
    >
      {[0, 1, 2].map((row) => (
        <View key={row} style={{ flexDirection: "row", gap: 8 }}>
          {keys.slice(row * 3, row * 3 + 3).map((d) => (
            <Pressable key={d} onPress={() => onDigit(d)} style={keyStyle}>
              <Text style={keyText}>{d}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={onBackspace}
          style={[keyStyle, { backgroundColor: "#d6d3d1" }]}
        >
          <Text style={keyText}>⌫</Text>
        </Pressable>
        <Pressable onPress={() => onDigit("0")} style={keyStyle}>
          <Text style={keyText}>0</Text>
        </Pressable>
        {allowDecimal ? (
          <Pressable onPress={() => onDigit(".")} style={keyStyle}>
            <Text style={keyText}>.</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onEnter}
          style={[keyStyle, { backgroundColor: colors.accentDark }]}
        >
          <Text style={[keyText, { color: "#fff" }]}>Enter</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Append a digit/decimal to a numeric string field (custom keypad). */
export function appendKeypadDigit(current: string, digit: string, allowDecimal: boolean) {
  if (digit === ".") {
    if (!allowDecimal || current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  // Fresh entry replaces a lone "0"
  if (current === "0" && digit !== ".") return digit;
  return `${current}${digit}`;
}

export function backspaceKeypadValue(current: string) {
  return current.slice(0, -1);
}
