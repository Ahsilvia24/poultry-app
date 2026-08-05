import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../theme";

export function OptionPicker({
  open,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 16,
            maxHeight: "70%",
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "800", marginBottom: 8 }}>{title}</Text>
          <ScrollView>
            {options.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  onSelect(opt.value);
                  onClose();
                }}
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: "#f5f5f4",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontWeight: value === opt.value ? "800" : "600",
                    color: colors.text,
                  }}
                >
                  {opt.label}
                </Text>
                {value === opt.value ? (
                  <Ionicons name="checkmark" size={18} color={colors.accentDark} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SelectField({
  label,
  valueLabel,
  onPress,
  compact,
  style,
}: {
  label: string;
  valueLabel: string;
  onPress: () => void;
  compact?: boolean;
  style?: object;
}) {
  return (
    <View style={[{ marginTop: compact ? 0 : 8 }, style]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={[
          styles.input,
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: compact ? 44 : 52,
          },
        ]}
      >
        <Text
          style={{ color: colors.text, fontWeight: "600", flexShrink: 1 }}
          numberOfLines={1}
        >
          {valueLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}
