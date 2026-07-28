import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as ScrollViewType,
  type View as ViewType,
} from "react-native";
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
  reactivateFlock,
  updateFarm,
  updateFlockGrowthRate,
  updateFlockNumber,
  updateGeneratorLog,
  updateHouse,
} from "../../../../src/repos/data";
import { setFarmNavContext } from "../../../../src/lib/farmNavContext";
import { useTabScrollToTop } from "../../../../src/lib/tabScroll";
import { VISIT_TYPE_LABELS } from "../../../../src/lib/visits";
import {
  ISSUE_CATEGORY_LABELS,
  LITTER_EVENT_LABELS,
} from "../../../../src/lib/opsLabels";
import {
  formatGeneratorChartsCopy,
  formatGeneratorHours,
  generatorDeltas,
  type GeneratorHours,
} from "../../../../src/lib/generator";
import {
  catchWeightProjections,
  resolveGrowthRate,
} from "../../../../src/lib/weight/projections";
import { scrollFieldAboveKeypad } from "../../../../src/lib/scrollField";
import { addDaysKey, todayKey } from "../../../../src/lib/ids";
import { colors, styles } from "../../../../src/theme";
import {
  Card,
  Metric,
  PrimaryButton,
  SectionTitle,
  StatusBadge,
  WeeklyMortalityList,
  formatNumber,
  formatPct,
} from "../../../../src/components/ui";
import { WeightProjectionTile } from "../../../../src/components/WeightProjectionTile";
import { DatePickerField } from "../../../../src/components/DatePickerField";
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
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      <Pressable
        accessibilityLabel={editLabel}
        onPress={onEdit}
        hitSlop={8}
        style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="pencil-outline" size={20} color={colors.muted} />
      </Pressable>
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
  placementDate: string;
  catchDate: string;
  flockNumber: string;
  applyToRemaining: boolean;
};

type AddHouseDraft = {
  houseNumber: string;
  squareFootage: string;
  totalFanCFM: string;
  numberOfFans: string;
};

type HouseNumField =
  | "houseNumber"
  | "squareFootage"
  | "totalFanCFM"
  | "numberOfFans"
  | "placedBirdCount";

type GeneratorNumField = "gen1Hours" | "gen2Hours" | "gen3Hours" | "gen4Hours";

function generatorFieldLabel(field: GeneratorNumField): string {
  switch (field) {
    case "gen1Hours":
      return "Gen 1 hours";
    case "gen2Hours":
      return "Gen 2 hours";
    case "gen3Hours":
      return "Gen 3 hours";
    case "gen4Hours":
      return "Gen 4 hours";
  }
}

type FarmEditDraft = {
  farmName: string;
  growerName: string;
  phoneNumber: string;
  email: string;
  notes: string;
};

function houseFieldLabel(field: HouseNumField): string {
  switch (field) {
    case "houseNumber":
      return "House number";
    case "placedBirdCount":
      return "Birds placed";
    case "squareFootage":
      return "Square footage";
    case "totalFanCFM":
      return "Total fan CFM";
    case "numberOfFans":
      return "Number of fans";
    default:
      return field;
  }
}

function HouseNumFieldButton({
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
  fieldRef?: (node: ViewType | null) => void;
}) {
  return (
    <View ref={fieldRef} collapsable={false} style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={[
          styles.input,
          {
            justifyContent: "center",
            backgroundColor: active ? "#ecfdf5" : "#fff",
          },
          active ? { borderColor: colors.accentDark, borderWidth: 2 } : null,
        ]}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: value ? colors.text : colors.muted,
            letterSpacing: 0.2,
          }}
          numberOfLines={1}
        >
          {value || "0"}
        </Text>
      </Pressable>
    </View>
  );
}

const GENERATOR_CHARTS = [
  { label: "Gen 1", hourKey: "gen1Hours" as const, deltaKey: "gen1" as const },
  { label: "Gen 2", hourKey: "gen2Hours" as const, deltaKey: "gen2" as const },
  { label: "Gen 3", hourKey: "gen3Hours" as const, deltaKey: "gen3" as const },
  { label: "Gen 4", hourKey: "gen4Hours" as const, deltaKey: "gen4" as const },
];

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
        <Text style={{ width: 64, fontSize: 11, fontWeight: "600", color: colors.muted, lineHeight: 14 }}>
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
                  width: 64,
                  fontSize: 12,
                  lineHeight: 16,
                  fontWeight: "600",
                  color: colors.text,
                  fontVariant: ["tabular-nums"],
                }}
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
  }>();
  const farmId = paramId(params.id);
  const openEdit = paramId(params.edit) === "1";
  const router = useRouter();
  const [data, setData] = useState<FarmDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingHouse, setEditingHouse] = useState<HouseEditDraft | null>(null);
  const [houseEditError, setHouseEditError] = useState<string | null>(null);
  const [houseSaving, setHouseSaving] = useState(false);
  const [addingHouse, setAddingHouse] = useState<AddHouseDraft | null>(null);
  const [addHouseError, setAddHouseError] = useState<string | null>(null);
  const [addHouseSaving, setAddHouseSaving] = useState(false);
  const [houseActiveField, setHouseActiveField] = useState<HouseNumField | null>(null);
  const [houseReplaceOnType, setHouseReplaceOnType] = useState(false);
  const houseScrollRef = useRef<ScrollViewType>(null);
  const houseScrollYRef = useRef(0);
  const houseFieldRefs = useRef(new Map<HouseNumField, ViewType>());
  const [expandedHouses, setExpandedHouses] = useState<Set<string>>(new Set());
  const [editingFarm, setEditingFarm] = useState<FarmEditDraft | null>(null);
  const [farmEditError, setFarmEditError] = useState<string | null>(null);
  const [farmSaving, setFarmSaving] = useState(false);
  const [editingFlockNumber, setEditingFlockNumber] = useState<string | null>(null);
  const [flockNumberDraft, setFlockNumberDraft] = useState("");
  const [flockNumberError, setFlockNumberError] = useState<string | null>(null);
  const [flockNumberSaving, setFlockNumberSaving] = useState(false);
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [generatorSaving, setGeneratorSaving] = useState(false);
  const [generatorError, setGeneratorError] = useState<string | null>(null);
  const [generatorEditingId, setGeneratorEditingId] = useState<string | null>(null);
  const [generatorDraft, setGeneratorDraft] = useState({
    logDate: todayKey(),
    gen1Hours: "",
    gen2Hours: "",
    gen3Hours: "",
    gen4Hours: "",
  });
  const [generatorActiveField, setGeneratorActiveField] = useState<GeneratorNumField | null>(null);
  const [generatorReplaceOnType, setGeneratorReplaceOnType] = useState(false);
  const generatorScrollRef = useRef<ScrollViewType>(null);
  const generatorScrollYRef = useRef(0);
  const generatorFieldRefs = useRef(new Map<GeneratorNumField, ViewType>());
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

  useFocusEffect(
    useCallback(() => {
      load();
      if (farmId) setFarmNavContext({ farmId, houseFlockId: null });
    }, [load, farmId]),
  );

  function openFarmEditor(farm: FarmDetail["farm"]) {
    setFarmEditError(null);
    setEditingFarm({
      farmName: farm.farmName,
      growerName: farm.growerName ?? "",
      phoneNumber: farm.phoneNumber ?? "",
      email: farm.email ?? "",
      notes: farm.notes ?? "",
    });
  }

  // Open settings editor when navigated with ?edit=1 (from farms list gear)
  useEffect(() => {
    if (!openEdit || !data || data.farm.id !== farmId || editingFarm) return;
    openFarmEditor(data.farm);
  }, [openEdit, data, farmId, editingFarm]);

  // Keep the active field visible after the keypad mounts (layout shift)
  // Must stay above any early returns (Rules of Hooks).
  useEffect(() => {
    if (!houseActiveField) return;
    const t = setTimeout(() => {
      const node = houseFieldRefs.current.get(houseActiveField) ?? null;
      scrollFieldAboveKeypad(houseScrollRef, { current: node }, houseScrollYRef);
    }, 100);
    return () => clearTimeout(t);
  }, [houseActiveField]);

  useEffect(() => {
    if (!generatorActiveField) return;
    const t = setTimeout(() => {
      const node = generatorFieldRefs.current.get(generatorActiveField) ?? null;
      scrollFieldAboveKeypad(generatorScrollRef, { current: node }, generatorScrollYRef);
    }, 100);
    return () => clearTimeout(t);
  }, [generatorActiveField]);

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
            style={{ marginBottom: 12 }}
          >
            <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Farms</Text>
          </Pressable>
          <Text style={{ color: colors.danger }}>{error ?? "Farm not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { farm } = data;
  const activeFlocks = data.activeFlocks ?? [];
  const flockAge = data.activeFlock?.flockAgeDays ?? null;
  const flockAges = (() => {
    if (activeFlocks.length > 0) {
      return Array.from(new Set(activeFlocks.map((f) => f.flockAgeDays))).sort(
        (a, b) => a - b,
      );
    }
    if (data.activeFlock?.flockAgesDays?.length) return data.activeFlock.flockAgesDays;
    return flockAge != null ? [flockAge] : [];
  })();
  const flockAgeLabel =
    flockAges.length > 0 ? flockAges.map((a) => `(${a}d)`).join(" ") : "—";
  const flockIdLabel = activeFlocks.map((f) => f.flockNumber).filter(Boolean).join(" · ");
  const flockPlacementDates =
    data.activeFlock?.placementDates?.length
      ? data.activeFlock.placementDates
      : data.activeFlock?.placementDate
        ? [data.activeFlock.placementDate]
        : [];
  const birdsPlaced = data.houses.reduce((sum, h) => sum + (h.placedBirdCount ?? 0), 0);
  const cumMort = data.houses.reduce((sum, h) => sum + (h.cumulativeMortality ?? 0), 0);
  const phc = data.houses.reduce((sum, h) => sum + (h.projectedHeadCount ?? 0), 0);
  const projectedMort = data.houses.reduce(
    (sum, h) => sum + (h.projectedMortality ?? 0),
    0,
  );
  const flockCatchDates =
    data.activeFlock?.catchDates?.length
      ? data.activeFlock.catchDates
      : data.activeFlock?.projectedCatchDate || data.activeFlock?.resolvedCatchDate
        ? [
            data.activeFlock.projectedCatchDate ??
              data.activeFlock.resolvedCatchDate!,
          ]
        : [];
  const catchLabel =
    flockCatchDates[0] ??
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

  const flockWeeklyMortality = (() => {
    const totals = new Map<number, number>();
    for (const h of data.houses) {
      for (const w of h.weeklyMortality) {
        totals.set(w.week, (totals.get(w.week) ?? 0) + w.total);
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, total]) => ({ week, total }));
  })();

  const placementCatchLines = (() => {
    const seen = new Set<string>();
    const lines: Array<{ placement: string; catchDate: string | null }> = [];
    for (const h of data.houses) {
      if (h.placedBirdCount == null || !h.placementDate) continue;
      const key = `${h.placementDate}|${h.catchDate ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push({ placement: h.placementDate, catchDate: h.catchDate });
    }
    if (lines.length === 0 && flockPlacementDates.length > 0) {
      return flockPlacementDates.map((placement) => ({
        placement,
        catchDate: catchLabel,
      }));
    }
    return lines.sort((a, b) => {
      const c = (a.catchDate ?? "").localeCompare(b.catchDate ?? "");
      if (c !== 0) return c;
      return a.placement.localeCompare(b.placement);
    });
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

  function promptEditFlockNumber() {
    if (activeFlocks.length === 0) return;
    if (activeFlocks.length === 1) {
      setFlockNumberError(null);
      setFlockNumberDraft(activeFlocks[0]!.flockNumber);
      setEditingFlockNumber(activeFlocks[0]!.id);
      return;
    }
    Alert.alert("Edit flock ID", "Which flock ID do you want to edit?", [
      ...activeFlocks.map((fl) => ({
        text: `${fl.flockNumber} (${fl.flockAgeDays}d)`,
        onPress: () => {
          setFlockNumberError(null);
          setFlockNumberDraft(fl.flockNumber);
          setEditingFlockNumber(fl.id);
        },
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
    setHouseActiveField(null);
    setHouseReplaceOnType(false);
    const placementDate = h.placementDate ?? data?.activeFlock?.placementDate ?? "";
    const catchDate =
      h.catchDate ??
      (placementDate ? addDaysKey(placementDate, 52) : "");
    setEditingHouse({
      id: h.id,
      houseNumber: String(h.houseNumber),
      squareFootage: String(h.squareFootage ?? ""),
      totalFanCFM: h.totalFanCFM != null ? String(h.totalFanCFM) : "",
      numberOfFans: h.numberOfFans != null ? String(h.numberOfFans) : "",
      placedBirdCount: h.placedBirdCount != null ? String(h.placedBirdCount) : "",
      placementDate,
      catchDate,
      flockNumber: h.flockNumber ?? "",
      applyToRemaining: false,
    });
  }

  function closeHouseEditor() {
    if (houseSaving) return;
    setEditingHouse(null);
    setHouseEditError(null);
    setHouseActiveField(null);
    setHouseReplaceOnType(false);
  }

  function focusHouseField(field: HouseNumField) {
    setHouseActiveField(field);
    setHouseReplaceOnType(true);
    setTimeout(() => {
      const node = houseFieldRefs.current.get(field) ?? null;
      scrollFieldAboveKeypad(houseScrollRef, { current: node }, houseScrollYRef);
    }, 50);
  }

  function bindHouseFieldRef(field: HouseNumField) {
    return (node: ViewType | null) => {
      if (node) houseFieldRefs.current.set(field, node);
      else houseFieldRefs.current.delete(field);
    };
  }

  function getHouseFieldValue(field: HouseNumField) {
    if (!editingHouse) return "";
    return editingHouse[field];
  }

  function setHouseFieldValue(field: HouseNumField, value: string) {
    setEditingHouse((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function onHouseDigit(d: string) {
    if (!houseActiveField) return;
    const allowDecimal =
      houseActiveField === "squareFootage" || houseActiveField === "totalFanCFM";
    const current = getHouseFieldValue(houseActiveField);
    const base = houseReplaceOnType && d !== "." ? "" : current;
    setHouseReplaceOnType(false);
    setHouseFieldValue(houseActiveField, appendKeypadDigit(base, d, allowDecimal));
  }

  function onHouseBackspace() {
    if (!houseActiveField) return;
    setHouseReplaceOnType(false);
    setHouseFieldValue(houseActiveField, backspaceKeypadValue(getHouseFieldValue(houseActiveField)));
  }

  function onHouseEnter() {
    setHouseActiveField(null);
    setHouseReplaceOnType(false);
  }

  function closeGeneratorModal() {
    if (generatorSaving) return;
    setGeneratorModalOpen(false);
    setGeneratorError(null);
    setGeneratorEditingId(null);
    setGeneratorActiveField(null);
    setGeneratorReplaceOnType(false);
  }

  function openGeneratorEditor(log?: {
    id: string;
    logDate: string;
    gen1Hours: number;
    gen2Hours: number;
    gen3Hours: number;
    gen4Hours: number;
  }) {
    setGeneratorError(null);
    setGeneratorActiveField(null);
    setGeneratorReplaceOnType(false);
    if (log) {
      setGeneratorEditingId(log.id);
      setGeneratorDraft({
        logDate: log.logDate,
        gen1Hours: String(log.gen1Hours),
        gen2Hours: String(log.gen2Hours),
        gen3Hours: String(log.gen3Hours),
        gen4Hours: String(log.gen4Hours),
      });
    } else {
      const latest = data?.generatorLogs?.[0];
      setGeneratorEditingId(null);
      setGeneratorDraft({
        logDate: todayKey(),
        gen1Hours: latest ? String(latest.gen1Hours) : "",
        gen2Hours: latest ? String(latest.gen2Hours) : "",
        gen3Hours: latest ? String(latest.gen3Hours) : "",
        gen4Hours: latest ? String(latest.gen4Hours) : "",
      });
    }
    setGeneratorModalOpen(true);
  }

  function focusGeneratorField(field: GeneratorNumField) {
    setGeneratorActiveField(field);
    setGeneratorReplaceOnType(true);
    setTimeout(() => {
      const node = generatorFieldRefs.current.get(field) ?? null;
      scrollFieldAboveKeypad(generatorScrollRef, { current: node }, generatorScrollYRef);
    }, 50);
  }

  function bindGeneratorFieldRef(field: GeneratorNumField) {
    return (node: ViewType | null) => {
      if (node) generatorFieldRefs.current.set(field, node);
      else generatorFieldRefs.current.delete(field);
    };
  }

  function getGeneratorFieldValue(field: GeneratorNumField) {
    return generatorDraft[field];
  }

  function setGeneratorFieldValue(field: GeneratorNumField, value: string) {
    setGeneratorDraft((prev) => ({ ...prev, [field]: value }));
  }

  function onGeneratorDigit(d: string) {
    if (!generatorActiveField) return;
    const current = getGeneratorFieldValue(generatorActiveField);
    const base = generatorReplaceOnType && d !== "." ? "" : current;
    setGeneratorReplaceOnType(false);
    setGeneratorFieldValue(generatorActiveField, appendKeypadDigit(base, d, true));
  }

  function onGeneratorBackspace() {
    if (!generatorActiveField) return;
    setGeneratorReplaceOnType(false);
    setGeneratorFieldValue(
      generatorActiveField,
      backspaceKeypadValue(getGeneratorFieldValue(generatorActiveField)),
    );
  }

  function onGeneratorEnter() {
    if (!generatorActiveField) return;
    const order: GeneratorNumField[] = ["gen1Hours", "gen2Hours", "gen3Hours", "gen4Hours"];
    const idx = order.indexOf(generatorActiveField);
    const next = idx >= 0 ? order[idx + 1] : undefined;
    if (next) focusGeneratorField(next);
    else {
      setGeneratorActiveField(null);
      setGeneratorReplaceOnType(false);
    }
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
      updateHouse(farm.id, editingHouse.id, {
        houseNumber: Number(editingHouse.houseNumber),
        squareFootage: sq,
        totalFanCFM: cfm,
        numberOfFans: fans,
        ...(data?.activeFlock
          ? {
              placedBirdCount: placed,
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
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/farms");
          }}
          style={{ marginBottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back to farms"
        >
          <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Farms</Text>
        </Pressable>

        <View style={{ marginBottom: 16 }}>
          <Text style={styles.title}>{farm.farmName}</Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            {farm.growerName ? (
              <Text style={styles.subtitle}>{farm.growerName}</Text>
            ) : null}
            {farm.phoneNumber ? (
              <Pressable onPress={() => Linking.openURL(`tel:${farm.phoneNumber}`)}>
                <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: 15 }}>
                  {farm.phoneNumber}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel="Edit farm info"
              onPress={() => openFarmEditor(farm)}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="settings-outline" size={20} color={colors.muted} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
            <PrimaryButton
              label="Mortality"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/mortality",
                  params: { farmId: farm.id },
                })
              }
              style={{ flexGrow: 1, minWidth: "45%" }}
            />
            <PrimaryButton
              label="LFO"
              secondary
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/lfo",
                  params: { farmId: farm.id },
                })
              }
              style={{ flexGrow: 1, minWidth: "45%" }}
            />
            <PrimaryButton
              label="Add flock"
              secondary
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/farms/[id]/add-flock",
                  params: { id: farm.id },
                })
              }
              style={{ flexGrow: 1, minWidth: "45%" }}
            />
            {activeFlocks.length > 0 ? (
              <PrimaryButton
                label="Complete flock"
                secondary
                onPress={promptCompleteFlock}
                style={{ flexGrow: 1, minWidth: "45%" }}
              />
            ) : null}
          </View>
        </View>

        {activeFlocks.length > 0 ? (
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: "800", fontSize: 16 }}>
                  {activeFlocks.length > 1 ? "Active flocks" : "Active flock"}{" "}
                  {flockAgeLabel}
                </Text>
                {flockIdLabel ? (
                  <Text style={[styles.muted, { marginTop: 2, fontWeight: "400" }]}>
                    {flockIdLabel}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityLabel="Edit flock ID"
                onPress={promptEditFlockNumber}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="pencil-outline" size={20} color={colors.muted} />
              </Pressable>
            </View>

            <View style={[styles.row, { marginTop: 12 }]}>
              <Metric label="Birds placed" value={formatNumber(birdsPlaced)} />
              <Metric label="Proj. Head Count" value={formatNumber(phc || null)} />
              <Metric
                label="Cumulative Mortality"
                value={
                  birdsPlaced > 0
                    ? `${formatNumber(cumMort)} (${formatPct((cumMort / birdsPlaced) * 100)})`
                    : formatNumber(cumMort)
                }
              />
              <Metric
                label="Projected Mortality"
                value={
                  birdsPlaced > 0 && projectedMort > 0
                    ? `${formatNumber(projectedMort)} (${formatPct(
                        (projectedMort / birdsPlaced) * 100,
                      )})`
                    : formatNumber(projectedMort || null)
                }
              />
            </View>
            <View style={{ marginTop: 4, gap: 2 }}>
              {placementCatchLines.map((line) => (
                <Text
                  key={`${line.placement}|${line.catchDate ?? ""}`}
                  style={styles.muted}
                >
                  Placed {formatUsDate(line.placement)}
                  {line.catchDate ? ` · Catch ${formatUsDate(line.catchDate)}` : ""}
                </Text>
              ))}
            </View>
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
            ) : null}
            {flockWeeklyMortality.length > 0 ? (
              <View
                style={{
                  marginTop: 14,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: 14,
                }}
              >
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
                <WeeklyMortalityList weeks={flockWeeklyMortality} />
              </View>
            ) : null}
          </Card>
        ) : (
          <Card>
            <Text style={{ fontWeight: "800" }}>No active flock</Text>
            <Text style={[styles.muted, { marginTop: 4, marginBottom: 12 }]}>
              {data.latestCompletedFlock
                ? `Flock ${data.latestCompletedFlock.flockNumber} was completed. Make it active again, or add a new flock.`
                : "Add a flock to track mortality for this farm."}
            </Text>
            <View style={{ gap: 10 }}>
              {data.latestCompletedFlock ? (
                <PrimaryButton
                  label={`Make flock ${data.latestCompletedFlock.flockNumber} active`}
                  secondary
                  onPress={() => {
                    Alert.alert(
                      "Make flock active?",
                      `Make flock ${data.latestCompletedFlock!.flockNumber} active again?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Make active",
                          onPress: () => {
                            try {
                              reactivateFlock(data.latestCompletedFlock!.id);
                              load();
                            } catch (e) {
                              Alert.alert(
                                "Error",
                                e instanceof Error ? e.message : "Could not reactivate flock",
                              );
                            }
                          },
                        },
                      ],
                    );
                  }}
                />
              ) : null}
              <PrimaryButton
                label="Add flock"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/farms/[id]/add-flock",
                    params: { id: farm.id },
                  })
                }
              />
            </View>
          </Card>
        )}

        <Card>
          <Text style={{ fontWeight: "800", fontSize: 14, marginBottom: 8 }}>Quick links</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(
              [
                { key: "visits", label: "Visits", onPress: () => scrollToSection("visits") },
                {
                  key: "generators",
                  label: "Generator Log",
                  onPress: () => scrollToSection("generators"),
                },
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
              ] as const
            ).map((link) => (
              <Pressable
                key={link.key}
                onPress={link.onPress}
                style={{
                  width: "47%",
                  flexGrow: 1,
                  minHeight: 44,
                  borderRadius: 10,
                  backgroundColor: colors.accentDark,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 8,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{link.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <SectionTitle>{farm.farmName}</SectionTitle>
        {data.houses.map((h) => {
          const detailsOpen = expandedHouses.has(h.id);
          function openMortalityForHouse() {
            if (!h.houseFlockId) return;
            setFarmNavContext({ farmId: farm.id, houseFlockId: h.houseFlockId });
            router.push({
              pathname: "/(tabs)/mortality",
              params: { farmId: farm.id, houseFlockId: h.houseFlockId },
            });
          }
          return (
            <Card key={`${farm.id}-${h.id}`}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Pressable
                  style={{ flex: 1, minWidth: 0 }}
                  onPress={openMortalityForHouse}
                  accessibilityLabel={`Open mortality for house ${h.houseNumber}`}
                >
                  <Text style={{ fontSize: 17, fontWeight: "800" }}>
                    House {h.houseNumber}
                    {h.flockNumber ? (
                      <Text style={{ fontWeight: "600", color: colors.muted }}>
                        {" "}
                        · {h.flockNumber}
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
                <StatusBadge status={h.status} />
                <Pressable
                  accessibilityLabel={`Edit house ${h.houseNumber}`}
                  onPress={() => openHouseEditor(h)}
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
                  accessibilityLabel={`Delete house ${h.houseNumber}`}
                  onPress={() => confirmDeleteHouse(h)}
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

              {h.weeklyMortality.length > 0 ? (
                <Pressable
                  onPress={openMortalityForHouse}
                  accessibilityLabel={`Weekly mortality for house ${h.houseNumber}`}
                  style={{ marginTop: 12 }}
                >
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
                </Pressable>
              ) : (
                <Pressable onPress={openMortalityForHouse} style={{ marginTop: 12 }}>
                  <Text style={styles.muted}>No weekly mortality yet.</Text>
                </Pressable>
              )}

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
                  marginTop: 12,
                  paddingTop: 12,
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
                <View style={[styles.row, { marginTop: 10 }]}>
                  <Metric label="Placed" value={formatNumber(h.placedBirdCount)} />
                  <Metric label="Remaining" value={formatNumber(h.remainingBirdCount)} />
                  <Metric
                    label="PHC"
                    value={formatNumber(h.projectedHeadCount)}
                    hint="Assumes 150 for catch crew"
                  />
                  <Metric
                    label="M"
                    value={
                      h.placedBirdCount != null
                        ? `${formatNumber(h.cumulativeMortality)} (${formatPct(h.cumulativeMortalityPct)})`
                        : formatNumber(h.cumulativeMortality)
                    }
                  />
                  <Metric
                    label="Projected mortality"
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
                  <Metric label="Recommended Min Vent" value={h.recommendedMinVent ?? "—"} />
                </View>
              ) : null}
            </Card>
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
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
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
                  </View>
                  <RowActions
                    editLabel="Edit visit"
                    deleteLabel="Delete visit"
                    onEdit={() =>
                      router.push({
                        pathname: "/(tabs)/farms/[id]/visits/[visitId]",
                        params: { id: farm.id, visitId: v.id },
                      })
                    }
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
              {(data.generatorLogs ?? []).length > 0 ? (
                <Pressable
                  onPress={async () => {
                    const allLogs = data.generatorLogs ?? [];
                    const logs = allLogs.slice(0, MAX_GENERATOR_LOGS_DISPLAY);
                    const text = formatGeneratorChartsCopy(
                      logs.map((log, index) => {
                        const previous = allLogs[index + 1] ?? null;
                        const hours: GeneratorHours = {
                          gen1Hours: log.gen1Hours,
                          gen2Hours: log.gen2Hours,
                          gen3Hours: log.gen3Hours,
                          gen4Hours: log.gen4Hours,
                        };
                        const prevHours = previous
                          ? {
                              gen1Hours: previous.gen1Hours,
                              gen2Hours: previous.gen2Hours,
                              gen3Hours: previous.gen3Hours,
                              gen4Hours: previous.gen4Hours,
                            }
                          : null;
                        const [y, m, d] = log.logDate.split("-").map(Number);
                        return {
                          dateLabel: `${m}-${d}-${y}`,
                          hours,
                          deltas: generatorDeltas(hours, prevHours),
                        };
                      }),
                    );
                    try {
                      const Clipboard = await import("expo-clipboard");
                      await Clipboard.setStringAsync(text);
                      Alert.alert("Copied", "Generator log copied to clipboard.");
                    } catch {
                      Alert.alert("Copy failed", "Could not copy on this device.");
                    }
                  }}
                  hitSlop={8}
                  accessibilityLabel="Copy generator log"
                >
                  <Ionicons name="copy-outline" size={20} color={colors.accentDark} />
                </Pressable>
              ) : null}
            </View>
            {(data.generatorLogs ?? []).length === 0 ? (
              <Text style={[styles.muted, { marginTop: 10 }]}>None yet</Text>
            ) : (
              <>
                {GENERATOR_CHARTS.map((gen) => {
                  const allLogs = data.generatorLogs ?? [];
                  const logs = allLogs.slice(0, MAX_GENERATOR_LOGS_DISPLAY);
                  const rows: GeneratorChartRow[] = logs.map((log, index) => {
                    const previous = allLogs[index + 1] ?? null;
                    const hours: GeneratorHours = {
                      gen1Hours: log.gen1Hours,
                      gen2Hours: log.gen2Hours,
                      gen3Hours: log.gen3Hours,
                      gen4Hours: log.gen4Hours,
                    };
                    const prevHours = previous
                      ? {
                          gen1Hours: previous.gen1Hours,
                          gen2Hours: previous.gen2Hours,
                          gen3Hours: previous.gen3Hours,
                          gen4Hours: previous.gen4Hours,
                        }
                      : null;
                    const deltas = generatorDeltas(hours, prevHours);
                    const [y, m, d] = log.logDate.split("-").map(Number);
                    return {
                      id: log.id,
                      dateLabel: `${m}-${d}-${y}`,
                      hours: log[gen.hourKey],
                      exercised: deltas[gen.deltaKey],
                    };
                  });
                  return (
                    <GeneratorHoursChart
                      key={gen.label}
                      title={gen.label}
                      rows={rows}
                      onEdit={(id) => {
                        const log = allLogs.find((l) => l.id === id);
                        if (log) openGeneratorEditor(log);
                      }}
                      onDelete={(id) =>
                        Alert.alert("Delete generator log?", "This cannot be undone.", [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => {
                              deleteGeneratorLog(farm.id, id);
                              load();
                            },
                          },
                        ])
                      }
                    />
                  );
                })}
              </>
            )}
          </Card>
          <RecordLink
            label="Log generators"
            onPress={() => openGeneratorEditor()}
          />
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
        visible={editingHouse != null}
        animationType="slide"
        transparent
        onRequestClose={closeHouseEditor}
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
              ref={houseScrollRef}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: houseActiveField ? 280 : undefined }}
              contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
              onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                houseScrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
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
                  <HouseNumFieldButton
                    label="House number"
                    value={editingHouse.houseNumber}
                    active={houseActiveField === "houseNumber"}
                    onPress={() => focusHouseField("houseNumber")}
                    fieldRef={bindHouseFieldRef("houseNumber")}
                  />
                  {data.activeFlock ? (
                    <>
                      <HouseNumFieldButton
                        label="Birds placed"
                        value={editingHouse.placedBirdCount}
                        active={houseActiveField === "placedBirdCount"}
                        onPress={() => focusHouseField("placedBirdCount")}
                        fieldRef={bindHouseFieldRef("placedBirdCount")}
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
                      <Text style={[styles.label, { marginTop: 2 }]}>Flock ID</Text>
                      <TextInput
                        style={[styles.input, { fontSize: 20, fontWeight: "700", color: colors.text }]}
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
                  <HouseNumFieldButton
                    label="Square footage"
                    value={editingHouse.squareFootage}
                    active={houseActiveField === "squareFootage"}
                    onPress={() => focusHouseField("squareFootage")}
                    fieldRef={bindHouseFieldRef("squareFootage")}
                  />
                  <HouseNumFieldButton
                    label="Total fan CFM"
                    value={editingHouse.totalFanCFM}
                    active={houseActiveField === "totalFanCFM"}
                    onPress={() => focusHouseField("totalFanCFM")}
                    fieldRef={bindHouseFieldRef("totalFanCFM")}
                  />
                  <HouseNumFieldButton
                    label="Number of fans"
                    value={editingHouse.numberOfFans}
                    active={houseActiveField === "numberOfFans"}
                    onPress={() => focusHouseField("numberOfFans")}
                    fieldRef={bindHouseFieldRef("numberOfFans")}
                  />
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
            {houseActiveField ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  backgroundColor: "#fafaf9",
                }}
              >
                <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted }}>
                    {houseFieldLabel(houseActiveField)}
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontSize: 32,
                      fontWeight: "800",
                      color: colors.text,
                      letterSpacing: 0.3,
                    }}
                    numberOfLines={1}
                  >
                    {getHouseFieldValue(houseActiveField) || "0"}
                  </Text>
                </View>
                <NumberKeypad
                  allowDecimal={
                    houseActiveField === "squareFootage" || houseActiveField === "totalFanCFM"
                  }
                  onDigit={onHouseDigit}
                  onBackspace={onHouseBackspace}
                  onEnter={onHouseEnter}
                />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={editingFlockNumber != null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!flockNumberSaving) setEditingFlockNumber(null);
        }}
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
            onPress={() => {
              if (!flockNumberSaving) setEditingFlockNumber(null);
            }}
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
                Edit flock ID
              </Text>
              {flockNumberError ? (
                <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "700" }}>
                  {flockNumberError}
                </Text>
              ) : null}
              <Text style={[styles.label, { marginTop: 14 }]}>Flock number</Text>
              <TextInput
                style={styles.input}
                value={flockNumberDraft}
                onChangeText={setFlockNumberDraft}
                autoCapitalize="characters"
                autoFocus
                autoCorrect={false}
                returnKeyType="done"
                placeholder="e.g. 26-07"
                placeholderTextColor={colors.muted}
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <PrimaryButton
                  label={flockNumberSaving ? "Saving…" : "Save"}
                  onPress={() => {
                    if (!editingFlockNumber) return;
                    setFlockNumberSaving(true);
                    setFlockNumberError(null);
                    try {
                      updateFlockNumber(editingFlockNumber, flockNumberDraft);
                      setEditingFlockNumber(null);
                      load();
                    } catch (e) {
                      setFlockNumberError(
                        e instanceof Error ? e.message : "Could not save flock number",
                      );
                    } finally {
                      setFlockNumberSaving(false);
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  label="Cancel"
                  secondary
                  onPress={() => {
                    if (!flockNumberSaving) setEditingFlockNumber(null);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </Pressable>
          </Pressable>
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
                <View style={{ marginTop: 14, gap: 4 }}>
                  <Text style={styles.label}>House number *</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 22, fontWeight: "700", color: colors.text }]}
                    value={addingHouse.houseNumber}
                    onChangeText={(v) =>
                      setAddingHouse((prev) => (prev ? { ...prev, houseNumber: v } : prev))
                    }
                    keyboardType="number-pad"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>Square footage *</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 22, fontWeight: "700", color: colors.text }]}
                    value={addingHouse.squareFootage}
                    onChangeText={(v) =>
                      setAddingHouse((prev) => (prev ? { ...prev, squareFootage: v } : prev))
                    }
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>Total fan CFM</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 22, fontWeight: "700", color: colors.text }]}
                    value={addingHouse.totalFanCFM}
                    onChangeText={(v) =>
                      setAddingHouse((prev) => (prev ? { ...prev, totalFanCFM: v } : prev))
                    }
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>Number of fans</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 22, fontWeight: "700", color: colors.text }]}
                    value={addingHouse.numberOfFans}
                    onChangeText={(v) =>
                      setAddingHouse((prev) => (prev ? { ...prev, numberOfFans: v } : prev))
                    }
                    keyboardType="number-pad"
                    placeholderTextColor={colors.muted}
                  />
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
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
              ref={generatorScrollRef}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: generatorActiveField ? 280 : undefined }}
              contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
              onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                generatorScrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                {generatorEditingId ? "Edit generators" : "Log generators"}
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
              {(
                [
                  ["gen1Hours", "Gen 1 hours"],
                  ["gen2Hours", "Gen 2 hours"],
                  ["gen3Hours", "Gen 3 hours"],
                  ["gen4Hours", "Gen 4 hours"],
                ] as const
              ).map(([key, label]) => (
                <HouseNumFieldButton
                  key={key}
                  label={label}
                  value={generatorDraft[key]}
                  active={generatorActiveField === key}
                  onPress={() => focusGeneratorField(key)}
                  fieldRef={bindGeneratorFieldRef(key)}
                />
              ))}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <PrimaryButton
                  label={generatorSaving ? "Saving…" : "Save"}
                  onPress={() => {
                    setGeneratorSaving(true);
                    setGeneratorError(null);
                    try {
                      const payload = {
                        logDate: generatorDraft.logDate.trim(),
                        gen1Hours: Number(generatorDraft.gen1Hours || 0),
                        gen2Hours: Number(generatorDraft.gen2Hours || 0),
                        gen3Hours: Number(generatorDraft.gen3Hours || 0),
                        gen4Hours: Number(generatorDraft.gen4Hours || 0),
                      };
                      if (generatorEditingId) {
                        updateGeneratorLog(farm.id, generatorEditingId, payload);
                      } else {
                        createGeneratorLog({
                          farmId: farm.id,
                          ...payload,
                        });
                      }
                      setGeneratorModalOpen(false);
                      setGeneratorEditingId(null);
                      setGeneratorActiveField(null);
                      setGeneratorReplaceOnType(false);
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
            {generatorActiveField ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  backgroundColor: "#fafaf9",
                }}
              >
                <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted }}>
                    {generatorFieldLabel(generatorActiveField)}
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontSize: 32,
                      fontWeight: "800",
                      color: colors.text,
                      letterSpacing: 0.3,
                    }}
                    numberOfLines={1}
                  >
                    {getGeneratorFieldValue(generatorActiveField) || "0"}
                  </Text>
                </View>
                <NumberKeypad
                  allowDecimal
                  onDigit={onGeneratorDigit}
                  onBackspace={onGeneratorBackspace}
                  onEnter={onGeneratorEnter}
                />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
