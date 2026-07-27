import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { DEFAULT_GROWTH_RATE_LBS_PER_DAY } from "../lib/weight/projections";
import { colors, styles } from "../theme";
import { PrimaryButton } from "./ui";

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
}: {
  groups: WeightProjectionGroup[];
  growthRateLbsPerDay: number;
  onSaveGrowthRate: (rate: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(growthRateLbsPerDay));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (groups.length === 0) return null;

  const catchDatesSorted = groups.map((g) => g.catchDateKey);

  function startEdit() {
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

  return (
    <View
      style={{
        marginTop: 14,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <View style={{ flex: 1, minWidth: 160 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.muted }}>
            Weight projections
          </Text>
          <Text style={[styles.muted, { marginTop: 2, fontSize: 13 }]}>
            Age at kill × growth rate
          </Text>
        </View>
        <Text style={{ fontSize: 14, color: colors.text }}>
          Using{" "}
          <Text style={{ fontWeight: "800" }}>{growthRateLbsPerDay.toFixed(3)} lb/day</Text>
        </Text>
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

      {!editing ? (
        <Pressable onPress={startEdit} style={{ marginTop: groups.length > 1 ? 10 : 12 }}>
          <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: 13 }}>
            Edit growth rate
          </Text>
        </Pressable>
      ) : (
        <View style={{ marginTop: 12, gap: 10 }}>
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
            Default {DEFAULT_GROWTH_RATE_LBS_PER_DAY} · Weight = days of age × GR
          </Text>
          {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
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
        </View>
      )}
    </View>
  );
}
