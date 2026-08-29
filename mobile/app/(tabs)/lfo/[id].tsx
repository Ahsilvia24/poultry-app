import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as ScrollViewType,
  type View as ViewType,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { deleteLfo, getLfo, saveLfoAsNew, updateLfo } from "../../../src/repos/data";
import {
  DEFAULT_LFO_CONSUMPTION_RATE,
  calculateLastFeedOrder,
  catchPartsFromFeedUpAt,
  feedUpAtFromCatch,
  formatHouseLfoSummary,
  formatLfoOrderClock,
} from "../../../src/lib/lfo/calculate";
import { scrollFieldAboveKeypad } from "../../../src/lib/scrollField";
import { useTabScrollToTop } from "../../../src/lib/tabScroll";
import { colors, fonts, styles } from "../../../src/theme";
import { Card, PrimaryButton } from "../../../src/components/ui";
import { DatePickerField } from "../../../src/components/DatePickerField";
import { TimeScrollPickerField } from "../../../src/components/TimeScrollPicker";
import { currentHalfHourTime, normalizeHalfHourTime } from "../../../src/lib/time-slots";
import {
  NumberKeypad,
  appendKeypadDigit,
  backspaceKeypadValue,
} from "../../../src/components/NumberKeypad";
import { LfoHouseSummaryBlock } from "../../../src/components/LfoHouseSummaryBlock";
import { shareLfoPdf } from "../../../src/lib/reports/shareLfoPdf";

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

function formatAsOf(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type HouseDraft = {
  id: string;
  houseId: string;
  houseNumber: number;
  headCount: number;
  binAPounds: string;
  binBPounds: string;
  catchDate: string;
  catchTime: string;
};

type ActiveField =
  | { kind: "rate" }
  | { kind: "binA"; houseId: string }
  | { kind: "binB"; houseId: string };

function loadDraft(id: string) {
  const lfo = getLfo(id);
  return {
    farmName: lfo.farmName,
    orderDate: lfo.orderDate.slice(0, 10),
    orderTime: normalizeHalfHourTime(lfo.orderTime) ?? currentHalfHourTime(),
    consumptionRate: String(lfo.consumptionRate ?? DEFAULT_LFO_CONSUMPTION_RATE),
    calculatedAt: lfo.calculatedAt,
    notes: lfo.notes,
    houses: lfo.houses.map(
      (h): HouseDraft => {
        const parts = catchPartsFromFeedUpAt(h.feedUpAt);
        return {
          id: h.id,
          houseId: h.houseId,
          houseNumber: h.houseNumber,
          headCount: h.headCount,
          binAPounds: String(h.binAPounds ?? 0),
          binBPounds: String(h.binBPounds ?? 0),
          catchDate: parts.date,
          catchTime: parts.time,
        };
      },
    ),
  };
}

function FieldButton({
  label,
  value,
  active,
  onPress,
  style,
  fieldRef,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
  style?: object;
  fieldRef?: (node: ViewType | null) => void;
}) {
  return (
    <View ref={fieldRef} collapsable={false} style={style}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={[
          styles.input,
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
          },
          active
            ? { borderColor: colors.accentDark, borderWidth: 2 }
            : null,
        ]}
      >
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.sans,
            fontSize: 16,
            fontWeight: "700",
            lineHeight: 22,
            color: value ? colors.text : colors.muted,
          }}
        >
          {value || "0"}
        </Text>
      </Pressable>
    </View>
  );
}

function fieldKey(field: ActiveField) {
  if (field.kind === "rate") return "rate";
  return `${field.kind}:${field.houseId}`;
}

export default function EditLfoScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [farmName, setFarmName] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [orderTime, setOrderTime] = useState(currentHalfHourTime);
  const [consumptionRate, setConsumptionRate] = useState(String(DEFAULT_LFO_CONSUMPTION_RATE));
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [houses, setHouses] = useState<HouseDraft[]>([]);
  const [ready, setReady] = useState(false);
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  const [replaceOnType, setReplaceOnType] = useState(false);
  const scrollRef = useRef<ScrollViewType>(null);
  useTabScrollToTop("lfo", scrollRef);
  const scrollYRef = useRef(0);
  const fieldRefs = useRef(new Map<string, ViewType>());

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
      setOrderTime(draft.orderTime);
      setConsumptionRate(draft.consumptionRate);
      setCalculatedAt(draft.calculatedAt);
      setNotes(draft.notes);
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

  useEffect(() => {
    // LFO edit is nested under the LFO stack — hide the root tab bar
    const tabs = navigation.getParent();
    tabs?.setOptions({
      tabBarStyle: activeField ? { display: "none" } : undefined,
    });
    return () => {
      tabs?.setOptions({ tabBarStyle: undefined });
    };
  }, [activeField, navigation]);

  // Re-scroll after keypad mounts (layout shift)
  useEffect(() => {
    if (!activeField) return;
    const key = fieldKey(activeField);
    const t = setTimeout(() => {
      const node = fieldRefs.current.get(key) ?? null;
      scrollFieldAboveKeypad(scrollRef, { current: node }, scrollYRef);
    }, 100);
    return () => clearTimeout(t);
  }, [activeField]);

  const calc = useMemo(() => {
    const rate = Number(consumptionRate);
    return calculateLastFeedOrder({
      orderDate,
      orderTime,
      consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
      houses: houses.map((r) => ({
        houseId: r.houseId,
        houseNumber: r.houseNumber,
        headCount: r.headCount,
        binAPounds: Number(r.binAPounds) || 0,
        binBPounds: Number(r.binBPounds) || 0,
        feedUpAt: feedUpAtFromCatch(r.catchDate, r.catchTime),
      })),
    });
  }, [consumptionRate, orderDate, orderTime, houses]);

  const houseSummary = useMemo(() => formatHouseLfoSummary(calc.houses), [calc.houses]);

  function shareCurrentLfo() {
    const rate = Number(consumptionRate);
    void shareLfoPdf({
      farmName,
      orderDate,
      orderTime,
      consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
      calculatedAt,
      notes,
      houses: houses.map((house) => ({
        houseId: house.houseId,
        houseNumber: house.houseNumber,
        headCount: house.headCount,
        binAPounds: Number(house.binAPounds) || 0,
        binBPounds: Number(house.binBPounds) || 0,
        catchDate: house.catchDate,
        catchTime: house.catchTime,
      })),
    }).catch(() => {
      Alert.alert("Could not share PDF", "Try again in a moment.");
    });
  }

  function updateHouse(houseId: string, patch: Partial<HouseDraft>) {
    setHouses((prev) => prev.map((h) => (h.houseId === houseId ? { ...h, ...patch } : h)));
  }

  function getActiveValue() {
    if (!activeField) return "";
    if (activeField.kind === "rate") return consumptionRate;
    const house = houses.find((h) => h.houseId === activeField.houseId);
    if (!house) return "";
    return activeField.kind === "binA" ? house.binAPounds : house.binBPounds;
  }

  function setActiveValue(next: string) {
    if (!activeField) return;
    if (activeField.kind === "rate") {
      setConsumptionRate(next);
      return;
    }
    if (activeField.kind === "binA") {
      updateHouse(activeField.houseId, { binAPounds: next });
      return;
    }
    updateHouse(activeField.houseId, { binBPounds: next });
  }

  function focusField(field: ActiveField) {
    setActiveField(field);
    setReplaceOnType(true);
    const key = fieldKey(field);
    setTimeout(() => {
      const node = fieldRefs.current.get(key) ?? null;
      scrollFieldAboveKeypad(scrollRef, { current: node }, scrollYRef);
    }, 50);
  }

  function bindFieldRef(key: string) {
    return (node: ViewType | null) => {
      if (node) fieldRefs.current.set(key, node);
      else fieldRefs.current.delete(key);
    };
  }

  function onDigit(d: string) {
    const current = getActiveValue();
    const allowDecimal = activeField?.kind === "rate";
    // Fresh typing replaces the field; 000 / decimal still append to a cleared base.
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

  function save() {
    if (!id) return;
    try {
      const rate = Number(consumptionRate);
      updateLfo({
        id,
        orderDate: orderDate.trim() || orderDate,
        orderTime: normalizeHalfHourTime(orderTime) ?? currentHalfHourTime(),
        notes: null,
        consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
        houses: houses.map((h) => ({
          id: h.id,
          houseId: h.houseId,
          binAPounds: Number(h.binAPounds) || 0,
          binBPounds: Number(h.binBPounds) || 0,
          feedUpAt: feedUpAtFromCatch(h.catchDate, h.catchTime),
        })),
      });
      setMsg("Saved");
      setError(null);
      setActiveField(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save LFO");
    }
  }

  function saveAsNew() {
    if (!id) return;
    try {
      const rate = Number(consumptionRate);
      const created = saveLfoAsNew({
        sourceId: id,
        orderDate: orderDate.trim() || orderDate,
        orderTime: normalizeHalfHourTime(orderTime) ?? currentHalfHourTime(),
        notes: null,
        consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
        houses: houses.map((h) => ({
          houseId: h.houseId,
          binAPounds: Number(h.binAPounds) || 0,
          binBPounds: Number(h.binBPounds) || 0,
          feedUpAt: feedUpAtFromCatch(h.catchDate, h.catchTime),
        })),
      });
      setError(null);
      setActiveField(null);
      router.replace(`/(tabs)/lfo/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save new LFO");
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
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)/lfo");
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
          keyboardShouldPersistTaps="handled"
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
                paddingVertical: 6,
                paddingRight: 4,
              }}
              accessibilityRole="button"
              accessibilityLabel="Back to LFOs"
            >
              <Ionicons name="chevron-back" size={22} color={colors.accentDark} />
              <Text style={{ fontWeight: "800", color: colors.accentDark, fontSize: 16 }}>
                LFOs
              </Text>
            </Pressable>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: "right",
                fontSize: 22,
                fontWeight: "800",
                color: colors.text,
              }}
            >
              {farmName || "LFO"}
            </Text>
          </View>

          {error ? (
            <Card>
              <Text style={{ color: colors.danger, fontWeight: "700" }}>{error}</Text>
              <PrimaryButton
                label="Back to LFOs"
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace("/(tabs)/lfo");
                }}
              />
            </Card>
          ) : null}

          {msg ? (
            <Text style={{ color: colors.accentDark, marginBottom: 8, fontWeight: "700" }}>
              {msg}
            </Text>
          ) : null}

          {ready ? (
            <>
              {formatLfoOrderClock(orderDate, orderTime) ? (
                <Text style={[styles.muted, { marginBottom: 10 }]}>
                  Hours until feed off are measured from{" "}
                  {formatLfoOrderClock(orderDate, orderTime)}.
                  {calculatedAt
                    ? ` Head counts stay frozen to ${formatAsOf(calculatedAt)}.`
                    : ""}
                </Text>
              ) : null}

              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <DatePickerField
                      label="Order date"
                      value={orderDate}
                      onChange={(date) => {
                        setActiveField(null);
                        setOrderDate(date);
                      }}
                      onOpen={() => setActiveField(null)}
                    />
                    <TimeScrollPickerField
                      label="Order time"
                      value={orderTime}
                      onChange={(time) => {
                        setActiveField(null);
                        setOrderTime(time);
                      }}
                      onOpen={() => setActiveField(null)}
                    />
                  </View>
                  <FieldButton
                    label="Consumption rate"
                    value={consumptionRate}
                    active={activeField?.kind === "rate"}
                    onPress={() => focusField({ kind: "rate" })}
                    fieldRef={bindFieldRef("rate")}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                </View>
                <Text style={[styles.muted, { marginTop: 4, fontSize: 12 }]}>
                  Consumption rate in lbs/bird/day
                </Text>
                {formatLfoOrderClock(orderDate, orderTime) ? (
                  <Text style={[styles.muted, { marginTop: 4, fontSize: 12 }]}>
                    Hours from {formatLfoOrderClock(orderDate, orderTime)}
                  </Text>
                ) : null}
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
                        {calculatedAt ? " at save" : ""}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <FieldButton
                        label="Bin A (lbs)"
                        value={house.binAPounds}
                        active={
                          activeField?.kind === "binA" && activeField.houseId === house.houseId
                        }
                        onPress={() => focusField({ kind: "binA", houseId: house.houseId })}
                        style={{ flex: 1 }}
                        fieldRef={bindFieldRef(`binA:${house.houseId}`)}
                      />
                      <FieldButton
                        label="Bin B (lbs)"
                        value={house.binBPounds}
                        active={
                          activeField?.kind === "binB" && activeField.houseId === house.houseId
                        }
                        onPress={() => focusField({ kind: "binB", houseId: house.houseId })}
                        style={{ flex: 1 }}
                        fieldRef={bindFieldRef(`binB:${house.houseId}`)}
                      />
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 10,
                        marginTop: 4,
                      }}
                    >
                      <DatePickerField
                        label="Catch date"
                        value={house.catchDate}
                        onChange={(date) => {
                          setActiveField(null);
                          updateHouse(house.houseId, { catchDate: date });
                        }}
                        onOpen={() => setActiveField(null)}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <TimeScrollPickerField
                        label="Catch time"
                        value={house.catchTime}
                        onChange={(time) => {
                          setActiveField(null);
                          updateHouse(house.houseId, { catchTime: time });
                        }}
                        onOpen={() => setActiveField(null)}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                    </View>
                    {house.catchTime ? (
                      <Pressable
                        onPress={() => updateHouse(house.houseId, { catchTime: "" })}
                        style={{ alignSelf: "flex-end", marginTop: 6 }}
                        hitSlop={8}
                      >
                        <Text style={{ color: colors.muted, fontWeight: "700" }}>Clear time</Text>
                      </Pressable>
                    ) : null}

                    {result ? (
                      <View style={{ marginTop: 12, gap: 4 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={styles.muted}>Feed up (−5)</Text>
                          <Text style={{ fontFamily: fonts.sans, fontWeight: "600" }}>
                            {formatFeedStamp(result.feedUpAt)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={styles.muted}>Feed off (−10)</Text>
                          <Text style={{ fontFamily: fonts.sans, fontWeight: "600" }}>
                            {formatFeedStamp(result.feedOffAt)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={styles.muted}>Hours until feed off</Text>
                          <Text style={{ fontFamily: fonts.sans, fontWeight: "600" }}>
                            {result.hoursUntilFeedOff == null
                              ? "—"
                              : formatHours(result.hoursUntilFeedOff)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={styles.muted}>Hourly consumption</Text>
                          <Text style={{ fontFamily: fonts.sans, fontWeight: "600" }}>
                            {formatLbs(result.hourlyConsumptionLbs)} lbs/hr
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={styles.muted}>Feed used until off</Text>
                          <Text style={{ fontFamily: fonts.sans, fontWeight: "600" }}>
                            {result.feedConsumedUntilOffLbs == null
                              ? "—"
                              : `${formatLbs(result.feedConsumedUntilOffLbs)} lbs`}
                          </Text>
                        </View>
                        {result.rawOrderLbs != null && result.rawOrderLbs > 0 ? (
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={styles.muted}>LFO</Text>
                            <Text style={{ fontFamily: fonts.sans, fontWeight: "600" }}>
                              {formatLbs(result.rawOrderLbs)} lbs
                            </Text>
                          </View>
                        ) : result.rawReclaimLbs != null && result.rawReclaimLbs > 0 ? (
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={styles.muted}>Reclaim</Text>
                            <Text style={{ fontFamily: fonts.sans, fontWeight: "600" }}>
                              {formatLbs(result.rawReclaimLbs)} lbs
                            </Text>
                          </View>
                        ) : null}
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={styles.muted}>
                            {result.orderLbs != null && result.orderLbs > 0
                              ? "LFO (rounded)"
                              : result.reclaimLbs != null && result.reclaimLbs > 0
                                ? "Reclaim (rounded)"
                                : "LFO / reclaim (rounded)"}
                          </Text>
                          <Text style={{ fontFamily: fonts.sans, fontWeight: "800" }}>
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

              {houseSummary.length > 0 ? (
                <Card>
                  <View style={{ marginTop: -4 }}>
                    <LfoHouseSummaryBlock
                      lines={houseSummary}
                      farmName={farmName}
                      fontSize={15}
                      onSharePdf={shareCurrentLfo}
                    />
                  </View>
                </Card>
              ) : null}

              <PrimaryButton
                label="Share PDF"
                secondary
                onPress={shareCurrentLfo}
              />
              <PrimaryButton label="Save changes" onPress={save} style={{ marginTop: 8 }} />
              <PrimaryButton
                label="Save as new LFO"
                secondary
                onPress={saveAsNew}
                style={{ marginTop: 8 }}
              />
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

        {activeField ? (
          <NumberKeypad
            allowDecimal={activeField.kind === "rate"}
            allowTripleZero={activeField.kind === "binA" || activeField.kind === "binB"}
            onDigit={onDigit}
            onBackspace={onBackspace}
            onEnter={onEnter}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
