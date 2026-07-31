import { ActivityIndicator, Pressable, Text } from "react-native";
import { colors } from "../../theme";

/** Single bottom action: save/log visit and open the PDF share sheet. */
export function ServiceFormActions({
  editing,
  saving,
  onComplete,
}: {
  editing: boolean;
  saving: boolean;
  onComplete: () => void;
}) {
  return (
    <Pressable
      disabled={saving}
      onPress={onComplete}
      style={{
        marginTop: 16,
        backgroundColor: colors.accentDark,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        opacity: saving ? 0.7 : 1,
      }}
    >
      {saving ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
          {editing ? "Save changes · Share PDF" : "Complete · Log visit · Share PDF"}
        </Text>
      )}
    </Pressable>
  );
}
