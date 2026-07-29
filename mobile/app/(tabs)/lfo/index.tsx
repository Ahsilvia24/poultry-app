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
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { createLfo, deleteLfo, listFarms, listLfos } from "../../../src/repos/data";
import { todayKey } from "../../../src/lib/ids";
import { scrollFieldAboveKeypad } from "../../../src/lib/scrollField";
import { useTabScrollToTop } from "../../../src/lib/tabScroll";
import { colors, styles } from "../../../src/theme";
import {
  Card,
  Chip,
  PageHeader,
  PrimaryButton,
} from "../../../src/components/ui";
import { CopyHouseSummaryButton } from "../../../src/components/LfoHouseSummaryBlock";
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
  placeholder,
  active,
  onPress,
  fieldRef,
}: {
  label: string;
  value: string;
  placeholder: string;
  active: boolean;
  onPress: () => void;
  fieldRef?: React.RefObject<ViewType | null>;
}) {
  const showPlaceholder = !value;
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
            color: showPlaceholder ? "rgba(120,113,108,0.55)" : colors.text,
          }}
        >
          {showPlaceholder ? placeholder : value}
        </Text>
      </Pressable>
    </View>
  );
}

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function LfoListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ farmId?: string | string[] }>();
  const routeFarmId = paramId(params.farmId);
  const [lfos, setLfos] = useState(listLfos());
  const [farms] = useState(listFarms().farms);
  const [farmId, setFarmId] = useState(() => {
    if (routeFarmId && farms.some((f) => f.id === routeFarmId)) return routeFarmId;
    return farms[0]?.id ?? "";
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [waterGal, setWaterGal] = useState("");
  const [headCount, setHeadCount] = useState("");
  const [activeField, setActiveField] = useState<CalcField | null>(null);
  const [replaceOnType, setReplaceOnType] = useState(false);

  const scrollRef = useRef<ScrollViewType>(null);
  useTabScrollToTop("lfo", scrollRef);
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
    if (routeFarmId && farms.some((f) => f.id === routeFarmId)) {
      setFarmId(routeFarmId);
    }
  }, [routeFarmId, farms]);

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: activeField ? { display: "none" } : undefined,
    });
    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
    };
  }, [activeField, navigation]);

  // Re-scroll after keypad mounts (layout shift)
  useEffect(() => {
    if (!activeField) return;
    const t = setTimeout(() => {
      scrollFieldAboveKeypad(
        scrollRef,
        activeField === "water" ? waterRef : headRef,
        scrollYRef,
      );
    }, 100);
    return () => clearTimeout(t);
  }, [activeField]);

  const calcResult = useMemo(() => {
    const water = Number(waterGal || DEFAULT_WATER_GAL);
    const heads = Number(headCount || DEFAULT_HEAD_COUNT);
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
    Alert.alert(
      "Are you sure?",
      `Delete LFO for ${farmName}? This cannot be undone.`,
      [
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
      ],
    );
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
                placeholder={DEFAULT_WATER_GAL}
                active={activeField === "water"}
                onPress={() => focusField("water")}
                fieldRef={waterRef}
              />
              <CalcFieldButton
                label="Current head count"
                value={headCount}
                placeholder={DEFAULT_HEAD_COUNT}
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

          <View style={{ marginTop: 20, marginBottom: 10 }}>
            <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 4 }]}>
              Saved LFOs
            </Text>
            <Text
              style={{
                fontSize: 11,
                lineHeight: 14,
                color: colors.muted,
                fontWeight: "600",
              }}
            >
              Rounds up to nearest 500 & adds 2000
            </Text>
            <Text
              style={{
                fontSize: 11,
                lineHeight: 14,
                color: colors.muted,
                fontWeight: "600",
              }}
            >
              Reclaim rounds to nearest 500
            </Text>
          </View>
          {lfos.length === 0 ? (
            <Card>
              <Text style={styles.muted}>None yet — create one above.</Text>
            </Card>
          ) : null}
          {lfos.map((l) => (
            <Swipeable
              key={l.id}
              overshootRight={false}
              friction={2}
              rightThreshold={40}
              containerStyle={{ marginBottom: 12 }}
              renderRightActions={() => (
                <Pressable
                  accessibilityLabel={`Delete LFO for ${l.farmName}`}
                  onPress={() => confirmDelete(l.id, l.farmName)}
                  style={{
                    backgroundColor: colors.danger,
                    justifyContent: "center",
                    alignItems: "center",
                    width: 88,
                    borderRadius: 14,
                    marginLeft: 8,
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color="#fff" />
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "800",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Delete
                  </Text>
                </Pressable>
              )}
            >
              <Card style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                <Pressable
                  onPress={() => openLfo(l.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit LFO for ${l.farmName}`}
                  style={({ pressed }) => ({
                    padding: 16,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontWeight: "800" }} numberOfLines={1}>
                        {l.farmName}
                      </Text>
                      <Text style={[styles.muted, { marginTop: 2 }]}>
                        {formatLfoDate(l.orderDate)}
                      </Text>
                    </View>
                    {l.houseSummary.length > 0 ? (
                      <CopyHouseSummaryButton lines={l.houseSummary} farmName={l.farmName} />
                    ) : null}
                  </View>
                  {l.houseSummary.length > 0 ? (
                    <View style={{ marginTop: 8, gap: 2, flexShrink: 0 }}>
                      {l.houseSummary.map((line) => (
                        <Text
                          key={line}
                          style={{ fontWeight: "700", color: colors.text, fontSize: 13 }}
                        >
                          {line}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              </Card>
            </Swipeable>
          ))}
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
