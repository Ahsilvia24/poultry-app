import { useCallback, useEffect, useRef, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
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
  updateFlockGrowthRate,
  updateGeneratorLog,
  updateHouse,
  updateHouseLoggedTemp,
} from "../../../../src/repos/data";
import {
  consumeFarmReturnFromMortality,
  getFarmNavContext,
  setFarmNavContext,
} from "../../../../src/lib/farmNavContext";
import { useTabScrollToTop } from "../../../../src/lib/tabScroll";
import { VISIT_TYPE_LABELS } from "../../../../src/lib/visits";
import {
  ISSUE_CATEGORY_LABELS,
  LITTER_EVENT_LABELS,
} from "../../../../src/lib/opsLabels";
import {
  formatGeneratorChartsCopy,
  formatGeneratorHours,
  hoursDelta,
  GENERATOR_FIELD_DEFS,
  type GenHourKey,
  type GeneratorHours,
} from "../../../../src/lib/generator";
import {
  catchWeightProjections,
  resolveGrowthRate,
} from "../../../../src/lib/weight/projections";
import { addDaysKey, todayKey } from "../../../../src/lib/ids";
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
import { WeightProjectionTile } from "../../../../src/components/WeightProjectionTile";
import { DatePickerField } from "../../../../src/components/DatePickerField";
import { ClipboardIconButton } from "../../../../src/components/ClipboardIconButton";

/** "2026-07-25" → "07-25-2026" */
function formatUsDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d) return dateKey;
  return `${m}-${d}-${y}`;
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
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

/** e.g. Wed 29 Jul 26 */
function formatHouseDetailDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return `${WEEKDAYS_SHORT[dt.getDay()]} ${d} ${MONTHS_SHORT[m - 1]} ${String(y).slice(-2)}`;
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
    <Pressable onPress={onPress} style={{ marginTop: 4, marginBottom: 16 }}>
      <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: 14 }}>{label}</Text>
    </Pressable>
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
  numberOfFans: string;
  placedBirdCount: string;
  /** Shown as placeholder while the field stays empty for easy retype. */
  placedBirdCountPlaceholder: string;
  placementDate: string;
  catchDate: string;
  flockNumber: string;
  applyToRemaining: boolean;
  applySpecsToRemaining: boolean;
};

type AddHouseDraft = {
  houseNumber: string;
  squareFootage: string;
  totalFanCFM: string;
  numberOfFans: string;
};

type FarmEditDraft = {
  farmName: string;
  growerName: string;
  phoneNumber: string;
  email: string;
  notes: string;
  numberOfGenerators: number | null;
};

/** Native iOS number pad — same feel as Flock ID text field. */
function NativeNumInput({
  label,
  value,
  onChangeText,
  decimal,
  placeholder,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  decimal?: boolean;
  placeholder?: string;
  style?: object;
}) {
  return (
    <View style={[{ marginBottom: 10 }, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, { fontSize: 20, fontWeight: "700", color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={decimal ? "decimal-pad" : "number-pad"}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

const MAX_GENERATOR_LOGS_DISPLAY = 8;

type GeneratorChartRow = {
  id: string;
  dateLabel: string;
  hours: number;
  exercised: number | null;
};

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
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ fontWeight: "700", fontSize: 12, color: colors.text, marginBottom: 1 }}>
        {title}
      </Text>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Text style={{ width: 80, fontSize: 11, fontWeight: "600", color: colors.muted, lineHeight: 14 }}>
          Date
        </Text>
        <Text style={{ width: 48, fontSize: 11, fontWeight: "600", color: colors.muted, lineHeight: 14 }}>
          Hours
        </Text>
        <Text style={{ width: 56, fontSize: 11, fontWeight: "600", color: colors.muted, lineHeight: 14 }}>
          Exercised
        </Text>
        {showActions ? <View style={{ width: 44 }} /> : null}
      </View>
      {rows.length === 0 ? (
        <Text style={[styles.muted, { fontSize: 12 }]}>None yet</Text>
      ) : (
        <View>
          {rows.map((row) => (
            <View
              key={row.id}
              style={{ flexDirection: "row", gap: 12, alignItems: "center", minHeight: 16 }}
            >
              <Text
                style={{
                  width: 80,
                  fontSize: 12,
                  lineHeight: 16,
                  fontWeight: "600",
                  color: colors.text,
                  fontVariant: ["tabular-nums"],
                }}
                numberOfLines={1}
              >
                {row.dateLabel}
              </Text>
              <Text
                style={{
                  width: 48,
                  fontSize: 12,
                  lineHeight: 16,
                  fontWeight: "600",
                  color: colors.text,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatGeneratorHours(row.hours)}
              </Text>
              <Text
                style={{
                  width: 56,
                  fontSize: 12,
                  lineHeight: 16,
                  fontWeight: "600",
                  color: colors.text,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatGeneratorHours(row.exercised)}
              </Text>
              {showActions ? (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Pressable
                    accessibilityLabel="Edit generator log"
                    onPress={() => onEdit(row.id)}
                    hitSlop={4}
                    style={{
                      width: 22,
                      height: 16,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="pencil-outline" size={13} color={colors.muted} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Delete generator log"
                    onPress={() => onDelete(row.id)}
                    hitSlop={4}
                    style={{
                      width: 22,
                      height: 16,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="trash-outline" size={13} color={colors.danger} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
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
  const [data, setData] = useState<FarmDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingHouse, setEditingHouse] = useState<HouseEditDraft | null>(null);
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
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [generatorSaving, setGeneratorSaving] = useState(false);
  const [generatorError, setGeneratorError] = useState<string | null>(null);
  const [generatorEditingId, setGeneratorEditingId] = useState<string | null>(null);
  const [generatorEditingGen, setGeneratorEditingGen] = useState<GenHourKey | null>(null);
  const [generatorDraft, setGeneratorDraft] = useState({
    logDate: todayKey(),
    gen1Hours: "",
    gen2Hours: "",
    gen3Hours: "",
    gen4Hours: "",
  });
  const scrollRef = useRef<ScrollViewType>(null);
  useTabScrollToTop("farms", scrollRef);
  const sectionY = useRef<Record<string, number>>({});

  function scrollToSection(key: string) {
    const y = sectionY.current[key];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
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

  const scrollToHouseFlock = useCallback(
    (houseFlockId: string | null | undefined) => {
      if (!houseFlockId || !data || data.farm.id !== farmId) return;
      const house = data.houses.find((h) => h.houseFlockId === houseFlockId);
      if (!house) return;
      const key = `house-${house.id}`;
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
    },
    [data, farmId],
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

  // Back to House → that house; any other focus → top of page.
  useEffect(() => {
    if (!data || data.farm.id !== farmId || focusNonce === 0) return;
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
      growerName: farm.growerName ?? "",
      phoneNumber: farm.phoneNumber ?? "",
      email: farm.email ?? "",
      notes: farm.notes ?? "",
      numberOfGenerators: farm.numberOfGenerators ?? null,
    });
  }

  // Open settings editor when navigated with ?edit=1 (from farms list gear)
  useEffect(() => {
    if (!openEdit || !data || data.farm.id !== farmId || editingFarm) return;
    openFarmEditor(data.farm);
  }, [openEdit, data, farmId, editingFarm]);

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
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)/farms");
            }}
            style={{
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} style={{ marginRight: -4 }} />
            <Text style={styles.title}>Farms</Text>
          </Pressable>
          <Text style={{ color: colors.danger }}>{error ?? "Farm not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { farm } = data;
  const activeFlocks = data.activeFlocks ?? [];
  const catchLabel =
    data.activeFlock?.catchDates?.[0] ??
    data.activeFlock?.projectedCatchDate ??
    data.activeFlock?.resolvedCatchDate ??
    null;
  const growthRate = (() => {
    const fromHouse = data.houses.find((h) => h.growthRateLbsPerDay != null)?.growthRateLbsPerDay;
    if (fromHouse != null) return resolveGrowthRate(fromHouse);
    return data.activeFlock
      ? resolveGrowthRate(data.activeFlock.growthRateLbsPerDay)
      : null;
  })();

  /** Unique catch dates → Catch day / +1 / +2, soonest catch first. */
  const weightProjectionGroups = (() => {
    if (activeFlocks.length === 0 || growthRate == null) return [];
    const byCatch = new Map<string, { placement: string; rate: number }>();
    for (const h of data.houses) {
      if (h.placedBirdCount == null) continue;
      const catchDate = h.catchDate ?? catchLabel;
      if (!catchDate) continue;
      const placement = h.placementDate ?? data.activeFlock?.placementDate;
      if (!placement) continue;
      const rate = resolveGrowthRate(h.growthRateLbsPerDay);
      const existing = byCatch.get(catchDate);
      // Prefer earliest placement for a shared catch (older birds → higher weight).
      if (!existing || placement < existing.placement) {
        byCatch.set(catchDate, { placement, rate });
      }
    }
    if (byCatch.size === 0 && catchLabel && data.activeFlock) {
      byCatch.set(catchLabel, {
        placement: data.activeFlock.placementDate,
        rate: growthRate,
      });
    }
    return Array.from(byCatch.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([catchDate, { placement, rate }]) => ({
        catchDateKey: catchDate,
        projections: catchWeightProjections({
          placementDate: placement,
          catchDate,
          growthRateLbsPerDay: rate,
        }),
      }));
  })();

  function confirmCompleteFlock(flockId: string, flockNumber: string) {
    Alert.alert(
      "Complete flock?",
      `Mark flock ${flockNumber} as completed? You can reactivate it later from Farm History.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: () => {
            try {
              completeFlock(flockId);
              load();
            } catch (e) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Could not complete flock",
              );
            }
          },
        },
      ],
    );
  }

  function promptCompleteFlock() {
    if (activeFlocks.length === 0) return;
    if (activeFlocks.length === 1) {
      confirmCompleteFlock(activeFlocks[0]!.id, activeFlocks[0]!.flockNumber);
      return;
    }
    Alert.alert("Complete flock", "Which flock do you want to complete?", [
      ...activeFlocks.map((fl) => ({
        text: `${fl.flockNumber} (${fl.flockAgeDays}d)`,
        onPress: () => confirmCompleteFlock(fl.id, fl.flockNumber),
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
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
      numberOfFans: "",
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
      const fans =
        addingHouse.numberOfFans.trim() === ""
          ? null
          : Math.floor(Number(addingHouse.numberOfFans));
      if (cfm != null && !Number.isFinite(cfm)) throw new Error("Total fan CFM is invalid");
      if (fans != null && (!Number.isFinite(fans) || fans < 0)) {
        throw new Error("Number of fans is invalid");
      }
      createHouse(data.farm.id, {
        houseNumber: Number(addingHouse.houseNumber),
        squareFootage: sq,
        totalFanCFM: cfm,
        numberOfFans: fans,
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
    // Only prefill dates the house already has — don't inherit an old flock
    // date. Empty fields open the calendar on today via DatePickerField.
    const placementDate = h.placementDate ?? "";
    const catchDate = h.catchDate ?? "";
    setEditingHouse({
      id: h.id,
      houseNumber: String(h.houseNumber),
      squareFootage: String(h.squareFootage ?? ""),
      totalFanCFM: h.totalFanCFM != null ? String(h.totalFanCFM) : "",
      numberOfFans: h.numberOfFans != null ? String(h.numberOfFans) : "",
      // Leave blank so the tech can type a new count without deleting first.
      // Placeholder shows the current value; empty on save keeps it.
      placedBirdCount: "",
      placedBirdCountPlaceholder:
        h.placedBirdCount != null ? String(h.placedBirdCount) : "Type birds placed",
      placementDate,
      catchDate,
      flockNumber: h.flockNumber ?? "",
      applyToRemaining: false,
      applySpecsToRemaining: false,
    });
  }

  function closeHouseEditor() {
    if (houseSaving) return;
    setEditingHouse(null);
    setHouseEditError(null);
  }

  function closeTempModal() {
    if (tempSaving) return;
    setTempHouse(null);
    setTempError(null);
  }

  function saveHouseTemp() {
    if (!tempHouse || !farm) return;
    setTempSaving(true);
    setTempError(null);
    try {
      updateHouseLoggedTemp(farm.id, tempHouse.id, tempHouse.temp);
      setTempHouse(null);
      load();
    } catch (e) {
      setTempError(e instanceof Error ? e.message : "Could not save temperature");
    } finally {
      setTempSaving(false);
    }
  }

  function clearHouseTemp() {
    if (!tempHouse || !farm) return;
    setTempSaving(true);
    setTempError(null);
    try {
      updateHouseLoggedTemp(farm.id, tempHouse.id, null);
      setTempHouse(null);
      load();
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
    Alert.alert(
      `Delete house ${h.houseNumber}?`,
      "This removes the house from the farm. It will no longer appear in your lists.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            try {
              deleteHouse(farm.id, h.id);
              load();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Could not delete house");
            }
          },
        },
      ],
    );
  }

  function confirmDeleteVisit(visitId: string, visitDate: string) {
    Alert.alert("Delete visit?", `${visitDate} will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          try {
            deleteVisit(farm.id, visitId);
            load();
          } catch (e) {
            Alert.alert("Error", e instanceof Error ? e.message : "Could not delete visit");
          }
        },
      },
    ]);
  }

  function saveHouseEdit() {
    if (!editingHouse) return;
    setHouseSaving(true);
    setHouseEditError(null);
    try {
      const sq = Number(editingHouse.squareFootage);
      const cfm =
        editingHouse.totalFanCFM.trim() === "" ? null : Number(editingHouse.totalFanCFM);
      const fans =
        editingHouse.numberOfFans.trim() === ""
          ? null
          : Math.floor(Number(editingHouse.numberOfFans));
      const placedRaw = editingHouse.placedBirdCount.trim();
      const placed =
        placedRaw === "" ? null : Math.floor(Number(placedRaw));
      if (cfm != null && !Number.isFinite(cfm)) throw new Error("Total fan CFM is invalid");
      if (fans != null && !Number.isFinite(fans)) throw new Error("Number of fans is invalid");
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
        numberOfFans: fans,
        applySpecsToRemainingHouses: editingHouse.applySpecsToRemaining,
        ...(data?.activeFlock
          ? {
              ...(placedRaw !== ""
                ? { placedBirdCount: placed }
                : existingPlaced != null
                  ? { placedBirdCount: existingPlaced }
                  : {}),
              placementDate: editingHouse.placementDate.trim() || null,
              catchDate: editingHouse.catchDate.trim() || null,
              flockNumber: editingHouse.flockNumber.trim() || null,
              applyToRemainingHouses: editingHouse.applyToRemaining,
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
    if (openEdit) {
      // Opened from list gear — return to the farms list at the prior scroll position.
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/farms");
    }
  }

  function saveFarmEdit() {
    if (!editingFarm) return;
    setFarmSaving(true);
    setFarmEditError(null);
    try {
      updateFarm(farm.id, {
        farmName: editingFarm.farmName,
        growerName: editingFarm.growerName,
        phoneNumber: editingFarm.phoneNumber,
        email: editingFarm.email,
        notes: editingFarm.notes,
      });
      setEditingFarm(null);
      if (openEdit) {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/farms");
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
      >
        <View style={{ marginBottom: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/(tabs)/farms");
              }}
              accessibilityRole="button"
              accessibilityLabel="Back to farms"
              style={{
                flexShrink: 0,
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} style={{ marginRight: -4 }} />
              <Text style={styles.title}>Farms</Text>
            </Pressable>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              <Text
                style={[styles.title, { fontSize: 22, flexShrink: 1, textAlign: "right" }]}
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
          <Card style={{ marginTop: 0 }}>
            <Text style={{ fontWeight: "800", fontSize: 14, marginBottom: 8 }}>Quick links</Text>
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
                    key: "mortality",
                    label: "Mortality",
                    onPress: () => {
                      setFarmNavContext({ farmId: farm.id, houseFlockId: null });
                      router.navigate({
                        pathname: "/(tabs)/mortality",
                        params: { farmId: farm.id },
                      });
                    },
                  },
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
                    key: "weight",
                    label: "Weight Proj.",
                    onPress: () => scrollToSection("weight"),
                  },
                  {
                    key: "generators",
                    label: "Generator Log",
                    onPress: () => scrollToSection("generators"),
                  },
                  { key: "visits", label: "Visits", onPress: () => scrollToSection("visits") },
                  { key: "issues", label: "Issues", onPress: () => scrollToSection("issues") },
                  { key: "litter", label: "Litter", onPress: () => scrollToSection("litter") },
                  { key: "feed", label: "Feed", onPress: () => scrollToSection("feed") },
                  {
                    key: "reports",
                    label: "Reports",
                    onPress: () =>
                      router.push({
                        pathname: "/(tabs)/reports",
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
                          label: "Complete Flock",
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
              overshootRight={false}
              friction={2}
              rightThreshold={40}
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
                    {detailsOpen ? "Hide details" : "Show details"}
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
                        <Metric
                          columns={3}
                          label="Placed"
                          value={formatNumber(h.placedBirdCount)}
                        />
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
                        <Metric
                          columns={3}
                          label="Placed/Catch"
                          value={
                            [
                              h.placementDate ? formatHouseDetailDate(h.placementDate) : null,
                              h.catchDate ? formatHouseDetailDate(h.catchDate) : null,
                            ]
                              .filter(Boolean)
                              .join("\n") || "—"
                          }
                        />
                        <Metric
                          columns={3}
                          label="Mortality"
                          value={
                            h.placedBirdCount != null
                              ? `${formatNumber(h.cumulativeMortality)} (${formatPct(h.cumulativeMortalityPct)})`
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
                              ? `${formatNumber(h.projectedMortality)} (${formatPct(
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
        <Pressable onPress={openAddHouse} hitSlop={8} style={{ marginBottom: 8, paddingVertical: 4 }}>
          <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: 14 }}>
            Add house
          </Text>
        </Pressable>

        {/* ── Visits ── */}
        <View onLayout={onSectionLayout("visits")}>
          <Card>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>Recent visits</Text>
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
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit visit ${formatShortDate(v.visitDate)}`}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/farms/[id]/visits/[visitId]",
                        params: { id: farm.id, visitId: v.id },
                      })
                    }
                    style={{ flex: 1, minWidth: 0 }}
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
                    {v.notes ? <Text style={[styles.muted, { marginTop: 2 }]}>{v.notes}</Text> : null}
                  </Pressable>
                  <RowActions
                    deleteLabel="Delete visit"
                    onDelete={() => confirmDeleteVisit(v.id, v.visitDate)}
                  />
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: 16 }}>Generator log</Text>
              {(data.generatorLogs ?? []).some(
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
                      allLogs.slice(0, MAX_GENERATOR_LOGS_DISPLAY).map((log) => {
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
              ) : null}
            </View>
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
                        Alert.alert(
                          `Delete ${gen.label} entry?`,
                          "Only this generator reading will be removed. Other generators on this date stay.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => {
                                deleteGeneratorLog(farm.id, id, gen.hourKey);
                                load();
                              },
                            },
                          ],
                        )
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

        {/* ── Weight projections ── */}
        <View onLayout={onSectionLayout("weight")}>
          {growthRate != null && weightProjectionGroups.length > 0 ? (
            <WeightProjectionTile
              groups={weightProjectionGroups}
              growthRateLbsPerDay={growthRate}
              onSaveGrowthRate={(rate) => {
                for (const fl of activeFlocks) {
                  updateFlockGrowthRate(fl.id, rate);
                }
                load();
              }}
            />
          ) : (
            <Card>
              <Text style={{ fontWeight: "800", fontSize: 16 }}>Weight projections</Text>
              <Text style={[styles.muted, { marginTop: 8 }]}>
                Add an active flock with a catch date to see weight projections.
              </Text>
            </Card>
          )}
        </View>

        {/* ── Issues ── */}
        <View onLayout={onSectionLayout("issues")}>
          <Card>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>Recent issues</Text>
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
                    onDelete={() =>
                      Alert.alert("Delete issue?", "This cannot be undone.", [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => {
                            try {
                              deleteIssue(farm.id, issue.id);
                              load();
                            } catch (e) {
                              Alert.alert(
                                "Error",
                                e instanceof Error ? e.message : "Could not delete",
                              );
                            }
                          },
                        },
                      ])
                    }
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
            <Text style={{ fontWeight: "800", fontSize: 16 }}>Litter events</Text>
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
                    onDelete={() =>
                      Alert.alert("Delete litter event?", "This cannot be undone.", [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => {
                            try {
                              deleteLitterEvent(farm.id, e.id);
                              load();
                            } catch (err) {
                              Alert.alert(
                                "Error",
                                err instanceof Error ? err.message : "Could not delete",
                              );
                            }
                          },
                        },
                      ])
                    }
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
            <Text style={{ fontWeight: "800", fontSize: 16 }}>Feed deliveries</Text>
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
                    onDelete={() =>
                      Alert.alert("Delete feed delivery?", "This cannot be undone.", [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => {
                            try {
                              deleteFeedDelivery(d.id);
                              load();
                            } catch (err) {
                              Alert.alert(
                                "Error",
                                err instanceof Error ? err.message : "Could not delete",
                              );
                            }
                          },
                        },
                      ])
                    }
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

        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            marginTop: 8,
            marginBottom: 8,
          }}
        >
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(tabs)/farms/[id]/history",
                params: { id: farm.id },
              })
            }
            hitSlop={8}
          >
            <Text style={{ color: colors.accentDark, fontWeight: "600", fontSize: 14 }}>
              Farm History
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={tempHouse != null}
        animationType="slide"
        transparent
        onRequestClose={closeTempModal}
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
            <Pressable style={{ flex: 1 }} onPress={closeTempModal} />
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: 20,
                paddingBottom: Platform.OS === "ios" ? 28 : 24,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                House {tempHouse?.houseNumber} temperature
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 14 }}>
                Logged temps fill Current Temp on the Service Report and reset at midnight.
              </Text>
              <NativeNumInput
                label="Temperature (°F)"
                value={tempHouse?.temp ?? ""}
                onChangeText={(v) =>
                  setTempHouse((prev) => (prev ? { ...prev, temp: v } : prev))
                }
                decimal
                placeholder="e.g. 78"
              />
              {tempError ? (
                <Text style={{ color: colors.danger, fontWeight: "600", marginBottom: 10 }}>
                  {tempError}
                </Text>
              ) : null}
              {tempSaving ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <View style={{ gap: 10 }}>
                  <PrimaryButton label="Save temperature" onPress={saveHouseTemp} />
                  {tempHouse?.temp.trim() ? (
                    <PrimaryButton
                      label="Clear temperature"
                      secondary
                      onPress={clearHouseTemp}
                    />
                  ) : null}
                  <PrimaryButton label="Cancel" secondary onPress={closeTempModal} />
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={editingHouse != null}
        animationType="slide"
        transparent
        onRequestClose={closeHouseEditor}
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
            <Pressable style={{ flex: 1 }} onPress={closeHouseEditor} />
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
                contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === "ios" ? 28 : 24 }}
              >
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                  Edit house {editingHouse?.houseNumber}
                </Text>
                {houseEditError ? (
                  <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "700" }}>
                    {houseEditError}
                  </Text>
                ) : null}
                {editingHouse ? (
                  <View style={{ marginTop: 14 }}>
                    <NativeNumInput
                      label="House number"
                      value={editingHouse.houseNumber}
                      onChangeText={(v) =>
                        setEditingHouse((prev) => (prev ? { ...prev, houseNumber: v } : prev))
                      }
                    />
                    {data.activeFlock ? (
                      <>
                        <Text style={[styles.label, { marginTop: 2 }]}>Flock ID</Text>
                        <TextInput
                          style={[
                            styles.input,
                            { fontSize: 20, fontWeight: "700", color: colors.text },
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
                        <NativeNumInput
                          label="Birds placed"
                          value={editingHouse.placedBirdCount}
                          placeholder={editingHouse.placedBirdCountPlaceholder}
                          onChangeText={(v) =>
                            setEditingHouse((prev) =>
                              prev ? { ...prev, placedBirdCount: v } : prev,
                            )
                          }
                        />
                        <View style={{ marginBottom: 10 }}>
                          <DatePickerField
                            label="Placement date"
                            value={editingHouse.placementDate}
                            presentation="inline"
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
                        </View>
                        <View style={{ marginBottom: 10 }}>
                          <DatePickerField
                            label="Catch date"
                            value={editingHouse.catchDate}
                            presentation="inline"
                            onChange={(date) =>
                              setEditingHouse((prev) =>
                                prev ? { ...prev, catchDate: date } : prev,
                              )
                            }
                          />
                        </View>
                        <Pressable
                          onPress={() =>
                            setEditingHouse((prev) =>
                              prev
                                ? { ...prev, applyToRemaining: !prev.applyToRemaining }
                                : prev,
                            )
                          }
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 10,
                            marginBottom: 12,
                            paddingVertical: 4,
                          }}
                        >
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              borderWidth: 2,
                              borderColor: editingHouse.applyToRemaining
                                ? colors.accentDark
                                : colors.border,
                              backgroundColor: editingHouse.applyToRemaining
                                ? colors.accentDark
                                : "#fff",
                              alignItems: "center",
                              justifyContent: "center",
                              marginTop: 1,
                            }}
                          >
                            {editingHouse.applyToRemaining ? (
                              <Ionicons name="checkmark" size={16} color="#fff" />
                            ) : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: "700", color: colors.text, fontSize: 14 }}>
                              Apply to all remaining houses
                            </Text>
                            <Text style={[styles.muted, { marginTop: 2 }]}>
                              Birds placed, placement date, catch date, and flock for houses after
                              this one. Earlier houses stay unchanged.
                            </Text>
                          </View>
                        </Pressable>
                      </>
                    ) : null}
                    <NativeNumInput
                      label="Square footage"
                      value={editingHouse.squareFootage}
                      decimal
                      onChangeText={(v) =>
                        setEditingHouse((prev) => (prev ? { ...prev, squareFootage: v } : prev))
                      }
                    />
                    <NativeNumInput
                      label="Total fan CFM"
                      value={editingHouse.totalFanCFM}
                      decimal
                      onChangeText={(v) =>
                        setEditingHouse((prev) => (prev ? { ...prev, totalFanCFM: v } : prev))
                      }
                    />
                    <NativeNumInput
                      label="Number of fans"
                      value={editingHouse.numberOfFans}
                      onChangeText={(v) =>
                        setEditingHouse((prev) => (prev ? { ...prev, numberOfFans: v } : prev))
                      }
                    />
                    <Pressable
                      onPress={() =>
                        setEditingHouse((prev) =>
                          prev
                            ? {
                                ...prev,
                                applySpecsToRemaining: !prev.applySpecsToRemaining,
                              }
                            : prev,
                        )
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 10,
                        marginBottom: 12,
                        paddingVertical: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          borderWidth: 2,
                          borderColor: editingHouse.applySpecsToRemaining
                            ? colors.accentDark
                            : colors.border,
                          backgroundColor: editingHouse.applySpecsToRemaining
                            ? colors.accentDark
                            : "#fff",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 1,
                        }}
                      >
                        {editingHouse.applySpecsToRemaining ? (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "700", color: colors.text, fontSize: 14 }}>
                          Apply to all remaining houses
                        </Text>
                        <Text style={[styles.muted, { marginTop: 2 }]}>
                          Square footage, fan CFM, and number of fans for houses after this one.
                          Earlier houses stay unchanged.
                        </Text>
                      </View>
                    </Pressable>
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
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
                ) : null}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
                Add house
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
                    label="Total fan CFM"
                    value={addingHouse.totalFanCFM}
                    decimal
                    onChangeText={(v) =>
                      setAddingHouse((prev) => (prev ? { ...prev, totalFanCFM: v } : prev))
                    }
                  />
                  <NativeNumInput
                    label="Number of fans"
                    value={addingHouse.numberOfFans}
                    onChangeText={(v) =>
                      setAddingHouse((prev) => (prev ? { ...prev, numberOfFans: v } : prev))
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
            onPress={closeFarmEditor}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: 20,
                paddingBottom: Platform.OS === "ios" ? 28 : 20,
                maxHeight: "90%",
              }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                  Edit farm info
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
                    <Text style={[styles.label, { marginTop: 8 }]}>Grower name</Text>
                    <TextInput
                      style={styles.input}
                      value={editingFarm.growerName}
                      onChangeText={(v) =>
                        setEditingFarm((prev) => (prev ? { ...prev, growerName: v } : prev))
                      }
                      autoCapitalize="words"
                    />
                    <Text style={[styles.label, { marginTop: 8 }]}>Phone</Text>
                    <TextInput
                      style={styles.input}
                      value={editingFarm.phoneNumber}
                      onChangeText={(v) =>
                        setEditingFarm((prev) => (prev ? { ...prev, phoneNumber: v } : prev))
                      }
                      keyboardType="phone-pad"
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                    <Text style={[styles.label, { marginTop: 8 }]}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={editingFarm.email}
                      onChangeText={(v) =>
                        setEditingFarm((prev) => (prev ? { ...prev, email: v } : prev))
                      }
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
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
                    />
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                      <PrimaryButton
                        label={farmSaving ? "Saving…" : "Save farm changes"}
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
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
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
                    onPress={() => {
                      setGeneratorSaving(true);
                      setGeneratorError(null);
                      try {
                        const parseHours = (raw: string) => {
                          const trimmed = raw.trim();
                          if (trimmed === "") return null;
                          const n = Number(trimmed);
                          if (!Number.isFinite(n) || n < 0) {
                            throw new Error("Generator hours must be 0 or greater");
                          }
                          return n;
                        };
                        const payload = {
                          logDate: generatorDraft.logDate.trim(),
                          gen1Hours: parseHours(generatorDraft.gen1Hours),
                          gen2Hours: parseHours(generatorDraft.gen2Hours),
                          gen3Hours: parseHours(generatorDraft.gen3Hours),
                          gen4Hours: parseHours(generatorDraft.gen4Hours),
                        };
                        if (generatorEditingId) {
                          updateGeneratorLog(farm.id, generatorEditingId, {
                            ...payload,
                            onlyGen: generatorEditingGen ?? undefined,
                          });
                        } else {
                          createGeneratorLog({
                            farmId: farm.id,
                            ...payload,
                          });
                        }
                        setGeneratorModalOpen(false);
                        setGeneratorEditingId(null);
                        setGeneratorEditingGen(null);
                        load();
                      } catch (e) {
                        setGeneratorError(
                          e instanceof Error ? e.message : "Could not save generator log",
                        );
                      } finally {
                        setGeneratorSaving(false);
                      }
                    }}
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
    </SafeAreaView>
  );
}
