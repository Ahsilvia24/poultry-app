import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
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
import { Card, Chip, PageHeader } from "../../src/components/ui";
import { ExportDataCard } from "../../src/components/ExportDataCard";
import { WeightProjectionTile } from "../../src/components/WeightProjectionTile";
import {
  CoolCellsChart,
  LightsChart,
  MaxCoolingChart,
  TempCurveChart,
} from "../../src/components/toolsCharts";

type SectionKey = "temp" | "cool" | "max" | "lights" | "weight" | "vent";

const QUICK_LINKS: Array<{ key: SectionKey; label: string }> = [
  { key: "weight", label: "Weight Proj." },
  { key: "temp", label: "Temp Curve" },
  { key: "cool", label: "Cool Cells" },
  { key: "max", label: "Max Cooling" },
  { key: "lights", label: "Lights" },
  { key: "vent", label: "Ventilation" },
];

function paramValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function ToolsScreen() {
  const params = useLocalSearchParams<{
    farmId?: string | string[];
    section?: string | string[];
  }>();
  const paramFarmId = paramValue(params.farmId);
  const paramSection = paramValue(params.section) as SectionKey | "";

  const scrollRef = useRef<ScrollView>(null);
  useTabScrollToTop("tools", scrollRef);
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({});
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    temp: true,
    cool: true,
    max: true,
    lights: true,
    weight: true,
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

  /** Selected house → Catch day / +1 / +2 from that house’s catch (or flock). */
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

  useEffect(() => {
    const section: SectionKey =
      paramSection === "temp" ||
      paramSection === "cool" ||
      paramSection === "max" ||
      paramSection === "lights" ||
      paramSection === "weight" ||
      paramSection === "vent"
        ? paramSection
        : "weight";
    const t = setTimeout(() => openAndScroll(section), 50);
    return () => clearTimeout(t);
  }, [paramSection, paramFarmId]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
      >
        <PageHeader
          title="Tools"
          subtitle="Weight projections and field calculators"
        />

        <Card style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
            Quick links
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 10,
            }}
          >
            {QUICK_LINKS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => openAndScroll(item.key)}
                style={{
                  width: "48%",
                  flexGrow: 1,
                  minHeight: 40,
                  borderRadius: 10,
                  backgroundColor: colors.accentDark,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <View onLayout={(e) => onSectionLayout("weight", e)} collapsable={false}>
          {open.weight ? (
            <SectionPanel
              title="Weight projections"
              onClose={() => setOpen((p) => ({ ...p, weight: false }))}
            >
              {!useAgeOfBird ? (
                <>
                  <Text style={styles.label}>Farm</Text>
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

        <View onLayout={(e) => onSectionLayout("temp", e)} collapsable={false}>
          {open.temp ? (
            <SectionPanel
              title="Temp Curve"
              subtitle="Target house temperature (°F) by bird age — summer vs winter"
              onClose={() => setOpen((p) => ({ ...p, temp: false }))}
            >
              <TempCurveChart />
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View onLayout={(e) => onSectionLayout("cool", e)} collapsable={false}>
          {open.cool ? (
            <SectionPanel
              title="Cool Cells"
              onClose={() => setOpen((p) => ({ ...p, cool: false }))}
            >
              <CoolCellsChart />
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View onLayout={(e) => onSectionLayout("max", e)} collapsable={false}>
          {open.max ? (
            <SectionPanel
              title="Max Cooling"
              subtitle="By relative humidity and outside temperature (°F)"
              onClose={() => setOpen((p) => ({ ...p, max: false }))}
            >
              <MaxCoolingChart />
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View onLayout={(e) => onSectionLayout("lights", e)} collapsable={false}>
          {open.lights ? (
            <SectionPanel
              title="Lights"
              onClose={() => setOpen((p) => ({ ...p, lights: false }))}
            >
              <LightsChart />
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View onLayout={(e) => onSectionLayout("vent", e)} collapsable={false}>
          {open.vent ? (
            <>
              <SectionPanel
                title="Ventilation"
                onClose={() => setOpen((p) => ({ ...p, vent: false }))}
              >
                <Text style={styles.label}>Farm</Text>
                <ChipScroller>
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

                <Text style={styles.label}>House</Text>
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
                              selectedHouse.ageDays != null ? ` · ${selectedHouse.ageDays}d` : ""
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
                        label="Total CFM"
                        value={
                          selectedHouse.totalFanCFM != null
                            ? `${selectedHouse.totalFanCFM.toLocaleString()}${
                                selectedHouse.numberOfFans != null
                                  ? ` · ${selectedHouse.numberOfFans} fans`
                                  : ""
                              }`
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
                        Need birds placed, flock week, and Total fan CFM on this house to calculate.
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

        <View style={{ marginTop: 8, marginBottom: 24 }}>
          <ExportDataCard />
        </View>
      </ScrollView>
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
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
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
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted }}>Close</Text>
        </Pressable>
      </View>
      {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </Card>
  );
}
