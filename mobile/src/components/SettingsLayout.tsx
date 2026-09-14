import { useState, type ReactNode, type Ref } from "react";
import {
  Platform,
  Text,
  TextInput,
  View,
  type ReturnKeyTypeOptions,
  type TextInputProps,
} from "react-native";
import { colors } from "../theme";

/**
 * Settings page layout — label on the left, grey edit box on the right.
 * Say “settings layout” when you want this on another tile.
 */
export const settingsNoFocusRing =
  Platform.OS === "web"
    ? ({
        outlineWidth: 0,
        outlineStyle: "none",
        outlineColor: "transparent",
        boxShadow: "none",
      } as const)
    : null;

export const settingsValueChip = {
  minHeight: 36,
  borderRadius: 10,
  backgroundColor: "#e7e5e4",
  paddingHorizontal: 10,
  justifyContent: "center" as const,
};

export const settingsValueText = {
  fontSize: 15,
  fontWeight: "600" as const,
  color: colors.text,
  textAlign: "right" as const,
};

export function SettingsRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 44,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text, flex: 1, flexShrink: 1 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export function placeCaretAtEnd(
  value: string,
  target?: { setSelectionRange?: (start: number, end: number) => void },
) {
  const n = value.length;
  const move = () => {
    try {
      target?.setSelectionRange?.(n, n);
    } catch {
      /* ignore */
    }
  };
  move();
  requestAnimationFrame(move);
}

export function SettingsChipInput({
  value,
  onChangeText,
  accessibilityLabel,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  textContentType,
  autoComplete,
  placeholder,
  wide,
  returnKeyType,
  blurOnSubmit,
  onSubmitEditing,
  inputRef,
}: {
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel: string;
  keyboardType?: "number-pad" | "decimal-pad";
  autoCapitalize?: "words" | "none";
  autoCorrect?: boolean;
  textContentType?: "name";
  autoComplete?: "name";
  placeholder?: string;
  wide?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  blurOnSubmit?: boolean;
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  inputRef?: Ref<TextInput>;
}) {
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
  const chipStyle = wide
    ? [settingsValueChip, { minWidth: 152, maxWidth: 224, flex: 1 }]
    : [settingsValueChip, settingsValueText, { width: 76, paddingVertical: 6, borderWidth: 0 }, settingsNoFocusRing];

  return (
    <View style={wide ? chipStyle : undefined}>
      <TextInput
        ref={inputRef}
        style={
          wide
            ? [settingsValueText, { paddingVertical: 6, borderWidth: 0 }, settingsNoFocusRing]
            : chipStyle
        }
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        textContentType={textContentType}
        autoComplete={autoComplete}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        selectionColor={colors.muted}
        underlineColorAndroid="transparent"
        selectTextOnFocus={false}
        selection={selection}
        accessibilityLabel={accessibilityLabel}
        returnKeyType={returnKeyType ?? "done"}
        blurOnSubmit={blurOnSubmit ?? true}
        onSubmitEditing={onSubmitEditing}
        onFocus={(event) => {
          const n = value.length;
          setSelection({ start: n, end: n });
          placeCaretAtEnd(value, event.target as { setSelectionRange?: (start: number, end: number) => void });
          setTimeout(() => setSelection(undefined), 80);
        }}
      />
    </View>
  );
}
