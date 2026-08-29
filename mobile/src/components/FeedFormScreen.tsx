import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  createFeedDelivery,
  deleteFeedDelivery,
  getFarmDetail,
  getFeedDelivery,
  updateFeedDelivery,
} from "../repos/data";
import { todayKey } from "../lib/ids";
import { FEED_MILL_OPTIONS, FEED_TYPE_OPTIONS } from "../lib/opsLabels";
import { colors, styles } from "../theme";
import { Card, PageHeader, PrimaryButton } from "./ui";
import { DatePickerField } from "./DatePickerField";
import { OptionPicker, SelectField } from "./OptionPicker";
import { ConfirmDialog } from "./ConfirmDialog";

export function FeedFormScreen({ farmId, deliveryId }: { farmId: string; deliveryId?: string }) {
  const router = useRouter();
  const editing = Boolean(deliveryId);
  const detail = useMemo(() => {
    try {
      return getFarmDetail(farmId);
    } catch {
      return null;
    }
  }, [farmId]);
  const initial = useMemo(() => {
    if (!deliveryId) return null;
    try {
      return getFeedDelivery(deliveryId);
    } catch {
      return null;
    }
  }, [deliveryId]);

  const flocks = detail?.flocks ?? [];
  const defaultFlock =
    flocks.find((f) => f.status === "ACTIVE") ?? flocks[0] ?? null;

  const [deliveryDate, setDeliveryDate] = useState(initial?.deliveryDate ?? todayKey());
  const [flockId, setFlockId] = useState(initial?.flockId ?? defaultFlock?.id ?? "");
  const selectedFlock = flocks.find((f) => f.id === flockId) ?? defaultFlock;
  const [houseFlockId, setHouseFlockId] = useState(
    initial?.houseFlockId ?? selectedFlock?.houses[0]?.houseFlockId ?? "",
  );
  const [pounds, setPounds] = useState(
    initial?.poundsDelivered != null ? String(initial.poundsDelivered) : "",
  );
  const [feedType, setFeedType] = useState(initial?.feedType ?? "Starter");
  const [feedMill, setFeedMill] = useState(initial?.feedMill ?? "Heavener");
  const [ticketNumber, setTicketNumber] = useState(initial?.ticketNumber ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [picker, setPicker] = useState<"date" | "flock" | "house" | "type" | "mill" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (editing && !initial) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.content}>
          <Text style={{ color: colors.danger }}>Feed delivery not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  function save() {
    setBusy(true);
    setError(null);
    try {
      const poundsDelivered = Number(pounds);
      const payload = {
        flockId: flockId || null,
        houseFlockId: houseFlockId || null,
        deliveryDate: deliveryDate.trim(),
        poundsDelivered,
        feedType,
        feedMill,
        ticketNumber,
        notes,
      };
      if (deliveryId) updateFeedDelivery(deliveryId, payload);
      else createFeedDelivery(payload);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save feed delivery");
      setBusy(false);
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
          <Pressable onPress={() => router.back()} style={{ marginBottom: 8 }}>
            <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Back</Text>
          </Pressable>
          <PageHeader
            title={editing ? "Edit feed delivery" : "Record feed delivery"}
            subtitle={detail?.farm.farmName ?? "Farm"}
          />
          <Card>
            <DatePickerField
              label="Delivery date"
              value={deliveryDate}
              expanded={picker === "date"}
              onOpen={() => setPicker("date")}
              onChange={setDeliveryDate}
            />
            <SelectField
              label="Flock"
              valueLabel={
                selectedFlock
                  ? `${selectedFlock.flockNumber}${selectedFlock.status === "ACTIVE" ? " (active)" : ""}`
                  : "Select flock"
              }
              onPress={() => setPicker("flock")}
            />
            <SelectField
              label="House"
              valueLabel={
                houseFlockId
                  ? `House ${
                      selectedFlock?.houses.find((h) => h.houseFlockId === houseFlockId)
                        ?.houseNumber ?? "?"
                    }`
                  : "Select house"
              }
              onPress={() => setPicker("house")}
            />
            <Text style={[styles.label, { marginTop: 8 }]}>Pounds delivered *</Text>
            <TextInput
              style={styles.input}
              value={pounds}
              onChangeText={setPounds}
              keyboardType="decimal-pad"
            />
            <SelectField
              label="Feed type"
              valueLabel={feedType || "—"}
              onPress={() => setPicker("type")}
            />
            <SelectField
              label="Feed mill"
              valueLabel={feedMill || "—"}
              onPress={() => setPicker("mill")}
            />
            <Text style={[styles.label, { marginTop: 8 }]}>Ticket number</Text>
            <TextInput style={styles.input} value={ticketNumber} onChangeText={setTicketNumber} />
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
                label={editing ? "Save changes" : "Save feed delivery"}
                onPress={save}
              />
            )}
            {editing && deliveryId ? (
              <PrimaryButton
                label="Delete feed delivery"
                secondary
                style={{ marginTop: 10 }}
                onPress={() => setDeleteOpen(true)}
              />
            ) : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionPicker
        open={picker === "flock"}
        title="Flock"
        value={flockId}
        options={flocks.map((f) => ({
          value: f.id,
          label: `${f.flockNumber}${f.status === "ACTIVE" ? " (active)" : ""}`,
        }))}
        onSelect={(id) => {
          setFlockId(id);
          const next = flocks.find((f) => f.id === id);
          setHouseFlockId(next?.houses[0]?.houseFlockId ?? "");
        }}
        onClose={() => setPicker(null)}
      />
      <OptionPicker
        open={picker === "house"}
        title="House"
        value={houseFlockId}
        options={(selectedFlock?.houses ?? []).map((h) => ({
          value: h.houseFlockId,
          label: `House ${h.houseNumber}`,
        }))}
        onSelect={setHouseFlockId}
        onClose={() => setPicker(null)}
      />
      <OptionPicker
        open={picker === "type"}
        title="Feed type"
        value={feedType}
        options={FEED_TYPE_OPTIONS.map((v) => ({ value: v, label: v }))}
        onSelect={setFeedType}
        onClose={() => setPicker(null)}
      />
      <OptionPicker
        open={picker === "mill"}
        title="Feed mill"
        value={feedMill}
        options={FEED_MILL_OPTIONS.map((v) => ({ value: v, label: v }))}
        onSelect={setFeedMill}
        onClose={() => setPicker(null)}
      />
      <ConfirmDialog
        visible={deleteOpen}
        title="Delete feed delivery?"
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (!deliveryId) return;
          deleteFeedDelivery(deliveryId);
          setDeleteOpen(false);
          router.back();
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </SafeAreaView>
  );
}
