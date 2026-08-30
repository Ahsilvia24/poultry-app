import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  listFarms,
  getFarmDetail,
  updateFlockGrowthRate,
} from "../../src/repos/data";
import {
  CFM_BY_FAN_SIZE,
  CFM_PER_BIRD,
  MIN_VENT_CYCLE_SECONDS,
  allMinVentWeeks,
  recommendedMinVent,
} from "../../src/lib/tools";
import { flockWeekFromAge, formatMinVentCycle } from "../../src/lib/mortality";
import {
  catchWeightProjections,
  DEFAULT_GROWTH_RATE_LBS_PER_DAY,
  resolveGrowthRate,
} from "../../src/lib/weight/projections";
import { colors, styles } from "../../src/theme";
import { useTabScrollToTop } from "../../src/lib/tabScroll";
import { useKeyboardInset } from "../../src/lib/useKeyboardInset";
import { Card, Chip } from "../../src/components/ui";
import { WeightProjectionManualTile } from "../../src/components/WeightProjectionManualTile";
import { WeightProjectionTile } from "../../src/components/WeightProjectionTile";
import {
  CoolCellsChart,
  LightsChart,
  MaxCoolingChart,
  TempCurveChart,
} from "../../src/components/toolsCharts";

type SectionKey = "temp" | "cool" | "max" | "lights" | "weight" | "weightManual" | "vent";

const QUICK_LINKS: Array<{ key: SectionKey; label: string }> = [
  { key: "weight", label: "Weight Proj." },
  { key: "vent", label: "Ventilation" },
  { key: "temp", label: "Temp Curve" },
  { key: "cool", label: "Cool Cells" },
  { key: "max", label: "Max Cooling" },
  { key: "lights", label: "Lights" },
];

function paramValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function ToolsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmId?: string | string[];
    section?: string | string[];
  }>();
  const paramFarmId = paramValue(params.farmId);
  const paramSection = paramValue(params.section) as SectionKey | "";

  const scrollRef = useRef<ScrollView>(null);
  useTabScrollToTop("tools", scrollRef);
  const keyboardInset = useKeyboardInset();
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({});
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    temp: true,
    cool: true,
    max: true,
    lights: true,
    weight: true,
    weightManual: true,
    vent: true,
  });
  const [cfmOpen, setCfmOpen] = useState<"bird" | "fan" | null>(null);
  const [showVentMath, setShowVentMath] = useState(false);
  const [detailVersion, setDetailVersion] = useState(0);

  const farms = useMemo(() => listFarms().farms, []);
  const [farmId, setFarmId] = useState(() => paramFarmId || farms[0]?.id || "");
  const [houseId, setHouseId] = useState("");
  const [useAgeOfBird, setUseAgeOfBird] = useState(false);
  const [ageDaysText, setAgeDaysText] = useState("");
  const [localGrowthRate, setLocalGrowthRate] = useState<number | null>(null);

  useEffect(() => {
    if (paramFarmId && farms.some((f) => f.id === paramFarmId)) {
      setFarmId(paramFarmId);
      setHouseId("");
    }
  }, [paramFarmId, farms]);

  const detail = useMemo(() => {
    if (!farmId) return null;
    try {
      return getFarmDetail(farmId);
    } catch {
      return null;
    }
    // detailVersion forces refresh after saving growth rate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, detailVersion]);

  const houses = detail?.houses ?? [];
  const selectedHouse = houses.find((h) => h.id === houseId) ?? houses[0] ?? null;

  const flockWeek =
    selectedHouse?.ageDays != null
      ? flockWeekFromAge(Math.max(0, selectedHouse.ageDays))
      : (detail?.activeFlock?.flockWeek ?? null);

  const breakdown =
    selectedHouse &&
    flockWeek != null &&
    selectedHouse.placedBirdCount != null &&
    selectedHouse.totalFanCFM != null
      ? recommendedMinVent({
          birdsPlaced: selectedHouse.placedBirdCount,
          flockWeek,
          totalFanCFM: selectedHouse.totalFanCFM,
        })
      : null;

  const weekRows =
    selectedHouse &&
    selectedHouse.placedBirdCount != null &&
    selectedHouse.totalFanCFM != null
      ? allMinVentWeeks({
          birdsPlaced: selectedHouse.placedBirdCount,
          totalFanCFM: selectedHouse.totalFanCFM,
        })
      : [];

  const activeFlocks = detail?.activeFlocks ?? [];
  const growthRate = (() => {
    if (localGrowthRate != null) return resolveGrowthRate(localGrowthRate);
    if (selectedHouse?.growthRateLbsPerDay != null) {
      return resolveGrowthRate(selectedHouse.growthRateLbsPerDay);
    }
    if (detail?.activeFlock) {
      return resolveGrowthRate(detail.activeFlock.growthRateLbsPerDay);
    }
    return DEFAULT_GROWTH_RATE_LBS_PER_DAY;
  })();

  useEffect(() => {
    setLocalGrowthRate(null);
  }, [selectedHouse?.id]);

  /** Selected house → Low / Catch Day / High (±0.20 lb) from that house’s catch (or flock). */
  const weightProjectionGroups = (() => {
    if (!detail || growthRate == null || !selectedHouse) return [];
    const catchDate =
      selectedHouse.catchDate ??
      detail.activeFlock?.projectedCatchDate ??
      detail.activeFlock?.resolvedCatchDate ??
      detail.activeFlock?.catchDates?.[0] ??
      null;
    const placement =
      selectedHouse.placementDate ?? detail.activeFlock?.placementDate ?? null;
    if (!catchDate || !placement) return [];
    return [
      {
        catchDateKey: catchDate,
        projections: catchWeightProjections({
          placementDate: placement,
          catchDate,
          growthRateLbsPerDay: growthRate,
        }),
      },
    ];
  })();

  function onSectionLayout(key: SectionKey, e: LayoutChangeEvent) {
    sectionY.current[key] = e.nativeEvent.layout.y;
  }

  function openAndScroll(key: SectionKey) {
    setOpen((prev) => ({ ...prev, [key]: true }));
    requestAnimationFrame(() => {
      const y = sectionY.current[key];
      if (y != null) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
      }
    });
  }

  function scrollToTop() {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  useEffect(() => {
    // Only auto-scroll for deep links (section and/or farmId). Plain Tools
    // tab opens should stay at the top with Quick links visible.
    const section: SectionKey | null =
      paramSection === "temp" ||
      paramSection === "cool" ||
      paramSection === "max" ||
      paramSection === "lights" ||
      paramSection === "weight" ||
      paramSection === "weightManual" ||
      paramSection === "vent"
        ? paramSection
        : paramFarmId
          ? "weight"
          : null;
    if (!section) return;
    const t = setTimeout(() => openAndScroll(section), 50);
    return () => clearTimeout(t);
  }, [paramSection, paramFarmId]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          Platform.OS !== "ios" && keyboardInset > 0
            ? { paddingBottom: keyboardInset + 32 }
            : null,
        ]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
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
          <Text style={[styles.title, { flex: 1 }]}>Tools</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push("/settings")}
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Card style={{ marginBottom: 12 }}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {QUICK_LINKS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => openAndScroll(item.key)}
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
                    fontSize: 12,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <View onLayout={(e) => onSectionLayout("weight", e)} collapsable={false}>
          {open.weight ? (
            <SectionPanel title="Weight Projections">
              {!useAgeOfBird ? (
                <>
                  <ChipScroller style={{ marginBottom: 6 }}>
                    {farms.map((f) => (
                      <Chip
                        key={f.id}
                        label={f.farmName}
                        active={farmId === f.id}
                        onPress={() => {
                          setFarmId(f.id);
                          setHouseId("");
                        }}
                      />
                    ))}
                  </ChipScroller>

                  <ChipScroller style={{ marginBottom: 8 }}>
                    {houses.map((h) => (
                      <Chip
                        key={h.id}
                        label={`House ${h.houseNumber}`}
                        active={(selectedHouse?.id ?? "") === h.id}
                        onPress={() => setHouseId(h.id)}
                      />
                    ))}
                  </ChipScroller>
                </>
              ) : null}

              <WeightProjectionTile
                groups={weightProjectionGroups}
                growthRateLbsPerDay={growthRate}
                embedded
                useAgeOfBird={useAgeOfBird}
                onUseAgeOfBirdChange={setUseAgeOfBird}
                ageDaysText={ageDaysText}
                onAgeDaysChange={setAgeDaysText}
                onSaveGrowthRate={(rate) => {
                  setLocalGrowthRate(rate);
                  const flockId =
                    selectedHouse?.flockId ?? detail?.activeFlock?.id ?? null;
                  if (flockId) {
                    updateFlockGrowthRate(flockId, rate);
                    setDetailVersion((v) => v + 1);
                  } else if (activeFlocks.length > 0) {
                    for (const fl of activeFlocks) {
                      updateFlockGrowthRate(fl.id, rate);
                    }
                    setDetailVersion((v) => v + 1);
                  }
                }}
              />
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View onLayout={(e) => onSectionLayout("weightManual", e)} collapsable={false}>
          {open.weightManual ? (
            <SectionPanel title="Weight Projections Manual" onTop={scrollToTop}>
              <WeightProjectionManualTile />
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View onLayout={(e) => onSectionLayout("vent", e)} collapsable={false}>
          {open.vent ? (
            <>
              <SectionPanel title="Ventilation" onTop={scrollToTop}>
                <ChipScroller style={{ marginBottom: 6 }}>
                  {farms.map((f) => (
                    <Chip
                      key={f.id}
                      label={f.farmName}
                      active={farmId === f.id}
                      onPress={() => {
                        setFarmId(f.id);
                        setHouseId("");
                      }}
                    />
                  ))}
                </ChipScroller>

                <ChipScroller>
                  {houses.map((h) => (
                    <Chip
                      key={h.id}
                      label={`House ${h.houseNumber}`}
                      active={(selectedHouse?.id ?? "") === h.id}
                      onPress={() => setHouseId(h.id)}
                    />
                  ))}
                </ChipScroller>

                {selectedHouse ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: "#fff",
                      padding: 10,
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <Text style={{ fontWeight: "700", fontSize: 15 }}>
                        House {selectedHouse.houseNumber}
                      </Text>
                      <Text
                        style={[
                          styles.muted,
                          { fontSize: 13 },
                          flockWeek == null ? { color: colors.warn } : null,
                        ]}
                        numberOfLines={1}
                      >
                        {flockWeek != null
                          ? `· Flock week ${flockWeek}${
                              selectedHouse.ageDays != null ? ` ${selectedHouse.ageDays}d` : ""
                            }`
                          : "· No active flock"}
                      </Text>
                    </View>
                    <View style={[styles.row, { marginTop: 8 }]}>
                      <MetricTile
                        label="HP"
                        value={selectedHouse.placedBirdCount?.toLocaleString() ?? "—"}
                      />
                      <MetricTile
                        label="Total CFM (Min Vent)"
                        value={
                          selectedHouse.totalFanCFM != null
                            ? selectedHouse.totalFanCFM.toLocaleString()
                            : "—"
                        }
                      />
                      <MetricTile
                        label="CFM / Bird"
                        value={
                          breakdown
                            ? breakdown.cfmPerBird.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "—"
                        }
                      />
                      <MetricTile
                        label="Result"
                        value={
                          breakdown
                            ? formatMinVentCycle(breakdown.onSeconds, breakdown.offSeconds)
                            : "—"
                        }
                      />
                    </View>

                    {weekRows.length > 0 ? (
                      <View
                        style={{
                          marginTop: 6,
                          paddingTop: 6,
                          borderTopWidth: 1,
                          borderTopColor: "#f5f5f4",
                        }}
                      >
                        {weekRows.map((w) => (
                          <View
                            key={w.week}
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: 8,
                              paddingVertical: 3,
                            }}
                          >
                            <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>
                              Wk{w.week}{" "}
                              <Text style={{ color: colors.muted }}>
                                ({w.dayStart}-{w.dayEnd}d · {w.cfmPerBird.toFixed(2)} CFM/bird)
                              </Text>
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "800",
                                color: colors.text,
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              {formatMinVentCycle(w.onSeconds, w.offSeconds)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {breakdown ? (
                      <View style={{ marginTop: 6 }}>
                        <Pressable
                          onPress={() => setShowVentMath((v) => !v)}
                          hitSlop={8}
                          style={{ alignSelf: "flex-start" }}
                        >
                          <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: 13 }}>
                            {showVentMath ? "Hide math" : "Show math"}
                          </Text>
                        </Pressable>
                        {showVentMath ? (
                          <View
                            style={{
                              marginTop: 8,
                              padding: 10,
                              borderRadius: 10,
                              backgroundColor: "#fafaf9",
                              borderWidth: 1,
                              borderColor: colors.border,
                              gap: 4,
                            }}
                          >
                            <Text style={{ fontSize: 13, color: colors.text }}>
                              ON = (HP × CFM/Bird ÷ Total CFM) × {MIN_VENT_CYCLE_SECONDS}
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.text }}>
                              OFF = {MIN_VENT_CYCLE_SECONDS} − ON
                            </Text>
                            <View
                              style={{
                                marginTop: 6,
                                paddingTop: 8,
                                borderTopWidth: 1,
                                borderTopColor: "#e7e5e4",
                                gap: 4,
                              }}
                            >
                              <Text
                                style={{ fontSize: 13, fontFamily: "Courier", color: colors.text }}
                              >
                                {selectedHouse.placedBirdCount!.toLocaleString()} ×{" "}
                                {breakdown.cfmPerBird.toFixed(2)} ={" "}
                                {breakdown.requiredCfm.toFixed(1)} required CFM
                              </Text>
                              <Text
                                style={{ fontSize: 13, fontFamily: "Courier", color: colors.text }}
                              >
                                {breakdown.requiredCfm.toFixed(1)} ÷{" "}
                                {selectedHouse.totalFanCFM!.toLocaleString()} ×{" "}
                                {MIN_VENT_CYCLE_SECONDS} = {breakdown.onRaw.toFixed(2)}
                              </Text>
                              <Text
                                style={{ fontSize: 13, fontFamily: "Courier", color: colors.text }}
                              >
                                Round → {breakdown.onSeconds} ON / {breakdown.offSeconds} OFF
                              </Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={{ color: colors.warn, marginTop: 10 }}>
                        Need birds placed, flock week, and Total CFM (Min Vent) on this house to calculate.
                      </Text>
                    )}
                  </View>
                ) : null}
              </SectionPanel>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 28,
                  marginTop: 4,
                  marginBottom: 12,
                }}
              >
                <Pressable
                  onPress={() => setCfmOpen((v) => (v === "bird" ? null : "bird"))}
                  hitSlop={8}
                >
                  <Text
                    style={{
                      color: colors.accentDark,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    CFM / Bird
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setCfmOpen((v) => (v === "fan" ? null : "fan"))}
                  hitSlop={8}
                >
                  <Text
                    style={{
                      color: colors.accentDark,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    CFM / Fan size
                  </Text>
                </Pressable>
              </View>
              {cfmOpen === "bird" ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    overflow: "hidden",
                    marginBottom: 12,
                    backgroundColor: "#fff",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      padding: 12,
                      backgroundColor: "#fafaf9",
                    }}
                  >
                    <Text style={{ fontWeight: "700" }}>CFM / Bird</Text>
                    <Pressable onPress={() => setCfmOpen(null)}>
                      <Text style={{ fontWeight: "700", color: colors.muted }}>Close</Text>
                    </Pressable>
                  </View>
                  {CFM_PER_BIRD.map((r) => (
                    <View
                      key={r.week}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderTopWidth: 1,
                        borderTopColor: "#f5f5f4",
                      }}
                    >
                      <Text style={{ fontWeight: "700" }}>
                        {r.week} ({r.dayStart}-{r.dayEnd} days)
                      </Text>
                      <Text style={{ fontWeight: "600" }}>{r.cfmPerBird.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {cfmOpen === "fan" ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    overflow: "hidden",
                    marginBottom: 12,
                    backgroundColor: "#fff",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      padding: 12,
                      backgroundColor: "#fafaf9",
                    }}
                  >
                    <Text style={{ fontWeight: "700" }}>CFM / Fan size</Text>
                    <Pressable onPress={() => setCfmOpen(null)}>
                      <Text style={{ fontWeight: "700", color: colors.muted }}>Close</Text>
                    </Pressable>
                  </View>
                  {CFM_BY_FAN_SIZE.map((r) => (
                    <View
                      key={r.fanSizeInches}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderTopWidth: 1,
                        borderTopColor: "#f5f5f4",
                      }}
                    >
                      <Text style={{ fontWeight: "700" }}>{r.fanSizeInches}&quot;</Text>
                      <Text style={{ fontWeight: "600" }}>
                        {r.cfmPerFan.toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View onLayout={(e) => onSectionLayout("temp", e)} collapsable={false}>
          {open.temp ? (
            <SectionPanel title="Temp Curve" onTop={scrollToTop}>
              <TempCurveChart />
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View onLayout={(e) => onSectionLayout("cool", e)} collapsable={false}>
          {open.cool ? (
            <SectionPanel title="Cool Cells" onTop={scrollToTop}>
              <CoolCellsChart />
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View onLayout={(e) => onSectionLayout("max", e)} collapsable={false}>
          {open.max ? (
            <SectionPanel title="Max Cooling" onTop={scrollToTop}>
              <MaxCoolingChart />
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View onLayout={(e) => onSectionLayout("lights", e)} collapsable={false}>
          {open.lights ? (
            <SectionPanel title="Lights" onTop={scrollToTop}>
              <LightsChart />
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: "47%", marginBottom: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 1 }}>
        {value}
      </Text>
    </View>
  );
}

function ChipScroller({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ marginBottom: 10 }, style]}
      contentContainerStyle={{
        flexDirection: "row",
        alignItems: "center",
        paddingRight: 8,
      }}
    >
      {children}
    </ScrollView>
  );
}

function SectionAnchor() {
  return <View style={{ height: 1 }} />;
}

function SectionPanel({
  title,
  subtitle,
  onTop,
  children,
}: {
  title: string;
  subtitle?: string;
  onTop?: () => void;
  children?: React.ReactNode;
}) {
  return (
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
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.muted, { marginTop: 4 }]}>{subtitle}</Text>
          ) : null}
        </View>
        {onTop ? (
          <Pressable onPress={onTop} hitSlop={8}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted }}>Top</Text>
          </Pressable>
        ) : null}
      </View>
      {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </Card>
  );
}
