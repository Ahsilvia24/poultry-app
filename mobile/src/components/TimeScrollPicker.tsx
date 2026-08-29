import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ScrollView as ScrollViewType,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../theme";

/** Half-hour slots: top (:00) and bottom (:30) of each hour. */
export const FEED_UP_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const minutes = i * 30;
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const value = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const ampm = hour24 < 12 ? "AM" : "PM";
  const label = `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
  return { value, label };
});

export function timeLabel(value: string) {
  return FEED_UP_TIME_OPTIONS.find((o) => o.value === value)?.label ?? (value || "Select time");
}

function parseTime(value: string): Date {
  const raw = value && /^\d{2}:\d{2}$/.test(value) ? value : "06:00";
  const [h, m] = raw.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 6, m ?? 0, 0, 0);
  if (!Number.isFinite(d.getTime())) {
    const fallback = new Date();
    fallback.setHours(6, 0, 0, 0);
    return fallback;
  }
  return d;
}

function safePickerDate(d: Date): Date {
  return Number.isFinite(d.getTime()) ? d : parseTime("06:00");
}

/** Snap to nearest :00 / :30 and return "HH:mm". */
function toTimeKey(d: Date): string {
  const total = d.getHours() * 60 + d.getMinutes();
  const snapped = Math.round(total / 30) * 30;
  const wrapped = ((snapped % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * @react-native-community/datetimepicker is a no-op on web, so Expo web
 * uses a half-hour option list instead of the native spinner.
 */
function WebTimeOptions({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (time: string) => void;
}) {
  const listRef = useRef<ScrollViewType | null>(null);
  const selectedIndex = Math.max(
    0,
    FEED_UP_TIME_OPTIONS.findIndex((o) => o.value === value),
  );

  useEffect(() => {
    const y = Math.max(0, selectedIndex * 44 - 88);
    const t = setTimeout(() => {
      listRef.current?.scrollTo({ y, animated: false });
    }, 40);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  return (
    <ScrollView
      ref={listRef}
      style={{ maxHeight: 280 }}
      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      {FEED_UP_TIME_OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={{
              minHeight: 44,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: 4,
              backgroundColor: selected ? colors.accentDark : "#f5f5f4",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontWeight: "800",
                fontSize: 16,
                color: selected ? "#fff" : colors.text,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function TimeScrollPickerField({
  label,
  value,
  onChange,
  onOpen,
  style,
  inputStyle,
  presentation = "modal",
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
  /** Fired when the picker is opened (e.g. to dismiss a keypad). */
  onOpen?: () => void;
  style?: object;
  /** Extra styles on the value box (e.g. drop bottom margin when a control sits under it). */
  inputStyle?: object;
  /** `inline` expands under the field — required inside parent Modals. */
  presentation?: "modal" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseTime(value || "06:00"));
  const isWeb = Platform.OS === "web";
  const useInline = presentation === "inline";

  function openPicker() {
    onOpen?.();
    setDraft(parseTime(value || "06:00"));
    setOpen((v) => (useInline ? !v : true));
  }

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && selected) onChange(toTimeKey(selected));
      return;
    }
    if (selected) setDraft(selected);
  }

  function selectWebTime(time: string) {
    setDraft(parseTime(time));
    onChange(time);
    setOpen(false);
  }

  const draftKey = toTimeKey(safePickerDate(draft));
  const pickerValue = safePickerDate(draft);

  return (
    <View style={style}>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value ? timeLabel(value) : "Select time"}. Opens time picker`}
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
          {value ? timeLabel(value) : "Select time"}
        </Text>
        <Ionicons name="time-outline" size={20} color={colors.muted} />
      </Pressable>

      {Platform.OS === "android" && open && !useInline ? (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          display="spinner"
          minuteInterval={30}
          onChange={onPickerChange}
        />
      ) : null}

      {open && useInline ? (
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
            <Text style={{ fontWeight: "700", color: colors.text }}>{timeLabel(draftKey)}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Text style={{ fontWeight: "800", color: colors.accentDark }}>Done</Text>
            </Pressable>
          </View>
          <WebTimeOptions value={draftKey} onSelect={selectWebTime} />
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
              onPress={() => {}}
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                paddingBottom: 24,
                maxHeight: "80%",
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
                <Text style={{ fontWeight: "800", color: colors.text }}>{label}</Text>
                {isWeb ? (
                  <View style={{ width: 56 }} />
                ) : (
                  <Pressable
                    onPress={() => {
                      onChange(draftKey);
                      setOpen(false);
                    }}
                    hitSlop={8}
                  >
                    <Text style={{ fontWeight: "800", color: colors.accentDark }}>Done</Text>
                  </Pressable>
                )}
              </View>

              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                <Text style={{ fontSize: 13, color: colors.muted, fontWeight: "600" }}>
                  Selected
                </Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 2 }}>
                  {timeLabel(draftKey)}
                </Text>
              </View>

              {isWeb ? (
                <WebTimeOptions value={draftKey} onSelect={selectWebTime} />
              ) : (
                <DateTimePicker
                  value={pickerValue}
                  mode="time"
                  display="spinner"
                  minuteInterval={30}
                  onChange={onPickerChange}
                  style={{ alignSelf: "center" }}
                />
              )}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
