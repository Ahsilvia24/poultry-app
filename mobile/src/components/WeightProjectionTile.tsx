import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { DEFAULT_GROWTH_RATE_LBS_PER_DAY } from "../lib/weight/projections";
import { colors, styles } from "../theme";
import { Card, PrimaryButton } from "./ui";

const DAY_2 = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/** Compact date for tight projection cells: "Mo 8/3" */
function formatCatchShort(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  const day = DAY_2[dt.getDay()] ?? "";
  return `${day} ${m}/${d}`;
}

type Projection = {
  offsetDays: number;
  dateKey: string;
  label: string;
  ageDays: number;
  weightLbs: number;
};

export type WeightProjectionGroup = {
  catchDateKey: string;
  projections: Projection[];
};

export function WeightProjectionTile({
  groups,
  growthRateLbsPerDay,
  onSaveGrowthRate,
  embedded = false,
}: {
  groups: WeightProjectionGroup[];
  growthRateLbsPerDay: number;
  onSaveGrowthRate: (rate: number) => void;
  /** When true, skip the outer card chrome and section title (used inside Tools). */
  embedded?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(growthRateLbsPerDay));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (groups.length === 0) return null;

  const catchDatesSorted = groups.map((g) => g.catchDateKey);

  function startEdit() {
    if (saving) return;
    if (editing) {
      setEditing(false);
      setError(null);
      return;
    }
    setDraft(String(growthRateLbsPerDay || DEFAULT_GROWTH_RATE_LBS_PER_DAY));
    setError(null);
    setEditing(true);
  }

  function save() {
    const rate = Number(draft);
    if (!Number.isFinite(rate) || rate < 0) {
      setError("Enter a valid growth rate (0 or greater).");
      return;
    }
    setSaving(true);
    try {
      onSaveGrowthRate(rate);
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const growthRateControl = (
    <Pressable
      onPress={startEdit}
      accessibilityRole="button"
      accessibilityLabel="Edit growth rate"
      accessibilityState={{ expanded: editing }}
      style={{ marginLeft: embedded ? "auto" : 0 }}
    >
      <Text style={{ fontSize: 14, color: colors.text }}>
        Using{" "}
        <Text
          style={{
            fontWeight: "800",
            color: colors.accentDark,
            textDecorationLine: "underline",
          }}
        >
          {growthRateLbsPerDay.toFixed(3)} lb/day
        </Text>
      </Text>
    </Pressable>
  );

  const body = (
    <>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {embedded ? null : (
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>Weight projections</Text>
          </View>
        )}
        {growthRateControl}
      </View>

      {groups.map((group) => (
        <View key={group.catchDateKey} style={{ marginTop: 12 }}>
          {groups.length > 1 ? (
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 8,
              }}
            >
              Catch {formatCatchShort(group.catchDateKey)}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {group.projections.map((p) => (
              <View
                key={`${group.catchDateKey}-${p.offsetDays}`}
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
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  {p.ageDays}d · {formatCatchShort(p.dateKey)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {groups.length > 1 ? (
        <View style={{ marginTop: 12, gap: 2 }}>
          {catchDatesSorted.map((dateKey) => (
            <Text key={dateKey} style={[styles.muted, { fontSize: 13 }]}>
              Catch {formatCatchShort(dateKey)}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );

  return (
    <View style={{ marginBottom: 16 }}>
      {embedded ? body : <Card>{body}</Card>}

      {editing ? (
        <Card style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>
            Growth rate (lb/day)
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            style={styles.input}
            placeholder={String(DEFAULT_GROWTH_RATE_LBS_PER_DAY)}
            placeholderTextColor={colors.muted}
          />
          <Text style={[styles.muted, { fontSize: 12 }]}>
            Default {DEFAULT_GROWTH_RATE_LBS_PER_DAY}
          </Text>
          {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <PrimaryButton
              label={saving ? "Saving…" : "Save"}
              onPress={() => {
                if (!saving) save();
              }}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label="Cancel"
              secondary
              onPress={() => {
                if (saving) return;
                setEditing(false);
                setError(null);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : null}
    </View>
  );
}
