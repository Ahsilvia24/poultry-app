import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
  deleteFeedDelivery,
  deleteHouse,
  deleteIssue,
  deleteLitterEvent,
  deleteVisit,
  getFarmDetail,
  reactivateFlock,
  updateFarm,
  updateFlockGrowthRate,
  updateFlockNumber,
  updateHouse,
} from "../../../../src/repos/data";
import { VISIT_TYPE_LABELS } from "../../../../src/lib/visits";
import {
  ISSUE_CATEGORY_LABELS,
  LITTER_EVENT_LABELS,
} from "../../../../src/lib/opsLabels";
import {
  catchWeightProjections,
  resolveGrowthRate,
} from "../../../../src/lib/weight/projections";
import { scrollFieldAboveKeypad } from "../../../../src/lib/scrollField";
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
};

type HouseNumField =
  | "houseNumber"
  | "squareFootage"
  | "totalFanCFM"
  | "numberOfFans"
  | "placedBirdCount";

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

type FarmEditDraft = {
  farmName: string;
  growerName: string;
  phoneNumber: string;
  notes: string;
};

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
  const scrollRef = useRef<ScrollViewType>(null);
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
    }, [load]),
  );

  function openFarmEditor(farm: FarmDetail["farm"]) {
    setFarmEditError(null);
    setEditingFarm({
      farmName: farm.farmName,
      growerName: farm.growerName ?? "",
      phoneNumber: farm.phoneNumber ?? "",
      notes: farm.notes ?? "",
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
            onPress={() => router.replace("/(tabs)/farms")}
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
  const flockAge = data.activeFlock?.flockAgeDays ?? null;
  const flockAges =
    data.activeFlock?.flockAgesDays?.length
      ? data.activeFlock.flockAgesDays
      : flockAge != null
        ? [flockAge]
        : [];
  const flockAgeLabel =
    flockAges.length > 0 ? flockAges.map((a) => `(${a}d)`).join(" ") : "—";
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
  const catchLabel =
    data.activeFlock?.projectedCatchDate ?? data.activeFlock?.resolvedCatchDate ?? null;
  const growthRate = data.activeFlock
    ? resolveGrowthRate(data.activeFlock.growthRateLbsPerDay)
    : null;
  const weightProjections =
    data.activeFlock && catchLabel && growthRate != null
      ? catchWeightProjections({
          placementDate: data.activeFlock.placementDate,
          catchDate: catchLabel,
          growthRateLbsPerDay: growthRate,
        })
      : [];

  function openHouseEditor(h: HouseRow) {
    setHouseEditError(null);
    setHouseActiveField(null);
    setHouseReplaceOnType(false);
    setEditingHouse({
      id: h.id,
      houseNumber: String(h.houseNumber),
      squareFootage: String(h.squareFootage ?? ""),
      totalFanCFM: h.totalFanCFM != null ? String(h.totalFanCFM) : "",
      numberOfFans: h.numberOfFans != null ? String(h.numberOfFans) : "",
      placedBirdCount: h.placedBirdCount != null ? String(h.placedBirdCount) : "",
      placementDate: h.placementDate ?? data?.activeFlock?.placementDate ?? "",
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

  // Keep the active field visible after the keypad mounts (layout shift)
  useEffect(() => {
    if (!houseActiveField) return;
    const t = setTimeout(() => {
      const node = houseFieldRefs.current.get(houseActiveField) ?? null;
      scrollFieldAboveKeypad(houseScrollRef, { current: node }, houseScrollYRef);
    }, 100);
    return () => clearTimeout(t);
  }, [houseActiveField]);

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
      router.replace({ pathname: "/(tabs)/farms/[id]", params: { id: farm.id } });
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
        notes: editingFarm.notes,
      });
      setEditingFarm(null);
      if (openEdit) {
        router.replace({ pathname: "/(tabs)/farms/[id]", params: { id: farm.id } });
      }
      load();
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
          onPress={() => router.replace("/(tabs)/farms")}
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
              label="History"
              secondary
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/farms/[id]/history",
                  params: { id: farm.id },
                })
              }
              style={{ flexGrow: 1, minWidth: "45%" }}
            />
            {data.activeFlock ? (
              <PrimaryButton
                label="Complete flock"
                secondary
                onPress={() => {
                  Alert.alert(
                    "Complete flock?",
                    "Mark this flock as completed? You can reactivate it later from History.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Complete",
                        onPress: () => {
                          try {
                            completeFlock(data.activeFlock!.id);
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
                }}
                style={{ flexGrow: 1, minWidth: "45%" }}
              />
            ) : null}
          </View>
        </View>

        {data.activeFlock ? (
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: 16, flex: 1 }}>
                Active flock — {flockAgeLabel}
                {data.activeFlock.flockNumber ? ` · ${data.activeFlock.flockNumber}` : ""}
              </Text>
              <Pressable
                accessibilityLabel="Edit flock number"
                onPress={() => {
                  setFlockNumberError(null);
                  setFlockNumberDraft(data.activeFlock?.flockNumber ?? "");
                  setEditingFlockNumber(data.activeFlock?.id ?? null);
                }}
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
              {flockPlacementDates.map((placed) => (
                <Text key={placed} style={styles.muted}>
                  Placed {formatUsDate(placed)}
                  {catchLabel ? ` · Catch ${formatUsDate(catchLabel)}` : ""}
                </Text>
              ))}
            </View>
            {growthRate != null && weightProjections.length > 0 ? (
              <WeightProjectionTile
                catchDateKey={catchLabel}
                growthRateLbsPerDay={growthRate}
                projections={weightProjections}
                onSaveGrowthRate={(rate) => {
                  updateFlockGrowthRate(data.activeFlock!.id, rate);
                  load();
                }}
              />
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
                { key: "issues", label: "Issues", onPress: () => scrollToSection("issues") },
                { key: "litter", label: "Litter", onPress: () => scrollToSection("litter") },
                { key: "feed", label: "Feed", onPress: () => scrollToSection("feed") },
                {
                  key: "history",
                  label: "History",
                  onPress: () =>
                    router.push({
                      pathname: "/(tabs)/farms/[id]/history",
                      params: { id: farm.id },
                    }),
                },
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
          return (
            <Card key={`${farm.id}-${h.id}`}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 17, fontWeight: "800" }}>
                    House {h.houseNumber}
                    {h.cumulativeMortality != null ? (
                      <Text style={{ fontWeight: "600", color: colors.muted }}>
                        {" "}
                        · Mort. {formatNumber(h.cumulativeMortality)}
                      </Text>
                    ) : null}
                    {h.projectedHeadCount != null ? (
                      <Text style={{ fontWeight: "600", color: colors.muted }}>
                        {" "}
                        · PHC {formatNumber(h.projectedHeadCount)}
                      </Text>
                    ) : null}
                  </Text>
                </View>
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
                <View style={{ marginTop: 12 }}>
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
                <Text style={[styles.muted, { marginTop: 12 }]}>No weekly mortality yet.</Text>
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
                    label="Mort."
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
              style={{ maxHeight: houseActiveField ? 360 : undefined }}
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
                          onChange={(date) =>
                            setEditingHouse((prev) =>
                              prev ? { ...prev, placementDate: date } : prev,
                            )
                          }
                        />
                      </View>
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
              <NumberKeypad
                allowDecimal={
                  houseActiveField === "squareFootage" || houseActiveField === "totalFanCFM"
                }
                onDigit={onHouseDigit}
                onBackspace={onHouseBackspace}
                onEnter={onHouseEnter}
              />
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
      </Modal>

      <Modal
        visible={editingFarm != null}
        animationType="slide"
        transparent
        onRequestClose={closeFarmEditor}
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
              maxHeight: "85%",
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
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
                  <Text style={[styles.label, { marginTop: 8 }]}>Notes</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
                    value={editingFarm.notes}
                    onChangeText={(v) =>
                      setEditingFarm((prev) => (prev ? { ...prev, notes: v } : prev))
                    }
                    multiline
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
      </Modal>
    </SafeAreaView>
  );
}
