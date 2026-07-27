import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../theme";
import { todayKey } from "../lib/ids";

/** "2026-07-26" → "July 26, 2026" */
export function formatDisplayDate(dateKey: string) {
  if (!dateKey) return "Select date";
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return dt.toLocaleDateString(undefined, {
    month: "long",
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
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  if (!Number.isFinite(dt.getTime())) {
    const [ty, tm, td] = todayKey().split("-").map(Number);
    return new Date(ty!, (tm ?? 1) - 1, td ?? 1, 12, 0, 0, 0);
  }
  return dt;
}

function safePickerDate(d: Date): Date {
  return Number.isFinite(d.getTime()) ? d : parseDateKey(todayKey());
}

function toDateKey(d: Date) {
  const safe = safePickerDate(d);
  return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, "0")}-${String(safe.getDate()).padStart(2, "0")}`;
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

  const draftKey = toDateKey(draft);
  const pickerValue = safePickerDate(draft);

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
          value={pickerValue}
          mode="date"
          display="calendar"
          onChange={onPickerChange}
        />
      ) : null}

      {Platform.OS !== "android" && open ? (
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
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <Text style={{ fontWeight: "700", color: colors.muted }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onChange(draftKey);
                    setOpen(false);
                  }}
                  hitSlop={8}
                >
                  <Text style={{ fontWeight: "800", color: colors.accentDark }}>Done</Text>
                </Pressable>
              </View>
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                <Text style={{ fontSize: 13, color: colors.muted, fontWeight: "600" }}>
                  Selected
                </Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 2 }}>
                  {formatDisplayDate(draftKey)}
                </Text>
              </View>
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
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
