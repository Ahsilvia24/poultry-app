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
import { createLfo, deleteLfo, listFarms, listLfos } from "../../../src/repos/data";
import { todayKey } from "../../../src/lib/ids";
import { colors, styles } from "../../../src/theme";
import {
  Card,
  Chip,
  PageHeader,
  PrimaryButton,
  SectionTitle,
} from "../../../src/components/ui";

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

export default function LfoListScreen() {
  const router = useRouter();
  const [lfos, setLfos] = useState(listLfos());
  const [farms] = useState(listFarms().farms);
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [waterGal, setWaterGal] = useState("");
  const [headCount, setHeadCount] = useState("");

  const load = useCallback(() => {
    setLfos(listLfos());
  }, []);

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
    router.push(`/(tabs)/lfo/${id}`);
  }

  function confirmDelete(id: string, farmName: string) {
    Alert.alert("Delete LFO", `Delete LFO for ${farmName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteLfo(id);
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
            if (!farmId) {
              setMsg("Select a farm first");
              return;
            }
            setLoading(true);
            try {
              const { id } = createLfo(farmId, todayKey());
              setLfos(listLfos());
              setMsg("Created LFO");
              openLfo(id);
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Could not create LFO");
            } finally {
              setLoading(false);
            }
          }}
        />

        {msg ? (
          <Text style={{ color: colors.accentDark, marginTop: 8, fontWeight: "700" }}>{msg}</Text>
        ) : null}

        <SectionTitle>Saved LFOs</SectionTitle>
        {lfos.length === 0 ? (
          <Card>
            <Text style={styles.muted}>None yet — create one above.</Text>
          </Card>
        ) : null}
        {lfos.map((l) => (
          <Card key={l.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                style={{ flex: 1, minWidth: 0 }}
                onPress={() => openLfo(l.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open LFO for ${l.farmName}`}
              >
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
      </ScrollView>
    </SafeAreaView>
  );
}
