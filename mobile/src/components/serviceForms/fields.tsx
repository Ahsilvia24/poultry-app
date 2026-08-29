import { Pressable, Text, TextInput, View, type ScrollView, type TextInputProps } from "react-native";
import { useRef } from "react";
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

export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? colors.accentDark : colors.border,
          backgroundColor: checked ? colors.accentDark : "#fff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? (
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800", lineHeight: 15 }}>✓</Text>
        ) : null}
      </View>
      <Text style={{ flex: 1, fontWeight: "600", color: colors.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
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
  editable = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad" | "numbers-and-punctuation" | "number-pad";
  multiline?: boolean;
  onFocus?: TextInputProps["onFocus"];
  editable?: boolean;
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
        editable={editable}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.input,
          multiline ? { minHeight: 96, paddingTop: 10 } : null,
          !editable ? { backgroundColor: "#f5f5f4" } : null,
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

const compactInputStyle = {
  minHeight: 40,
  borderWidth: 1,
  borderColor: "#d6d3d1",
  borderRadius: 10,
  paddingHorizontal: 10,
  fontSize: 16,
  fontWeight: "700" as const,
  backgroundColor: "#fff",
  color: colors.text,
  textAlign: "center" as const,
};

function CompactCell({
  label,
  value,
  onChange,
  placeholder,
  keyboardType = "default",
  flexBasis = "30%",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
  flexBasis?: `${number}%`;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexShrink: 1,
        flexBasis,
        minWidth: 72,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "800",
          color: colors.muted,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#a8a29e"
        keyboardType={keyboardType}
        style={compactInputStyle}
      />
    </View>
  );
}

/** Dense H1 / H2 / … value grid (same look as Service Report house temps). */
export function CompactHouseValueGrid({
  houses,
  getValue,
  onChange,
  placeholder,
  keyboardType = "decimal-pad",
}: {
  houses: Array<{ houseNumber: number }>;
  getValue: (houseNumber: number) => string;
  onChange: (houseNumber: number, value: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {houses.map((h) => (
        <CompactCell
          key={h.houseNumber}
          label={`H${h.houseNumber}`}
          value={getValue(h.houseNumber)}
          onChange={(v) => onChange(h.houseNumber, v)}
          placeholder={placeholder}
          keyboardType={keyboardType}
        />
      ))}
    </View>
  );
}

/** Heat/Cool on row 1, Stage 1–3 on row 2 — compact temp-grid style. */
export function CompactBackupSettings({
  heat,
  cool,
  stage1,
  stage2,
  stage3,
  onChange,
}: {
  heat: string;
  cool: string;
  stage1: string;
  stage2: string;
  stage3: string;
  onChange: (patch: {
    backupHeat?: string;
    backupCool?: string;
    backupStage1?: string;
    backupStage2?: string;
    backupStage3?: string;
  }) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: "700", marginTop: 4, marginBottom: 2, color: colors.text }}>
        Backup settings
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <CompactCell
          label="Heat"
          value={heat}
          onChange={(backupHeat) => onChange({ backupHeat })}
          flexBasis="48%"
        />
        <CompactCell
          label="Cool"
          value={cool}
          onChange={(backupCool) => onChange({ backupCool })}
          flexBasis="48%"
        />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <CompactCell
          label="Stage 1"
          value={stage1}
          onChange={(backupStage1) => onChange({ backupStage1 })}
        />
        <CompactCell
          label="Stage 2"
          value={stage2}
          onChange={(backupStage2) => onChange({ backupStage2 })}
        />
        <CompactCell
          label="Stage 3"
          value={stage3}
          onChange={(backupStage3) => onChange({ backupStage3 })}
        />
      </View>
    </View>
  );
}

/**
 * Comments block for service checklists. Keeps the "Comments" heading pinned
 * to the top of the scroll view when the notes field is focused (instead of
 * scrollToEnd, which leaves only the bare text box on screen).
 *
 * Must be a direct child of the form ScrollView content for layout.y to work.
 */
export function CommentsField({
  value,
  onChange,
  scrollRef,
}: {
  value: string;
  onChange: (v: string) => void;
  scrollRef: React.RefObject<ScrollView | null>;
}) {
  const sectionY = useRef(0);

  function focusComments() {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, sectionY.current - 8),
        animated: true,
      });
    }, 300);
  }

  return (
    <View
      onLayout={(e) => {
        sectionY.current = e.nativeEvent.layout.y;
      }}
    >
      <View
        style={[
          styles.card,
          { marginBottom: 0, paddingTop: 14, paddingBottom: 14 },
        ]}
      >
        <Text
          style={{
            fontSize: 17,
            fontWeight: "800",
            color: colors.text,
            marginBottom: 10,
          }}
        >
          Comments
        </Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Add comments…"
          placeholderTextColor="#a8a29e"
          multiline
          onFocus={focusComments}
          textAlignVertical="top"
          style={[styles.input, { minHeight: 110, paddingTop: 10, marginBottom: 0 }]}
        />
      </View>
    </View>
  );
}
