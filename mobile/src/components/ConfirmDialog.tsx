import { Modal, Pressable, Text, View } from "react-native";
import { colors } from "../theme";

/**
 * Cross-platform confirm dialog.
 * React Native Web's `Alert.alert` is a no-op, so Farms Active/Inactive/Delete
 * must use this (or equivalent) instead of Alert on web.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  altLabel,
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onAlt,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  altLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onAlt?: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: "#fff",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
            maxWidth: 420,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{title}</Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.muted }}>
            {message}
          </Text>
          <View style={{ marginTop: 18, gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              onPress={onConfirm}
              style={{
                borderRadius: 10,
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: danger ? colors.danger : colors.accentDark,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{confirmLabel}</Text>
            </Pressable>
            {altLabel && onAlt ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={altLabel}
                onPress={onAlt}
                style={{
                  borderRadius: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                  {altLabel}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              onPress={onCancel}
              style={{
                borderRadius: 10,
                paddingVertical: 12,
                paddingHorizontal: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 15 }}>
                {cancelLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
