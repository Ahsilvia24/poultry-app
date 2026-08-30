import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { BackHeader, Card, PrimaryButton } from "./ui";
import { DatePickerField } from "./DatePickerField";
import { ConfirmDialog } from "./ConfirmDialog";

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
  const [datePicker, setDatePicker] = useState<"visit" | "followUp" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
          <BackHeader
            backLabel="Farm"
            title="Visit"
            onBack={() => router.back()}
            accessibilityLabel="Back to farm"
          />
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
    setDeleteOpen(true);
  }

  function runDelete() {
    if (!visitId) return;
    try {
      deleteVisit(farmId, visitId);
      setDeleteOpen(false);
      router.back();
    } catch (e) {
      setDeleteOpen(false);
      setError(e instanceof Error ? e.message : "Could not delete visit");
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
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <BackHeader
            backLabel="Farm"
            title={editing ? "Edit visit" : "Log visit"}
            onBack={() => router.back()}
            accessibilityLabel="Back to farm"
          />

          <Card>
            <DatePickerField
              label="Visit date"
              value={visitDate}
              expanded={datePicker === "visit"}
              onOpen={() => setDatePicker("visit")}
              onChange={setVisitDate}
            />

            <Text style={[styles.label, { marginTop: 8 }]}>Visit type</Text>
            <Pressable
              onPress={() => {
                setDatePicker(null);
                setTypePickerOpen(true);
              }}
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
              <View style={{ marginTop: 4 }}>
                <DatePickerField
                  label="Follow-up date"
                  value={followUpDate}
                  expanded={datePicker === "followUp"}
                  onOpen={() => setDatePicker("followUp")}
                  onChange={setFollowUpDate}
                />
              </View>
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
              {(
                VISIT_TYPE_OPTIONS.some((opt) => opt.value === visitType)
                  ? VISIT_TYPE_OPTIONS
                  : [
                      {
                        value: visitType,
                        label: VISIT_TYPE_LABELS[visitType] ?? visitType,
                      },
                      ...VISIT_TYPE_OPTIONS,
                    ]
              ).map((opt) => (
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
      <ConfirmDialog
        visible={deleteOpen}
        title="Delete visit?"
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={runDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </SafeAreaView>
  );
}
