import { useCallback, useEffect, useRef, useState, type Ref, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type ScrollView as ScrollViewType,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  completeFlock,
  createGeneratorLog,
  createHouse,
  deleteFeedDelivery,
  deleteGeneratorLog,
  deleteHouse,
  deleteIssue,
  deleteLitterEvent,
  deleteVisit,
  getFarmDetail,
  updateFarm,
  updateGeneratorLog,
  updateHouse,
  updateHouseLoggedTemp,
} from "../../../../src/repos/data";
import {
  consumeFarmReturnFromMortality,
  getFarmNavContext,
  setFarmNavContext,
  useGoToFarmList,
} from "../../../../src/lib/farmNavContext";
import { useTabScrollToTop } from "../../../../src/lib/tabScroll";
import { VISIT_TYPE_LABELS } from "../../../../src/lib/visits";
import {
  ISSUE_CATEGORY_LABELS,
  LITTER_EVENT_LABELS,
} from "../../../../src/lib/opsLabels";
import {
  detectGeneratorHourSwap,
  formatGeneratorChartsCopy,
  formatGeneratorHours,
  hoursDelta,
  previousGeneratorHoursFromLogs,
  GENERATOR_FIELD_DEFS,
  MAX_GENERATOR_HOUR_LOGS,
  type GenHourKey,
  type GeneratorHourSwapSuggestion,
  type GeneratorHours,
} from "../../../../src/lib/generator";
import { addDaysKey, todayKey } from "../../../../src/lib/ids";
import { formatGroupedInput, parseGroupedNumber, ungroupNumber } from "../../../../src/lib/grouped-number";
import { colors, styles } from "../../../../src/theme";
import {
  Card,
  Chip,
  Metric,
  PrimaryButton,
  WeeklyMortalityList,
  formatNumber,
  formatPct,
} from "../../../../src/components/ui";
import { DatePickerField } from "../../../../src/components/DatePickerField";
import { TimeScrollPickerField } from "../../../../src/components/TimeScrollPicker";
import { ClipboardIconButton } from "../../../../src/components/ClipboardIconButton";
import { compactCatchTimeLabel } from "../../../../src/lib/time-slots";
import { ConfirmDialog } from "../../../../src/components/ConfirmDialog";
import { SwipeCommitDeleteRow } from "../../../../src/components/SwipeCommitDeleteRow";
import { useExclusiveSwipeables } from "../../../../src/lib/useExclusiveSwipeables";
import {
  NumberKeypad,
  appendKeypadDigit,
  backspaceKeypadValue,
} from "../../../../src/components/NumberKeypad";

/** "2026-07-25" → "07-25-2026" */
function formatUsDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d) return dateKey;
  return `${m}-${d}-${y}`;
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** e.g. 2 Sep 26 */
function formatHouseDetailDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${d} ${MONTHS_SHORT[m - 1]} ${String(y).slice(-2)}`;
}

function daysBetweenKeys(fromKey: string, toKey: string): number | null {
  const [y1, m1, d1] = fromKey.split("-").map(Number);
  const [y2, m2, d2] = toKey.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return null;
  const a = new Date(y1, m1 - 1, d1, 12, 0, 0, 0).getTime();
  const b = new Date(y2, m2 - 1, d2, 12, 0, 0, 0).getTime();
  return Math.round((b - a) / 86400000);
}

function formatShortDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function RecordLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ marginTop: 4, marginBottom: 16, alignSelf: "flex-end" }}
    >
      <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Matches Tools section tiles — scroll the farm page back to the top. */
function TopLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Scroll to top"
    >
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted }}>Top</Text>
    </Pressable>
  );
}

function SectionHeading({
  title,
  onTop,
  right,
}: {
  title: string;
  onTop: () => void;
  right?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <Text style={{ fontWeight: "800", fontSize: 16, flex: 1, minWidth: 0 }}>{title}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {right}
        <TopLink onPress={onTop} />
      </View>
    </View>
  );
}

function RowActions({
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: {
  editLabel?: string;
  deleteLabel: string;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {onEdit ? (
        <Pressable
          accessibilityLabel={editLabel ?? "Edit"}
          onPress={onEdit}
          hitSlop={8}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="pencil-outline" size={20} color={colors.muted} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel={deleteLabel}
        onPress={onDelete}
        hitSlop={8}
        style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="trash-outline" size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

type FarmDetail = ReturnType<typeof getFarmDetail>;
type HouseRow = FarmDetail["houses"][number];

type HouseEditDraft = {
  id: string;
  houseNumber: string;
  squareFootage: string;
  totalFanCFM: string;
  totalPowerCFM: string;
  placedBirdCount: string;
  placementDate: string;
  catchDate: string;
  catchTime: string;
  flockNumber: string;
  applyBirdsToRemaining: boolean;
  applyPlacementToRemaining: boolean;
  applyCatchDateToRemaining: boolean;
  applyCatchTimeToRemaining: boolean;
  applyFlockIdToRemaining: boolean;
  applySquareFootageToRemaining: boolean;
  applyMinVentCfmToRemaining: boolean;
  applyPowerCfmToRemaining: boolean;
};

type AddHouseDraft = {
  houseNumber: string;
  squareFootage: string;
  totalFanCFM: string;
  totalPowerCFM: string;
};

type FarmEditDraft = {
  farmName: string;
  farmNumber: string;
  growerName: string;
  notes: string;
  numberOfGenerators: number | null;
};

/** Native iOS number pad — same feel as Flock ID text field. */
function NativeNumInput({
  label,
  value,
  onChangeText,
  decimal,
  grouped,
  placeholder,
  style,
  autoFocus,
  inputRef,
  propagateChecked,
  onPropagateToggle,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  decimal?: boolean;
  grouped?: boolean;
  placeholder?: string;
  style?: object;
  autoFocus?: boolean;
  inputRef?: Ref<TextInput>;
  propagateChecked?: boolean;
  onPropagateToggle?: () => void;
}) {
  return (
    <View style={[{ marginBottom: 10 }, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        autoFocus={autoFocus}
        style={[
          styles.input,
          { fontSize: 20, fontWeight: "700", color: colors.text },
          onPropagateToggle ? { marginBottom: 0 } : null,
        ]}
        value={grouped ? formatGroupedInput(value, !!decimal) : value}
        onChangeText={(text) =>
          onChangeText(grouped ? formatGroupedInput(text, !!decimal) : text)
        }
        keyboardType={decimal ? "decimal-pad" : "number-pad"}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
      />
      {onPropagateToggle ? (
        <PropagateCheck checked={!!propagateChecked} onToggle={onPropagateToggle} />
      ) : null}
    </View>
  );
}

function PropagateCheck({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel="Propagate"
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        marginTop: 2,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: checked ? colors.accentDark : colors.border,
          backgroundColor: checked ? colors.accentDark : "#fff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
      </View>
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, lineHeight: 16 }}>
        Propagate
      </Text>
    </Pressable>
  );
}

const MAX_GENERATOR_LOGS_DISPLAY = MAX_GENERATOR_HOUR_LOGS;

type GeneratorChartRow = {
  id: string;
  dateLabel: string;
  hours: number;
  exercised: number | null;
};

const GENERATOR_SWIPE_DELETE_W = 72;

function GeneratorSwipeDeleteRow({
  deleteLabel,
  onDelete,
  children,
  isOpen,
  onOpen,
}: {
  deleteLabel: string;
  onDelete: () => void;
  children: ReactNode;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const [x, setX] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) setX(0);
  }, [isOpen]);

  function begin(pageX: number, pageY: number) {
    startX.current = pageX;
    startY.current = pageY;
  }

  function move(pageX: number) {
    if (startX.current == null) return;
    setX(Math.max(-GENERATOR_SWIPE_DELETE_W, Math.min(0, pageX - startX.current)));
  }

  function end() {
    if (startX.current == null) {
      setX(0);
      return;
    }
    setX((cur) => {
      const next = cur <= -36 ? -GENERATOR_SWIPE_DELETE_W : 0;
      if (next < 0) onOpen();
      return next;
    });
    startX.current = null;
    startY.current = null;
  }

  return (
    <View style={{ overflow: "hidden" }}>
      {x < -8 ? (
        <Pressable
          accessibilityLabel={deleteLabel}
          onPress={onDelete}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: GENERATOR_SWIPE_DELETE_W,
            backgroundColor: colors.danger,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Delete</Text>
        </Pressable>
      ) : null}
      <View
        // Responder + mouse so swipe-left works on native and Expo web.
        onStartShouldSetResponder={() => false}
        onMoveShouldSetResponder={(e) => {
          if (startX.current == null || startY.current == null) return false;
          const dx = e.nativeEvent.pageX - startX.current;
          const dy = e.nativeEvent.pageY - startY.current;
          return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy);
        }}
        onResponderGrant={(e) => begin(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        onResponderMove={(e) => move(e.nativeEvent.pageX)}
        onResponderRelease={end}
        onResponderTerminate={end}
        onTouchStart={(e) => begin(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        {...(Platform.OS === "web"
          ? {
              onMouseDown: (e: { pageX: number; pageY: number }) => begin(e.pageX, e.pageY),
              onMouseMove: (e: { pageX: number; buttons?: number }) => {
                if (e.buttons === 1) move(e.pageX);
              },
              onMouseUp: end,
              onMouseLeave: () => {
                if (startX.current != null) end();
              },
            }
          : {})}
        style={{
          transform: [{ translateX: x }],
          backgroundColor: colors.card,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function GeneratorHoursChart({
  title,
  rows,
  onEdit,
  onDelete,
}: {
  title: string;
  rows: GeneratorChartRow[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const showActions = onEdit != null && onDelete != null;
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const cell = {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600" as const,
    color: colors.text,
    fontVariant: ["tabular-nums"] as const,
  };
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text, marginBottom: 2 }}>
        {title}
      </Text>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Text style={{ width: 96, fontSize: 14, fontWeight: "600", color: colors.muted, lineHeight: 18 }}>
          Date
        </Text>
        <Text style={{ width: 60, fontSize: 14, fontWeight: "600", color: colors.muted, lineHeight: 18 }}>
          Hours
        </Text>
        <Text style={{ width: 80, fontSize: 14, fontWeight: "600", color: colors.muted, lineHeight: 18 }}>
          Exercised
        </Text>
        {showActions ? <View style={{ width: 28 }} /> : null}
      </View>
      {rows.length === 0 ? (
        <Text style={[styles.muted, { fontSize: 15 }]}>None yet</Text>
      ) : (
        <View>
          {rows.map((row) => {
            const cells = (
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "center",
                  minHeight: 30,
                  paddingVertical: 4,
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ ...cell, width: 96 }} numberOfLines={1}>
                  {row.dateLabel}
                </Text>
                <Text style={{ ...cell, width: 60 }}>{formatGeneratorHours(row.hours)}</Text>
                <Text style={{ ...cell, width: 80 }}>{formatGeneratorHours(row.exercised)}</Text>
              </View>
            );
            if (!showActions) {
              return <View key={row.id}>{cells}</View>;
            }
            return (
              <View key={row.id} style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <GeneratorSwipeDeleteRow
                    deleteLabel="Delete generator log"
                    onDelete={() => onDelete(row.id)}
                    isOpen={openSwipeId === row.id}
                    onOpen={() => setOpenSwipeId(row.id)}
                  >
                    {cells}
                  </GeneratorSwipeDeleteRow>
                </View>
                <Pressable
                  accessibilityLabel="Edit generator log"
                  onPress={() => onEdit(row.id)}
                  hitSlop={6}
                  style={{
                    width: 28,
                    height: 28,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="settings-outline" size={20} color={colors.muted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function FarmDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    edit?: string | string[];
    focusHouseFlockId?: string | string[];
  }>();
  const farmId = paramId(params.id);
  const openEdit = paramId(params.edit) === "1";
  const focusHouseFlockIdParam = paramId(params.focusHouseFlockId);
  const router = useRouter();
  const goToFarmList = useGoToFarmList();
  const insets = useSafeAreaInsets();
  const houseEditTopPad =
    Platform.OS === "web"
      ? (`max(${Math.max(insets.top, 12)}px, env(safe-area-inset-top, 12px))` as unknown as number)
      : Math.max(insets.top, 12);
  const [data, setData] = useState<FarmDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingHouse, setEditingHouse] = useState<HouseEditDraft | null>(null);
  const [housePicker, setHousePicker] = useState<"placement" | "catch" | "catchTime" | null>(
    null,
  );
  const [houseEditError, setHouseEditError] = useState<string | null>(null);
  const [houseSaving, setHouseSaving] = useState(false);
  const [tempHouse, setTempHouse] = useState<{
    id: string;
    houseNumber: number;
    temp: string;
  } | null>(null);
  const [tempSaving, setTempSaving] = useState(false);
  const [tempError, setTempError] = useState<string | null>(null);
  const [addingHouse, setAddingHouse] = useState<AddHouseDraft | null>(null);
  const [addHouseError, setAddHouseError] = useState<string | null>(null);
  const [addHouseSaving, setAddHouseSaving] = useState(false);
  const [expandedHouses, setExpandedHouses] = useState<Set<string>>(new Set());
  const [editingFarm, setEditingFarm] = useState<FarmEditDraft | null>(null);
  const [farmEditError, setFarmEditError] = useState<string | null>(null);
  const [farmSaving, setFarmSaving] = useState(false);
  const [farmEditKeyboardH, setFarmEditKeyboardH] = useState(0);
  const farmEditScrollRef = useRef<ScrollViewType>(null);
  const farmNotesWrapRef = useRef<View>(null);
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [generatorSaving, setGeneratorSaving] = useState(false);
  const [generatorError, setGeneratorError] = useState<string | null>(null);
  const [generatorEditingId, setGeneratorEditingId] = useState<string | null>(null);
  const [generatorEditingGen, setGeneratorEditingGen] = useState<GenHourKey | null>(null);
  const [opsConfirm, setOpsConfirm] = useState<
    | { kind: "house"; houseId: string; houseNumber: number }
    | { kind: "generator"; logId: string; hourKey: GenHourKey; label: string }
    | null
  >(null);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [completeConfirm, setCompleteConfirm] = useState<{
    flockId: string;
    flockNumber: string;
  } | null>(null);
  const [completePickerOpen, setCompletePickerOpen] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [generatorDraft, setGeneratorDraft] = useState({
    logDate: todayKey(),
    gen1Hours: "",
    gen2Hours: "",
    gen3Hours: "",
    gen4Hours: "",
  });
  const [generatorSwap, setGeneratorSwap] = useState<GeneratorHourSwapSuggestion | null>(
    null,
  );
  const scrollRef = useRef<ScrollViewType>(null);
  useTabScrollToTop("farms", scrollRef);
  const houseSwipe = useExclusiveSwipeables();
  const sectionY = useRef<Record<string, number>>({});

  function scrollToSection(key: string) {
    const y = sectionY.current[key];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }

  function scrollPageToTop() {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function onSectionLayout(key: string) {
    return (e: LayoutChangeEvent) => {
      sectionY.current[key] = e.nativeEvent.layout.y;
    };
  }

  // Drop previous farm immediately when the route id changes
  useEffect(() => {
    setData(null);
    setError(null);
    setLoading(true);
    setEditingFarm(null);
    setExpandedHouses(new Set());
  }, [farmId]);

  const load = useCallback(() => {
    if (!farmId) {
      setError("Missing farm id");
      setData(null);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const next = getFarmDetail(farmId);
      setData(next);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  const [focusNonce, setFocusNonce] = useState(0);
  // One-shot house scroll from Mortality "Back to House" only.
  // Read via ref so clearing the route param doesn't re-fire focus → top scroll.
  const focusHouseParamRef = useRef(focusHouseFlockIdParam);
  focusHouseParamRef.current = focusHouseFlockIdParam;
  const oneShotHouseScrollRef = useRef<string | null>(null);

  const scrollToHouseKey = useCallback((key: string | null | undefined) => {
    if (!key) return;
    let attempts = 0;
    const tryScroll = () => {
      const y = sectionY.current[key];
      if (y != null) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
        return;
      }
      if (attempts++ < 12) setTimeout(tryScroll, 50);
    };
    setTimeout(tryScroll, 32);
  }, []);

  const scrollToHouseFlock = useCallback(
    (houseFlockId: string | null | undefined) => {
      if (!houseFlockId || !data || data.farm.id !== farmId) return;
      const house = data.houses.find((h) => h.houseFlockId === houseFlockId);
      if (!house) return;
      scrollToHouseKey(`house-${house.id}`);
    },
    [data, farmId, scrollToHouseKey],
  );

  useFocusEffect(
    useCallback(() => {
      load();
      if (!farmId) return;
      // Clear Mortality→Farms pending so the list doesn't redirect later.
      const pending = consumeFarmReturnFromMortality();
      const ctx = getFarmNavContext();
      const oneShotHouse = focusHouseParamRef.current || "";
      // Only Back to House arms a house snap; everything else lands at top.
      oneShotHouseScrollRef.current = oneShotHouse || null;
      const houseForCtx =
        oneShotHouse ||
        pending?.houseFlockId ||
        (ctx.farmId === farmId ? ctx.houseFlockId : null) ||
        null;
      setFarmNavContext({
        farmId,
        houseFlockId: houseForCtx,
      });
      setFocusNonce((n) => n + 1);
      // Consume the one-shot param so later Farms visits don't keep snapping.
      if (oneShotHouse) {
        router.setParams({ focusHouseFlockId: "" });
      }
    }, [load, farmId, router]),
  );

  // Back to House → that house; any other *focus* → top of page.
  // Do not re-run on data refresh (temp save) or the list jumps back to house 1.
  const lastFocusNonceRef = useRef(0);
  useEffect(() => {
    if (!data || data.farm.id !== farmId || focusNonce === 0) return;
    if (lastFocusNonceRef.current === focusNonce) return;
    lastFocusNonceRef.current = focusNonce;
    const target = oneShotHouseScrollRef.current;
    oneShotHouseScrollRef.current = null;
    if (target) {
      scrollToHouseFlock(target);
    } else {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [data, farmId, focusNonce, scrollToHouseFlock]);

  function openFarmEditor(farm: FarmDetail["farm"]) {
    setFarmEditError(null);
    setEditingFarm({
      farmName: farm.farmName,
      farmNumber: farm.farmNumber ?? "",
      growerName: farm.growerName ?? "",
      notes: farm.notes ?? "",
      numberOfGenerators: farm.numberOfGenerators ?? null,
    });
  }

  // Open settings editor when navigated with ?edit=1 (from farms list gear)
  useEffect(() => {
    if (!openEdit || !data || data.farm.id !== farmId || editingFarm) return;
    openFarmEditor(data.farm);
  }, [openEdit, data, farmId, editingFarm]);

  useEffect(() => {
    if (!editingFarm) {
      setFarmEditKeyboardH(0);
      return;
    }
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e) => {
      setFarmEditKeyboardH(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => setFarmEditKeyboardH(0));

    const vv = Platform.OS === "web" && typeof window !== "undefined" ? window.visualViewport : null;
    const onViewport = () => {
      if (!vv) return;
      setFarmEditKeyboardH(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    vv?.addEventListener("resize", onViewport);
    vv?.addEventListener("scroll", onViewport);

    return () => {
      show.remove();
      hide.remove();
      vv?.removeEventListener("resize", onViewport);
      vv?.removeEventListener("scroll", onViewport);
    };
  }, [editingFarm]);

  // Never render a previous farm under a new id
  const ready = data != null && data.farm.id === farmId;

  if (loading && !ready) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.content}>
          <Pressable
            onPress={goToFarmList}
            style={{
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              minHeight: 44,
            }}
            accessibilityRole="button"
            accessibilityLabel="Back to farms"
          >
            <Ionicons name="chevron-back" size={22} color={colors.accentDark} />
            <Text
              style={{
                color: colors.accentDark,
                fontWeight: "700",
                fontSize: 17,
                fontFamily: styles.title.fontFamily,
              }}
            >
              Farms
            </Text>
          </Pressable>
          <Text style={{ color: colors.danger }}>{error ?? "Farm not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { farm } = data;
  const activeFlocks = data.activeFlocks ?? [];

  function askCompleteFlock(flockId: string, flockNumber: string) {
    setCompleteError(null);
    setCompletePickerOpen(false);
    setCompleteConfirm({ flockId, flockNumber });
  }

  function runCompleteFlock() {
    if (!completeConfirm) return;
    try {
      completeFlock(completeConfirm.flockId);
      setCompleteConfirm(null);
      setCompleteError(null);
      load();
    } catch (e) {
      setCompleteConfirm(null);
      setCompleteError(e instanceof Error ? e.message : "Could not complete flock");
    }
  }

  function promptCompleteFlock() {
    if (activeFlocks.length === 0) return;
    if (activeFlocks.length === 1) {
      askCompleteFlock(activeFlocks[0]!.id, activeFlocks[0]!.flockNumber);
      return;
    }
    // RN Web Alert.alert is a no-op — use an in-app picker instead.
    setCompleteError(null);
    setCompletePickerOpen(true);
  }

  function openAddHouse() {
    if (!data) return;
    const nextNum =
      data.houses.reduce((max, h) => Math.max(max, h.houseNumber), 0) + 1;
    setAddHouseError(null);
    setAddingHouse({
      houseNumber: String(nextNum),
      squareFootage: "29700",
      totalFanCFM: "",
      totalPowerCFM: "",
    });
  }

  function closeAddHouse() {
    if (addHouseSaving) return;
    setAddingHouse(null);
    setAddHouseError(null);
  }

  function saveAddHouse() {
    if (!data || !addingHouse) return;
    setAddHouseSaving(true);
    setAddHouseError(null);
    try {
      const sq = Number(addingHouse.squareFootage);
      const cfm =
        addingHouse.totalFanCFM.trim() === "" ? null : Number(addingHouse.totalFanCFM);
      const powerCfm =
        addingHouse.totalPowerCFM.trim() === "" ? null : Number(addingHouse.totalPowerCFM);
      if (cfm != null && !Number.isFinite(cfm)) throw new Error("Total CFM (Min Vent) is invalid");
      if (powerCfm != null && !Number.isFinite(powerCfm)) {
        throw new Error("Total CFM (Power) is invalid");
      }
      createHouse(data.farm.id, {
        houseNumber: Number(addingHouse.houseNumber),
        squareFootage: sq,
        totalFanCFM: cfm,
        totalPowerCFM: powerCfm,
        numberOfFans: null,
      });
      setAddingHouse(null);
      load();
    } catch (e) {
      setAddHouseError(e instanceof Error ? e.message : "Could not add house");
    } finally {
      setAddHouseSaving(false);
    }
  }

  function openHouseEditor(h: HouseRow) {
    setHouseEditError(null);
    setHousePicker(null);
    // Only prefill dates the house already has — don't inherit an old flock
    // date. Empty fields open the calendar on today via DatePickerField.
    const placementDate = h.placementDate ?? "";
    const catchDate = h.catchDate ?? "";
    setEditingHouse({
      id: h.id,
      houseNumber: String(h.houseNumber),
      squareFootage: String(h.squareFootage ?? 29700),
      totalFanCFM: h.totalFanCFM != null ? String(h.totalFanCFM) : "",
      totalPowerCFM: h.totalPowerCFM != null ? String(h.totalPowerCFM) : "",
      // Only show a count that was already saved — never ghost-fill 23000/29700.
      placedBirdCount: h.placedBirdCount != null ? String(h.placedBirdCount) : "",
      placementDate,
      catchDate,
      catchTime: h.catchTime ?? "",
      flockNumber: h.flockNumber ?? "",
      applyBirdsToRemaining: false,
      applyPlacementToRemaining: false,
      applyCatchDateToRemaining: false,
      applyCatchTimeToRemaining: false,
      applyFlockIdToRemaining: false,
      applySquareFootageToRemaining: false,
      applyMinVentCfmToRemaining: false,
      applyPowerCfmToRemaining: false,
    });
  }

  function closeHouseEditor() {
    if (houseSaving) return;
    setEditingHouse(null);
    setHousePicker(null);
    setHouseEditError(null);
  }

  function closeTempModal() {
    if (tempSaving) return;
    setTempHouse(null);
    setTempError(null);
  }

  function saveHouseTemp() {
    if (!tempHouse || !farm) return;
    const houseKey = `house-${tempHouse.id}`;
    setTempSaving(true);
    setTempError(null);
    try {
      Keyboard.dismiss();
      updateHouseLoggedTemp(farm.id, tempHouse.id, tempHouse.temp);
      setTempHouse(null);
      load();
      scrollToHouseKey(houseKey);
    } catch (e) {
      setTempError(e instanceof Error ? e.message : "Could not save temperature");
    } finally {
      setTempSaving(false);
    }
  }

  function clearHouseTemp() {
    if (!tempHouse || !farm) return;
    const houseKey = `house-${tempHouse.id}`;
    setTempSaving(true);
    setTempError(null);
    try {
      Keyboard.dismiss();
      updateHouseLoggedTemp(farm.id, tempHouse.id, null);
      setTempHouse(null);
      load();
      scrollToHouseKey(houseKey);
    } catch (e) {
      setTempError(e instanceof Error ? e.message : "Could not clear temperature");
    } finally {
      setTempSaving(false);
    }
  }

  function closeGeneratorModal() {
    if (generatorSaving) return;
    setGeneratorModalOpen(false);
    setGeneratorError(null);
    setGeneratorEditingId(null);
    setGeneratorEditingGen(null);
    setGeneratorSwap(null);
  }

  function parseGeneratorDraftHours() {
    const parseHours = (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === "") return null;
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error("Generator hours must be 0 or greater");
      }
      return n;
    };
    return {
      logDate: generatorDraft.logDate.trim(),
      gen1Hours: parseHours(generatorDraft.gen1Hours),
      gen2Hours: parseHours(generatorDraft.gen2Hours),
      gen3Hours: parseHours(generatorDraft.gen3Hours),
      gen4Hours: parseHours(generatorDraft.gen4Hours),
    };
  }

  function persistGeneratorHours(
    hours: {
      logDate: string;
      gen1Hours: number | null;
      gen2Hours: number | null;
      gen3Hours: number | null;
      gen4Hours: number | null;
    },
    remapAll = false,
  ) {
    if (generatorEditingId) {
      updateGeneratorLog(farm.id, generatorEditingId, {
        ...hours,
        onlyGen: remapAll ? undefined : generatorEditingGen ?? undefined,
      });
    } else {
      createGeneratorLog({
        farmId: farm.id,
        ...hours,
      });
    }
    setGeneratorModalOpen(false);
    setGeneratorEditingId(null);
    setGeneratorEditingGen(null);
    setGeneratorSwap(null);
    load();
  }

  function saveGeneratorLog(
    hours?: {
      logDate: string;
      gen1Hours: number | null;
      gen2Hours: number | null;
      gen3Hours: number | null;
      gen4Hours: number | null;
    },
    remapAll = false,
  ) {
    setGeneratorSaving(true);
    setGeneratorError(null);
    try {
      const payload = hours ?? parseGeneratorDraftHours();
      if (!hours) {
        const previous = previousGeneratorHoursFromLogs(data?.generatorLogs ?? [], {
          onOrBeforeDate: payload.logDate,
          excludeLogId: generatorEditingId,
        });
        const entered = generatorEditingGen
          ? {
              gen1Hours: generatorEditingGen === "gen1Hours" ? payload.gen1Hours : null,
              gen2Hours: generatorEditingGen === "gen2Hours" ? payload.gen2Hours : null,
              gen3Hours: generatorEditingGen === "gen3Hours" ? payload.gen3Hours : null,
              gen4Hours: generatorEditingGen === "gen4Hours" ? payload.gen4Hours : null,
            }
          : payload;
        const swap = detectGeneratorHourSwap(previous, entered);
        if (swap) {
          setGeneratorSwap(swap);
          return;
        }
      }
      persistGeneratorHours(payload, remapAll);
    } catch (e) {
      setGeneratorError(e instanceof Error ? e.message : "Could not save generator log");
    } finally {
      setGeneratorSaving(false);
    }
  }

  function openGeneratorEditor(
    log?: {
      id: string;
      logDate: string;
      gen1Hours: number | null;
      gen2Hours: number | null;
      gen3Hours: number | null;
      gen4Hours: number | null;
    },
    onlyGen?: GenHourKey,
  ) {
    setGeneratorError(null);
    setGeneratorEditingGen(onlyGen ?? null);
    if (log) {
      setGeneratorEditingId(log.id);
      setGeneratorDraft({
        logDate: log.logDate,
        gen1Hours: log.gen1Hours == null ? "" : String(log.gen1Hours),
        gen2Hours: log.gen2Hours == null ? "" : String(log.gen2Hours),
        gen3Hours: log.gen3Hours == null ? "" : String(log.gen3Hours),
        gen4Hours: log.gen4Hours == null ? "" : String(log.gen4Hours),
      });
    } else {
      setGeneratorEditingId(null);
      setGeneratorDraft({
        logDate: todayKey(),
        gen1Hours: "",
        gen2Hours: "",
        gen3Hours: "",
        gen4Hours: "",
      });
    }
    setGeneratorModalOpen(true);
  }

  function confirmDeleteHouse(h: HouseRow) {
    setOpsConfirm({ kind: "house", houseId: h.id, houseNumber: h.houseNumber });
  }

  function removeVisit(visitId: string) {
    try {
      deleteVisit(farm.id, visitId);
      load();
    } catch (e) {
      setOpsError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  function removeIssue(issueId: string) {
    try {
      deleteIssue(farm.id, issueId);
      load();
    } catch (e) {
      setOpsError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  function removeLitter(eventId: string) {
    try {
      deleteLitterEvent(farm.id, eventId);
      load();
    } catch (e) {
      setOpsError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  function removeFeed(deliveryId: string) {
    try {
      deleteFeedDelivery(deliveryId);
      load();
    } catch (e) {
      setOpsError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  function runOpsConfirm() {
    if (!opsConfirm) return;
    try {
      if (opsConfirm.kind === "house") deleteHouse(farm.id, opsConfirm.houseId);
      else deleteGeneratorLog(farm.id, opsConfirm.logId, opsConfirm.hourKey);
      load();
    } catch (e) {
      setOpsError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setOpsConfirm(null);
    }
  }

  function saveHouseEdit() {
    if (!editingHouse) return;
    setHouseSaving(true);
    setHouseEditError(null);
    try {
      const sq = parseGroupedNumber(editingHouse.squareFootage);
      const cfm =
        editingHouse.totalFanCFM.trim() === ""
          ? null
          : parseGroupedNumber(editingHouse.totalFanCFM);
      const powerCfm =
        editingHouse.totalPowerCFM.trim() === ""
          ? null
          : parseGroupedNumber(editingHouse.totalPowerCFM);
      const existing = data?.houses.find((h) => h.id === editingHouse.id);
      const fans = existing?.numberOfFans ?? null;
      const placedRaw = ungroupNumber(editingHouse.placedBirdCount).trim();
      const placed =
        placedRaw === "" ? null : Math.floor(parseGroupedNumber(placedRaw));
      if (cfm != null && !Number.isFinite(cfm)) throw new Error("Total CFM (Min Vent) is invalid");
      if (powerCfm != null && !Number.isFinite(powerCfm)) {
        throw new Error("Total CFM (Power) is invalid");
      }
      if (
        data?.activeFlock &&
        placedRaw !== "" &&
        (placed == null || !Number.isFinite(placed) || placed < 1)
      ) {
        throw new Error("Birds placed must be at least 1");
      }
      // Empty birds-placed field = leave the existing count unchanged.
      const existingPlaced =
        data?.houses.find((h) => h.id === editingHouse.id)?.placedBirdCount ?? null;
      updateHouse(farm.id, editingHouse.id, {
        houseNumber: Number(editingHouse.houseNumber),
        squareFootage: sq,
        totalFanCFM: cfm,
        totalPowerCFM: powerCfm,
        numberOfFans: fans,
        applySquareFootageToRemainingHouses: editingHouse.applySquareFootageToRemaining,
        applyMinVentCfmToRemainingHouses: editingHouse.applyMinVentCfmToRemaining,
        applyPowerCfmToRemainingHouses: editingHouse.applyPowerCfmToRemaining,
        ...(data?.activeFlock
          ? {
              ...(placedRaw !== ""
                ? { placedBirdCount: placed }
                : existingPlaced != null
                  ? { placedBirdCount: existingPlaced }
                  : {}),
              placementDate: editingHouse.placementDate.trim() || null,
              catchDate: editingHouse.catchDate.trim() || null,
              catchTime: editingHouse.catchTime.trim() || null,
              flockNumber: editingHouse.flockNumber.trim() || null,
              applyBirdsToRemainingHouses: editingHouse.applyBirdsToRemaining,
              applyPlacementToRemainingHouses: editingHouse.applyPlacementToRemaining,
              applyCatchDateToRemainingHouses: editingHouse.applyCatchDateToRemaining,
              applyCatchTimeToRemainingHouses: editingHouse.applyCatchTimeToRemaining,
              applyFlockIdToRemainingHouses: editingHouse.applyFlockIdToRemaining,
            }
          : null),
      });
      closeHouseEditor();
      load();
    } catch (e) {
      setHouseEditError(e instanceof Error ? e.message : "Could not save house");
    } finally {
      setHouseSaving(false);
    }
  }

  function closeFarmEditor() {
    if (farmSaving) return;
    setEditingFarm(null);
    setFarmEditError(null);
    setFarmEditKeyboardH(0);
    if (openEdit) {
      // Opened from list gear — return to the farms list at the prior scroll position.
      goToFarmList();
    }
  }

  function saveFarmEdit() {
    if (!editingFarm) return;
    setFarmSaving(true);
    setFarmEditError(null);
    try {
      updateFarm(farm.id, {
        farmName: editingFarm.farmName,
        farmNumber: editingFarm.farmNumber,
        growerName: editingFarm.growerName,
        notes: editingFarm.notes,
      });
      setEditingFarm(null);
      if (openEdit) {
        goToFarmList();
      } else {
        load();
      }
    } catch (e) {
      setFarmEditError(e instanceof Error ? e.message : "Could not save farm");
    } finally {
      setFarmSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={houseSwipe.closeAll}
      >
        <View
          style={{
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Pressable
            onPress={goToFarmList}
            accessibilityRole="button"
            accessibilityLabel="Back to farms"
            hitSlop={8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              flexShrink: 0,
              minHeight: 44,
            }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.accentDark} />
            <Text
              style={{
                color: colors.accentDark,
                fontWeight: "700",
                fontSize: 17,
                fontFamily: styles.title.fontFamily,
              }}
            >
              Farms
            </Text>
          </Pressable>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 6,
              flex: 1,
              minWidth: 0,
            }}
          >
            <Text
              style={[styles.title, { flexShrink: 1, textAlign: "right", fontSize: 24 }]}
              numberOfLines={1}
            >
              {farm.farmName}
            </Text>
            <Pressable
              accessibilityLabel="Edit farm info"
              onPress={() => openFarmEditor(farm)}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Ionicons name="settings-outline" size={22} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Card>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(
                [
                  {
                    key: "service",
                    label: "Service Farm",
                    onPress: () =>
                      router.push({
                        pathname: "/(tabs)/farms/[id]/service",
                        params: { id: farm.id },
                      }),
                  },
                  {
                    key: "generators",
                    label: "Generator",
                    onPress: () => scrollToSection("generators"),
                  },
                  { key: "visits", label: "Visits", onPress: () => scrollToSection("visits") },
                  { key: "issues", label: "Issues", onPress: () => scrollToSection("issues") },
                  { key: "litter", label: "Litter", onPress: () => scrollToSection("litter") },
                  { key: "feed", label: "Feed", onPress: () => scrollToSection("feed") },
                  {
                    key: "lfo",
                    label: "LFO",
                    onPress: () =>
                      router.push({
                        pathname: "/(tabs)/lfo",
                        params: { farmId: farm.id },
                      }),
                  },
                  {
                    key: "add-flock",
                    label: "Add Flock",
                    onPress: () =>
                      router.push({
                        pathname: "/(tabs)/farms/[id]/add-flock",
                        params: { id: farm.id },
                      }),
                  },
                  ...(activeFlocks.length > 0
                    ? [
                        {
                          key: "complete-flock",
                          label: "End Flock",
                          onPress: promptCompleteFlock,
                        },
                      ]
                    : []),
                ] as Array<{ key: string; label: string; onPress: () => void }>
              ).map((link) => (
                <Pressable
                  key={link.key}
                  onPress={link.onPress}
                  style={{
                    width: "31.5%",
                    minHeight: 44,
                    borderRadius: 10,
                    backgroundColor: colors.accentDark,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "800",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                    numberOfLines={2}
                  >
                    {link.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </View>

        {data.houses.map((h) => {
          const detailsOpen = expandedHouses.has(h.id);
          return (
            <View
              key={`${farm.id}-${h.id}`}
              collapsable={false}
              onLayout={onSectionLayout(`house-${h.id}`)}
              style={{ marginBottom: 12 }}
            >
            <Swipeable
              ref={houseSwipe.setRef(h.id)}
              overshootRight={false}
              friction={2}
              rightThreshold={40}
              onSwipeableWillOpen={() => houseSwipe.closeOthers(h.id)}
              renderRightActions={() => (
                <Pressable
                  accessibilityLabel={`Delete house ${h.houseNumber}`}
                  onPress={() => confirmDeleteHouse(h)}
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
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12, marginTop: 4 }}>
                    Delete
                  </Text>
                </Pressable>
              )}
            >
              <Card style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                <View style={{ padding: 16, paddingBottom: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <Pressable
                      onPress={() => openHouseEditor(h)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit house ${h.houseNumber}`}
                      style={({ pressed }) => ({
                        flex: 1,
                        minWidth: 0,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 17, fontWeight: "800" }}>
                        House {h.houseNumber}
                        {h.ageDays != null ? (
                          <Text style={{ fontWeight: "600", color: colors.muted }}>
                            {" "}
                            {h.ageDays}d
                          </Text>
                        ) : null}
                      </Text>
                      {h.cumulativeMortality != null || h.projectedHeadCount != null ? (
                        <Text
                          style={{
                            marginTop: 2,
                            fontSize: 14,
                            fontWeight: "600",
                            color: colors.muted,
                          }}
                        >
                          {h.cumulativeMortality != null
                            ? `M ${formatNumber(h.cumulativeMortality)}`
                            : null}
                          {h.cumulativeMortality != null && h.projectedHeadCount != null
                            ? " · "
                            : null}
                          {h.projectedHeadCount != null
                            ? `PHC ${formatNumber(h.projectedHeadCount)}`
                            : null}
                        </Text>
                      ) : null}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        h.loggedTemp
                          ? `Edit temperature for house ${h.houseNumber}, currently ${h.loggedTemp} degrees`
                          : `Log temperature for house ${h.houseNumber}`
                      }
                      hitSlop={6}
                      onPress={() => {
                        setTempError(null);
                        setTempHouse({
                          id: h.id,
                          houseNumber: h.houseNumber,
                          temp: h.loggedTemp ?? "",
                        });
                      }}
                      style={({ pressed }) => ({
                        backgroundColor: h.loggedTemp ? "#fff" : "#f5f5f4",
                        borderWidth: 1.5,
                        borderColor: h.loggedTemp ? colors.accentDark : colors.border,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        borderRadius: 12,
                        minWidth: 72,
                        minHeight: 56,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.88 : 1,
                      })}
                    >
                      {h.loggedTemp ? (
                        <>
                          <Text
                            style={{
                              color: colors.accentDark,
                              fontWeight: "800",
                              fontSize: 18,
                              lineHeight: 22,
                            }}
                          >
                            {h.loggedTemp}°
                          </Text>
                          <Text
                            style={{
                              color: colors.muted,
                              fontWeight: "700",
                              fontSize: 10,
                              marginTop: 1,
                            }}
                          >
                            Temp
                          </Text>
                        </>
                      ) : (
                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: "800",
                            fontSize: 12,
                            textAlign: "center",
                            lineHeight: 15,
                          }}
                        >
                          Log{"\n"}Temp
                        </Text>
                      )}
                    </Pressable>
                    {h.houseFlockId ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Enter mortality for house ${h.houseNumber}`}
                        hitSlop={6}
                        onPress={() => {
                          setFarmNavContext({
                            farmId: farm.id,
                            houseFlockId: h.houseFlockId,
                          });
                          // navigate (not push) so the Farms stack keeps this farm
                          // underneath when the user returns via the Farms tab.
                          // `jump` changes every tap so re-entering the same house
                          // still triggers mortality's focus/jump-to-box logic.
                          router.navigate({
                            pathname: "/(tabs)/mortality",
                            params: {
                              farmId: farm.id,
                              houseFlockId: h.houseFlockId!,
                              jump: String(Date.now()),
                            },
                          });
                        }}
                        style={({ pressed }) => ({
                          backgroundColor: colors.accentDark,
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                          borderRadius: 12,
                          minWidth: 96,
                          minHeight: 56,
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: pressed ? 0.88 : 1,
                        })}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontWeight: "800",
                            fontSize: 13,
                            textAlign: "center",
                            lineHeight: 16,
                          }}
                        >
                          Enter{"\n"}mortality
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <Pressable
                    onPress={() => openHouseEditor(h)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit house ${h.houseNumber} weekly mortality`}
                    style={({ pressed }) => ({
                      marginTop: 12,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    {h.weeklyMortality.length > 0 ? (
                      <View>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: colors.muted,
                            textTransform: "uppercase",
                            marginBottom: 8,
                          }}
                        >
                          Weekly mortality
                        </Text>
                        <WeeklyMortalityList weeks={h.weeklyMortality} />
                      </View>
                    ) : (
                      <Text style={styles.muted}>No weekly mortality yet.</Text>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  onPress={() =>
                    setExpandedHouses((prev) => {
                      const next = new Set(prev);
                      if (next.has(h.id)) next.delete(h.id);
                      else next.add(h.id);
                      return next;
                    })
                  }
                  accessibilityState={{ expanded: detailsOpen }}
                  style={{
                    marginHorizontal: 16,
                    marginTop: 8,
                    paddingTop: 12,
                    paddingBottom: detailsOpen ? 0 : 16,
                    borderTopWidth: 1,
                    borderTopColor: "#f5f5f4",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    minHeight: 40,
                  }}
                >
                  <Text style={{ color: colors.muted, fontWeight: "700", width: 14 }}>
                    {detailsOpen ? "▾" : "▸"}
                  </Text>
                  <Text style={{ fontWeight: "700", color: colors.text, fontSize: 14 }}>
                    {detailsOpen ? "Hide Details" : "Show Details"}
                  </Text>
                </Pressable>

                {detailsOpen ? (
                  <Pressable
                    onPress={() => openHouseEditor(h)}
                    accessibilityLabel={`Edit house ${h.houseNumber} details`}
                    style={{ paddingHorizontal: 16, paddingBottom: 16, marginTop: 10 }}
                  >
                    <View style={{ gap: 10 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        <View style={{ width: "33.333%", paddingRight: 8, marginBottom: 10 }}>
                          <Text style={{ fontSize: 13, color: colors.muted }}>Placed</Text>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "700",
                              color: colors.text,
                              marginTop: 2,
                            }}
                          >
                            {formatNumber(h.placedBirdCount)}
                          </Text>
                          {h.placementDate ? (
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: "700",
                                color: colors.text,
                                marginTop: 2,
                              }}
                            >
                              {formatHouseDetailDate(h.placementDate)}
                            </Text>
                          ) : null}
                        </View>
                        <Metric
                          columns={3}
                          label="Remaining"
                          value={formatNumber(h.remainingBirdCount)}
                        />
                        <Metric
                          columns={3}
                          label="PHC"
                          value={formatNumber(h.projectedHeadCount)}
                          hint="150 catch crew"
                        />
                      </View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        <View style={{ width: "33.333%", paddingRight: 8, marginBottom: 10 }}>
                          <Text style={{ fontSize: 13, color: colors.muted }}>Catch</Text>
                          {h.catchDate ? (
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: "700",
                                color: colors.text,
                                marginTop: 2,
                                lineHeight: 20,
                              }}
                            >
                              {formatHouseDetailDate(h.catchDate)}
                            </Text>
                          ) : (
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: "700",
                                color: colors.text,
                                marginTop: 2,
                              }}
                            >
                              —
                            </Text>
                          )}
                          {h.catchTime ? (
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: "700",
                                color: colors.text,
                                lineHeight: 20,
                              }}
                            >
                              {compactCatchTimeLabel(h.catchTime)}
                            </Text>
                          ) : null}
                          {h.placementDate && h.catchDate
                            ? (() => {
                                const age = daysBetweenKeys(h.placementDate, h.catchDate);
                                return age != null ? (
                                  <Text
                                    style={{
                                      fontSize: 15,
                                      fontWeight: "700",
                                      color: colors.text,
                                      lineHeight: 20,
                                    }}
                                  >
                                    {age} days
                                  </Text>
                                ) : null;
                              })()
                            : null}
                        </View>
                        <Metric
                          columns={3}
                          label="Mortality"
                          value={
                            h.placedBirdCount != null
                              ? `${formatNumber(h.cumulativeMortality)}\n(${formatPct(h.cumulativeMortalityPct)})`
                              : formatNumber(h.cumulativeMortality)
                          }
                        />
                        <Metric
                          columns={3}
                          label="Proj. Mort."
                          value={
                            h.projectedMortality != null &&
                            h.placedBirdCount != null &&
                            h.placedBirdCount > 0
                              ? `${formatNumber(h.projectedMortality)}\n(${formatPct(
                                  (h.projectedMortality / h.placedBirdCount) * 100,
                                )})`
                              : formatNumber(h.projectedMortality)
                          }
                        />
                      </View>
                    </View>
                  </Pressable>
                ) : null}
              </Card>
            </Swipeable>
            </View>
          );
        })}

        {data.houses.length === 0 ? (
          <Text style={[styles.muted, { marginBottom: 4 }]}>No houses yet.</Text>
        ) : null}
        <Pressable
          onPress={openAddHouse}
          hitSlop={8}
          style={{ marginBottom: 8, paddingVertical: 4, alignSelf: "flex-end" }}
        >
          <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: 14 }}>
            Add House
          </Text>
        </Pressable>

        {/* ── Visits ── */}
        <View onLayout={onSectionLayout("visits")}>
          <Card>
            <SectionHeading title="Recent Visits" onTop={scrollPageToTop} />
            {data.visits.length === 0 ? (
              <Text style={[styles.muted, { marginTop: 10 }]}>None yet</Text>
            ) : (
              data.visits.map((v) => (
                <View
                  key={v.id}
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: "#f5f5f4",
                  }}
                >
                  <SwipeCommitDeleteRow
                    onDelete={() => removeVisit(v.id)}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/farms/[id]/visits/[visitId]",
                        params: { id: farm.id, visitId: v.id },
                      })
                    }
                  >
                    <View
                      accessibilityRole="button"
                      accessibilityLabel={`Edit visit ${formatShortDate(v.visitDate)}`}
                    >
                      <Text style={{ fontWeight: "700" }}>
                        {formatShortDate(v.visitDate)} —{" "}
                        {VISIT_TYPE_LABELS[v.visitType] ?? v.visitType}
                      </Text>
                      {v.followUpRequired ? (
                        <Text style={{ color: "#b45309", fontWeight: "600", marginTop: 2 }}>
                          Follow-up due
                        </Text>
                      ) : null}
                      {v.notes ? (
                        <Text style={[styles.muted, { marginTop: 2 }]}>{v.notes}</Text>
                      ) : null}
                    </View>
                  </SwipeCommitDeleteRow>
                </View>
              ))
            )}
          </Card>
          <RecordLink
            label="Log visit"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/farms/[id]/log-visit",
                params: { id: farm.id },
              })
            }
          />
        </View>

        {/* ── Generator log ── */}
        <View onLayout={onSectionLayout("generators")}>
          <Card>
            <SectionHeading
              title="Generator Log"
              onTop={scrollPageToTop}
              right={
                (data.generatorLogs ?? []).some(
                  (log) =>
                    log.gen1Hours != null ||
                    log.gen2Hours != null ||
                    log.gen3Hours != null ||
                    log.gen4Hours != null,
                ) ? (
                  <ClipboardIconButton
                    accessibilityLabel="Copy generator log"
                    color={colors.accentDark}
                    getText={() => {
                      const allLogs = data.generatorLogs ?? [];
                      return formatGeneratorChartsCopy(
                        allLogs.map((log) => {
                          const hours: GeneratorHours = {
                            gen1Hours: log.gen1Hours,
                            gen2Hours: log.gen2Hours,
                            gen3Hours: log.gen3Hours,
                            gen4Hours: log.gen4Hours,
                          };
                          const priorFor = (hourKey: GenHourKey) => {
                            let seen = false;
                            for (const candidate of allLogs) {
                              if (!seen) {
                                if (candidate.id === log.id) seen = true;
                                continue;
                              }
                              if (candidate[hourKey] != null) return candidate[hourKey];
                            }
                            return null;
                          };
                          const [y, m, d] = log.logDate.split("-").map(Number);
                          return {
                            dateLabel: `${m}-${d}-${y}`,
                            hours,
                            deltas: {
                              gen1: hoursDelta(log.gen1Hours, priorFor("gen1Hours")),
                              gen2: hoursDelta(log.gen2Hours, priorFor("gen2Hours")),
                              gen3: hoursDelta(log.gen3Hours, priorFor("gen3Hours")),
                              gen4: hoursDelta(log.gen4Hours, priorFor("gen4Hours")),
                            },
                          };
                        }),
                      );
                    }}
                  />
                ) : null
              }
            />
            {(data.generatorLogs ?? []).every(
              (log) =>
                log.gen1Hours == null &&
                log.gen2Hours == null &&
                log.gen3Hours == null &&
                log.gen4Hours == null,
            ) ? (
              <Text style={[styles.muted, { marginTop: 10 }]}>None yet</Text>
            ) : (
              <>
                {GENERATOR_FIELD_DEFS.map((gen) => {
                  const allLogs = data.generatorLogs ?? [];
                  const genLogs = allLogs
                    .filter((log) => log[gen.hourKey] != null)
                    .slice(0, MAX_GENERATOR_LOGS_DISPLAY);
                  if (genLogs.length === 0) return null;
                  const rows: GeneratorChartRow[] = genLogs.map((log, index) => {
                    const previous = genLogs[index + 1] ?? null;
                    const [y, m, d] = log.logDate.split("-").map(Number);
                    return {
                      id: log.id,
                      dateLabel: `${m}-${d}-${y}`,
                      hours: log[gen.hourKey] as number,
                      exercised: hoursDelta(log[gen.hourKey], previous?.[gen.hourKey]),
                    };
                  });
                  return (
                    <GeneratorHoursChart
                      key={gen.key}
                      title={gen.label}
                      rows={rows}
                      onEdit={(id) => {
                        const log = allLogs.find((l) => l.id === id);
                        if (log) openGeneratorEditor(log, gen.hourKey);
                      }}
                      onDelete={(id) =>
                        setOpsConfirm({
                          kind: "generator",
                          logId: id,
                          hourKey: gen.hourKey,
                          label: gen.label,
                        })
                      }
                    />
                  );
                })}
              </>
            )}
          </Card>
          {!generatorModalOpen ? (
            <RecordLink label="Log generators" onPress={() => openGeneratorEditor()} />
          ) : null}
        </View>

        {/* ── Issues ── */}
        <View onLayout={onSectionLayout("issues")}>
          <Card>
            <SectionHeading title="Recent Issues" onTop={scrollPageToTop} />
            {data.issues.length === 0 ? (
              <Text style={[styles.muted, { marginTop: 10 }]}>None yet</Text>
            ) : (
              data.issues.map((issue) => (
                <View
                  key={issue.id}
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: "#f5f5f4",
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: "700" }}>
                      {formatShortDate(issue.dateReported)} · {issue.priority}
                      <Text style={{ fontWeight: "600", color: colors.muted }}>
                        {" "}
                        · {issue.status}
                      </Text>
                    </Text>
                    <Text style={{ marginTop: 2 }}>
                      {ISSUE_CATEGORY_LABELS[issue.category] ?? issue.category}:{" "}
                      {issue.description}
                    </Text>
                  </View>
                  <RowActions
                    editLabel="Edit issue"
                    deleteLabel="Delete issue"
                    onEdit={() =>
                      router.push({
                        pathname: "/(tabs)/farms/[id]/issues/[issueId]",
                        params: { id: farm.id, issueId: issue.id },
                      })
                    }
                    onDelete={() => removeIssue(issue.id)}
                  />
                </View>
              ))
            )}
          </Card>
          <RecordLink
            label="Report issue"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/farms/[id]/report-issue",
                params: { id: farm.id },
              })
            }
          />
        </View>

        {/* ── Litter ── */}
        <View onLayout={onSectionLayout("litter")}>
          <Card>
            <SectionHeading title="Litter Events" onTop={scrollPageToTop} />
            {data.litterEvents.length === 0 ? (
              <Text style={[styles.muted, { marginTop: 10 }]}>None yet</Text>
            ) : (
              data.litterEvents.map((e) => (
                <View
                  key={e.id}
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: "#f5f5f4",
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: "700" }}>
                      {formatShortDate(e.eventDate)} —{" "}
                      {LITTER_EVENT_LABELS[e.eventType] ?? e.eventType}
                      {e.houseNumber != null ? ` · House ${e.houseNumber}` : ""}
                    </Text>
                    {e.notes ? <Text style={[styles.muted, { marginTop: 2 }]}>{e.notes}</Text> : null}
                  </View>
                  <RowActions
                    editLabel="Edit litter event"
                    deleteLabel="Delete litter event"
                    onEdit={() =>
                      router.push({
                        pathname: "/(tabs)/farms/[id]/litter/[eventId]",
                        params: { id: farm.id, eventId: e.id },
                      })
                    }
                    onDelete={() => removeLitter(e.id)}
                  />
                </View>
              ))
            )}
          </Card>
          <RecordLink
            label="Record litter event"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/farms/[id]/record-litter",
                params: { id: farm.id },
              })
            }
          />
        </View>

        {/* ── Feed ── */}
        <View onLayout={onSectionLayout("feed")}>
          <Card>
            <SectionHeading title="Feed Deliveries" onTop={scrollPageToTop} />
            {data.feedDeliveries.length === 0 ? (
              <Text style={[styles.muted, { marginTop: 10 }]}>None yet</Text>
            ) : (
              data.feedDeliveries.map((d) => (
                <View
                  key={d.id}
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: "#f5f5f4",
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: "700" }}>
                      {formatShortDate(d.deliveryDate)} — {formatNumber(d.poundsDelivered)} lbs
                      {d.houseNumber != null ? ` · House ${d.houseNumber}` : ""}
                      {d.feedType ? ` · ${d.feedType}` : ""}
                      {d.feedMill ? ` · ${d.feedMill}` : ""}
                    </Text>
                  </View>
                  <RowActions
                    editLabel="Edit feed delivery"
                    deleteLabel="Delete feed delivery"
                    onEdit={() =>
                      router.push({
                        pathname: "/(tabs)/farms/[id]/feed/[deliveryId]",
                        params: { id: farm.id, deliveryId: d.id },
                      })
                    }
                    onDelete={() => removeFeed(d.id)}
                  />
                </View>
              ))
            )}
          </Card>
          <RecordLink
            label="Record feed delivery"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/farms/[id]/record-feed",
                params: { id: farm.id },
              })
            }
          />
        </View>

      </ScrollView>

      <Modal
        visible={tempHouse != null}
        animationType="slide"
        transparent
        onRequestClose={closeTempModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={closeTempModal} />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              overflow: "hidden",
            }}
          >
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                House {tempHouse?.houseNumber} temperature
              </Text>
              <Text
                style={{
                  marginTop: 12,
                  fontSize: 40,
                  fontWeight: "800",
                  textAlign: "center",
                  color: colors.text,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {tempHouse?.temp.trim() ? `${tempHouse.temp}°` : "—"}
              </Text>
              {tempError ? (
                <Text style={{ color: colors.danger, fontWeight: "600", marginTop: 8 }}>
                  {tempError}
                </Text>
              ) : null}
              {tempHouse?.temp.trim() ? (
                <Pressable
                  onPress={clearHouseTemp}
                  disabled={tempSaving}
                  style={{ marginTop: 10, minHeight: 36, justifyContent: "center" }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear temperature"
                >
                  <Text style={{ textAlign: "center", fontWeight: "700", color: colors.muted }}>
                    Clear temperature
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <NumberKeypad
              allowDecimal
              onDigit={(d) =>
                setTempHouse((prev) =>
                  prev ? { ...prev, temp: appendKeypadDigit(prev.temp, d, true) } : prev,
                )
              }
              onBackspace={() => {
                if (!tempHouse?.temp) closeTempModal();
                else
                  setTempHouse((prev) =>
                    prev ? { ...prev, temp: backspaceKeypadValue(prev.temp) } : prev,
                  );
              }}
              onEnter={() => {
                if (tempHouse?.temp.trim()) saveHouseTemp();
                else clearHouseTemp();
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={editingHouse != null}
        animationType="slide"
        transparent={Platform.OS === "web"}
        onRequestClose={closeHouseEditor}
      >
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: "#fff",
            paddingTop: houseEditTopPad,
            ...(Platform.OS === "web"
              ? { position: "fixed" as const, top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }
              : null),
          }}
          edges={["bottom"]}
        >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <View style={{ flex: 1, backgroundColor: "#fff" }}>
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                Edit house {editingHouse?.houseNumber}
              </Text>
              {houseEditError ? (
                <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "700" }}>
                  {houseEditError}
                </Text>
              ) : null}
            </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
              >
                {editingHouse ? (
                  <View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <NativeNumInput
                        label="House number"
                        value={editingHouse.houseNumber}
                        style={{ flex: 1 }}
                        onChangeText={(v) =>
                          setEditingHouse((prev) => (prev ? { ...prev, houseNumber: v } : prev))
                        }
                      />
                      {data.activeFlock ? (
                        <View style={{ flex: 1, marginBottom: 10 }}>
                          <Text style={styles.label}>Flock ID</Text>
                          <TextInput
                            style={[
                              styles.input,
                              { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 0 },
                            ]}
                            value={editingHouse.flockNumber}
                            onChangeText={(v) =>
                              setEditingHouse((prev) =>
                                prev ? { ...prev, flockNumber: v } : prev,
                              )
                            }
                            autoCapitalize="characters"
                            autoCorrect={false}
                            placeholder="e.g. 26-07"
                            placeholderTextColor={colors.muted}
                          />
                          <PropagateCheck
                            checked={editingHouse.applyFlockIdToRemaining}
                            onToggle={() =>
                              setEditingHouse((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      applyFlockIdToRemaining: !prev.applyFlockIdToRemaining,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </View>
                      ) : (
                        <View style={{ flex: 1 }} />
                      )}
                    </View>
                    {data.activeFlock ? (
                      <>
                        <View style={{ marginBottom: 10 }}>
                          <DatePickerField
                            label="Placement date"
                            value={editingHouse.placementDate}
                            presentation={Platform.OS === "web" ? "modal" : "inline"}
                            expanded={housePicker === "placement"}
                            onOpen={() => setHousePicker("placement")}
                            inputStyle={{ marginBottom: 0 }}
                            onChange={(date) =>
                              setEditingHouse((prev) => {
                                if (!prev) return prev;
                                const oldDefault = prev.placementDate
                                  ? addDaysKey(prev.placementDate, 52)
                                  : "";
                                const catchWasDefault =
                                  !prev.catchDate || prev.catchDate === oldDefault;
                                return {
                                  ...prev,
                                  placementDate: date,
                                  catchDate: catchWasDefault
                                    ? addDaysKey(date, 52)
                                    : prev.catchDate,
                                };
                              })
                            }
                          />
                          <PropagateCheck
                            checked={editingHouse.applyPlacementToRemaining}
                            onToggle={() =>
                              setEditingHouse((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      applyPlacementToRemaining: !prev.applyPlacementToRemaining,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </View>
                        <NativeNumInput
                          label="Birds placed"
                          value={editingHouse.placedBirdCount}
                          grouped
                          onChangeText={(v) =>
                            setEditingHouse((prev) =>
                              prev ? { ...prev, placedBirdCount: v } : prev,
                            )
                          }
                          propagateChecked={editingHouse.applyBirdsToRemaining}
                          onPropagateToggle={() =>
                            setEditingHouse((prev) =>
                              prev
                                ? { ...prev, applyBirdsToRemaining: !prev.applyBirdsToRemaining }
                                : prev,
                            )
                          }
                        />
                        <View style={{ marginBottom: 10 }}>
                          <DatePickerField
                            label="Catch date"
                            value={editingHouse.catchDate}
                            presentation={Platform.OS === "web" ? "modal" : "inline"}
                            expanded={housePicker === "catch"}
                            onOpen={() => setHousePicker("catch")}
                            inputStyle={{ marginBottom: 0 }}
                            onChange={(date) =>
                              setEditingHouse((prev) =>
                                prev ? { ...prev, catchDate: date } : prev,
                              )
                            }
                          />
                          <PropagateCheck
                            checked={editingHouse.applyCatchDateToRemaining}
                            onToggle={() =>
                              setEditingHouse((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      applyCatchDateToRemaining: !prev.applyCatchDateToRemaining,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </View>
                        <View style={{ marginBottom: 10 }}>
                          <TimeScrollPickerField
                            label="Catch time"
                            value={editingHouse.catchTime}
                            presentation={Platform.OS === "web" ? "modal" : "inline"}
                            expanded={housePicker === "catchTime"}
                            onOpen={() => setHousePicker("catchTime")}
                            inputStyle={{ marginBottom: 0 }}
                            onChange={(time) =>
                              setEditingHouse((prev) =>
                                prev ? { ...prev, catchTime: time } : prev,
                              )
                            }
                          />
                          <PropagateCheck
                            checked={editingHouse.applyCatchTimeToRemaining}
                            onToggle={() =>
                              setEditingHouse((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      applyCatchTimeToRemaining: !prev.applyCatchTimeToRemaining,
                                    }
                                  : prev,
                              )
                            }
                          />
                          {editingHouse.catchTime ? (
                            <Pressable
                              onPress={() =>
                                setEditingHouse((prev) =>
                                  prev ? { ...prev, catchTime: "" } : prev,
                                )
                              }
                              style={{ alignSelf: "flex-start", marginTop: 2 }}
                              hitSlop={8}
                            >
                              <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12 }}>
                                Clear
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </>
                    ) : null}
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <NativeNumInput
                        label="Square footage"
                        value={editingHouse.squareFootage}
                        placeholder="29,700"
                        decimal
                        grouped
                        style={{ flex: 1 }}
                        onChangeText={(v) =>
                          setEditingHouse((prev) => (prev ? { ...prev, squareFootage: v } : prev))
                        }
                        propagateChecked={editingHouse.applySquareFootageToRemaining}
                        onPropagateToggle={() =>
                          setEditingHouse((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  applySquareFootageToRemaining: !prev.applySquareFootageToRemaining,
                                }
                              : prev,
                          )
                        }
                      />
                      <NativeNumInput
                        label="Total CFM (Min Vent)"
                        value={editingHouse.totalFanCFM}
                        decimal
                        grouped
                        style={{ flex: 1 }}
                        onChangeText={(v) =>
                          setEditingHouse((prev) => (prev ? { ...prev, totalFanCFM: v } : prev))
                        }
                        propagateChecked={editingHouse.applyMinVentCfmToRemaining}
                        onPropagateToggle={() =>
                          setEditingHouse((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  applyMinVentCfmToRemaining: !prev.applyMinVentCfmToRemaining,
                                }
                              : prev,
                          )
                        }
                      />
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <NativeNumInput
                        label="Total CFM (Power)"
                        value={editingHouse.totalPowerCFM}
                        decimal
                        grouped
                        style={{ flex: 1 }}
                        onChangeText={(v) =>
                          setEditingHouse((prev) => (prev ? { ...prev, totalPowerCFM: v } : prev))
                        }
                        propagateChecked={editingHouse.applyPowerCfmToRemaining}
                        onPropagateToggle={() =>
                          setEditingHouse((prev) =>
                            prev
                              ? { ...prev, applyPowerCfmToRemaining: !prev.applyPowerCfmToRemaining }
                              : prev,
                          )
                        }
                      />
                      <View style={{ flex: 1 }} />
                    </View>
                  </View>
                ) : null}
              </ScrollView>
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  paddingHorizontal: 20,
                  paddingTop: 12,
                  paddingBottom: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <PrimaryButton
                  label={houseSaving ? "Saving…" : "Save"}
                  onPress={saveHouseEdit}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  label="Cancel"
                  secondary
                  onPress={closeHouseEditor}
                  style={{ flex: 1 }}
                />
              </View>
          </View>
        </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={addingHouse != null}
        animationType="slide"
        transparent
        onRequestClose={closeAddHouse}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
            onPress={closeAddHouse}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: 20,
                paddingBottom: Platform.OS === "ios" ? 28 : 20,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                Add House
              </Text>
              {addHouseError ? (
                <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "700" }}>
                  {addHouseError}
                </Text>
              ) : null}
              {addingHouse ? (
                <View style={{ marginTop: 14 }}>
                  <NativeNumInput
                    label="House number *"
                    value={addingHouse.houseNumber}
                    onChangeText={(v) =>
                      setAddingHouse((prev) => (prev ? { ...prev, houseNumber: v } : prev))
                    }
                  />
                  <NativeNumInput
                    label="Square footage *"
                    value={addingHouse.squareFootage}
                    decimal
                    onChangeText={(v) =>
                      setAddingHouse((prev) => (prev ? { ...prev, squareFootage: v } : prev))
                    }
                  />
                  <NativeNumInput
                    label="Total CFM (Min Vent)"
                    value={addingHouse.totalFanCFM}
                    decimal
                    onChangeText={(v) =>
                      setAddingHouse((prev) => (prev ? { ...prev, totalFanCFM: v } : prev))
                    }
                  />
                  <NativeNumInput
                    label="Total CFM (Power)"
                    value={addingHouse.totalPowerCFM}
                    decimal
                    onChangeText={(v) =>
                      setAddingHouse((prev) => (prev ? { ...prev, totalPowerCFM: v } : prev))
                    }
                  />
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                    <PrimaryButton
                      label={addHouseSaving ? "Saving…" : "Save house"}
                      onPress={saveAddHouse}
                      style={{ flex: 1 }}
                    />
                    <PrimaryButton
                      label="Cancel"
                      secondary
                      onPress={closeAddHouse}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : null}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={editingFarm != null}
        animationType="slide"
        transparent
        onRequestClose={closeFarmEditor}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
            paddingBottom:
              farmEditKeyboardH > 0 ? farmEditKeyboardH : Math.max(insets.bottom, 8),
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={closeFarmEditor} />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: "90%",
              overflow: "hidden",
            }}
          >
            <ScrollView
              ref={farmEditScrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={{
                padding: 20,
                paddingBottom: 16,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                Edit Farm Info
              </Text>
              {farmEditError ? (
                <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "700" }}>
                  {farmEditError}
                </Text>
              ) : null}
              {editingFarm ? (
                <View style={{ marginTop: 14, gap: 4 }}>
                  <Text style={styles.label}>Farm name *</Text>
                  <TextInput
                    style={styles.input}
                    value={editingFarm.farmName}
                    onChangeText={(v) =>
                      setEditingFarm((prev) => (prev ? { ...prev, farmName: v } : prev))
                    }
                    autoCapitalize="words"
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>Farm #</Text>
                  <TextInput
                    style={styles.input}
                    value={editingFarm.farmNumber}
                    onChangeText={(v) =>
                      setEditingFarm((prev) => (prev ? { ...prev, farmNumber: v } : prev))
                    }
                    autoCapitalize="characters"
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>Grower name</Text>
                  <TextInput
                    style={styles.input}
                    value={editingFarm.growerName}
                    onChangeText={(v) =>
                      setEditingFarm((prev) => (prev ? { ...prev, growerName: v } : prev))
                    }
                    autoCapitalize="words"
                  />
                  <View ref={farmNotesWrapRef} collapsable={false}>
                    <Text style={[styles.label, { marginTop: 8 }]}>Notes</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          minHeight: 110,
                          paddingTop: 12,
                          paddingBottom: 12,
                          textAlignVertical: "top",
                          color: colors.text,
                        },
                      ]}
                      value={editingFarm.notes}
                      onChangeText={(v) =>
                        setEditingFarm((prev) => (prev ? { ...prev, notes: v } : prev))
                      }
                      multiline
                      scrollEnabled
                      placeholder="Notes"
                      placeholderTextColor={colors.muted}
                      onFocus={() => {
                        requestAnimationFrame(() => {
                          const wrap = farmNotesWrapRef.current;
                          const scroll = farmEditScrollRef.current;
                          if (!wrap || !scroll) return;
                          wrap.measureLayout(
                            scroll as unknown as number,
                            (_x, y) => {
                              scroll.scrollTo({ y: Math.max(0, y - 20), animated: true });
                            },
                            () => {
                              scroll.scrollToEnd({ animated: true });
                            },
                          );
                        });
                      }}
                    />
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 16,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <PrimaryButton
                label={farmSaving ? "Saving…" : "Save"}
                onPress={saveFarmEdit}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label="Cancel"
                secondary
                onPress={closeFarmEditor}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={generatorModalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeGeneratorModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={closeGeneratorModal} />
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                maxHeight: "92%",
                overflow: "hidden",
              }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  padding: 20,
                  paddingBottom: Platform.OS === "ios" ? 28 : 24,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                  {generatorEditingId
                    ? generatorEditingGen
                      ? `Edit ${GENERATOR_FIELD_DEFS.find((f) => f.hourKey === generatorEditingGen)?.label ?? "generator"}`
                      : "Edit generators"
                    : "Log generators"}
                </Text>
                {generatorError ? (
                  <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "700" }}>
                    {generatorError}
                  </Text>
                ) : null}
                <View style={{ marginTop: 14, marginBottom: 10 }}>
                  <DatePickerField
                    label="Date logged"
                    value={generatorDraft.logDate}
                    presentation="inline"
                    onChange={(date) =>
                      setGeneratorDraft((prev) => ({ ...prev, logDate: date }))
                    }
                  />
                </View>
                {(generatorEditingGen
                  ? GENERATOR_FIELD_DEFS.filter((f) => f.hourKey === generatorEditingGen)
                  : GENERATOR_FIELD_DEFS
                ).map((f) => (
                  <NativeNumInput
                    key={f.hourKey}
                    label={`${f.label} hours`}
                    value={generatorDraft[f.hourKey]}
                    decimal
                    placeholder="Optional"
                    onChangeText={(v) =>
                      setGeneratorDraft((prev) => ({ ...prev, [f.hourKey]: v }))
                    }
                  />
                ))}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <PrimaryButton
                    label={generatorSaving ? "Saving…" : "Save"}
                    onPress={() => saveGeneratorLog()}
                    style={{ flex: 1 }}
                  />
                  <PrimaryButton
                    label="Cancel"
                    secondary
                    onPress={closeGeneratorModal}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDialog
        visible={generatorSwap != null}
        title="Hours look swapped"
        message={generatorSwap?.message ?? ""}
        confirmLabel="Fix and save"
        altLabel="Save as entered"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (!generatorSwap) return;
          const draft = parseGeneratorDraftHours();
          saveGeneratorLog({ ...draft, ...generatorSwap.suggested }, true);
        }}
        onAlt={() => {
          saveGeneratorLog(parseGeneratorDraftHours(), false);
        }}
        onCancel={() => setGeneratorSwap(null)}
      />
      <ConfirmDialog
        visible={opsConfirm != null}
        title={
          opsConfirm?.kind === "house"
            ? `Delete house ${opsConfirm.houseNumber}?`
            : opsConfirm?.kind === "generator"
              ? `Delete ${opsConfirm.label} entry?`
              : "Delete?"
        }
        message={
          opsConfirm?.kind === "house"
            ? "This removes the house from the farm. It will no longer appear in your lists."
            : opsConfirm?.kind === "generator"
              ? "Only this generator reading will be removed. Other generators on this date stay."
              : "This cannot be undone."
        }
        confirmLabel="Delete"
        danger
        onConfirm={runOpsConfirm}
        onCancel={() => setOpsConfirm(null)}
      />
      <ConfirmDialog
        visible={opsError != null}
        title="Error"
        message={opsError ?? ""}
        confirmLabel="OK"
        cancelLabel="Dismiss"
        onConfirm={() => setOpsError(null)}
        onCancel={() => setOpsError(null)}
      />
      <ConfirmDialog
        visible={completeConfirm != null}
        title="End flock?"
        message={
          completeConfirm
            ? `Mark flock ${completeConfirm.flockNumber} as completed? You can reactivate it later from Farm History.`
            : ""
        }
        confirmLabel="End flock"
        onConfirm={runCompleteFlock}
        onCancel={() => setCompleteConfirm(null)}
      />

      <ConfirmDialog
        visible={completeError != null}
        title="Error"
        message={completeError ?? ""}
        confirmLabel="OK"
        cancelLabel="Dismiss"
        onConfirm={() => setCompleteError(null)}
        onCancel={() => setCompleteError(null)}
      />

      <Modal
        visible={completePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCompletePickerOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => setCompletePickerOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 20,
              maxWidth: 420,
              width: "100%",
              alignSelf: "center",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
              End flock
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.muted }}>
              Which flock do you want to end?
            </Text>
            <View style={{ marginTop: 16, gap: 8 }}>
              {activeFlocks.map((fl) => (
                <Pressable
                  key={fl.id}
                  accessibilityRole="button"
                  onPress={() => askCompleteFlock(fl.id, fl.flockNumber)}
                  style={{
                    borderRadius: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    backgroundColor: colors.accentDark,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                    {fl.flockNumber} ({fl.flockAgeDays}d)
                  </Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => setCompletePickerOpen(false)}
                style={{
                  borderRadius: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 15 }}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
