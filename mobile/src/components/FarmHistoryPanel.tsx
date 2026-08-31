import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  deleteFlock,
  getFarmHistory,
  reactivateFlock,
} from "../repos/data";
import { formatLongScheduleDate } from "../lib/schedule";
import { colors, styles } from "../theme";
import {
  Card,
  Metric,
  PrimaryButton,
  SectionTitle,
  formatNumber,
  formatPct,
} from "./ui";
import { ConfirmDialog } from "./ConfirmDialog";

type HistoryData = ReturnType<typeof getFarmHistory>;
type HistoryRow = HistoryData["all"][number];

function FlockHistoryCard({
  row,
  title,
  onReactivate,
  onDelete,
}: {
  row: HistoryRow;
  title: string;
  onReactivate: (row: HistoryRow) => void;
  onDelete: (row: HistoryRow) => void;
}) {
  const canDelete = row.flockStatus !== "ACTIVE";
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
          <Text style={{ fontWeight: "800", fontSize: 16 }}>{title}</Text>
          <Text style={[styles.muted, { marginTop: 2 }]}>
            {row.flockStatus === "ACTIVE" ? "Active" : "Completed"}
            {" · Placed "}
            {formatLongScheduleDate(row.placementDate)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {canDelete ? (
            <Pressable
              accessibilityLabel={`Delete flock ${row.flockNumber}`}
              onPress={() => onDelete(row)}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.muted} />
            </Pressable>
          ) : null}
          {canDelete ? (
            <PrimaryButton
              label="Make active"
              secondary
              onPress={() => onReactivate(row)}
            />
          ) : null}
        </View>
      </View>
      <View style={[styles.row, { marginTop: 12 }]}>
        <Metric label="Birds placed" value={formatNumber(row.birdsPlaced)} />
        <Metric
          label="Catch date"
          value={row.catchDate ? formatLongScheduleDate(row.catchDate) : "—"}
        />
        <Metric label="Market age" value={row.marketAge != null ? `${row.marketAge}d` : "—"} />
        <Metric
          label="Mortality"
          value={
            row.birdsPlaced > 0
              ? `${formatNumber(row.cumulativeMortality)} (${formatPct(row.mortPct)})`
              : formatNumber(row.cumulativeMortality)
          }
        />
        <Metric
          label="Livability"
          value={row.livability != null ? formatPct(row.livability) : "—"}
        />
      </View>
      {row.houseMortPcts.length > 0 ? (
        <Text style={[styles.muted, { marginTop: 4, fontSize: 12 }]}>
          Houses:{" "}
          {row.houseMortPcts
            .map((h) => `${h.houseNumber} ${formatPct(h.mortPct)}`)
            .join(" · ")}
        </Text>
      ) : null}
    </Card>
  );
}

export function FarmHistoryPanel({ farmId }: { farmId: string }) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "reactivate"; row: HistoryRow }
    | { kind: "delete"; row: HistoryRow }
    | null
  >(null);

  const load = useCallback(() => {
    if (!farmId) {
      setError(null);
      setData(null);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setData(getFarmHistory(farmId));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function runConfirm() {
    if (!confirm) return;
    try {
      if (confirm.kind === "reactivate") reactivateFlock(confirm.row.id);
      else deleteFlock(farmId, confirm.row.id);
      setConfirm(null);
      load();
    } catch (e) {
      setConfirm(null);
      setError(e instanceof Error ? e.message : "Could not update flock");
    }
  }

  return (
    <View>
      {error ? (
        <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>
      ) : null}
      {loading && !data ? (
        <Text style={[styles.muted, { marginBottom: 12 }]}>Loading history…</Text>
      ) : null}

      {data?.current ? (
        <FlockHistoryCard
          row={data.current}
          title={
            data.current.flockStatus === "ACTIVE"
              ? `Current flock — ${data.current.flockNumber}`
              : `Latest flock — ${data.current.flockNumber}`
          }
          onReactivate={(row) => setConfirm({ kind: "reactivate", row })}
          onDelete={(row) => setConfirm({ kind: "delete", row })}
        />
      ) : (
        <Card>
          <Text style={styles.muted}>
            {farmId ? "No flocks recorded for this farm." : "Select a farm."}
          </Text>
        </Card>
      )}

      <SectionTitle>Previous 3 Flocks</SectionTitle>
      {data?.previous.length ? (
        data.previous.map((row) => (
          <FlockHistoryCard
            key={row.id}
            row={row}
            title={`Flock ${row.flockNumber}`}
            onReactivate={(r) => setConfirm({ kind: "reactivate", row: r })}
            onDelete={(r) => setConfirm({ kind: "delete", row: r })}
          />
        ))
      ) : (
        <Card>
          <Text style={styles.muted}>No completed previous flocks to compare.</Text>
        </Card>
      )}

      {data && data.all.length > 0 ? (
        <>
          <SectionTitle>All Flocks</SectionTitle>
          {data.all.map((row) => (
            <Card key={`all-${row.id}`}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontWeight: "800" }}>
                    {row.flockNumber}
                    <Text style={{ fontWeight: "600", color: colors.muted }}>
                      {" "}
                      · {row.flockStatus === "ACTIVE" ? "Active" : "Completed"}
                    </Text>
                  </Text>
                  <Text style={[styles.muted, { marginTop: 4 }]}>
                    Placed {row.placementDate}
                    {row.catchDate ? ` · Catch ${row.catchDate}` : ""}
                    {row.marketAge != null ? ` · ${row.marketAge}d` : ""}
                    {" · Mort "}
                    {formatPct(row.mortPct)}
                  </Text>
                </View>
                {row.flockStatus !== "ACTIVE" ? (
                  <Pressable
                    accessibilityLabel={`Delete flock ${row.flockNumber}`}
                    onPress={() => setConfirm({ kind: "delete", row })}
                    hitSlop={8}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <ConfirmDialog
        visible={confirm != null}
        title={
          confirm?.kind === "reactivate"
            ? "Make flock active?"
            : confirm
              ? `Delete flock ${confirm.row.flockNumber}?`
              : ""
        }
        message={
          confirm?.kind === "reactivate"
            ? `Make flock ${confirm.row.flockNumber} active again?`
            : "This permanently removes the flock and its mortality, feed, and LFO records. This cannot be undone."
        }
        confirmLabel={confirm?.kind === "reactivate" ? "Make active" : "Delete"}
        danger={confirm?.kind === "delete"}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}
