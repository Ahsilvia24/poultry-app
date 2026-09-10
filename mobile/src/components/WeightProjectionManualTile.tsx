import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DEFAULT_LFO_CONSUMPTION_RATE } from "../lib/lfo/calculate";
import { catchWeightBandFromLbs } from "../lib/weight/projections";
import {
  DEFAULT_EXPECTED_FEED_CONVERSION,
  manualProjectedWeightLbs,
  parseManualNumber,
} from "../lib/weight/manualProjection";
import { colors } from "../theme";
import {
  NumberKeypad,
  appendKeypadDigit,
  backspaceKeypadValue,
} from "./NumberKeypad";

type FieldKey = "tf" | "inv" | "chc" | "cr" | "dtk" | "efc";

const FIELDS: Array<{
  key: FieldKey;
  label: string;
  unit: string;
  decimal: boolean;
  tripleZero: boolean;
}> = [
  { key: "tf", label: "TF", unit: "lb", decimal: false, tripleZero: true },
  { key: "inv", label: "INV", unit: "lb", decimal: false, tripleZero: true },
  { key: "chc", label: "CHC", unit: "", decimal: false, tripleZero: true },
  { key: "cr", label: "CR", unit: "lb/bird/day", decimal: true, tripleZero: false },
  { key: "dtk", label: "DTK", unit: "days", decimal: true, tripleZero: false },
  { key: "efc", label: "EFC", unit: "", decimal: true, tripleZero: false },
];

function formatField(key: FieldKey, raw: string) {
  if (raw.trim() === "") return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (key === "cr" || key === "efc") return n.toFixed(3);
  if (key === "tf" || key === "inv" || key === "chc") {
    return Math.round(n).toLocaleString();
  }
  if (key === "dtk") {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function WeightProjectionManualTile() {
  const [tf, setTf] = useState("");
  const [inv, setInv] = useState("");
  const [chc, setChc] = useState("");
  const [cr, setCr] = useState(String(DEFAULT_LFO_CONSUMPTION_RATE));
  const [dtk, setDtk] = useState("");
  const [efc, setEfc] = useState(String(DEFAULT_EXPECTED_FEED_CONVERSION));
  const [active, setActive] = useState<FieldKey | null>(null);
  const [replaceOnType, setReplaceOnType] = useState(false);

  const values: Record<FieldKey, string> = { tf, inv, chc, cr, dtk, efc };
  const setters: Record<FieldKey, (next: string) => void> = {
    tf: setTf,
    inv: setInv,
    chc: setChc,
    cr: setCr,
    dtk: setDtk,
    efc: setEfc,
  };

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
