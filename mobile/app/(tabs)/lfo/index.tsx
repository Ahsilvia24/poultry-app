import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as ScrollViewType,
  type View as ViewType,
} from "react-native";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { createLfo, deleteLfo, listFarms, listLfos } from "../../../src/repos/data";
import { todayKey } from "../../../src/lib/ids";
import { scrollFieldAboveKeypad } from "../../../src/lib/scrollField";
import { colors, styles } from "../../../src/theme";
import {
  Card,
  Chip,
  PageHeader,
  PrimaryButton,
  SectionTitle,
} from "../../../src/components/ui";
import {
  NumberKeypad,
  appendKeypadDigit,
  backspaceKeypadValue,
} from "../../../src/components/NumberKeypad";

/** Gallons of water → lbs (approx). Matches web calculator. */
const LBS_PER_GALLON = 8.34;
/** Water:feed weight ratio used to back into feed. */
const WATER_TO_FEED_RATIO = 1.9;

const DEFAULT_WATER_GAL = "2500";
const DEFAULT_HEAD_COUNT = "24360";

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

type CalcField = "water" | "head";

function CalcFieldButton({
  label,
  value,
  active,
  onPress,
  fieldRef,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
  fieldRef?: React.RefObject<ViewType | null>;
}) {
  return (
    <View ref={fieldRef} collapsable={false} style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={[
          styles.input,
          active ? { borderColor: colors.accentDark, borderWidth: 2 } : null,
        ]}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: value ? colors.text : colors.muted,
          }}
        >
          {value || "0"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function LfoListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [lfos, setLfos] = useState(listLfos());
  const [farms] = useState(listFarms().farms);
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [waterGal, setWaterGal] = useState(DEFAULT_WATER_GAL);
  const [headCount, setHeadCount] = useState(DEFAULT_HEAD_COUNT);
  const [activeField, setActiveField] = useState<CalcField | null>(null);
  const [replaceOnType, setReplaceOnType] = useState(false);

  const scrollRef = useRef<ScrollViewType>(null);
  const scrollYRef = useRef(0);
  const waterRef = useRef<ViewType>(null);
  const headRef = useRef<ViewType>(null);

  const load = useCallback(() => {
    setLfos(listLfos());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: activeField ? { display: "none" } : undefined,
    });
    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
    };
  }, [activeField, navigation]);

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

  function focusField(field: CalcField) {
    setActiveField(field);
    setReplaceOnType(true);
    setTimeout(() => {
      scrollFieldAboveKeypad(
        scrollRef,
        field === "water" ? waterRef : headRef,
        scrollYRef,
      );
    }, 50);
  }

  function getActiveValue() {
    return activeField === "water" ? waterGal : headCount;
  }

  function setActiveValue(next: string) {
    if (activeField === "water") setWaterGal(next);
    else if (activeField === "head") setHeadCount(next);
  }

  function onDigit(d: string) {
    const current = getActiveValue();
    const allowDecimal = activeField === "water";
    const base = replaceOnType && d !== "." ? "" : current;
    setReplaceOnType(false);
    setActiveValue(appendKeypadDigit(base, d, allowDecimal));
  }

  function onBackspace() {
    setReplaceOnType(false);
    setActiveValue(backspaceKeypadValue(getActiveValue()));
  }

  function onEnter() {
    setActiveField(null);
    setReplaceOnType(false);
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
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={styles.screen}
          contentContainerStyle={[styles.content, { paddingBottom: activeField ? 24 : 40 }]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          keyboardShouldPersistTaps="handled"
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
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
            <Text style={{ color: colors.accentDark, marginTop: 8, fontWeight: "700" }}>
              {msg}
            </Text>
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
              <CalcFieldButton
                label="Daily water (gal)"
                value={waterGal}
                active={activeField === "water"}
                onPress={() => focusField("water")}
                fieldRef={waterRef}
              />
              <CalcFieldButton
                label="Current head count"
                value={headCount}
                active={activeField === "head"}
                onPress={() => focusField("head")}
                fieldRef={headRef}
              />
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

        {activeField ? (
          <NumberKeypad
            allowDecimal={activeField === "water"}
            onDigit={onDigit}
            onBackspace={onBackspace}
            onEnter={onEnter}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
