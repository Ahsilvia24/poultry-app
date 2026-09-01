import { useEffect, useRef } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from "react-native";
import { colors } from "../theme";

const ROW_H = 40;

/**
 * iOS-style wheel picker (the scrolly drum, not a bottom sheet).
 * Use this when settings should stay on one screen.
 */
export function WheelPicker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: index * ROW_H, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [index]);

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    const next = Math.min(options.length - 1, Math.max(0, Math.round(y / ROW_H)));
    const option = options[next];
    if (option && option.value !== value) onChange(option.value);
    scrollRef.current?.scrollTo({ y: next * ROW_H, animated: true });
  }

  return (
    <View style={{ height: ROW_H * 3, overflow: "hidden" }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: ROW_H,
          height: ROW_H,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
          zIndex: 1,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ paddingVertical: ROW_H }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <View
              key={option.value}
              style={{
                height: ROW_H,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: selected ? 17 : 15,
                  fontWeight: selected ? "800" : "600",
                  color: selected ? colors.text : colors.muted,
                }}
              >
                {option.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
