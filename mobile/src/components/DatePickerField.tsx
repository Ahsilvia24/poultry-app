import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../theme";
import { todayKey } from "../lib/ids";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2026-09-24" → "24 Sep 26" */
export function formatDisplayDate(dateKey: string) {
  if (!dateKey) return "Select date";
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${d} ${MONTHS_SHORT[m - 1]} ${String(y).slice(-2)}`;
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

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * @react-native-community/datetimepicker is a no-op on web, so Expo web
 * needs this month grid for place/catch (and other) date fields.
 */
function WebMonthCalendar({
  value,
  onSelect,
}: {
  value: Date;
  onSelect: (date: Date) => void;
}) {
  const selected = safePickerDate(value);
  const [cursor, setCursor] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: Array<{ key: string; day: number | null; date?: Date }> = [];
    for (let i = 0; i < firstDow; i++) {
      out.push({ key: `pad-${i}`, day: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      out.push({
        key: `${year}-${month}-${day}`,
        day,
        date: new Date(year, month, day, 12, 0, 0, 0),
      });
    }
    return out;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const selectedKey = toDateKey(selected);
  const today = todayKey();

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          paddingHorizontal: 4,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() =>
            setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
          }
          hitSlop={8}
          style={{ padding: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{monthLabel}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() =>
            setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
          }
          hitSlop={8}
          style={{ padding: 10 }}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {WEEKDAYS.map((d) => (
          <Text
            key={d}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 13,
              fontWeight: "700",
              color: colors.muted,
              paddingVertical: 6,
            }}
          >
            {d}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((cell) => {
          if (cell.day == null || !cell.date) {
            return <View key={cell.key} style={{ width: "14.2857%", aspectRatio: 1 }} />;
          }
          const key = toDateKey(cell.date);
          const isSelected = key === selectedKey;
          const isToday = key === today;
          return (
            <Pressable
              key={cell.key}
              accessibilityRole="button"
              accessibilityLabel={formatDisplayDate(key)}
              onPress={() => {
                setCursor(new Date(cell.date!.getFullYear(), cell.date!.getMonth(), 1));
                onSelect(cell.date!);
              }}
              style={{
                width: "14.2857%",
                aspectRatio: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSelected ? colors.accentDark : "transparent",
                  borderWidth: isToday && !isSelected ? 1 : 0,
                  borderColor: colors.accentDark,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: isSelected || isToday ? "800" : "600",
                    color: isSelected ? "#fff" : colors.text,
                  }}
                >
                  {cell.day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
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
  expanded,
  style,
  inputStyle,
}: {
  label: string;
  value: string;
  onChange: (dateKey: string) => void;
  /** `inline` expands under the field — required inside parent Modals. */
  presentation?: "modal" | "inline";
  /** Fired when the calendar is opened (e.g. to dismiss a keypad). */
  onOpen?: () => void;
  /** When false, collapse an inline calendar (exclusive accordion). */
  expanded?: boolean;
  style?: object;
  /** Extra styles on the value box (e.g. drop bottom margin when a control sits under it). */
  inputStyle?: object;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseDateKey(value));
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    if (expanded === false) setOpen(false);
  }, [expanded]);
  // Web can use the modal sheet too (needed when the field sits in a tight row).
  // Pass presentation="inline" to expand under the field (e.g. nested modals).
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

  function selectWebDate(selected: Date) {
    setDraft(selected);
    onChange(toDateKey(selected));
    setOpen(false);
  }

  const draftKey = toDateKey(draft);
  const pickerValue = safePickerDate(draft);

  const calendarBody = isWeb ? (
    <WebMonthCalendar value={pickerValue} onSelect={selectWebDate} />
  ) : (
    <DateTimePicker
      value={pickerValue}
      mode="date"
      display={Platform.OS === "ios" ? "inline" : "default"}
      onChange={onPickerChange}
      style={{ alignSelf: "center" }}
    />
  );

  return (
    <View style={style}>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatDisplayDate(value)}. Opens calendar`}
        style={[
          styles.input,
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
          },
          inputStyle,
        ]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={{
            flex: 1,
            minWidth: 0,
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
          {calendarBody}
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
              justifyContent: isWeb ? "center" : "flex-end",
              padding: isWeb ? 16 : 0,
            }}
            onPress={() => setOpen(false)}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                borderBottomLeftRadius: isWeb ? 16 : 0,
                borderBottomRightRadius: isWeb ? 16 : 0,
                paddingBottom: 24,
                minHeight: isWeb ? "78%" : undefined,
                maxHeight: isWeb ? "94%" : undefined,
                width: "100%",
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
              {calendarBody}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
