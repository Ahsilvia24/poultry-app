import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
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
import { createLfo, deleteLfo, getLfo, listFarms, listLfos } from "../../../src/repos/data";
import { shareLfoPdf } from "../../../src/lib/reports/shareLfoPdf";
import { SharePdfIconButton } from "../../../src/components/SharePdfIconButton";
import { todayKey } from "../../../src/lib/ids";
import { currentHalfHourTime } from "../../../src/lib/time-slots";
import { scrollFieldAboveKeypad } from "../../../src/lib/scrollField";
import { useTabScrollToTop } from "../../../src/lib/tabScroll";
import { colors, styles } from "../../../src/theme";
import {
  Card,
  PageHeader,
  PrimaryButton,
} from "../../../src/components/ui";
import { CopyHouseSummaryButton } from "../../../src/components/LfoHouseSummaryBlock";
import {
  NumberKeypad,
  appendKeypadDigit,
  backspaceKeypadValue,
} from "../../../src/components/NumberKeypad";
import { LfoFarmTabs, MANUAL_LFO_TAB_ID } from "../../../src/components/LfoFarmTabs";
import { ManualLfoScreen } from "../../../src/components/ManualLfoScreen";
import { ConsumptionRateCalculator } from "../../../src/components/ConsumptionRateCalculator";

/** "2026-07-26" → "7-26-2026" (no leading zeros). */
function formatLfoDate(dateKey: string) {
  const [y, m, d] = dateKey.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${m}-${d}-${y}`;
}

function shareSavedLfo(id: string) {
  try {
    const detail = getLfo(id);
    void shareLfoPdf({
      farmName: detail.farmName,
      orderDate: detail.orderDate.slice(0, 10),
      orderTime: detail.orderTime,
      consumptionRate: detail.consumptionRate,
      calculatedAt: detail.calculatedAt,
      notes: detail.notes,
      houses: detail.houses.map((house) => ({
        houseId: house.houseId,
        houseNumber: house.houseNumber,
        headCount: house.headCount,
        binAPounds: house.binAPounds,
        binBPounds: house.binBPounds,
        feedUpAt: house.feedUpAt,
      })),
    }).catch(() => {
      Alert.alert("Could not share PDF", "Try again in a moment.");
    });
  } catch (e) {
    Alert.alert(
      "Could not share PDF",
      e instanceof Error ? e.message : "This LFO could not be loaded.",
    );
  }
}

function SavedLfoList({
  lfos,
  onOpen,
  onDelete,
}: {
  lfos: ReturnType<typeof listLfos>;
  onOpen: (id: string) => void;
  onDelete: (id: string, farmName: string) => void;
}) {
  return (
    <>
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
              onPress={() => onDelete(l.id, l.farmName)}
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
              onPress={() => onOpen(l.id)}
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
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <SharePdfIconButton
                    onPress={() => shareSavedLfo(l.id)}
                    accessibilityLabel={`Share PDF for ${l.farmName}`}
                  />
                  {l.houseSummary.length > 0 ? (
                    <CopyHouseSummaryButton lines={l.houseSummary} farmName={l.farmName} />
                  ) : null}
                </View>
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
    </>
  );
}

type CalcField = "water" | "head";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function LfoListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ farmId?: string | string[] }>();
  const routeFarmId = paramId(params.farmId);
  const [lfos, setLfos] = useState<ReturnType<typeof listLfos>>([]);
  const [farms, setFarms] = useState<ReturnType<typeof listFarms>["farms"]>([]);
  const [farmId, setFarmId] = useState(routeFarmId || "");
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
    const nextFarms = listFarms().farms;
    setFarms(nextFarms);
    setLfos(listLfos());
    setFarmId((prev) => {
      if (prev === MANUAL_LFO_TAB_ID) return prev;
      if (prev && nextFarms.some((f) => f.id === prev)) return prev;
      if (routeFarmId && nextFarms.some((f) => f.id === routeFarmId)) return routeFarmId;
      return nextFarms[0]?.id ?? MANUAL_LFO_TAB_ID;
    });
  }, [routeFarmId]);

  function dismissKeypad() {
    setActiveField(null);
    setReplaceOnType(false);
    Keyboard.dismiss();
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const el = document.activeElement;
      if (el instanceof HTMLElement) el.blur();
    }
  }

  useFocusEffect(
    useCallback(() => {
      dismissKeypad();
      load();
      return () => {
        setActiveField(null);
        setReplaceOnType(false);
      };
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

  function openLfo(id: string) {
    router.push(`/(tabs)/lfo/${id}`);
  }

  function focusField(field: CalcField) {
    Keyboard.dismiss();
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const el = document.activeElement;
      if (el instanceof HTMLElement) el.blur();
    }
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
    const base = replaceOnType ? "" : current;
    setReplaceOnType(false);
    setActiveValue(appendKeypadDigit(base, d, false));
  }

  function onBackspace() {
    setReplaceOnType(false);
    setActiveValue(backspaceKeypadValue(getActiveValue()));
  }

  function onEnter() {
    dismissKeypad();
  }

  const isManual = farmId === MANUAL_LFO_TAB_ID;

  function selectFarm(id: string) {
    dismissKeypad();
    setFarmId(id);
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
      {isManual ? (
        <ManualLfoScreen
          farms={farms}
          farmId={farmId}
          onSelectFarm={selectFarm}
          onSaved={(id) => {
            setLfos(listLfos());
            openLfo(id);
          }}
          savedSection={
            <SavedLfoList lfos={lfos} onOpen={openLfo} onDelete={confirmDelete} />
          }
        />
      ) : (
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
          onScrollBeginDrag={dismissKeypad}
          scrollEventThrottle={16}
        >
          <PageHeader
            title="Last Feed Order"
          />

          <LfoFarmTabs farms={farms} selectedId={farmId} onSelect={selectFarm} />
          <PrimaryButton
            label="Create LFO"
            onPress={() => {
              dismissKeypad();
              if (!farmId || farmId === MANUAL_LFO_TAB_ID) {
                setMsg("Select a farm first");
                return;
              }
              setLoading(true);
              try {
                const { id } = createLfo(farmId, todayKey(), undefined, currentHalfHourTime());
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

          <ConsumptionRateCalculator
            style={{ marginTop: 8 }}
            waterGal={waterGal}
            headCount={headCount}
            waterActive={activeField === "water"}
            headActive={activeField === "head"}
            onFocusWater={() => focusField("water")}
            onFocusHead={() => focusField("head")}
            waterRef={(node) => {
              waterRef.current = node;
            }}
            headRef={(node) => {
              headRef.current = node;
            }}
          />

          <SavedLfoList lfos={lfos} onOpen={openLfo} onDelete={confirmDelete} />
        </ScrollView>

        {activeField ? (
          <NumberKeypad
            allowDecimal={false}
            onDigit={onDigit}
            onBackspace={onBackspace}
            onEnter={onEnter}
          />
        ) : null}
      </View>
      )}
    </SafeAreaView>
  );
}
