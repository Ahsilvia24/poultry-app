import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as ScrollViewType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../theme";

const ITEM_HEIGHT = 44;

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
  const [draft, setDraft] = useState(value || "06:00");
  const scrollRef = useRef<ScrollViewType>(null);

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(
      0,
      FEED_UP_TIME_OPTIONS.findIndex((o) => o.value === (value || "06:00")),
    );
    setDraft(FEED_UP_TIME_OPTIONS[idx]!.value);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    });
  }, [open, value]);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.min(
      FEED_UP_TIME_OPTIONS.length - 1,
      Math.max(0, Math.round(y / ITEM_HEIGHT)),
    );
    setDraft(FEED_UP_TIME_OPTIONS[idx]!.value);
    scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
  }

  return (
    <View>
      <Text style={[styles.label, { marginTop: 4 }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
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

      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
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
              paddingBottom: 20,
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
              <Pressable onPress={() => setOpen(false)}>
                <Text style={{ fontWeight: "700", color: colors.muted }}>Cancel</Text>
              </Pressable>
              <Text style={{ fontWeight: "800", color: colors.text }}>Feed up time</Text>
              <Pressable
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                <Text style={{ fontWeight: "800", color: colors.accentDark }}>Done</Text>
              </Pressable>
            </View>

            <View style={{ height: ITEM_HEIGHT * 5, marginTop: 8 }}>
              {/* Selection highlight */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: ITEM_HEIGHT * 2,
                  left: 16,
                  right: 16,
                  height: ITEM_HEIGHT,
                  borderRadius: 10,
                  backgroundColor: "#f5f5f4",
                  zIndex: 0,
                }}
              />
              <ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onMomentumScrollEnd={onScrollEnd}
                onScrollEndDrag={onScrollEnd}
                contentContainerStyle={{
                  paddingVertical: ITEM_HEIGHT * 2,
                }}
              >
                {FEED_UP_TIME_OPTIONS.map((opt) => {
                  const selected = opt.value === draft;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        setDraft(opt.value);
                        const idx = FEED_UP_TIME_OPTIONS.findIndex((o) => o.value === opt.value);
                        scrollRef.current?.scrollTo({
                          y: Math.max(0, idx) * ITEM_HEIGHT,
                          animated: true,
                        });
                      }}
                      style={{
                        height: ITEM_HEIGHT,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: selected ? 20 : 16,
                          fontWeight: selected ? "800" : "600",
                          color: selected ? colors.text : colors.muted,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
