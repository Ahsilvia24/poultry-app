import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, styles } from "../../theme";
import type { YesNo } from "../../lib/serviceForms/types";

export function SectionTitle({ title }: { title: string }) {
  return (
    <Text
      style={{
        marginTop: 16,
        marginBottom: 8,
        fontSize: 15,
        fontWeight: "800",
        color: colors.text,
      }}
    >
      {title}
    </Text>
  );
}

export function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: YesNo;
  onChange: (v: YesNo) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ flex: 1, fontWeight: "600", color: colors.text, fontSize: 14 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {(["yes", "no"] as const).map((opt) => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={{
                minWidth: 48,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: active
                  ? opt === "yes"
                    ? colors.accentDark
                    : "#9a3412"
                  : "#f5f5f4",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: 12,
                  color: active ? "#fff" : colors.text,
                }}
              >
                {opt === "yes" ? "YES" : "NO"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Multi-select chip row (same visual language as Yes/No). Tap again to clear. */
export function MultiToggleField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ flex: 1, fontWeight: "600", color: colors.text, fontSize: 14 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {options.map((opt) => {
          const active = value.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                if (active) onChange(value.filter((v) => v !== opt.value));
                else onChange([...value, opt.value]);
              }}
              style={{
                minWidth: 48,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: active ? colors.accentDark : "#f5f5f4",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: 12,
                  color: active ? "#fff" : colors.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType = "default",
  multiline,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad" | "numbers-and-punctuation" | "number-pad";
  multiline?: boolean;
  onFocus?: TextInputProps["onFocus"];
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 4 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#a8a29e"
        keyboardType={keyboardType}
        multiline={multiline}
        onFocus={onFocus}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.input,
          multiline ? { minHeight: 96, paddingTop: 10 } : null,
        ]}
      />
    </View>
  );
}

export function PairFields({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}>{left}</View>
      <View style={{ flex: 1 }}>{right}</View>
    </View>
  );
}
