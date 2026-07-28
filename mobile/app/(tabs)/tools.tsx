import { useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listFarms, getFarmDetail } from "../../src/repos/data";
import {
  CFM_BY_FAN_SIZE,
  CFM_PER_BIRD,
  MIN_VENT_CYCLE_SECONDS,
  recommendedMinVent,
} from "../../src/lib/tools";
import { formatMinVentCycle } from "../../src/lib/mortality";
import { colors, styles } from "../../src/theme";
import { useTabScrollToTop } from "../../src/lib/tabScroll";
import { Card, Chip, PageHeader } from "../../src/components/ui";
import { ExportDataCard } from "../../src/components/ExportDataCard";
import {
  CoolCellsChart,
  LightsChart,
  MaxCoolingChart,
  TempCurveChart,
} from "../../src/components/toolsCharts";

type SectionKey = "temp" | "cool" | "max" | "lights" | "vent" | "phone";

const QUICK_LINKS: Array<{ key: SectionKey; label: string }> = [
  { key: "temp", label: "Temp Curve" },
  { key: "cool", label: "Cool Cells" },
  { key: "max", label: "Max Cooling" },
  { key: "lights", label: "Lights" },
  { key: "vent", label: "Ventilation" },
  { key: "phone", label: "Phone Numbers" },
];

export default function ToolsScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollToTop("tools", scrollRef);
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({});
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    temp: true,
    cool: true,
    max: true,
    lights: true,
    vent: true,
    phone: true,
  });
  const [cfmOpen, setCfmOpen] = useState<"bird" | "fan" | null>(null);

  const farms = useMemo(() => listFarms().farms, []);
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const [houseId, setHouseId] = useState("");

  const detail = useMemo(() => {
    if (!farmId) return null;
    try {
      return getFarmDetail(farmId);
    } catch {
      return null;
    }
  }, [farmId]);

  const houses = detail?.houses ?? [];
  const selectedHouse = houses.find((h) => h.id === houseId) ?? houses[0] ?? null;

  const breakdown =
    selectedHouse &&
    detail?.activeFlock?.flockWeek != null &&
    selectedHouse.placedBirdCount != null &&
    selectedHouse.totalFanCFM != null
      ? recommendedMinVent({
          birdsPlaced: selectedHouse.placedBirdCount,
          flockWeek: detail.activeFlock.flockWeek,
          totalFanCFM: selectedHouse.totalFanCFM,
        })
      : null;

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

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
      >
        <PageHeader
          title="Tools"
          subtitle="Calculators and helpers for field work"
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
            <SectionPanel
              title="Ventilation"
              onClose={() => setOpen((p) => ({ ...p, vent: false }))}
            >
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  backgroundColor: "#fafaf9",
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Recommended Min Vent math
                </Text>
                <Text style={{ marginTop: 8, color: colors.text, fontSize: 14 }}>
                  ON = (HP × CFM/Bird ÷ Total CFM) × {MIN_VENT_CYCLE_SECONDS}
                </Text>
                <Text style={{ marginTop: 4, color: colors.text, fontSize: 14 }}>
                  OFF = {MIN_VENT_CYCLE_SECONDS} − ON
                </Text>
              </View>

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
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontWeight: "700", fontSize: 15 }}>
                    House {selectedHouse.houseNumber} — worked example
                  </Text>
                  <Text style={[styles.muted, { marginTop: 4 }]}>
                    {detail?.activeFlock?.flockWeek != null
                      ? `Flock week ${detail.activeFlock.flockWeek}`
                      : "No active flock — week / HP unavailable."}
                  </Text>
                  <View style={[styles.row, { marginTop: 12 }]}>
                    <MetricTile
                      label="HP"
                      value={selectedHouse.placedBirdCount?.toLocaleString() ?? "—"}
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
                      label="Total CFM"
                      value={selectedHouse.totalFanCFM?.toLocaleString() ?? "—"}
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
                  {breakdown ? (
                    <View
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: "#f5f5f4",
                        gap: 4,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontFamily: "Courier", color: colors.text }}>
                        {selectedHouse.placedBirdCount!.toLocaleString()} ×{" "}
                        {breakdown.cfmPerBird.toFixed(2)} ={" "}
                        {breakdown.requiredCfm.toFixed(1)} required CFM
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: "Courier", color: colors.text }}>
                        {breakdown.requiredCfm.toFixed(1)} ÷{" "}
                        {selectedHouse.totalFanCFM!.toLocaleString()} × {MIN_VENT_CYCLE_SECONDS} ={" "}
                        {breakdown.onRaw.toFixed(2)}
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: "Courier", color: colors.text }}>
                        Round → {breakdown.onSeconds} ON / {breakdown.offSeconds} OFF
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: colors.warn, marginTop: 10 }}>
                      Need birds placed, flock week, and Total fan CFM on this house to calculate.
                    </Text>
                  )}
                </View>
              ) : null}

              <Pressable onPress={() => setCfmOpen((v) => (v === "bird" ? null : "bird"))}>
                <Text style={{ color: colors.accentDark, fontWeight: "700", marginBottom: 8 }}>
                  CFM / Bird
                </Text>
              </Pressable>
              {cfmOpen === "bird" ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
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

              <Pressable onPress={() => setCfmOpen((v) => (v === "fan" ? null : "fan"))}>
                <Text style={{ color: colors.accentDark, fontWeight: "700", marginBottom: 8 }}>
                  CFM / Fan size
                </Text>
              </Pressable>
              {cfmOpen === "fan" ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    overflow: "hidden",
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
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View onLayout={(e) => onSectionLayout("phone", e)} collapsable={false}>
          {open.phone ? (
            <SectionPanel
              title="Phone Numbers"
              subtitle="Coming soon."
              onClose={() => setOpen((p) => ({ ...p, phone: false }))}
            />
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
    <View style={{ width: "47%", marginBottom: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function ChipScroller({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 10 }}
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
