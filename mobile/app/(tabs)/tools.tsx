import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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

type Section = "temp" | "cool" | "lights" | "vent" | null;

export default function ToolsScreen() {
  const [open, setOpen] = useState<Section>("vent");
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
  const selectedHouse =
    houses.find((h) => h.id === houseId) ?? houses[0] ?? null;

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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>Offline tools & charts</Text>

      <LinkBtn label="Temp Curve" active={open === "temp"} onPress={() => setOpen(open === "temp" ? null : "temp")} />
      {open === "temp" ? (
        <View style={styles.card}>
          {TEMP_CURVE.map((r) => (
            <Text key={r.day} style={{ marginBottom: 4 }}>
              Day {r.day}: Summer {r.summer}°F · Winter {r.winter}°F
            </Text>
          ))}
        </View>
      ) : null}

      <LinkBtn label="Cool Cells" active={open === "cool"} onPress={() => setOpen(open === "cool" ? null : "cool")} />
      {open === "cool" ? (
        <View style={styles.card}>
          <Text style={{ fontWeight: "800", marginBottom: 8 }}>Big Bird</Text>
          {BIG_BIRD_COOL_CELLS.map((r, i) => (
            <Text key={i} style={{ marginBottom: 2 }}>
              Day {r.day} · diff {r.diff} · {r.onSec}/{r.offSec}
              {r.onTemp != null ? ` · on ${r.onTemp}` : ""}
            </Text>
          ))}
          <Text style={{ fontWeight: "800", marginVertical: 8 }}>Tunnel Diff</Text>
          {MIST_AND_COOL_CELLS.slice(0, 6).map((r, i) => (
            <Text key={i} style={{ marginBottom: 2 }}>
              Day {r.day} · tunnel {r.diff} · {r.onSec}/{r.offSec}
            </Text>
          ))}
          <Text style={{ fontWeight: "800", marginVertical: 8 }}>Chore Time</Text>
          {CHORE_TIME_COOL_PAD_SETTINGS.map((r) => (
            <Text key={r.label} style={{ marginBottom: 2 }}>
              {r.label}: {r.value}
            </Text>
          ))}
        </View>
      ) : null}

      <LinkBtn label="Lights" active={open === "lights"} onPress={() => setOpen(open === "lights" ? null : "lights")} />
      {open === "lights" ? (
        <View style={styles.card}>
          {LIGHTS_PROGRAM.map((r) => (
            <Text key={r.day} style={{ marginBottom: 4 }}>
              Days {r.day}: {r.hoursLight}h light / {r.hoursDark}h dark
            </Text>
          ))}
          <Text style={[styles.muted, { marginTop: 8 }]}>* Brood lights ON days 1–7 only.</Text>
        </View>
      ) : null}

      <LinkBtn
        label="Ventilation"
        active={open === "vent"}
        onPress={() => setOpen(open === "vent" ? null : "vent")}
      />
      {open === "vent" ? (
        <View style={styles.card}>
          <Text style={{ fontWeight: "800" }}>Recommended Min Vent math</Text>
          <Text style={{ marginTop: 6 }}>
            ON = (HP × CFM/Bird ÷ Total CFM) × {MIN_VENT_CYCLE_SECONDS}
          </Text>
          <Text>OFF = {MIN_VENT_CYCLE_SECONDS} − ON</Text>

          <Text style={[styles.label, { marginTop: 12 }]}>Farm</Text>
          <View style={styles.row}>
            {farms.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  setFarmId(f.id);
                  setHouseId("");
                }}
                style={[
                  styles.button,
                  styles.buttonSecondary,
                  { minHeight: 40, paddingHorizontal: 10 },
                  farmId === f.id ? { backgroundColor: colors.accent } : null,
                ]}
              >
                <Text
                  style={[
                    styles.buttonSecondaryText,
                    farmId === f.id ? { color: "#fff" } : null,
                    { fontSize: 13 },
                  ]}
                >
                  {f.farmName}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.row, { marginTop: 8 }]}>
            {houses.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => setHouseId(h.id)}
                style={[
                  styles.button,
                  styles.buttonSecondary,
                  { minHeight: 40, paddingHorizontal: 12 },
                  (selectedHouse?.id ?? "") === h.id ? { backgroundColor: colors.accent } : null,
                ]}
              >
                <Text
                  style={[
                    styles.buttonSecondaryText,
                    (selectedHouse?.id ?? "") === h.id ? { color: "#fff" } : null,
                  ]}
                >
                  H{h.houseNumber}
                </Text>
              </Pressable>
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
                    Required CFM {breakdown.requiredCfm.toFixed(1)} · raw ON {breakdown.onRaw.toFixed(2)}
                  </Text>
                  <Text style={{ fontWeight: "800", marginTop: 4 }}>
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

          <Text style={{ fontWeight: "800", marginTop: 16 }}>CFM / Bird</Text>
          {CFM_PER_BIRD.map((r) => (
            <Text key={r.week}>
              {r.week} ({r.dayStart}-{r.dayEnd} days): {r.cfmPerBird.toFixed(2)}
            </Text>
          ))}
          <Text style={{ fontWeight: "800", marginTop: 12 }}>CFM / Fan size</Text>
          {CFM_BY_FAN_SIZE.map((r) => (
            <Text key={r.fanSizeInches}>
              {r.fanSizeInches}&quot;: {r.cfmPerFan.toLocaleString()}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function LinkBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ marginTop: 10, marginBottom: 4 }}>
      <Text style={{ color: colors.accentDark, fontWeight: "800", fontSize: 16 }}>
        {active ? "▾ " : "▸ "}
        {label}
      </Text>
    </Pressable>
  );
}
