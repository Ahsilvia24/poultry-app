import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../theme";
import { todayKey } from "../lib/ids";

/** "2026-07-26" → "Wed, Jul 26, 2026" */
export function formatDisplayDate(dateKey: string) {
  if (!dateKey) return "Select date";
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseDateKey(dateKey: string): Date {
  if (!dateKey) {
    const [y, m, d] = todayKey().split("-").map(Number);
    return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  }
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (dateKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseDateKey(value));

  function openPicker() {
    setDraft(parseDateKey(value || todayKey()));
    setOpen(true);
  }

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && selected) onChange(toDateKey(selected));
      return;
    }
    if (selected) setDraft(selected);
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openPicker}
        style={[
          styles.input,
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
        ]}
      >
        <Text
          style={{
            fontWeight: "700",
            color: value ? colors.text : colors.muted,
            fontSize: 16,
          }}
        >
          {formatDisplayDate(value)}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={colors.muted} />
      </Pressable>

      {Platform.OS === "android" && open ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="calendar"
          onChange={onPickerChange}
        />
      ) : null}

      {Platform.OS === "ios" && open ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setOpen(false)}>
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
            onPress={() => setOpen(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                paddingBottom: 24,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Pressable onPress={() => setOpen(false)}>
                  <Text style={{ fontWeight: "700", color: colors.muted }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onChange(toDateKey(draft));
                    setOpen(false);
                  }}
                >
                  <Text style={{ fontWeight: "800", color: colors.accentDark }}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                onChange={onPickerChange}
                style={{ alignSelf: "center" }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
