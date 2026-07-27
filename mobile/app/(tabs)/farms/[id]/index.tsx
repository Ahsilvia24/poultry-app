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
  type ScrollView as ScrollViewType,
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
  updateHouse,
} from "../../../../src/repos/data";
import { VISIT_TYPE_LABELS } from "../../../../src/lib/visits";
import {
  ISSUE_CATEGORY_LABELS,
  LITTER_EVENT_LABELS,
} from "../../../../src/lib/opsLabels";
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

function formatShortDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0).toLocaleDateString(undefined, {
    month: "short",
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
};

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
  const [expandedHouses, setExpandedHouses] = useState<Set<string>>(new Set());
  const [editingFarm, setEditingFarm] = useState<FarmEditDraft | null>(null);
  const [farmEditError, setFarmEditError] = useState<string | null>(null);
  const [farmSaving, setFarmSaving] = useState(false);
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
  const birdsPlaced = data.houses.reduce((sum, h) => sum + (h.placedBirdCount ?? 0), 0);
  const cumMort = data.houses.reduce((sum, h) => sum + (h.cumulativeMortality ?? 0), 0);
  const phc = data.houses.reduce((sum, h) => sum + (h.projectedHeadCount ?? 0), 0);
  const projectedMort = data.houses.reduce(
    (sum, h) => sum + (h.projectedMortality ?? 0),
    0,
  );
  const catchLabel =
    data.activeFlock?.projectedCatchDate ?? data.activeFlock?.resolvedCatchDate ?? null;

  function openHouseEditor(h: HouseRow) {
    setHouseEditError(null);
    setEditingHouse({
      id: h.id,
      houseNumber: String(h.houseNumber),
      squareFootage: String(h.squareFootage ?? ""),
      totalFanCFM: h.totalFanCFM != null ? String(h.totalFanCFM) : "",
      numberOfFans: h.numberOfFans != null ? String(h.numberOfFans) : "",
    });
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
      if (cfm != null && !Number.isFinite(cfm)) throw new Error("Total fan CFM is invalid");
      if (fans != null && !Number.isFinite(fans)) throw new Error("Number of fans is invalid");
      updateHouse(farm.id, editingHouse.id, {
        houseNumber: Number(editingHouse.houseNumber),
        squareFootage: sq,
        totalFanCFM: cfm,
        numberOfFans: fans,
      });
      setEditingHouse(null);
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
              label="Enter mortality"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/mortality",
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
            <PrimaryButton
              label="LFO"
              secondary
              onPress={() => router.push("/(tabs)/lfo")}
              style={{ flexGrow: 1, minWidth: "45%" }}
            />
          </View>
        </View>

        {data.activeFlock ? (
          <Card>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>
              Active flock — {flockAge != null ? `${flockAge} days` : "—"}
              {data.activeFlock.flockNumber ? ` · ${data.activeFlock.flockNumber}` : ""}
            </Text>
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
            <Text style={[styles.muted, { marginTop: 4 }]}>
              Placed {data.activeFlock.placementDate}
              {catchLabel ? ` · Catch ${catchLabel}` : ""}
            </Text>
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
        onRequestClose={() => {
          if (!houseSaving) setEditingHouse(null);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          onPress={() => {
            if (!houseSaving) setEditingHouse(null);
          }}
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
                Edit house {editingHouse?.houseNumber}
              </Text>
              {houseEditError ? (
                <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "700" }}>
                  {houseEditError}
                </Text>
              ) : null}
              {editingHouse ? (
                <View style={{ marginTop: 14, gap: 4 }}>
                  <Text style={styles.label}>House number</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={editingHouse.houseNumber}
                    onChangeText={(v) =>
                      setEditingHouse((prev) => (prev ? { ...prev, houseNumber: v } : prev))
                    }
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>Square footage</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={editingHouse.squareFootage}
                    onChangeText={(v) =>
                      setEditingHouse((prev) => (prev ? { ...prev, squareFootage: v } : prev))
                    }
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>Total fan CFM</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={editingHouse.totalFanCFM}
                    onChangeText={(v) =>
                      setEditingHouse((prev) => (prev ? { ...prev, totalFanCFM: v } : prev))
                    }
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>Number of fans</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={editingHouse.numberOfFans}
                    onChangeText={(v) =>
                      setEditingHouse((prev) => (prev ? { ...prev, numberOfFans: v } : prev))
                    }
                  />
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                    <PrimaryButton
                      label={houseSaving ? "Saving…" : "Save"}
                      onPress={saveHouseEdit}
                      style={{ flex: 1 }}
                    />
                    <PrimaryButton
                      label="Cancel"
                      secondary
                      onPress={() => {
                        if (!houseSaving) setEditingHouse(null);
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : null}
            </ScrollView>
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
