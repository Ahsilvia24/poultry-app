import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as ScrollViewType,
  type View as ViewType,
} from "react-native";
import { useNavigation } from "expo-router";
import {
  DEFAULT_LFO_CONSUMPTION_RATE,
  calculateLastFeedOrder,
  feedUpAtFromCatch,
  formatLfoOrderClock,
} from "../lib/lfo/calculate";
import { todayKey } from "../lib/ids";
import { CUSTOM_KEYPAD_HEIGHT, scrollFieldAboveKeypad } from "../lib/scrollField";
import { useTabScrollToTop } from "../lib/tabScroll";
import { colors, fonts, styles } from "../theme";
import { Card, PageHeader, PrimaryButton } from "./ui";
import { DatePickerField } from "./DatePickerField";
import { TimeScrollPickerField } from "./TimeScrollPicker";
import { currentHalfHourTime, normalizeHalfHourTime } from "../lib/time-slots";
import {
  NumberKeypad,
  appendKeypadDigit,
  backspaceKeypadValue,
} from "./NumberKeypad";
import { LfoFarmTabs } from "./LfoFarmTabs";
import { FeedMillDataButton } from "./LfoHouseSummaryBlock";
import { formatConsumptionRate } from "../lib/lfo/consumptionRate";
import { formatFeedMillData } from "../lib/lfo/feedMillData";
import { getFarmLfoHouses, saveFarmLfo } from "../repos/data";

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

type HouseDraft = {
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

function draftsFromFarm(farmId: string): HouseDraft[] {
  return getFarmLfoHouses(farmId).map((house) => ({
    houseId: house.houseId,
    houseNumber: house.houseNumber,
    headCount: house.headCount,
    binAPounds: "0",
    binBPounds: "0",
    catchDate: house.catchDate,
    catchTime: house.catchTime,
  }));
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
          active ? { borderColor: colors.accentDark, borderWidth: 2 } : null,
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

export function FarmLfoScreen({
  farms,
  farmId,
  onSelectFarm,
  onSaved,
  savedSection,
}: {
  farms: Array<{ id: string; farmName: string }>;
  farmId: string;
  onSelectFarm: (id: string) => void;
  onSaved?: () => void;
  savedSection?: React.ReactNode;
}) {
  const navigation = useNavigation();
  const [orderDate, setOrderDate] = useState(todayKey);
  const [orderTime, setOrderTime] = useState(currentHalfHourTime);
  const [consumptionRate, setConsumptionRate] = useState(
    formatConsumptionRate(DEFAULT_LFO_CONSUMPTION_RATE),
  );
  const [houses, setHouses] = useState(() => draftsFromFarm(farmId));
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [replaceOnType, setReplaceOnType] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef<ScrollViewType>(null);
  useTabScrollToTop("lfo", scrollRef);
  const scrollYRef = useRef(0);
  const fieldRefs = useRef(new Map<string, ViewType>());

  function fieldKey(field: ActiveField | null) {
    if (!field) return "";
    if (field.kind === "rate") return "rate";
    return `${field.kind}:${field.houseId}`;
  }

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: activeField ? { display: "none" } : undefined,
    });
    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
    };
  }, [activeField, navigation]);

  useEffect(() => {
    if (!activeField) return;
    const t = setTimeout(() => {
      const node = fieldRefs.current.get(fieldKey(activeField)) ?? null;
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
      houses: houses.map((house) => ({
        houseId: house.houseId,
        houseNumber: house.houseNumber,
        headCount: house.headCount,
        binAPounds: Number(house.binAPounds) || 0,
        binBPounds: Number(house.binBPounds) || 0,
        feedUpAt: feedUpAtFromCatch(house.catchDate, house.catchTime),
      })),
    });
  }, [consumptionRate, houses, orderDate, orderTime]);

  const feedMillText = useMemo(
    () =>
      formatFeedMillData(
        houses.map((house) => {
          const result = calc.houses.find((row) => row.houseId === house.houseId);
          return {
            houseNumber: house.houseNumber,
            binAPounds: Number(house.binAPounds) || 0,
            binBPounds: Number(house.binBPounds) || 0,
            orderLbs: result?.orderLbs ?? null,
            reclaimLbs: result?.reclaimLbs ?? null,
          };
        }),
      ),
    [calc.houses, houses],
  );

  function updateHouse(houseId: string, patch: Partial<HouseDraft>) {
    setHouses((prev) => prev.map((house) => (house.houseId === houseId ? { ...house, ...patch } : house)));
  }

  function getActiveValue() {
    if (!activeField) return "";
    if (activeField.kind === "rate") return consumptionRate;
    const house = houses.find((row) => row.houseId === activeField.houseId);
    if (!house) return "";
    return activeField.kind === "binA" ? house.binAPounds : house.binBPounds;
  }

  function setActiveValue(next: string) {
    if (!activeField) return;
    if (activeField.kind === "rate") {
      setConsumptionRate(next);
      return;
    }
    updateHouse(activeField.houseId, {
      [activeField.kind === "binA" ? "binAPounds" : "binBPounds"]: next,
    });
  }

  function focusField(field: ActiveField) {
    setActiveField(field);
    setReplaceOnType(true);
    setTimeout(() => {
      const node = fieldRefs.current.get(fieldKey(field)) ?? null;
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
    const base = replaceOnType && d !== "." ? "" : current;
    setReplaceOnType(false);
    setActiveValue(appendKeypadDigit(base, d, allowDecimal));
  }

  function dismissKeypad() {
    if (activeField?.kind === "rate") {
      const n = Number(consumptionRate);
      if (Number.isFinite(n) && n > 0) setConsumptionRate(formatConsumptionRate(n));
    }
    setActiveField(null);
    setReplaceOnType(false);
  }

  function onBackspace() {
    setReplaceOnType(false);
    const current = getActiveValue();
    if (!current) {
      dismissKeypad();
      return;
    }
    setActiveValue(backspaceKeypadValue(current));
  }

  function persistLfo(resetBins: boolean) {
    try {
      setError(null);
      setSaved(false);
      const rate = Number(consumptionRate);
      saveFarmLfo({
        farmId,
        orderDate: orderDate.trim() || todayKey(),
        orderTime: normalizeHalfHourTime(orderTime) ?? currentHalfHourTime(),
        consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
        houses: houses.map((house) => ({
          houseId: house.houseId,
          binAPounds: Number(house.binAPounds) || 0,
          binBPounds: Number(house.binBPounds) || 0,
          feedUpAt: feedUpAtFromCatch(house.catchDate, house.catchTime),
          headCount: house.headCount,
        })),
      });
      setActiveField(null);
      if (resetBins) setHouses(draftsFromFarm(farmId));
      setSaved(true);
      onSaved?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save LFO. Try again.");
      return false;
    }
  }

  function save() {
    persistLfo(true);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: activeField ? CUSTOM_KEYPAD_HEIGHT : 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        onScrollBeginDrag={dismissKeypad}
        scrollEventThrottle={16}
      >
        <PageHeader title="Last Feed Order" />
        {error ? (
          <Text style={{ color: colors.danger, fontWeight: "700", marginBottom: 10 }}>
            {error}
          </Text>
        ) : null}
        {saved ? (
          <Text style={{ color: colors.accentDark, fontWeight: "700", marginBottom: 10 }}>
            Saved. Open it below anytime.
          </Text>
        ) : null}
        <LfoFarmTabs farms={farms} selectedId={farmId} onSelect={onSelectFarm} />

        <View ref={bindFieldRef("rate")} collapsable={false} style={{ marginBottom: 8 }}>
          <Pressable
            onPress={() => focusField({ kind: "rate" })}
            accessibilityRole="button"
            accessibilityLabel="Consumption rate"
          >
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 16,
                fontWeight: "800",
                color: colors.text,
              }}
            >
              Consumption Rate:{" "}
              <Text
                style={{
                  textDecorationLine: "underline",
                  color: activeField?.kind === "rate" ? colors.accentDark : colors.text,
                }}
              >
                {consumptionRate || "0"}
              </Text>{" "}
              lb/bird/day
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Bin Inventory & Feed Up</Text>
        {houses.length === 0 ? (
          <Card>
            <Text style={styles.muted}>
              This farm needs houses and an active flock.
            </Text>
          </Card>
        ) : null}

        {houses.map((house) => {
          const result = calc.houses.find((row) => row.houseId === house.houseId);
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
                <FieldButton
                  label="Bin A (lbs)"
                  value={house.binAPounds}
                  active={activeField?.kind === "binA" && activeField.houseId === house.houseId}
                  onPress={() => focusField({ kind: "binA", houseId: house.houseId })}
                  style={{ flex: 1 }}
                  fieldRef={bindFieldRef(`binA:${house.houseId}`)}
                />
                <FieldButton
                  label="Bin B (lbs)"
                  value={house.binBPounds}
                  active={activeField?.kind === "binB" && activeField.houseId === house.houseId}
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
                  expanded={openPicker === `catchDate:${house.houseId}`}
                  onChange={(date) => {
                    setActiveField(null);
                    updateHouse(house.houseId, { catchDate: date });
                  }}
                  onOpen={() => {
                    setActiveField(null);
                    setOpenPicker(`catchDate:${house.houseId}`);
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <TimeScrollPickerField
                  label="Catch time"
                  value={house.catchTime}
                  expanded={openPicker === `catchTime:${house.houseId}`}
                  onChange={(time) => {
                    setActiveField(null);
                    updateHouse(house.houseId, { catchTime: time });
                  }}
                  onOpen={() => {
                    setActiveField(null);
                    setOpenPicker(`catchTime:${house.houseId}`);
                  }}
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
                      {result.hoursUntilFeedOff == null ? "—" : formatHours(result.hoursUntilFeedOff)}
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
                expanded={openPicker === "orderDate"}
                onChange={(date) => {
                  setActiveField(null);
                  setOrderDate(date);
                }}
                onOpen={() => {
                  setActiveField(null);
                  setOpenPicker("orderDate");
                }}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TimeScrollPickerField
                label="Order time"
                value={orderTime}
                expanded={openPicker === "orderTime"}
                onChange={(time) => {
                  setActiveField(null);
                  setOrderTime(time);
                }}
                onOpen={() => {
                  setActiveField(null);
                  setOpenPicker("orderTime");
                }}
              />
            </View>
          </View>
          {formatLfoOrderClock(orderDate, orderTime) ? (
            <Text style={[styles.muted, { marginTop: 4, fontSize: 12 }]}>
              Hours from {formatLfoOrderClock(orderDate, orderTime)}
            </Text>
          ) : null}
        </Card>

        <FeedMillDataButton
          getText={() => feedMillText}
          onBeforeCopy={() => persistLfo(false)}
        />
        <PrimaryButton
          label="Save LFO"
          onPress={save}
          style={{
            marginTop: 8,
            borderWidth: 2,
            borderColor: "#022c22",
          }}
        />
        {savedSection}
      </ScrollView>

      {activeField ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss keypad"
            onPress={dismissKeypad}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <NumberKeypad
            allowDecimal={activeField.kind === "rate"}
            allowTripleZero={activeField.kind === "binA" || activeField.kind === "binB"}
            onDigit={onDigit}
            onBackspace={onBackspace}
            onEnter={dismissKeypad}
          />
        </>
      ) : null}
    </View>
  );
}
