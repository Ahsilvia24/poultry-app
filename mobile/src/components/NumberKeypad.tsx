import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../theme";

const keyStyle = {
  flex: 1,
  minHeight: 48,
  borderRadius: 10,
  backgroundColor: "#fff",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const keyText = {
  fontFamily: fonts.sans,
  fontSize: 22,
  fontWeight: "700" as const,
  color: colors.text,
};

export function NumberKeypad({
  onDigit,
  onBackspace,
  onEnter,
  allowDecimal = false,
  allowTripleZero = false,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  allowDecimal?: boolean;
  /** When true (and decimal is off), show a 000 key instead of a blank slot. */
  allowTripleZero?: boolean;
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
        ) : allowTripleZero ? (
          <Pressable onPress={() => onDigit("000")} style={keyStyle}>
            <Text style={[keyText, { fontSize: 18 }]}>000</Text>
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

/** Append a digit/decimal/000 to a numeric string field (custom keypad). */
export function appendKeypadDigit(current: string, digit: string, allowDecimal: boolean) {
  if (digit === ".") {
    if (!allowDecimal || current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  if (digit === "000") {
    if (current === "" || current === "0") return "000";
    return `${current}000`;
  }
  // Fresh entry replaces a lone "0"
  if (current === "0") return digit;
  return `${current}${digit}`;
}

export function backspaceKeypadValue(current: string) {
  return current.slice(0, -1);
}
