import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
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
  return d;
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

export function TimeScrollPickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseTime(value || "06:00"));

  function openPicker() {
    setDraft(parseTime(value || "06:00"));
    setOpen(true);
  }

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && selected) onChange(toTimeKey(selected));
      return;
    }
    if (selected) setDraft(selected);
  }

  const draftKey = toTimeKey(draft);

  return (
    <View>
      <Text style={[styles.label, { marginTop: 4 }]}>{label}</Text>
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
          {value ? timeLabel(value) : "Select time"}
        </Text>
        <Ionicons name="time-outline" size={20} color={colors.muted} />
      </Pressable>

      {Platform.OS === "android" && open ? (
        <DateTimePicker
          value={draft}
          mode="time"
          display="spinner"
          minuteInterval={30}
          onChange={onPickerChange}
        />
      ) : null}

      {Platform.OS !== "android" && open ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setOpen(false)}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
            <View
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
                <Text style={{ fontWeight: "800", color: colors.text }}>Feed up time</Text>
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
                  {timeLabel(draftKey)}
                </Text>
              </View>

              <DateTimePicker
                value={draft}
                mode="time"
                display="spinner"
                minuteInterval={30}
                onChange={onPickerChange}
                style={{ alignSelf: "center" }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
