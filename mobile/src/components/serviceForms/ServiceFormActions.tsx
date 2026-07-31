import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { colors } from "../../theme";

/** Bottom actions for Service Report / Placement / Prebrood. */
export function ServiceFormActions({
  editing,
  saving,
  sharing,
  onComplete,
  onSharePdf,
}: {
  editing: boolean;
  saving: boolean;
  sharing: boolean;
  onComplete: () => void;
  onSharePdf: () => void;
}) {
  const busy = saving || sharing;

  return (
    <View style={{ marginTop: 16, gap: 10 }}>
      <Pressable
        disabled={busy}
        onPress={onComplete}
        style={{
          backgroundColor: colors.accentDark,
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: "center",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
            {editing ? "Save changes" : "Complete · Log visit"}
          </Text>
        )}
      </Pressable>
      <Pressable
        disabled={busy}
        onPress={onSharePdf}
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          borderWidth: 2,
          borderColor: colors.accentDark,
          paddingVertical: 16,
          alignItems: "center",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {sharing ? (
          <ActivityIndicator color={colors.accentDark} />
        ) : (
          <Text style={{ color: colors.accentDark, fontWeight: "800", fontSize: 16 }}>
            Share PDF
          </Text>
        )}
      </Pressable>
    </View>
  );
}
