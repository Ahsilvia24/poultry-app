import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  createVisit,
  deleteVisit,
  getFarmDetail,
  getVisit,
  updateVisit,
} from "../repos/data";
import { birdAgeFromPlacement } from "../lib/mortality";
import { todayKey } from "../lib/ids";
import { VISIT_TYPE_LABELS, VISIT_TYPE_OPTIONS } from "../lib/visits";
import { colors, styles } from "../theme";
import { Card, PageHeader, PrimaryButton } from "./ui";

type Props = {
  farmId: string;
  visitId?: string;
};

export function VisitFormScreen({ farmId, visitId }: Props) {
  const router = useRouter();
  const editing = Boolean(visitId);

  const initial = useMemo(() => {
    if (!visitId) return null;
    try {
      return getVisit(farmId, visitId);
    } catch {
      return null;
    }
  }, [farmId, visitId]);

  const farmDetail = useMemo(() => {
    try {
      return getFarmDetail(farmId);
    } catch {
      return null;
    }
  }, [farmId]);

  const placementDate = farmDetail?.activeFlock?.placementDate ?? null;
  const flockId = farmDetail?.activeFlock?.id ?? initial?.flockId ?? null;

  const [visitDate, setVisitDate] = useState(initial?.visitDate ?? todayKey());
  const [visitType, setVisitType] = useState(initial?.visitType ?? "ROUTINE_SERVICE");
  const [condition, setCondition] = useState(initial?.generalBirdCondition ?? "Healthy");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [followUpRequired, setFollowUpRequired] = useState(initial?.followUpRequired ?? false);
  const [followUpDate, setFollowUpDate] = useState(initial?.followUpDate ?? "");
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const birdAge =
    placementDate && visitDate
      ? birdAgeFromPlacement(placementDate, visitDate)
      : (initial?.birdAgeInDays ?? null);

  if (editing && !initial) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.content}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Back</Text>
          </Pressable>
          <Text style={{ color: colors.danger }}>Visit not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        farmId,
        flockId,
        visitDate: visitDate.trim(),
        visitType,
        generalBirdCondition: condition,
        notes: notes.trim() || null,
        followUpRequired,
        followUpDate: followUpRequired ? followUpDate.trim() || null : null,
      };
      if (visitId) {
        updateVisit(visitId, payload);
      } else {
        createVisit(payload);
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save visit");
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!visitId) return;
    Alert.alert("Delete visit?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          try {
            deleteVisit(farmId, visitId);
            router.back();
          } catch (e) {
            Alert.alert("Error", e instanceof Error ? e.message : "Could not delete visit");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={{ marginBottom: 8 }}>
            <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Back</Text>
          </Pressable>

          <PageHeader
            title={editing ? "Edit visit" : "Log visit"}
            subtitle={farmDetail?.farm.farmName ?? "Farm visit"}
          />

          <Card>
            <Text style={styles.label}>Visit date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={visitDate}
              onChangeText={setVisitDate}
              autoCapitalize="none"
              placeholder="2026-07-26"
              placeholderTextColor={colors.muted}
            />

            <Text style={[styles.label, { marginTop: 8 }]}>Visit type</Text>
            <Pressable
              onPress={() => setTypePickerOpen(true)}
              style={[
                styles.input,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: "600" }}>
                {VISIT_TYPE_LABELS[visitType] ?? visitType}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.muted} />
            </Pressable>

            <Text style={[styles.label, { marginTop: 8 }]}>Bird age (days)</Text>
            <View
              style={[
                styles.input,
                { backgroundColor: "#f5f5f4", justifyContent: "center" },
              ]}
            >
              <Text style={{ color: colors.muted, fontWeight: "600" }}>
                {birdAge != null ? String(birdAge) : "—"}
              </Text>
            </View>

            <Text style={[styles.label, { marginTop: 8 }]}>Bird condition</Text>
            <TextInput
              style={styles.input}
              value={condition}
              onChangeText={setCondition}
              placeholder="Healthy"
              placeholderTextColor={colors.muted}
            />

            <Text style={[styles.label, { marginTop: 8 }]}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Optional notes"
              placeholderTextColor={colors.muted}
            />

            <Pressable
              onPress={() => setFollowUpRequired((v) => !v)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginTop: 8,
                marginBottom: 8,
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: followUpRequired }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: followUpRequired ? colors.accentDark : colors.border,
                  backgroundColor: followUpRequired ? colors.accent : "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {followUpRequired ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : null}
              </View>
              <Text style={{ fontWeight: "700", color: colors.text }}>Follow-up required</Text>
            </Pressable>

            {followUpRequired ? (
              <>
                <Text style={styles.label}>Follow-up date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={followUpDate}
                  onChangeText={setFollowUpDate}
                  autoCapitalize="none"
                  placeholder="2026-07-30"
                  placeholderTextColor={colors.muted}
                />
              </>
            ) : null}

            {error ? (
              <Text style={{ color: colors.danger, marginBottom: 12, fontWeight: "600" }}>
                {error}
              </Text>
            ) : null}

            {busy ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <PrimaryButton
                label={editing ? "Save changes" : "Save visit"}
                onPress={save}
              />
            )}

            {editing ? (
              <PrimaryButton
                label="Delete visit"
                secondary
                onPress={confirmDelete}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={typePickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setTypePickerOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          onPress={() => setTypePickerOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              maxHeight: "70%",
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "800", marginBottom: 8 }}>
              Visit type
            </Text>
            <ScrollView>
              {VISIT_TYPE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    setVisitType(opt.value);
                    setTypePickerOpen(false);
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
                  <Text
                    style={{
                      fontWeight: visitType === opt.value ? "800" : "600",
                      color: colors.text,
                    }}
                  >
                    {opt.label}
                  </Text>
                  {visitType === opt.value ? (
                    <Ionicons name="checkmark" size={18} color={colors.accentDark} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
