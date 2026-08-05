import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  createLitterEvent,
  deleteLitterEvent,
  getFarmDetail,
  getLitterEvent,
  updateLitterEvent,
} from "../repos/data";
import { todayKey } from "../lib/ids";
import { LITTER_EVENT_LABELS, LITTER_EVENT_OPTIONS } from "../lib/opsLabels";
import { colors, styles } from "../theme";
import { Card, PageHeader, PrimaryButton } from "./ui";
import { DatePickerField } from "./DatePickerField";
import { OptionPicker, SelectField } from "./OptionPicker";

export function LitterFormScreen({ farmId, eventId }: { farmId: string; eventId?: string }) {
  const router = useRouter();
  const editing = Boolean(eventId);
  const detail = useMemo(() => {
    try {
      return getFarmDetail(farmId);
    } catch {
      return null;
    }
  }, [farmId]);
  const initial = useMemo(() => {
    if (!eventId) return null;
    try {
      return getLitterEvent(farmId, eventId);
    } catch {
      return null;
    }
  }, [farmId, eventId]);

  const houses = detail?.houses ?? [];
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? todayKey());
  const [eventType, setEventType] = useState(initial?.eventType ?? "FULL_LITTER_CLEANOUT");
  const [houseId, setHouseId] = useState(initial?.houseId ?? "");
  const [contractor, setContractor] = useState(initial?.contractor ?? "");
  const [litterDepth, setLitterDepth] = useState(
    initial?.litterDepth != null ? String(initial.litterDepth) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [picker, setPicker] = useState<"house" | "type" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (editing && !initial) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.content}>
          <Text style={{ color: colors.danger }}>Litter event not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  function save() {
    setBusy(true);
    setError(null);
    try {
      const depth =
        litterDepth.trim() === "" ? null : Number(litterDepth);
      if (depth != null && !Number.isFinite(depth)) throw new Error("Litter depth is invalid");
      const payload = {
        farmId,
        houseId: houseId || null,
        eventDate: eventDate.trim(),
        eventType,
        contractor,
        litterDepth: depth,
        cost: initial?.cost ?? null,
        notes,
      };
      if (eventId) updateLitterEvent(eventId, payload);
      else createLitterEvent(payload);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save litter event");
      setBusy(false);
    }
  }

  const houseLabel =
    houseId === ""
      ? "Entire farm"
      : `House ${houses.find((h) => h.id === houseId)?.houseNumber ?? "?"}`;

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
            title={editing ? "Edit litter event" : "Record litter event"}
            subtitle={detail?.farm.farmName ?? "Farm"}
          />
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <DatePickerField
                label="Event date"
                value={eventDate}
                onChange={setEventDate}
                compact
              />
              <SelectField
                label="House"
                valueLabel={houseLabel}
                onPress={() => setPicker("house")}
                compact
                style={{ flex: 1, minWidth: 0 }}
              />
            </View>
            <SelectField
              label="Event type"
              valueLabel={LITTER_EVENT_LABELS[eventType] ?? eventType}
              onPress={() => setPicker("type")}
            />
            <Text style={[styles.label, { marginTop: 8 }]}>Contractor</Text>
            <TextInput style={styles.input} value={contractor} onChangeText={setContractor} />
            <Text style={[styles.label, { marginTop: 8 }]}>Litter depth</Text>
            <TextInput
              style={styles.input}
              value={litterDepth}
              onChangeText={setLitterDepth}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.label, { marginTop: 8 }]}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 64, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            {error ? (
              <Text style={{ color: colors.danger, marginBottom: 12, fontWeight: "600" }}>
                {error}
              </Text>
            ) : null}
            {busy ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <PrimaryButton
                label={editing ? "Save changes" : "Save litter event"}
                onPress={save}
              />
            )}
            {editing && eventId ? (
              <PrimaryButton
                label="Delete litter event"
                secondary
                style={{ marginTop: 10 }}
                onPress={() =>
                  Alert.alert("Delete litter event?", "This cannot be undone.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => {
                        deleteLitterEvent(farmId, eventId);
                        router.back();
                      },
                    },
                  ])
                }
              />
            ) : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionPicker
        open={picker === "type"}
        title="Event type"
        value={eventType}
        options={LITTER_EVENT_OPTIONS}
        onSelect={setEventType}
        onClose={() => setPicker(null)}
      />
      <OptionPicker
        open={picker === "house"}
        title="House"
        value={houseId}
        options={[
          { value: "", label: "Entire farm" },
          ...houses.map((h) => ({ value: h.id, label: `House ${h.houseNumber}` })),
        ]}
        onSelect={setHouseId}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}
