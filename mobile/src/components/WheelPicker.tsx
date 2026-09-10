import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

const ROW_H = 36;

/**
 * Closed: selected value + up/down chevrons, on one line.
 * Open: scrollable list; tap a row to choose and close.
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
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <View style={{ zIndex: open ? 20 : 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Order farms by"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((prev) => !prev)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: ROW_H,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 17,
            fontWeight: "600",
            color: colors.text,
          }}
        >
          {selected?.label ?? ""}
        </Text>
        <View pointerEvents="none" style={{ marginLeft: 4 }}>
          <View style={{ height: 16, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="chevron-up" size={14} color={colors.text} />
          </View>
          <View style={{ height: 16, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="chevron-down" size={14} color={colors.text} />
          </View>
        </View>
      </Pressable>

      {open ? (
        <View
          style={{
            marginTop: 2,
            maxHeight: ROW_H * 4,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "#fff",
            overflow: "hidden",
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        >
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            bounces
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={{
                    minHeight: ROW_H,
                    justifyContent: "center",
                    paddingHorizontal: 10,
                    backgroundColor: active ? "rgba(4, 120, 87, 0.07)" : "#fff",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 17,
                      fontWeight: active ? "800" : "600",
                      color: colors.text,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
