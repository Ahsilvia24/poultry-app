import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors, styles } from "../theme";
import { farmGroupKey, summarizePlacementRows, type PlacementRow } from "../lib/placementImport/parse";
import {
  PLACEMENT_FIX_CHIPS,
  addBlankPlacementFarm,
  addPlacementHouseRow,
  buildPlacementReviewIssues,
  patchPlacementRowAt,
  removePlacementRowAt,
  renamePlacementFarm,
  rowsForFarm,
  type PlacementExtractHint,
  type PlacementFixChipId,
} from "../lib/placementImport/review";

type Props = {
  rows: PlacementRow[];
  farmKey: string;
  farmName: string;
  farmCode: string;
  farmOptions: Array<{ key: string; farmName: string; farmCode: string }>;
  stats: PlacementExtractHint | null;
  onChangeRows: (rows: PlacementRow[]) => void;
  onSelectFarm: (farmKey: string) => void;
  onClose: () => void;
};

function Field({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  flex = 1,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: "default" | "number-pad" | "numeric";
  flex?: number;
}) {
  return (
    <View style={{ flex, minWidth: 0 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: colors.muted, marginBottom: 2 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="characters"
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 7,
          fontSize: 13,
          fontWeight: "600",
          color: colors.text,
          backgroundColor: "#fff",
        }}
      />
    </View>
  );
}

export function PlacementImportReview({
  rows,
  farmKey,
  farmName,
  farmCode,
  farmOptions,
  stats,
  onChangeRows,
  onSelectFarm,
  onClose,
}: Props) {
  const [chips, setChips] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [editName, setEditName] = useState(farmName);
  const [editCode, setEditCode] = useState(farmCode);

  const issues = useMemo(() => buildPlacementReviewIssues(rows, stats), [rows, stats]);
  const summary = useMemo(() => summarizePlacementRows(rows), [rows]);
  const farmRows = useMemo(() => rowsForFarm(rows, farmKey), [rows, farmKey]);

  const activeChipIds = Object.entries(chips)
    .filter(([, on]) => on)
    .map(([id]) => id as PlacementFixChipId);

  function toggleChip(id: string) {
    setChips((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function applyFarmIdentity() {
    onChangeRows(renamePlacementFarm(rows, farmKey, editName, editCode));
  }

  return (
    <View
      style={{
        marginTop: 12,
        borderWidth: 1,
        borderColor: "#fde68a",
        backgroundColor: "#fffbeb",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <View style={[styles.row, { justifyContent: "space-between", alignItems: "center" }]}>
        <Text style={{ fontWeight: "800", color: colors.text, fontSize: 14 }}>
          Fix what’s wrong (offline)
        </Text>
        <Pressable onPress={onClose}>
          <Text style={{ fontWeight: "700", color: colors.muted, fontSize: 12 }}>Done</Text>
        </Pressable>
      </View>

      <Text style={[styles.muted, { marginTop: 6, fontSize: 12, lineHeight: 17 }]}>
        Review {summary.farmCount} farms · {summary.houseCount} houses ·{" "}
        {summary.birdsSent.toLocaleString()} birds
        {stats?.expectedRows ? ` (PDF hint ~${stats.expectedRows})` : ""}. Edit below — no
        internet needed.
      </Text>

      {issues.length > 0 ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          {issues.map((issue) => (
            <Text
              key={issue.id}
              style={{
                fontSize: 12,
                lineHeight: 16,
                fontWeight: "600",
                color: issue.severity === "warn" ? colors.warn : colors.text,
              }}
            >
              {issue.severity === "warn" ? "⚠ " : "• "}
              {issue.message}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={{ marginTop: 8, fontSize: 12, color: colors.accentDark, fontWeight: "700" }}>
          Looks complete — still edit anything that isn’t right.
        </Text>
      )}

      <Text style={{ marginTop: 12, fontWeight: "800", color: colors.text, fontSize: 12 }}>
        What’s wrong?
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {PLACEMENT_FIX_CHIPS.map((chip) => {
          const on = Boolean(chips[chip.id]);
          return (
            <Pressable
              key={chip.id}
              onPress={() => toggleChip(chip.id)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: on ? colors.accentDark : colors.border,
                backgroundColor: on ? "#d1fae5" : "#fff",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: on ? colors.accentDark : colors.text,
                }}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Optional: describe the mistake (kept on this screen only)"
        placeholderTextColor={colors.muted}
        multiline
        style={{
          marginTop: 8,
          minHeight: 56,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          fontSize: 13,
          color: colors.text,
          backgroundColor: "#fff",
          textAlignVertical: "top",
        }}
      />

      {activeChipIds.includes("missing_farms") ? (
        <Pressable
          onPress={() => onChangeRows(addBlankPlacementFarm(rows))}
          style={{ marginTop: 8 }}
        >
          <Text style={{ fontWeight: "800", color: colors.accentDark, fontSize: 12 }}>
            + Add a missing farm
          </Text>
        </Pressable>
      ) : null}

      <View
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: "#f3e8c8",
        }}
      >
        <Text style={{ fontWeight: "800", color: colors.text, marginBottom: 6 }}>
          Edit farm: {farmName}
        </Text>
        {farmOptions.length > 1 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {farmOptions.map((opt) => {
              const active = opt.key === farmKey;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => onSelectFarm(opt.key)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    borderRadius: 7,
                    borderWidth: 1,
                    borderColor: active ? colors.accentDark : colors.border,
                    backgroundColor: active ? "#d1fae5" : "#fff",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: active ? colors.accentDark : colors.text,
                    }}
                    numberOfLines={1}
                  >
                    {opt.farmName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field label="Farm name" value={editName} onChangeText={setEditName} flex={1.4} />
          <Field label="Code" value={editCode} onChangeText={setEditCode} flex={0.8} />
        </View>
        <Pressable onPress={applyFarmIdentity} style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: "800", color: colors.accentDark, fontSize: 12 }}>
            Apply name / code to all houses on this farm
          </Text>
        </Pressable>

        {farmRows.map(({ index, row }) => (
          <View
            key={`${farmKey}-${index}-${row.houseNo}`}
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "#fff",
            }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Field
                label="House"
                value={String(row.houseNo)}
                keyboardType="number-pad"
                onChangeText={(t) =>
                  onChangeRows(
                    patchPlacementRowAt(rows, index, { houseNo: Number(t.replace(/\D/g, "")) || 1 }),
                  )
                }
                flex={0.55}
              />
              <Field
                label="Date placed"
                value={row.datePlaced}
                onChangeText={(t) =>
                  onChangeRows(patchPlacementRowAt(rows, index, { datePlaced: t }))
                }
                flex={1}
              />
              <Field
                label="Birds sent"
                value={String(row.numberSent || "")}
                keyboardType="number-pad"
                onChangeText={(t) =>
                  onChangeRows(
                    patchPlacementRowAt(rows, index, {
                      numberSent: Number(t.replace(/[^\d]/g, "")) || 0,
                    }),
                  )
                }
                flex={0.9}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Field
                label="Flock"
                value={row.flockId}
                onChangeText={(t) =>
                  onChangeRows(patchPlacementRowAt(rows, index, { flockId: t }))
                }
              />
            </View>
            <Pressable
              onPress={() => onChangeRows(removePlacementRowAt(rows, index))}
              style={{ marginTop: 8, alignSelf: "flex-start" }}
            >
              <Text style={{ fontWeight: "700", color: colors.danger, fontSize: 12 }}>
                Remove this house
              </Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={() => {
            const currentKey = farmGroupKey(editCode || farmCode, editName || farmName);
            const live = rowsForFarm(rows, currentKey)[0]?.row;
            onChangeRows(
              addPlacementHouseRow(rows, {
                farmCode: editCode || farmCode,
                farmName: editName || farmName,
                flockId: live?.flockId,
                datePlaced: live?.datePlaced,
              }),
            );
          }}
          style={{ marginTop: 10 }}
        >
          <Text style={{ fontWeight: "800", color: colors.accentDark, fontSize: 12 }}>
            + Add house to this farm
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
