import { useEffect, useRef } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

const ROW_H = 36;

/**
 * One-row scroll picker: only the selected value is visible.
 * Flick/scroll to change; chevrons on the right are the Apple affordance, not buttons.
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
  const last = Math.max(0, options.length - 1);
  const canUp = index > 0;
  const canDown = index < last;

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: index * ROW_H, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [index]);

  function commitOffset(y: number) {
    const next = Math.min(last, Math.max(0, Math.round(y / ROW_H)));
    const option = options[next];
    if (option && option.value !== value) onChange(option.value);
    scrollRef.current?.scrollTo({ y: next * ROW_H, animated: true });
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    commitOffset(e.nativeEvent.contentOffset.y);
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: ROW_H }}>
      <View
        style={{
          flex: 1,
          minWidth: 0,
          height: ROW_H,
          overflow: "hidden",
        }}
      >
        <ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={ROW_H}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          scrollEventThrottle={16}
          style={
            Platform.OS === "web"
              ? ({
                  height: ROW_H,
                  overflowY: "auto",
                  scrollSnapType: "y mandatory",
                } as object)
              : { height: ROW_H }
          }
        >
          {options.map((option) => (
            <View
              key={option.value}
              style={
                Platform.OS === "web"
                  ? ({
                      height: ROW_H,
                      justifyContent: "center",
                      scrollSnapAlign: "start",
                    } as object)
                  : { height: ROW_H, justifyContent: "center" }
              }
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 17,
                  fontWeight: "600",
                  color: colors.text,
                }}
              >
                {option.label}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <View pointerEvents="none" style={{ marginLeft: 4 }}>
        <View style={{ height: 16, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-up" size={14} color={canUp ? colors.text : "#d6d3d1"} />
        </View>
        <View style={{ height: 16, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-down" size={14} color={canDown ? colors.text : "#d6d3d1"} />
        </View>
      </View>
    </View>
  );
}
