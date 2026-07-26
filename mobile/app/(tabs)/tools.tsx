import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
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
import {
  Card,
  Chip,
  PageHeader,
} from "../../src/components/ui";

type Section = "temp" | "cool" | "max" | "lights" | "vent" | null;

const QUICK_LINKS: Array<{ key: Section; label: string }> = [
  { key: "temp", label: "Temp Curve" },
  { key: "cool", label: "Cool Cells" },
  { key: "max", label: "Max Cooling" },
  { key: "lights", label: "Lights" },
  { key: "vent", label: "Ventilation" },
];

export default function ToolsScreen() {
  const [open, setOpen] = useState<Section>("temp");
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

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <PageHeader title="Tools" subtitle="Temp, cooling, lights, and ventilation" />

        <View style={[styles.row, { marginBottom: 8 }]}>
          {QUICK_LINKS.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              active={open === item.key}
              onPress={() => setOpen(open === item.key ? null : item.key)}
            />
          ))}
        </View>

        {open === "temp" ? (
          <Card>
            <SectionTitleInCard>Temperature curve (°F)</SectionTitleInCard>
            <TableHeader cols={["Day", "Summer", "Winter"]} widths={[60, 80, 80]} />
            {TEMP_CURVE.map((r) => (
              <TableRow
                key={r.day}
                cols={[String(r.day), String(r.summer), String(r.winter)]}
                widths={[60, 80, 80]}
              />
            ))}
          </Card>
        ) : null}

        {open === "cool" ? (
          <Card>
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
          </Card>
        ) : null}

        {open === "max" ? (
          <Card>
            <SectionTitleInCard>Max cooling notes</SectionTitleInCard>
            <Text style={{ color: colors.text, lineHeight: 22 }}>
              Use cool-cell and tunnel settings from Cool Cells. Target house temperature from the
              Temp Curve for the current bird age. Increase cooling stages as outside humidity and
              bird heat load rise.
            </Text>
          </Card>
        ) : null}

        {open === "lights" ? (
          <Card>
            <SectionTitleInCard>Lights program</SectionTitleInCard>
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
          </Card>
        ) : null}

        {open === "vent" ? (
          <Card>
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
          </Card>
        ) : null}

        {open == null ? (
          <Card>
            <Text style={styles.muted}>Select a tool above.</Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
    <Text style={[{ fontWeight: "800", fontSize: 16, color: colors.accentDark, marginBottom: 8 }, style]}>
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
