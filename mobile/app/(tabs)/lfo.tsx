import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  createLfo,
  deleteLfo,
  getLfo,
  listFarms,
  listLfos,
  updateLfoInventory,
} from "../../src/repos/data";
import { todayKey } from "../../src/lib/ids";
import { colors, styles } from "../../src/theme";
import {
  Card,
  Chip,
  PageHeader,
  PrimaryButton,
  SectionTitle,
} from "../../src/components/ui";

/** Gallons of water → lbs (approx). Matches web calculator. */
const LBS_PER_GALLON = 8.34;
/** Water:feed weight ratio used to back into feed. */
const WATER_TO_FEED_RATIO = 1.9;

/** "2026-07-26" → "7-26-2026" (no leading zeros). */
function formatLfoDate(dateKey: string) {
  const [y, m, d] = dateKey.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${m}-${d}-${y}`;
}

function formatNum(n: number, digits = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function ChipScroller({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 10 }}
      contentContainerStyle={{ flexDirection: "row", alignItems: "center", paddingRight: 8 }}
    >
      {children}
    </ScrollView>
  );
}

export default function LfoScreen() {
  const router = useRouter();
  const [lfos, setLfos] = useState(listLfos());
  const [farms] = useState(listFarms().farms);
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReturnType<typeof getLfo> | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [waterGal, setWaterGal] = useState("");
  const [headCount, setHeadCount] = useState("");

  const load = useCallback(() => {
    setLfos(listLfos());
    if (selectedId) {
      try {
        setDetail(getLfo(selectedId));
      } catch {
        setDetail(null);
        setSelectedId(null);
      }
    }
  }, [selectedId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const calcResult = useMemo(() => {
    const water = Number(waterGal);
    const heads = Number(headCount);
    if (!Number.isFinite(water) || water <= 0 || !Number.isFinite(heads) || heads <= 0) {
      return null;
    }
    const wc = water * LBS_PER_GALLON;
    const fc = wc / WATER_TO_FEED_RATIO;
    const rate = fc / heads;
    return { wc, fc, rate };
  }, [waterGal, headCount]);

  function openLfo(id: string) {
    setSelectedId(id);
    setDetail(getLfo(id));
    setMsg(null);
  }

  function confirmDelete(id: string, farmName: string) {
    Alert.alert("Delete LFO", `Delete LFO for ${farmName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteLfo(id);
          if (selectedId === id) {
            setSelectedId(null);
            setDetail(null);
          }
          setLfos(listLfos());
          setMsg("LFO deleted");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader
          title="LFO"
          subtitle="Last feed order inventory and consumption rate"
        />

        <ChipScroller>
          {farms.map((f) => (
            <Chip
              key={f.id}
              label={f.farmName}
              active={farmId === f.id}
              onPress={() => setFarmId(f.id)}
            />
          ))}
        </ChipScroller>
        <PrimaryButton
          label="Create LFO"
          onPress={() => {
            if (!farmId) return;
            setLoading(true);
            const { id } = createLfo(farmId, todayKey());
            openLfo(id);
            setLfos(listLfos());
            setMsg("Created LFO");
            setLoading(false);
          }}
        />

        {msg ? (
          <Text style={{ color: colors.accentDark, marginTop: 8, fontWeight: "700" }}>{msg}</Text>
        ) : null}

        <SectionTitle>Saved LFOs</SectionTitle>
        {lfos.length === 0 ? (
          <Card>
            <Text style={styles.muted}>None yet</Text>
          </Card>
        ) : null}
        {lfos.map((l) => (
          <Card
            key={l.id}
            style={
              selectedId === l.id
                ? { borderColor: colors.accent, borderWidth: 2 }
                : undefined
            }
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => openLfo(l.id)}>
                <Text style={{ fontWeight: "800" }} numberOfLines={1}>
                  {l.farmName}
                </Text>
                <Text style={[styles.muted, { marginTop: 2 }]}>
                  {formatLfoDate(l.orderDate)}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Edit LFO for ${l.farmName}`}
                onPress={() => openLfo(l.id)}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="pencil-outline" size={20} color={colors.muted} />
              </Pressable>
              <Pressable
                accessibilityLabel={`Delete LFO for ${l.farmName}`}
                onPress={() => confirmDelete(l.id, l.farmName)}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trash-outline" size={20} color={colors.muted} />
              </Pressable>
            </View>
          </Card>
        ))}

        {detail ? (
          <View style={{ marginTop: 4 }}>
            <SectionTitle>
              {detail.farmName} · {formatLfoDate(detail.orderDate)}
            </SectionTitle>
            {detail.houses.map((h, idx) => (
              <Card key={h.id}>
                <Text style={{ fontWeight: "800", marginBottom: 8 }}>House {h.houseNumber}</Text>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Bin A lbs</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={String(h.binAPounds)}
                      onChangeText={(v) => {
                        const n = Number(v) || 0;
                        setDetail((prev) => {
                          if (!prev) return prev;
                          const houses = [...prev.houses];
                          houses[idx] = { ...houses[idx]!, binAPounds: n };
                          return { ...prev, houses };
                        });
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Bin B lbs</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={String(h.binBPounds)}
                      onChangeText={(v) => {
                        const n = Number(v) || 0;
                        setDetail((prev) => {
                          if (!prev) return prev;
                          const houses = [...prev.houses];
                          houses[idx] = { ...houses[idx]!, binBPounds: n };
                          return { ...prev, houses };
                        });
                      }}
                    />
                  </View>
                </View>
              </Card>
            ))}
            <PrimaryButton
              label="Save inventory"
              onPress={() => {
                if (!detail) return;
                updateLfoInventory(
                  detail.houses.map((h) => ({
                    id: h.id,
                    binAPounds: h.binAPounds,
                    binBPounds: h.binBPounds,
                    feedUpAt: h.feedUpAt,
                    consumptionRate: h.consumptionRate,
                  })),
                );
                setMsg("Inventory saved");
              }}
            />
          </View>
        ) : null}

        <Card style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
            Consumption rate calculator
          </Text>
          <Text style={[styles.muted, { marginTop: 4, marginBottom: 12 }]}>
            Daily water (gal) × {LBS_PER_GALLON} = WC → WC ÷ {WATER_TO_FEED_RATIO} = FC → FC ÷ head
            count
          </Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Daily water (gal)</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={waterGal}
                onChangeText={setWaterGal}
                placeholder=""
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Current head count</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={headCount}
                onChangeText={setHeadCount}
                placeholder=""
              />
            </View>
          </View>
          {calcResult ? (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.muted}>WC (water lbs)</Text>
                <Text style={{ fontWeight: "600" }}>{formatNum(calcResult.wc, 1)} lbs</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.muted}>FC (feed / day)</Text>
                <Text style={{ fontWeight: "600" }}>{formatNum(calcResult.fc, 1)} lbs</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.muted}>Consumption rate</Text>
                <Text style={{ fontWeight: "800" }}>
                  {formatNum(calcResult.rate, 3)} lbs/bird/day
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.muted}>Enter water and head count to calculate.</Text>
          )}
        </Card>

        <Pressable style={{ marginTop: 16 }} onPress={() => router.push("/(tabs)/reports")}>
          <Text style={{ color: colors.accentDark, fontWeight: "700" }}>Open reports →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
