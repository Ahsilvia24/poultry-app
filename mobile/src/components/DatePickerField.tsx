import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../theme";
import { todayKey } from "../lib/ids";

/** "2026-07-26" → "Jul 26, 2026" (or compact "7/26/26"). */
export function formatDisplayDate(dateKey: string, compact = false) {
  if (!dateKey) return "Select date";
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  if (compact) {
    return `${m}/${d}/${String(y).slice(-2)}`;
  }
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseDateKey(dateKey: string): Date {
  const trimmed = dateKey.trim();
  if (!trimmed) {
    const [y, m, d] = todayKey().split("-").map(Number);
    return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  }
  const [y, m, d] = trimmed.split("-").map(Number);
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

/**
 * Calendar date field.
 * Use `presentation="inline"` when nested inside another Modal (iOS nested
 * modals often fail to appear).
 */
export function DatePickerField({
  label,
  value,
  onChange,
  presentation = "modal",
  onOpen,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (dateKey: string) => void;
  /** `inline` expands under the field — required inside parent Modals. */
  presentation?: "modal" | "inline";
  /** Fired when the calendar is opened (e.g. to dismiss a keypad). */
  onOpen?: () => void;
  /** Shorter date text for narrow fields (e.g. Log visit). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseDateKey(value));
  const useInline = presentation === "inline" || Platform.OS === "android";

  function openPicker() {
    onOpen?.();
    // Unset fields start the calendar on today instead of a stale inherited date.
    setDraft(parseDateKey(value.trim() ? value : todayKey()));
    setOpen((v) => !v);
  }

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && selected) onChange(toDateKey(selected));
      return;
    }
    if (selected) {
      setDraft(selected);
      if (useInline) {
        onChange(toDateKey(selected));
      }
    }
  }

  const draftKey = toDateKey(draft);
  const pickerValue = safePickerDate(draft);

  return (
    <View style={{ width: "100%" }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatDisplayDate(value, compact)}. Opens calendar`}
        style={[
          styles.input,
          {
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: compact ? 8 : 10,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={{
            fontWeight: "700",
            color: value ? colors.text : colors.muted,
            fontSize: compact ? 15 : 16,
            flexShrink: 1,
            marginRight: 6,
          }}
        >
          {formatDisplayDate(value, compact)}
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

      {Platform.OS !== "android" && open && useInline ? (
        <View
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: "#fff",
            overflow: "hidden",
            paddingBottom: 8,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.text }}>
              {formatDisplayDate(draftKey)}
            </Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Text style={{ fontWeight: "800", color: colors.accentDark }}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={pickerValue}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={onPickerChange}
            style={{ alignSelf: "center" }}
          />
        </View>
      ) : null}

      {Platform.OS !== "android" && open && !useInline ? (
        <Modal
          transparent
          animationType="slide"
          visible
          presentationStyle="overFullScreen"
          onRequestClose={() => setOpen(false)}
        >
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
