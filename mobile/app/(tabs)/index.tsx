import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { deactivateFarm, getDashboard, toggleFollowUpCompletion } from "../../src/repos/data";
import { useAuth } from "../../src/auth";
import { colors, styles } from "../../src/theme";
import { formatShortScheduleDate, formatLastVisitDate } from "../../src/lib/schedule";
import { useTabScrollToTop } from "../../src/lib/tabScroll";
import {
  Card,
  Metric,
  SectionTitle,
  StatusBadge,
  WeeklyMortalityList,
  formatNumber,
  formatPct,
} from "../../src/components/ui";
import { ExportDataCard } from "../../src/components/ExportDataCard";
import { ScheduleImportCard } from "../../src/components/ScheduleImportCard";

type Dashboard = ReturnType<typeof getDashboard>;
type ScheduleItem = Dashboard["todaysSchedule"][number];

/** Visible farm rows before the list scrolls inside the tile. */
const VISIBLE_SCHEDULE_ROWS = 8;
/** marginTop 10 + ~22px row content (checkbox / single-line text). */
const SCHEDULE_ROW_STEP = 32;
const SCHEDULE_LIST_MAX_HEIGHT = VISIBLE_SCHEDULE_ROWS * SCHEDULE_ROW_STEP;

function scheduleItemKey(item: Pick<ScheduleItem, "farmId" | "date" | "label">) {
  return `${item.farmId}-${item.date}-${item.label}`;
}

/** One-finger scroll inside a dashboard schedule tile when there are more than 8 farms. */
function ScrollableScheduleList({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      style={{ maxHeight: SCHEDULE_LIST_MAX_HEIGHT }}
    >
      {children}
    </ScrollView>
  );
}

function ScheduleCheckRow({
  item,
  showDate,
  checked,
  busy,
  onToggle,
  onOpenFarm,
}: {
  item: ScheduleItem;
  showDate?: boolean;
  checked: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpenFarm: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 10,
        opacity: checked ? 0.5 : 1,
      }}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: busy }}
        accessibilityLabel={
          checked
            ? `Unmark ${item.farmName} ${item.label} complete`
            : `Mark ${item.farmName} ${item.label} complete`
        }
        onPress={onToggle}
        disabled={busy}
        hitSlop={8}
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          borderWidth: checked ? 0 : 1.5,
          borderColor: "#a8a29e",
          backgroundColor: checked ? colors.accentDark : "#fff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? (
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", lineHeight: 15 }}>✓</Text>
        ) : null}
      </Pressable>
      <Pressable
        onPress={onOpenFarm}
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "baseline",
            flexShrink: 1,
          }}
        >
          <Text
            style={{
              fontWeight: "700",
              color: colors.text,
              flexShrink: 1,
              textDecorationLine: checked ? "line-through" : "none",
            }}
            numberOfLines={1}
          >
            {item.farmName}
          </Text>
          {item.flockAgeDays != null ? (
            <Text
              style={{
                fontWeight: "400",
                color: colors.muted,
                flexShrink: 0,
                textDecorationLine: checked ? "line-through" : "none",
              }}
              numberOfLines={1}
            >
              {" "}
              · {item.flockAgeDays}d
            </Text>
          ) : null}
        </View>
        {showDate ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexShrink: 0,
              gap: 10,
            }}
          >
            <Text
              style={{
                color: colors.muted,
                fontSize: 13,
                fontWeight: "600",
                textAlign: "right",
                minWidth: 78,
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 13,
                fontWeight: "700",
                textAlign: "right",
                width: 92,
              }}
              numberOfLines={1}
            >
              {formatShortScheduleDate(item.date)}
            </Text>
          </View>
        ) : (
          <Text
            style={{
              color: colors.muted,
              fontSize: 13,
              fontWeight: "700",
              flexShrink: 0,
            }}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

/** e.g. Wed, Jul 29, 2026 */
function formatCatchDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, 12);
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollToTop("index", scrollRef);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [catchesOpen, setCatchesOpen] = useState(false);
  const [expandedFarmIds, setExpandedFarmIds] = useState<Set<string>>(() => new Set());

  function toggleFarmExpanded(farmId: string) {
    setExpandedFarmIds((prev) => {
      const next = new Set(prev);
      if (next.has(farmId)) next.delete(farmId);
      else next.add(farmId);
      return next;
    });
  }

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setData(getDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  function makeInactive(farmId: string) {
    deactivateFarm(farmId);
    setExpandedFarmIds((prev) => {
      const next = new Set(prev);
      next.delete(farmId);
      return next;
    });
    load();
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const serverChecked = useMemo(() => {
    if (!data) return {} as Record<string, boolean>;
    const next: Record<string, boolean> = {};
    for (const item of [...data.todaysSchedule, ...data.upcomingSchedule]) {
      next[scheduleItemKey(item)] = item.completed;
    }
    return next;
  }, [data]);

  const serverSignature = useMemo(
    () =>
      data
        ? [...data.todaysSchedule, ...data.upcomingSchedule]
            .map((i) => `${scheduleItemKey(i)}:${i.completed}`)
            .join("|")
        : "",
    [data],
  );

  useEffect(() => {
    setChecked(serverChecked);
  }, [serverSignature, serverChecked]);

  function toggleScheduleItem(item: ScheduleItem) {
    const key = scheduleItemKey(item);
    if (pendingKey === key) return;
    const next = !(checked[key] ?? item.completed);
    setChecked((prev) => ({ ...prev, [key]: next }));
    setPendingKey(key);
    try {
      toggleFollowUpCompletion({
        farmId: item.farmId,
        flockId: item.flockId,
        scheduledDate: item.date,
        label: item.label,
        completed: next,
      });
      setData(getDashboard());
    } catch {
      setChecked((prev) => ({ ...prev, [key]: !next }));
    } finally {
      setPendingKey(null);
    }
  }

  if (loading && !data) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <View style={{ marginBottom: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={[styles.title, { flex: 1 }]}>Dashboard</Text>
            <Pressable onPress={signOut} hitSlop={8}>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "700",
                  textDecorationLine: "underline",
                }}
              >
                Sign out
              </Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}

        {data ? (
          <>
            <Card>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted }}>
                Today&apos;s schedule
              </Text>
              {data.todaysSchedule.length === 0 ? (
                <Text style={[styles.muted, { marginTop: 8 }]}>Nothing due today</Text>
              ) : (
                <ScrollableScheduleList>
                  {data.todaysSchedule.map((item) => {
                    const key = scheduleItemKey(item);
                    return (
                      <ScheduleCheckRow
                        key={key}
                        item={item}
                        showDate
                        checked={checked[key] ?? item.completed}
                        busy={pendingKey === key}
                        onToggle={() => toggleScheduleItem(item)}
                        onOpenFarm={() =>
                          router.push({
                            pathname: "/(tabs)/farms/[id]",
                            params: { id: item.farmId },
                          })
                        }
                      />
                    );
                  })}
                </ScrollableScheduleList>
              )}
            </Card>

            <Card>
              <Pressable
                onPress={() => setUpcomingOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: upcomingOpen }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted, flex: 1 }}>
                  Upcoming Visits
                  {!upcomingOpen ? (
                    <Text style={{ fontWeight: "500", color: colors.muted }}>
                      {" "}
                      · {data.upcomingSchedule.length}
                    </Text>
                  ) : null}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.accentDark }}>
                  {upcomingOpen ? "Hide" : "Show"}
                </Text>
              </Pressable>
              {upcomingOpen ? (
                data.upcomingSchedule.length === 0 ? (
                  <Text style={[styles.muted, { marginTop: 8 }]}>None in the next 10 days</Text>
                ) : (
                  <ScrollableScheduleList>
                    {data.upcomingSchedule.map((item) => {
                      const key = scheduleItemKey(item);
                      return (
                        <ScheduleCheckRow
                          key={key}
                          item={item}
                          showDate
                          checked={checked[key] ?? item.completed}
                          busy={pendingKey === key}
                          onToggle={() => toggleScheduleItem(item)}
                          onOpenFarm={() =>
                            router.push({
                              pathname: "/(tabs)/farms/[id]",
                              params: { id: item.farmId },
                            })
                          }
                        />
                      );
                    })}
                  </ScrollableScheduleList>
                )
              ) : null}
            </Card>

            <Card>
              <Pressable
                onPress={() => setCatchesOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: catchesOpen }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted, flex: 1 }}>
                  Upcoming catches
                  {!catchesOpen ? (
                    <Text style={{ fontWeight: "500", color: colors.muted }}>
                      {" "}
                      · {data.upcomingCatches.length}
                    </Text>
                  ) : null}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.accentDark }}>
                  {catchesOpen ? "Hide" : "Show"}
                </Text>
              </Pressable>
              {catchesOpen ? (
                data.upcomingCatches.length === 0 ? (
                  <Text style={[styles.muted, { marginTop: 8 }]}>None</Text>
                ) : (
                  <ScrollableScheduleList>
                    {data.upcomingCatches.map((c) => (
                      <Pressable
                        key={`${c.farmId}-${c.date}`}
                        onPress={() =>
                          router.push({
                            pathname: "/(tabs)/farms/[id]",
                            params: { id: c.farmId },
                          })
                        }
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 8,
                          marginTop: 10,
                          minHeight: 22,
                        }}
                      >
                        <Text style={{ fontWeight: "700", color: colors.text, flex: 1 }}>
                          {c.farmName}
                          {c.flockAgeDays != null ? (
                            <Text style={{ fontWeight: "400", color: colors.muted }}>
                              {" "}
                              · {c.flockAgeDays}d
                            </Text>
                          ) : null}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 13 }}>
                          {formatCatchDate(c.date)}
                          {c.catchAgeDays != null ? ` (${c.catchAgeDays})` : ""}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollableScheduleList>
                )
              ) : null}
            </Card>

            <SectionTitle>Active farms</SectionTitle>
            {data.farmCards.map((farm) => {
              const open = expandedFarmIds.has(farm.id);
              return (
                <Swipeable
                  key={farm.id}
                  overshootRight={false}
                  friction={2}
                  rightThreshold={40}
                  containerStyle={{ marginBottom: 12 }}
                  onSwipeableOpen={(direction) => {
                    if (direction === "right") makeInactive(farm.id);
                  }}
                  renderRightActions={() => (
                    <Pressable
                      accessibilityLabel={`Make ${farm.farmName} inactive`}
                      onPress={() => makeInactive(farm.id)}
                      style={{
                        backgroundColor: "#57534e",
                        justifyContent: "center",
                        alignItems: "center",
                        width: 100,
                        borderRadius: 14,
                        marginLeft: 8,
                      }}
                    >
                      <Ionicons name="pause-circle-outline" size={22} color="#fff" />
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "800",
                          fontSize: 11,
                          marginTop: 4,
                          textAlign: "center",
                          paddingHorizontal: 4,
                        }}
                      >
                        Make inactive
                      </Text>
                    </Pressable>
                  )}
                >
                  <Card style={{ padding: 0, overflow: "hidden", marginBottom: 0 }}>
                    <Pressable
                      onPress={() => toggleFarmExpanded(farm.id)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      accessibilityLabel={`${open ? "Collapse" : "Expand"} ${farm.farmName} details`}
                      style={{ padding: 14 }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                            {farm.farmName}
                            <Text style={{ fontWeight: "600", color: colors.muted }}>
                              {" "}
                              ({farm.houseCount})
                            </Text>
                            {(() => {
                              const ages =
                                farm.flockAgesDays?.length
                                  ? farm.flockAgesDays
                                  : farm.flockAgeDays != null
                                    ? [farm.flockAgeDays]
                                    : [];
                              if (!ages.length) return null;
                              return (
                                <Text style={{ fontWeight: "600", color: colors.muted }}>
                                  {" "}
                                  {ages.map((a) => `${a}d`).join(" ")}
                                </Text>
                              );
                            })()}
                          </Text>
                        </View>
                        <StatusBadge status={farm.status} />
                      </View>

                      {open ? (
                        <View style={{ paddingTop: 14 }}>
                          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                            <Metric
                              columns={3}
                              label="Birds placed"
                              value={formatNumber(farm.birdsPlaced)}
                            />
                            <Metric
                              columns={3}
                              label="Birds remaining"
                              value={formatNumber(farm.birdsRemaining)}
                            />
                            <Metric
                              columns={3}
                              label="Proj. Head Count"
                              value={formatNumber(farm.projectedHeadCount)}
                            />
                            <Metric
                              columns={3}
                              label="Today's Mortality"
                              value={String(farm.todayMortality)}
                            />
                            <Metric
                              columns={3}
                              label="Total Mortality"
                              value={`${farm.cumulativeMortality} (${formatPct(farm.cumulativeMortalityPct)})`}
                            />
                            <Metric
                              columns={3}
                              label="Projected Mortality"
                              value={
                                farm.projectedMortality != null && farm.birdsPlaced > 0
                                  ? `${formatNumber(farm.projectedMortality)} (${formatPct(
                                      (farm.projectedMortality / farm.birdsPlaced) * 100,
                                    )})`
                                  : formatNumber(farm.projectedMortality)
                              }
                            />
                          </View>

                          {farm.weeklyMortality.length > 0 ? (
                            <View
                              style={{
                                borderTopWidth: 1,
                                borderTopColor: "#f5f5f4",
                                paddingTop: 10,
                                marginTop: 4,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "700",
                                  color: colors.muted,
                                  textTransform: "uppercase",
                                  letterSpacing: 0.4,
                                  marginBottom: 8,
                                }}
                              >
                                Weekly mortality
                              </Text>
                              <WeeklyMortalityList weeks={farm.weeklyMortality} />
                            </View>
                          ) : null}

                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              gap: 12,
                              marginTop: 10,
                            }}
                          >
                            <Text style={[styles.muted, { fontSize: 12 }]}>
                              Last visit:{" "}
                              {farm.lastVisitDate
                                ? formatLastVisitDate(farm.lastVisitDate)
                                : "—"}
                            </Text>
                            <Text style={[styles.muted, { fontSize: 12 }]}>
                              {farm.openIssues <= 0
                                ? "No open issues"
                                : farm.openIssues === 1
                                  ? "1 open issue"
                                  : `${farm.openIssues} open issues`}
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </Pressable>
                  </Card>
                </Swipeable>
              );
            })}
          </>
        ) : null}

        <View style={{ marginTop: 16 }}>
          <SectionTitle>Import</SectionTitle>
          <ScheduleImportCard />
        </View>

        <View style={{ marginTop: 16, marginBottom: 24 }}>
          <SectionTitle>Backup</SectionTitle>
          <ExportDataCard />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
