import { createElement, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

const noFocusRing =
  Platform.OS === "web"
    ? ({
        outlineWidth: 0,
        outlineStyle: "none",
        outlineColor: "transparent",
        boxShadow: "none",
      } as const)
    : null;

const valueChip = {
  minHeight: 36,
  borderRadius: 10,
  backgroundColor: "#e7e5e4",
  paddingHorizontal: 10,
  justifyContent: "center" as const,
};

const valueText = {
  fontSize: 15,
  fontWeight: "600" as const,
  color: colors.text,
  textAlign: "right" as const,
};

function SettingsRow({
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
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text, flexShrink: 0 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function SettingsSelect<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  if (Platform.OS === "web") {
    return createElement(
      "select",
      {
        value,
        "aria-label": title,
        onChange: (event: { target: { value: string } }) => onChange(event.target.value as T),
        style: {
          ...valueChip,
          ...valueText,
          minWidth: 152,
          maxWidth: 224,
          borderWidth: 0,
          appearance: "auto",
        },
      },
      options.map((option) =>
        createElement("option", { key: option.value, value: option.value }, option.label),
      ),
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => setOpen(true)}
        style={[valueChip, { minWidth: 152, maxWidth: 224 }]}
      >
        <Text numberOfLines={1} style={valueText}>
          {selected?.label ?? ""}
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              maxHeight: "70%",
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "800", marginBottom: 8 }}>{title}</Text>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={{
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: "#f5f5f4",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: value === option.value ? "800" : "600", color: colors.text }}>
                    {option.label}
                  </Text>
                  {value === option.value ? (
                    <Ionicons name="checkmark" size={18} color={colors.accentDark} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

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
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={[styles.title, { flex: 1 }]}>Settings</Text>
            <View style={{ alignItems: "flex-end", gap: 4, maxWidth: "52%" }}>
              {user?.email ? (
                <Text
                  accessibilityLabel="Email"
                  numberOfLines={1}
                  style={{ fontSize: 12, fontWeight: "500", color: colors.muted, textAlign: "right" }}
                >
                  {user.email}
                </Text>
              ) : null}
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
          </View>

          <SettingsRow label="Service Tech:">
            <View style={[valueChip, { minWidth: 152, maxWidth: 224, flex: 1 }]}>
              <TextInput
                style={[valueText, { paddingVertical: 6, borderWidth: 0 }, noFocusRing]}
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
          </SettingsRow>

          <SettingsRow label="Order Farms By:">
            <SettingsSelect
              title="Order Farms By"
              value={farmOrder}
              options={FARM_ORDER_OPTIONS.map((option) => ({
                value: option.key,
                label: option.label,
              }))}
              onChange={onChangeFarmOrder}
            />
          </SettingsRow>

          <SettingsRow label="Timezone:">
            <SettingsSelect
              title="Timezone"
              value={timeZone}
              options={APP_TIME_ZONES.map((zone) => ({
                value: zone.value,
                label: zone.label,
              }))}
              onChange={onChangeTimeZone}
            />
          </SettingsRow>

          <SettingsRow label="Feed up hours before catch:">
            <TextInput
              style={[
                valueChip,
                valueText,
                { width: 76, paddingVertical: 6, borderWidth: 0 },
                noFocusRing,
              ]}
              value={feedUpHours}
              onChangeText={onChangeFeedUpHours}
              keyboardType="number-pad"
              accessibilityLabel="Feed up hours before catch"
            />
          </SettingsRow>
          <SettingsRow label="Feed off hours before catch:">
            <TextInput
              style={[
                valueChip,
                valueText,
                { width: 76, paddingVertical: 6, borderWidth: 0 },
                noFocusRing,
              ]}
              value={feedOffHours}
              onChangeText={onChangeFeedOffHours}
              keyboardType="number-pad"
              accessibilityLabel="Feed off hours before catch"
            />
          </SettingsRow>

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

          <View style={{ marginTop: 12, gap: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>
              Change password
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ width: 88, fontSize: 15, fontWeight: "700", color: colors.text }}>
                Current:
              </Text>
              <TextInput
                style={[
                  {
                    flex: 1,
                    minWidth: 0,
                    minHeight: 44,
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.text,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    backgroundColor: "#fff",
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
                placeholder="********"
                placeholderTextColor={colors.muted}
                underlineColorAndroid="transparent"
                accessibilityLabel="Current password"
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ width: 88, fontSize: 15, fontWeight: "700", color: colors.text }}>
                New:
              </Text>
              <TextInput
                style={[
                  {
                    flex: 1,
                    minWidth: 0,
                    minHeight: 44,
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.text,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    backgroundColor: "#fff",
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
                placeholder="********"
                placeholderTextColor={colors.muted}
                underlineColorAndroid="transparent"
                accessibilityLabel="New password"
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ width: 88, fontSize: 15, fontWeight: "700", color: colors.text }}>
                Confirm:
              </Text>
              <TextInput
                style={[
                  {
                    flex: 1,
                    minWidth: 0,
                    minHeight: 44,
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.text,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    backgroundColor: "#fff",
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
                placeholder="********"
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
