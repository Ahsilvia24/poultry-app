import { useEffect, useMemo, useRef, useState } from "react";
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
import { useNavigation, useRouter } from "expo-router";
import {
  DEFAULT_LFO_CONSUMPTION_RATE,
  calculateLastFeedOrder,
  feedUpAtFromCatch,
  formatHouseLfoSummary,
  formatLfoOrderClock,
} from "../lib/lfo/calculate";
import { todayKey } from "../lib/ids";
import { scrollFieldAboveKeypad } from "../lib/scrollField";
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
import { LfoHouseSummaryBlock } from "./LfoHouseSummaryBlock";
import { LfoFarmTabs } from "./LfoFarmTabs";
import { ConsumptionRateCalculator } from "./ConsumptionRateCalculator";
import { createManualLfo } from "../repos/data";

const MANUAL_HOUSE_ID = "manual";

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

function formatHeadCountLabel(raw: string) {
  if (!raw) return "Head count";
  const n = Number(raw);
  if (!Number.isFinite(n)) return `Head count ${raw}`;
  return `Head count ${n.toLocaleString()}`;
}

type ActiveField = "rate" | "head" | "binA" | "binB" | "calcWater" | "calcHead";

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

export function ManualLfoScreen({
  farms,
  farmId,
  onSelectFarm,
  onSaved,
  savedSection,
}: {
  farms: Array<{ id: string; farmName: string }>;
  farmId: string;
  onSelectFarm: (id: string) => void;
  onSaved?: (id: string) => void;
  savedSection?: React.ReactNode;
}) {
  const navigation = useNavigation();
  const router = useRouter();
  const [orderDate, setOrderDate] = useState(todayKey);
  const [orderTime, setOrderTime] = useState(currentHalfHourTime);
  const [consumptionRate, setConsumptionRate] = useState(String(DEFAULT_LFO_CONSUMPTION_RATE));
  const [headCount, setHeadCount] = useState("");
  const [calcWaterGal, setCalcWaterGal] = useState("");
  const [calcHeadCount, setCalcHeadCount] = useState("");
  const [binAPounds, setBinAPounds] = useState("0");
  const [binBPounds, setBinBPounds] = useState("0");
  const [catchDate, setCatchDate] = useState("");
  const [catchTime, setCatchTime] = useState("");
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  const [replaceOnType, setReplaceOnType] = useState(false);
  const scrollRef = useRef<ScrollViewType>(null);
  useTabScrollToTop("lfo", scrollRef);
  const scrollYRef = useRef(0);
  const fieldRefs = useRef(new Map<string, ViewType>());

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
      const node = fieldRefs.current.get(activeField) ?? null;
      scrollFieldAboveKeypad(scrollRef, { current: node }, scrollYRef);
    }, 100);
    return () => clearTimeout(t);
  }, [activeField]);

  const heads = Number(headCount);
  const calc = useMemo(() => {
    const rate = Number(consumptionRate);
    return calculateLastFeedOrder({
      orderDate,
      orderTime,
      consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
      houses: [
        {
          houseId: MANUAL_HOUSE_ID,
          houseNumber: 1,
          headCount: Number.isFinite(heads) && heads > 0 ? heads : 0,
          binAPounds: Number(binAPounds) || 0,
          binBPounds: Number(binBPounds) || 0,
          feedUpAt: feedUpAtFromCatch(catchDate, catchTime),
        },
      ],
    });
  }, [binAPounds, binBPounds, catchDate, catchTime, consumptionRate, heads, orderDate, orderTime]);

  const result = calc.houses[0];
  const houseSummary = useMemo(() => formatHouseLfoSummary(calc.houses), [calc.houses]);

  function getActiveValue() {
    if (activeField === "rate") return consumptionRate;
    if (activeField === "head") return headCount;
    if (activeField === "binA") return binAPounds;
    if (activeField === "binB") return binBPounds;
    if (activeField === "calcWater") return calcWaterGal;
    if (activeField === "calcHead") return calcHeadCount;
    return "";
  }

  function setActiveValue(next: string) {
    if (activeField === "rate") setConsumptionRate(next);
    else if (activeField === "head") setHeadCount(next);
    else if (activeField === "binA") setBinAPounds(next);
    else if (activeField === "binB") setBinBPounds(next);
    else if (activeField === "calcWater") setCalcWaterGal(next);
    else if (activeField === "calcHead") setCalcHeadCount(next);
  }

  function focusField(field: ActiveField) {
    setActiveField(field);
    setReplaceOnType(true);
    setTimeout(() => {
      const node = fieldRefs.current.get(field) ?? null;
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
    const allowDecimal = activeField === "rate";
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
    try {
      const rate = Number(consumptionRate);
      const { id } = createManualLfo({
        orderDate: orderDate.trim() || todayKey(),
        orderTime: normalizeHalfHourTime(orderTime) ?? currentHalfHourTime(),
        consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
        headCount: Number.isFinite(heads) && heads > 0 ? heads : 0,
        binAPounds: Number(binAPounds) || 0,
        binBPounds: Number(binBPounds) || 0,
        feedUpAt: feedUpAtFromCatch(catchDate, catchTime),
      });
      setActiveField(null);
      if (onSaved) onSaved(id);
      else router.push(`/(tabs)/lfo/${id}`);
    } catch (e) {
      Alert.alert("Could not save LFO", e instanceof Error ? e.message : "Try again");
    }
  }

  return (
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
        <PageHeader title="Last Feed Order" />
        <LfoFarmTabs farms={farms} selectedId={farmId} onSelect={onSelectFarm} />

        <ConsumptionRateCalculator
          waterGal={calcWaterGal}
          headCount={calcHeadCount}
          waterActive={activeField === "calcWater"}
          headActive={activeField === "calcHead"}
          onFocusWater={() => focusField("calcWater")}
          onFocusHead={() => focusField("calcHead")}
          waterRef={bindFieldRef("calcWater")}
          headRef={bindFieldRef("calcHead")}
        />

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
              active={activeField === "rate"}
              onPress={() => focusField("rate")}
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
        <Card>
          <View
            ref={bindFieldRef("head")}
            collapsable={false}
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              marginBottom: 8,
            }}
          >
            <Pressable
              onPress={() => focusField("head")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Enter bird count"
            >
              <Text
                style={{
                  color: activeField === "head" ? colors.accentDark : colors.muted,
                  fontWeight: activeField === "head" ? "800" : "600",
                }}
              >
                {formatHeadCountLabel(headCount)}
              </Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <FieldButton
              label="Bin A (lbs)"
              value={binAPounds}
              active={activeField === "binA"}
              onPress={() => focusField("binA")}
              style={{ flex: 1 }}
              fieldRef={bindFieldRef("binA")}
            />
            <FieldButton
              label="Bin B (lbs)"
              value={binBPounds}
              active={activeField === "binB"}
              onPress={() => focusField("binB")}
              style={{ flex: 1 }}
              fieldRef={bindFieldRef("binB")}
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
              value={catchDate}
              onChange={(date) => {
                setActiveField(null);
                setCatchDate(date);
              }}
              onOpen={() => setActiveField(null)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <TimeScrollPickerField
              label="Catch time"
              value={catchTime}
              onChange={(time) => {
                setActiveField(null);
                setCatchTime(time);
              }}
              onOpen={() => setActiveField(null)}
              style={{ flex: 1, minWidth: 0 }}
            />
          </View>
          {catchTime ? (
            <Pressable
              onPress={() => setCatchTime("")}
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

        {houseSummary.length > 0 ? (
          <Card>
            <View style={{ marginTop: -4 }}>
              <LfoHouseSummaryBlock lines={houseSummary} farmName="Manual" fontSize={15} />
            </View>
          </Card>
        ) : null}

        <PrimaryButton label="Save LFO" onPress={save} />
        {savedSection}
      </ScrollView>

      {activeField ? (
        <NumberKeypad
          allowDecimal={activeField === "rate"}
          allowTripleZero={activeField === "binA" || activeField === "binB" || activeField === "head"}
          onDigit={onDigit}
          onBackspace={onBackspace}
          onEnter={onEnter}
        />
      ) : null}
    </View>
  );
}
