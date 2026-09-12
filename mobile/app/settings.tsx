import { createElement, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import {
  getAppTimeZone,
  getFarmOrder,
  getLfoFeedOffHoursBeforeCatch,
  getLfoFeedUpHoursBeforeCatch,
  getServiceTech,
  setAppTimeZone,
  setFarmOrder,
  setLfoFeedOffHoursBeforeCatch,
  setLfoFeedUpHoursBeforeCatch,
  setServiceTech,
} from "../src/lib/appSettings";
import { APP_TIME_ZONES } from "../src/lib/appTimeZones";
import { shareMobileBackup } from "../src/lib/dataExport";
import { FARM_ORDER_OPTIONS, type FarmOrder } from "../src/lib/farmOrder";
import { colors, styles } from "../src/theme";
import { WheelPicker } from "../src/components/WheelPicker";

const noFocusRing =
  Platform.OS === "web"
    ? ({
        outlineWidth: 0,
        outlineStyle: "none",
        outlineColor: "transparent",
        boxShadow: "none",
      } as const)
    : null;

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, changePassword } = useAuth();
  const [serviceTech, setServiceTechName] = useState(getServiceTech);
  const [farmOrder, setFarmOrderValue] = useState<FarmOrder>(getFarmOrder);
  const [timeZone, setTimeZoneValue] = useState(getAppTimeZone);
  const [feedUpHours, setFeedUpHours] = useState(() => String(getLfoFeedUpHoursBeforeCatch()));
  const [feedOffHours, setFeedOffHours] = useState(() => String(getLfoFeedOffHoursBeforeCatch()));
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordNote, setPasswordNote] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  function onChangeServiceTech(value: string) {
    setServiceTechName(value);
    setServiceTech(value);
  }

  function onChangeFarmOrder(value: FarmOrder) {
    setFarmOrderValue(value);
    setFarmOrder(value);
  }

  function onChangeTimeZone(value: string) {
    setTimeZoneValue(value);
    setAppTimeZone(value);
  }

  function onChangeFeedUpHours(value: string) {
    setFeedUpHours(value);
    const hours = Number(value);
    if (Number.isFinite(hours) && hours >= 1) {
      setLfoFeedUpHoursBeforeCatch(hours);
      setFeedOffHours(String(getLfoFeedOffHoursBeforeCatch()));
    }
  }

  function onChangeFeedOffHours(value: string) {
    setFeedOffHours(value);
    const hours = Number(value);
    if (Number.isFinite(hours) && hours >= 1) {
      setLfoFeedOffHoursBeforeCatch(hours);
      setFeedUpHours(String(getLfoFeedUpHoursBeforeCatch()));
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.content, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
        >
          {Platform.OS === "web"
            ? createElement("style", {
                dangerouslySetInnerHTML: {
                  __html:
                    "input:focus{outline:none!important;box-shadow:none!important;-webkit-tap-highlight-color:transparent}",
                },
              })
            : null}

          <View
            style={{
              marginBottom: 20,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={[styles.title, { flex: 1 }]}>Settings</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={() => router.back()}
              hitSlop={10}
            >
              <Text style={{ color: colors.text, fontWeight: "700", textDecorationLine: "underline" }}>
                Done
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>
              Service Tech:
            </Text>
            <TextInput
              style={[
                {
                  flex: 1,
                  minWidth: 0,
                  fontSize: 17,
                  fontWeight: "600",
                  color: colors.text,
                  paddingVertical: 2,
                  paddingHorizontal: 0,
                  borderWidth: 0,
                  backgroundColor: "transparent",
                },
                noFocusRing,
              ]}
              value={serviceTech}
              onChangeText={onChangeServiceTech}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              placeholder="Name"
              placeholderTextColor={colors.muted}
              selectionColor={colors.muted}
              underlineColorAndroid="transparent"
              accessibilityLabel="Service technician name"
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: "700",
                color: colors.text,
                paddingTop: 2,
              }}
            >
              Order Farms By:
            </Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <WheelPicker
                options={FARM_ORDER_OPTIONS.map((option) => ({
                  value: option.key,
                  label: option.label,
                }))}
                value={farmOrder}
                onChange={onChangeFarmOrder}
              />
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: "700",
                color: colors.text,
                paddingTop: 2,
              }}
            >
              Timezone:
            </Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <WheelPicker
                options={APP_TIME_ZONES.map((zone) => ({
                  value: zone.value,
                  label: zone.label,
                }))}
                value={timeZone}
                onChange={onChangeTimeZone}
              />
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 8,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, flex: 1 }}>
              Feed up hours before catch:
            </Text>
            <TextInput
              style={[
                {
                  width: 64,
                  fontSize: 17,
                  fontWeight: "600",
                  color: colors.text,
                  textAlign: "right",
                  paddingVertical: 2,
                  borderWidth: 0,
                  backgroundColor: "transparent",
                },
                noFocusRing,
              ]}
              value={feedUpHours}
              onChangeText={onChangeFeedUpHours}
              keyboardType="number-pad"
              accessibilityLabel="Feed up hours before catch"
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, flex: 1 }}>
              Feed off hours before catch:
            </Text>
            <TextInput
              style={[
                {
                  width: 64,
                  fontSize: 17,
                  fontWeight: "600",
                  color: colors.text,
                  textAlign: "right",
                  paddingVertical: 2,
                  borderWidth: 0,
                  backgroundColor: "transparent",
                },
                noFocusRing,
              ]}
              value={feedOffHours}
              onChangeText={onChangeFeedOffHours}
              keyboardType="number-pad"
              accessibilityLabel="Feed off hours before catch"
            />
          </View>

          <View style={{ flex: 1, minHeight: 48 }} />

          <Pressable
            disabled={exporting}
            onPress={() => {
              if (exporting) return;
              setExporting(true);
              setExportNote(null);
              void shareMobileBackup()
                .then(({ farmCount }) => {
                  setExportNote(
                    `Saved a backup of ${farmCount} farm${farmCount === 1 ? "" : "s"}. Keep that file.`,
                  );
                })
                .catch((e) => {
                  setExportNote(e instanceof Error ? e.message : "Export failed");
                })
                .finally(() => setExporting(false));
            }}
            style={{ alignSelf: "center", paddingVertical: 16, paddingHorizontal: 12 }}
          >
            <Text
              style={{
                color: colors.text,
                fontWeight: "700",
                textDecorationLine: "underline",
              }}
            >
              {exporting ? "Exporting…" : "Export data"}
            </Text>
          </Pressable>
          {exportNote ? (
            <Text
              style={{
                alignSelf: "center",
                maxWidth: 320,
                textAlign: "center",
                color: colors.muted,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {exportNote}
            </Text>
          ) : (
            <Text
              style={{
                alignSelf: "center",
                maxWidth: 320,
                textAlign: "center",
                color: colors.muted,
                fontSize: 13,
              }}
            >
              Safari keeps farms in this browser. Export to save a copy you own.
            </Text>
          )}

          <View style={{ marginTop: 12, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>Email:</Text>
              <Text
                style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: "600", color: colors.text }}
              >
                {user?.email ?? "—"}
              </Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>
              Change password
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ width: 88, fontSize: 15, fontWeight: "700", color: colors.text }}>
                Current:
              </Text>
              <TextInput
                style={[
                  {
                    flex: 1,
                    minWidth: 0,
                    fontSize: 17,
                    fontWeight: "600",
                    color: colors.text,
                    paddingVertical: 2,
                    paddingHorizontal: 0,
                    borderWidth: 0,
                    backgroundColor: "transparent",
                  },
                  noFocusRing,
                ]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="password"
                placeholder="Current password"
                placeholderTextColor={colors.muted}
                underlineColorAndroid="transparent"
                accessibilityLabel="Current password"
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ width: 88, fontSize: 15, fontWeight: "700", color: colors.text }}>
                New:
              </Text>
              <TextInput
                style={[
                  {
                    flex: 1,
                    minWidth: 0,
                    fontSize: 17,
                    fontWeight: "600",
                    color: colors.text,
                    paddingVertical: 2,
                    paddingHorizontal: 0,
                    borderWidth: 0,
                    backgroundColor: "transparent",
                  },
                  noFocusRing,
                ]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                autoComplete="password-new"
                placeholder="New password"
                placeholderTextColor={colors.muted}
                underlineColorAndroid="transparent"
                accessibilityLabel="New password"
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ width: 88, fontSize: 15, fontWeight: "700", color: colors.text }}>
                Confirm:
              </Text>
              <TextInput
                style={[
                  {
                    flex: 1,
                    minWidth: 0,
                    fontSize: 17,
                    fontWeight: "600",
                    color: colors.text,
                    paddingVertical: 2,
                    paddingHorizontal: 0,
                    borderWidth: 0,
                    backgroundColor: "transparent",
                  },
                  noFocusRing,
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                autoComplete="password-new"
                placeholder="Confirm password"
                placeholderTextColor={colors.muted}
                underlineColorAndroid="transparent"
                accessibilityLabel="Confirm new password"
              />
            </View>
            {passwordError ? (
              <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "600" }}>
                {passwordError}
              </Text>
            ) : null}
            {passwordNote ? (
              <Text style={{ color: colors.accentDark, fontSize: 13, fontWeight: "600" }}>
                {passwordNote}
              </Text>
            ) : null}
            <Pressable
              disabled={savingPassword}
              onPress={() => {
                if (savingPassword) return;
                setPasswordError(null);
                setPasswordNote(null);
                if (newPassword.length < 8) {
                  setPasswordError("Password must be at least 8 characters.");
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setPasswordError("New passwords do not match.");
                  return;
                }
                setSavingPassword(true);
                void changePassword(currentPassword, newPassword)
                  .then(() => {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordNote("Password updated.");
                  })
                  .catch((e) => {
                    setPasswordError(e instanceof Error ? e.message : "Could not change password.");
                  })
                  .finally(() => setSavingPassword(false));
              }}
              style={{ alignSelf: "flex-start", paddingVertical: 8 }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", textDecorationLine: "underline" }}>
                {savingPassword ? "Saving…" : "Change password"}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => void signOut()}
            style={{ alignSelf: "center", paddingVertical: 16, paddingHorizontal: 12 }}
          >
            <Text
              style={{
                color: colors.text,
                fontWeight: "700",
                textDecorationLine: "underline",
              }}
            >
              Sign out
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
