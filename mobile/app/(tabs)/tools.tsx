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
  BIG_BIRD_COOL_CELLS,
  CFM_BY_FAN_SIZE,
  CFM_PER_BIRD,
  CHORE_TIME_COOL_PAD_SETTINGS,
  LIGHTS_PROGRAM,
  MIN_VENT_CYCLE_SECONDS,
  MIST_AND_COOL_CELLS,
  TEMP_CURVE,
  recommendedMinVent,
} from "../../src/lib/tools";
import { formatMinVentCycle } from "../../src/lib/mortality";
import { colors, styles } from "../../src/theme";
import { Card, Chip, PageHeader } from "../../src/components/ui";

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
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({});
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    temp: true,
    cool: true,
    max: true,
    lights: true,
    vent: true,
    phone: true,
  });

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

        <View
          onLayout={(e) => onSectionLayout("temp", e)}
          collapsable={false}
        >
          {open.temp ? (
            <SectionPanel
              title="Temp Curve"
              subtitle="Target house temperature (°F) by bird age — summer vs winter"
              onClose={() => setOpen((p) => ({ ...p, temp: false }))}
            >
              <TableHeader cols={["Day", "Summer", "Winter"]} widths={[60, 80, 80]} />
              {TEMP_CURVE.map((r) => (
                <TableRow
                  key={r.day}
                  cols={[String(r.day), String(r.summer), String(r.winter)]}
                  widths={[60, 80, 80]}
                />
              ))}
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View
          onLayout={(e) => onSectionLayout("cool", e)}
          collapsable={false}
        >
          {open.cool ? (
            <SectionPanel title="Cool Cells" onClose={() => setOpen((p) => ({ ...p, cool: false }))}>
              <SectionTitleInCard>Big Bird cool cells</SectionTitleInCard>
              {BIG_BIRD_COOL_CELLS.map((r, i) => (
                <Text key={i} style={{ marginBottom: 4, color: colors.text }}>
                  Day {r.day} · diff {r.diff} · {r.onSec}/{r.offSec}
                  {r.onTemp != null ? ` · on ${r.onTemp}` : ""}
                </Text>
              ))}
              <SectionTitleInCard style={{ marginTop: 14 }}>Tunnel / mist</SectionTitleInCard>
              {MIST_AND_COOL_CELLS.slice(0, 8).map((r, i) => (
                <Text key={i} style={{ marginBottom: 4, color: colors.text }}>
                  Day {r.day} · tunnel {r.diff} · {r.onSec}/{r.offSec}
                </Text>
              ))}
              <SectionTitleInCard style={{ marginTop: 14 }}>Chore Time</SectionTitleInCard>
              {CHORE_TIME_COOL_PAD_SETTINGS.map((r) => (
                <Text key={r.label} style={{ marginBottom: 4, color: colors.text }}>
                  {r.label}: {r.value}
                </Text>
              ))}
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View
          onLayout={(e) => onSectionLayout("max", e)}
          collapsable={false}
        >
          {open.max ? (
            <SectionPanel
              title="Max Cooling"
              subtitle="By relative humidity and outside temperature (°F)"
              onClose={() => setOpen((p) => ({ ...p, max: false }))}
            >
              <Text style={{ color: colors.text, lineHeight: 22 }}>
                Use cool-cell and tunnel settings from Cool Cells. Target house temperature from the
                Temp Curve for the current bird age. Increase cooling stages as outside humidity and
                bird heat load rise.
              </Text>
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View
          onLayout={(e) => onSectionLayout("lights", e)}
          collapsable={false}
        >
          {open.lights ? (
            <SectionPanel
              title="Lights"
              onClose={() => setOpen((p) => ({ ...p, lights: false }))}
            >
              <TableHeader cols={["Days", "Light", "Dark"]} widths={[80, 70, 70]} />
              {LIGHTS_PROGRAM.map((r) => (
                <TableRow
                  key={r.day}
                  cols={[String(r.day), `${r.hoursLight}h`, `${r.hoursDark}h`]}
                  widths={[80, 70, 70]}
                />
              ))}
              <Text style={[styles.muted, { marginTop: 10 }]}>
                * Brood lights ON days 1–7 only.
              </Text>
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View
          onLayout={(e) => onSectionLayout("vent", e)}
          collapsable={false}
        >
          {open.vent ? (
            <SectionPanel
              title="Ventilation"
              onClose={() => setOpen((p) => ({ ...p, vent: false }))}
            >
              <SectionTitleInCard>Recommended min vent</SectionTitleInCard>
              <Text style={{ marginTop: 4, color: colors.text }}>
                ON = (HP × CFM/Bird ÷ Total CFM) × {MIN_VENT_CYCLE_SECONDS}
              </Text>
              <Text style={{ color: colors.text }}>OFF = {MIN_VENT_CYCLE_SECONDS} − ON</Text>

              <Text style={[styles.label, { marginTop: 14 }]}>Farm</Text>
              <View style={styles.row}>
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
              </View>

              <View style={[styles.row, { marginTop: 4 }]}>
                {houses.map((h) => (
                  <Chip
                    key={h.id}
                    label={`H${h.houseNumber}`}
                    active={(selectedHouse?.id ?? "") === h.id}
                    onPress={() => setHouseId(h.id)}
                  />
                ))}
              </View>

              {selectedHouse ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontWeight: "700" }}>
                    House {selectedHouse.houseNumber}
                    {detail?.activeFlock?.flockWeek != null
                      ? ` · Week ${detail.activeFlock.flockWeek}`
                      : ""}
                  </Text>
                  <Text style={styles.muted}>
                    HP {selectedHouse.placedBirdCount?.toLocaleString() ?? "—"} · Total CFM{" "}
                    {selectedHouse.totalFanCFM?.toLocaleString() ?? "—"}
                  </Text>
                  {breakdown ? (
                    <>
                      <Text style={{ marginTop: 8 }}>
                        Required CFM {breakdown.requiredCfm.toFixed(1)} · raw ON{" "}
                        {breakdown.onRaw.toFixed(2)}
                      </Text>
                      <Text style={{ fontWeight: "800", marginTop: 4, fontSize: 16 }}>
                        {formatMinVentCycle(breakdown.onSeconds, breakdown.offSeconds)}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: colors.warn, marginTop: 8 }}>
                      Need birds placed, flock week, and total fan CFM.
                    </Text>
                  )}
                </View>
              ) : null}

              <SectionTitleInCard style={{ marginTop: 16 }}>CFM / Bird</SectionTitleInCard>
              {CFM_PER_BIRD.map((r) => (
                <Text key={r.week} style={{ marginBottom: 2 }}>
                  {r.week} ({r.dayStart}-{r.dayEnd} days): {r.cfmPerBird.toFixed(2)}
                </Text>
              ))}
              <SectionTitleInCard style={{ marginTop: 12 }}>CFM / Fan size</SectionTitleInCard>
              {CFM_BY_FAN_SIZE.map((r) => (
                <Text key={r.fanSizeInches} style={{ marginBottom: 2 }}>
                  {r.fanSizeInches}&quot;: {r.cfmPerFan.toLocaleString()}
                </Text>
              ))}
            </SectionPanel>
          ) : (
            <SectionAnchor />
          )}
        </View>

        <View
          onLayout={(e) => onSectionLayout("phone", e)}
          collapsable={false}
        >
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
      </ScrollView>
    </SafeAreaView>
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

function SectionTitleInCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <Text
      style={[
        { fontWeight: "800", fontSize: 16, color: colors.accentDark, marginBottom: 8 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function TableHeader({ cols, widths }: { cols: string[]; widths: number[] }) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: 6,
        marginBottom: 4,
      }}
    >
      {cols.map((c, i) => (
        <Text
          key={c}
          style={{
            width: widths[i],
            fontSize: 12,
            fontWeight: "800",
            color: colors.muted,
            textTransform: "uppercase",
          }}
        >
          {c}
        </Text>
      ))}
    </View>
  );
}

function TableRow({ cols, widths }: { cols: string[]; widths: number[] }) {
  return (
    <View style={{ flexDirection: "row", paddingVertical: 5 }}>
      {cols.map((c, i) => (
        <Text key={`${c}-${i}`} style={{ width: widths[i], fontSize: 15, color: colors.text }}>
          {c}
        </Text>
      ))}
    </View>
  );
}
