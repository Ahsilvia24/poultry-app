import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { listFarms, getFarmDetail } from "../repos/data";
import { todayKey } from "../lib/ids";
import { DEFAULT_LFO_CONSUMPTION_RATE } from "../lib/lfo/calculate";
import { catchWeightBandFromLbs } from "../lib/weight/projections";
import {
  DEFAULT_EXPECTED_FEED_CONVERSION,
  manualProjectedWeightLbs,
  parseManualNumber,
} from "../lib/weight/manualProjection";
import { colors } from "../theme";
import { Chip } from "./ui";
import {
  NumberKeypad,
  appendKeypadDigit,
  backspaceKeypadValue,
} from "./NumberKeypad";

const MANUAL_TAB = "manual";

type FieldKey = "tf" | "inv" | "chc" | "cr" | "dtk" | "efc";

const FIELDS: Array<{
  key: FieldKey;
  label: string;
  unit: string;
  decimal: boolean;
  tripleZero: boolean;
}> = [
  { key: "tf", label: "TF", unit: "lb", decimal: true, tripleZero: true },
  { key: "inv", label: "INV", unit: "lb", decimal: true, tripleZero: true },
  { key: "chc", label: "CHC", unit: "", decimal: false, tripleZero: true },
  { key: "cr", label: "CR", unit: "lb/bird/day", decimal: true, tripleZero: false },
  { key: "dtk", label: "DTK", unit: "days", decimal: true, tripleZero: false },
  { key: "efc", label: "EFC", unit: "", decimal: true, tripleZero: false },
];

function daysToKill(fromKey: string, catchKey: string) {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = catchKey.split("-").map(Number);
  return Math.max(
    0,
    Math.round(
      (Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1) -
        Date.UTC(fy!, (fm ?? 1) - 1, fd ?? 1)) /
        86400000,
    ),
  );
}

function formatField(key: FieldKey, raw: string) {
  if (raw.trim() === "") return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (key === "cr" || key === "efc") return n.toFixed(3);
  if (key === "chc") return Math.round(n).toLocaleString();
  if (key === "dtk") {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function WeightProjectionManualTile() {
  const farms = useMemo(() => listFarms().farms, []);
  const [tab, setTab] = useState(MANUAL_TAB);
  const [houseId, setHouseId] = useState("");
  const [tf, setTf] = useState("");
  const [inv, setInv] = useState("");
  const [chc, setChc] = useState("");
  const [cr, setCr] = useState(String(DEFAULT_LFO_CONSUMPTION_RATE));
  const [dtk, setDtk] = useState("");
  const [efc, setEfc] = useState(String(DEFAULT_EXPECTED_FEED_CONVERSION));
  const [manualChc, setManualChc] = useState("");
  const [manualDtk, setManualDtk] = useState("");
  const [active, setActive] = useState<FieldKey | null>(null);
  const [replaceOnType, setReplaceOnType] = useState(false);

  const isManual = tab === MANUAL_TAB;
  const detail = useMemo(() => {
    if (isManual || !tab) return null;
    try {
      return getFarmDetail(tab);
    } catch {
      return null;
    }
  }, [isManual, tab]);

  const houses = detail?.houses ?? [];
  const house = houses.find((h) => h.id === houseId) ?? houses[0] ?? null;

  const values: Record<FieldKey, string> = { tf, inv, chc, cr, dtk, efc };
  const setters: Record<FieldKey, (next: string) => void> = {
    tf: setTf,
    inv: setInv,
    chc: setChc,
    cr: setCr,
    dtk: setDtk,
    efc: setEfc,
  };

  function houseDefaults(next: (typeof houses)[number] | null) {
    const head =
      next?.remainingBirdCount != null ? String(next.remainingBirdCount) : "";
    const days =
      next?.catchDate != null ? String(daysToKill(todayKey(), next.catchDate)) : "";
    setChc(head);
    setDtk(days);
  }

  function selectManual() {
    if (!isManual) {
      setTab(MANUAL_TAB);
      setChc(manualChc);
      setDtk(manualDtk);
      setActive(null);
    }
  }

  function selectFarm(id: string) {
    if (isManual) {
      setManualChc(chc);
      setManualDtk(dtk);
    }
    let nextHouse: (typeof houses)[number] | null = null;
    try {
      const next = getFarmDetail(id);
      nextHouse = next.houses[0] ?? null;
      setHouseId(nextHouse?.id ?? "");
      houseDefaults(nextHouse);
    } catch {
      setHouseId("");
      houseDefaults(null);
    }
    setTab(id);
    setActive(null);
  }

  function selectHouse(id: string) {
    const next = houses.find((h) => h.id === id) ?? null;
    setHouseId(id);
    houseDefaults(next);
    setActive(null);
  }

  const projected = useMemo(() => {
    const totalFeedLbs = parseManualNumber(tf);
    const inventoryLbs = parseManualNumber(inv);
    const currentHeadCount = parseManualNumber(chc);
    const consumptionRateLbsPerBirdDay = parseManualNumber(cr);
    const daysToKillValue = parseManualNumber(dtk);
    const expectedFeedConversion = parseManualNumber(efc);
    if (
      totalFeedLbs == null ||
      inventoryLbs == null ||
      currentHeadCount == null ||
      consumptionRateLbsPerBirdDay == null ||
      daysToKillValue == null ||
      expectedFeedConversion == null
    ) {
      return null;
    }
    return manualProjectedWeightLbs({
      totalFeedLbs,
      inventoryLbs,
      currentHeadCount,
      consumptionRateLbsPerBirdDay,
      daysToKill: daysToKillValue,
      expectedFeedConversion,
    });
  }, [tf, inv, chc, cr, dtk, efc]);

  const band = projected != null ? catchWeightBandFromLbs(projected) : null;
  const activeMeta = FIELDS.find((f) => f.key === active) ?? null;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 4 }}
        contentContainerStyle={{ flexDirection: "row", alignItems: "center", paddingRight: 8 }}
      >
        <Chip label="Manual" active={isManual} onPress={selectManual} />
        {farms.map((f) => (
          <Chip
            key={f.id}
            label={f.farmName}
            active={tab === f.id}
            onPress={() => selectFarm(f.id)}
          />
        ))}
      </ScrollView>

      {!isManual && houses.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 4 }}
          contentContainerStyle={{ flexDirection: "row", alignItems: "center", paddingRight: 8 }}
        >
          {houses.map((h) => (
            <Chip
              key={h.id}
              label={`House ${h.houseNumber}`}
              active={(house?.id ?? "") === h.id}
              onPress={() => selectHouse(h.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {FIELDS.map((field) => {
        const raw = values[field.key];
        const selected = active === field.key;
        return (
          <Pressable
            key={field.key}
            onPress={() => {
              setActive(field.key);
              setReplaceOnType(raw.trim() !== "");
            }}
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: "#f5f5f4",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted }}>
              {field.label}
            </Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: selected ? colors.accentDark : colors.text,
                textDecorationLine: "underline",
              }}
            >
              {selected ? raw || " " : formatField(field.key, raw)}
              {!selected && raw.trim() !== "" && field.unit ? (
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>
                  {" "}
                  {field.unit}
                </Text>
              ) : null}
            </Text>
          </Pressable>
        );
      })}

      {band ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {band.map((p) => (
            <View
              key={p.key}
              style={{
                flex: 1,
                backgroundColor: "#fafaf9",
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.muted }}>{p.label}</Text>
              <Text
                style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 2 }}
              >
                {p.weightLbs.toFixed(2)} lb
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ marginTop: 12, fontSize: 13, color: colors.muted }}>
          Tap the numbers to calculate
        </Text>
      )}

      {active && activeMeta ? (
        <View style={{ marginTop: 12 }}>
          <NumberKeypad
            onDigit={(d) => {
              const current = values[active];
              const next = appendKeypadDigit(
                replaceOnType ? "" : current,
                d,
                activeMeta.decimal,
              );
              setReplaceOnType(false);
              setters[active](next);
            }}
            onBackspace={() => {
              setters[active](backspaceKeypadValue(values[active]));
              setReplaceOnType(false);
            }}
            onEnter={() => setActive(null)}
            allowDecimal={activeMeta.decimal}
            allowTripleZero={activeMeta.tripleZero}
          />
        </View>
      ) : null}
    </View>
  );
}
