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
  const houseOptions = useMemo(
    () =>
      flocks.flatMap((f) =>
        f.houses.map((h) => ({
          houseFlockId: h.houseFlockId,
          houseNumber: h.houseNumber,
          flockId: f.id,
          flockNumber: f.flockNumber,
        })),
      ),
    [flocks],
  );
  const houseNumbersDuplicated = useMemo(() => {
    const counts = new Map<number, number>();
    for (const h of houseOptions) {
      counts.set(h.houseNumber, (counts.get(h.houseNumber) ?? 0) + 1);
    }
    return [...counts.values()].some((n) => n > 1);
  }, [houseOptions]);

  const defaultFlock = flocks.find((f) => f.status === "ACTIVE") ?? flocks[0] ?? null;
  const resolvedInitialFlockId = initial?.flockId ?? defaultFlock?.id ?? "";
  const resolvedInitialHouse =
    initial?.houseFlockId ??
    houseOptions.find((h) => h.flockId === resolvedInitialFlockId)?.houseFlockId ??
    houseOptions[0]?.houseFlockId ??
    "";

  const [deliveryDate, setDeliveryDate] = useState(initial?.deliveryDate ?? todayKey());
  const [flockId, setFlockId] = useState(resolvedInitialFlockId);
  const [houseFlockId, setHouseFlockId] = useState(resolvedInitialHouse);
  const [pounds, setPounds] = useState(
    initial?.poundsDelivered != null ? String(initial.poundsDelivered) : "",
  );
  const [feedType, setFeedType] = useState(initial?.feedType ?? "Starter");
  const [feedMill, setFeedMill] = useState(initial?.feedMill ?? "Heavener");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [picker, setPicker] = useState<"house" | "type" | "mill" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedHouse = houseOptions.find((h) => h.houseFlockId === houseFlockId) ?? null;

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
        ticketNumber: initial?.ticketNumber ?? null,
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

  const houseLabel = selectedHouse
    ? houseNumbersDuplicated
      ? `House ${selectedHouse.houseNumber} (${selectedHouse.flockNumber})`
      : `House ${selectedHouse.houseNumber}`
    : "Select house";

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
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <DatePickerField
                label="Delivery date"
                value={deliveryDate}
                onChange={setDeliveryDate}
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
                onPress={() =>
                  Alert.alert("Delete feed delivery?", "This cannot be undone.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => {
                        deleteFeedDelivery(deliveryId);
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
        open={picker === "house"}
        title="House"
        value={houseFlockId}
        options={houseOptions.map((h) => ({
          value: h.houseFlockId,
          label: houseNumbersDuplicated
            ? `House ${h.houseNumber} (${h.flockNumber})`
            : `House ${h.houseNumber}`,
        }))}
        onSelect={(id) => {
          setHouseFlockId(id);
          const opt = houseOptions.find((h) => h.houseFlockId === id);
          if (opt) setFlockId(opt.flockId);
        }}
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
    </SafeAreaView>
  );
}
