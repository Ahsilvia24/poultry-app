import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { deleteLfo, getLfo, updateLfo } from "../../../src/repos/data";
import {
  DEFAULT_LFO_CONSUMPTION_RATE,
  calculateLastFeedOrder,
} from "../../../src/lib/lfo/calculate";
import { colors, styles } from "../../../src/theme";
import { Card, PageHeader, PrimaryButton } from "../../../src/components/ui";

/** Half-hour slots: top (:00) and bottom (:30) of each hour. */
const FEED_UP_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const minutes = i * 30;
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const value = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const ampm = hour24 < 12 ? "AM" : "PM";
  const label = `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
  return { value, label };
});

function formatLbs(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatHours(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatFeedStamp(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function splitFeedUp(feedUpAt: string | null) {
  if (!feedUpAt) return { date: "", time: "" };
  const [date = "", timePart = ""] = feedUpAt.split("T");
  const raw = timePart.slice(0, 5);
  if (!raw) return { date, time: "" };
  const [hStr, mStr] = raw.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { date, time: "" };
  const total = h * 60 + m;
  const snapped = Math.round(total / 30) * 30;
  const sh = Math.floor((snapped % (24 * 60)) / 60);
  const sm = snapped % 60;
  return {
    date,
    time: `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`,
  };
}

function joinFeedUp(date: string, time: string) {
  if (!date || !time) return null;
  return `${date}T${time}`;
}

type HouseDraft = {
  id: string;
  houseId: string;
  houseNumber: number;
  headCount: number;
  binAPounds: string;
  binBPounds: string;
  feedUpDate: string;
  feedUpTime: string;
};

function loadDraft(id: string) {
  const lfo = getLfo(id);
  return {
    farmName: lfo.farmName,
    orderDate: lfo.orderDate.slice(0, 10),
    notes: lfo.notes ?? "",
    consumptionRate: String(lfo.consumptionRate ?? DEFAULT_LFO_CONSUMPTION_RATE),
    houses: lfo.houses.map(
      (h): HouseDraft => {
        const parts = splitFeedUp(h.feedUpAt);
        return {
          id: h.id,
          houseId: h.houseId,
          houseNumber: h.houseNumber,
          headCount: h.headCount,
          binAPounds: String(h.binAPounds ?? 0),
          binBPounds: String(h.binBPounds ?? 0),
          feedUpDate: parts.date,
          feedUpTime: parts.time,
        };
      },
    ),
  };
}

export default function EditLfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [farmName, setFarmName] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [notes, setNotes] = useState("");
  const [consumptionRate, setConsumptionRate] = useState(String(DEFAULT_LFO_CONSUMPTION_RATE));
  const [houses, setHouses] = useState<HouseDraft[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(() => {
    if (!id) {
      setError("Missing LFO id");
      setReady(false);
      return;
    }
    try {
      const draft = loadDraft(id);
      setFarmName(draft.farmName);
      setOrderDate(draft.orderDate);
      setNotes(draft.notes);
      setConsumptionRate(draft.consumptionRate);
      setHouses(draft.houses);
      setError(null);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "LFO not found");
      setReady(false);
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const calc = useMemo(() => {
    const rate = Number(consumptionRate);
    return calculateLastFeedOrder({
      orderDate,
      consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
      houses: houses.map((r) => ({
        houseId: r.houseId,
        houseNumber: r.houseNumber,
        headCount: r.headCount,
        binAPounds: Number(r.binAPounds) || 0,
        binBPounds: Number(r.binBPounds) || 0,
        feedUpAt: joinFeedUp(r.feedUpDate, r.feedUpTime),
      })),
    });
  }, [consumptionRate, orderDate, houses]);

  function updateHouse(houseId: string, patch: Partial<HouseDraft>) {
    setHouses((prev) => prev.map((h) => (h.houseId === houseId ? { ...h, ...patch } : h)));
  }

  function cycleTime(houseId: string, current: string, dir: 1 | -1) {
    if (!current) {
      updateHouse(houseId, { feedUpTime: dir === 1 ? "06:00" : "18:00" });
      return;
    }
    const idx = FEED_UP_TIME_OPTIONS.findIndex((o) => o.value === current);
    const next =
      idx < 0
        ? 0
        : (idx + dir + FEED_UP_TIME_OPTIONS.length) % FEED_UP_TIME_OPTIONS.length;
    updateHouse(houseId, { feedUpTime: FEED_UP_TIME_OPTIONS[next]!.value });
  }

  function save() {
    if (!id) return;
    try {
      const rate = Number(consumptionRate);
      updateLfo({
        id,
        orderDate: orderDate.trim() || orderDate,
        notes: notes.trim() ? notes.trim() : null,
        consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
        houses: houses.map((h) => ({
          id: h.id,
          binAPounds: Number(h.binAPounds) || 0,
          binBPounds: Number(h.binBPounds) || 0,
          feedUpAt: joinFeedUp(h.feedUpDate, h.feedUpTime),
        })),
      });
      setMsg("Saved");
      setError(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save LFO");
    }
  }

  function confirmDelete() {
    if (!id) return;
    Alert.alert("Delete LFO", `Delete LFO for ${farmName || "this farm"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteLfo(id);
          router.replace("/(tabs)/lfo");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
            alignSelf: "flex-start",
            paddingVertical: 6,
            paddingRight: 8,
          }}
          accessibilityRole="button"
          accessibilityLabel="Back to LFOs"
        >
          <Ionicons name="chevron-back" size={22} color={colors.accentDark} />
          <Text style={{ fontWeight: "800", color: colors.accentDark, fontSize: 16 }}>LFOs</Text>
        </Pressable>

        <PageHeader
          title={farmName || "LFO"}
          subtitle="Edit last feed order"
        />

        {error ? (
          <Card>
            <Text style={{ color: colors.danger, fontWeight: "700" }}>{error}</Text>
            <PrimaryButton label="Back to LFOs" onPress={() => router.replace("/(tabs)/lfo")} />
          </Card>
        ) : null}

        {msg ? (
          <Text style={{ color: colors.accentDark, marginBottom: 8, fontWeight: "700" }}>{msg}</Text>
        ) : null}

        {ready ? (
          <>
            <Card>
              <Text style={styles.label}>Order date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={orderDate}
                onChangeText={setOrderDate}
                autoCapitalize="none"
                placeholder="2026-07-26"
              />
              <Text style={[styles.label, { marginTop: 12 }]}>
                Consumption rate (lbs/bird/day)
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={consumptionRate}
                onChangeText={setConsumptionRate}
              />
            </Card>

            <Text style={styles.sectionTitle}>Bin inventory & feed up</Text>
            {houses.length === 0 ? (
              <Card>
                <Text style={styles.muted}>
                  No houses on this farm. Add houses, then create a new LFO.
                </Text>
              </Card>
            ) : null}

            {houses.map((house) => {
              const result = calc.houses.find((h) => h.houseId === house.houseId);
              const timeLabel =
                FEED_UP_TIME_OPTIONS.find((o) => o.value === house.feedUpTime)?.label ??
                (house.feedUpTime ? house.feedUpTime : "Select time");
              return (
                <Card key={house.houseId}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontWeight: "800" }}>House {house.houseNumber}</Text>
                    <Text style={styles.muted}>
                      Head count {house.headCount.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Bin A (lbs)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={house.binAPounds}
                        onChangeText={(v) => updateHouse(house.houseId, { binAPounds: v })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Bin B (lbs)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={house.binBPounds}
                        onChangeText={(v) => updateHouse(house.houseId, { binBPounds: v })}
                      />
                    </View>
                  </View>
                  <Text style={[styles.label, { marginTop: 4 }]}>Feed up date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={house.feedUpDate}
                    onChangeText={(v) => updateHouse(house.houseId, { feedUpDate: v })}
                    autoCapitalize="none"
                    placeholder="2026-07-26"
                  />
                  <Text style={[styles.label, { marginTop: 4 }]}>Feed up time</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable
                      onPress={() => cycleTime(house.houseId, house.feedUpTime, -1)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#fff",
                      }}
                    >
                      <Ionicons name="chevron-back" size={20} color={colors.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => cycleTime(house.houseId, house.feedUpTime, 1)}
                      style={{
                        flex: 1,
                        minHeight: 44,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#fff",
                        paddingHorizontal: 8,
                      }}
                    >
                      <Text style={{ fontWeight: "700", color: colors.text }}>{timeLabel}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => cycleTime(house.houseId, house.feedUpTime, 1)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#fff",
                      }}
                    >
                      <Ionicons name="chevron-forward" size={20} color={colors.text} />
                    </Pressable>
                    {house.feedUpTime ? (
                      <Pressable
                        onPress={() => updateHouse(house.houseId, { feedUpTime: "" })}
                        hitSlop={8}
                      >
                        <Text style={{ color: colors.muted, fontWeight: "700" }}>Clear</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {result ? (
                    <View style={{ marginTop: 12, gap: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={styles.muted}>Feed off (−6h)</Text>
                        <Text style={{ fontWeight: "600" }}>
                          {formatFeedStamp(result.feedOffAt)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={styles.muted}>Hours until feed off</Text>
                        <Text style={{ fontWeight: "600" }}>
                          {result.hoursUntilFeedOff == null
                            ? "—"
                            : formatHours(result.hoursUntilFeedOff)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={styles.muted}>Hourly consumption</Text>
                        <Text style={{ fontWeight: "600" }}>
                          {formatLbs(result.hourlyConsumptionLbs)} lbs/hr
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={styles.muted}>
                          {result.orderLbs != null && result.orderLbs > 0
                            ? "LFO (order)"
                            : result.reclaimLbs != null && result.reclaimLbs > 0
                              ? "Reclaim"
                              : "LFO / reclaim"}
                        </Text>
                        <Text style={{ fontWeight: "800" }}>
                          {result.balanceLbs == null
                            ? "—"
                            : result.orderLbs != null && result.orderLbs > 0
                              ? `Order ${formatLbs(result.orderLbs)} lbs`
                              : result.reclaimLbs != null && result.reclaimLbs > 0
                                ? `Reclaim ${formatLbs(result.reclaimLbs)} lbs`
                                : "Even"}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </Card>
              );
            })}

            {calc.houses.some((h) => h.feedUpAt) ? (
              <Card>
                <Text style={styles.muted}>
                  Farm LFO (order):{" "}
                  <Text style={{ fontWeight: "800", color: colors.text }}>
                    {formatLbs(calc.totalOrderLbs)} lbs
                  </Text>
                </Text>
                <Text style={[styles.muted, { marginTop: 4 }]}>
                  Farm reclaim:{" "}
                  <Text style={{ fontWeight: "800", color: colors.text }}>
                    {formatLbs(calc.totalReclaimLbs)} lbs
                  </Text>
                </Text>
              </Card>
            ) : null}

            <Card>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </Card>

            <PrimaryButton label="Save changes" onPress={save} />
            <Pressable
              onPress={confirmDelete}
              style={{ alignItems: "center", paddingVertical: 16 }}
              accessibilityRole="button"
              accessibilityLabel="Delete LFO"
            >
              <Text style={{ color: colors.danger, fontWeight: "800" }}>Delete LFO</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
