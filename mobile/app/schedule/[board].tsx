import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { DatePickerField } from "../../src/components/DatePickerField";
import { OneDotName } from "../../src/components/OneDotName";
import {
  addScheduleVisit,
  getDashboard,
  listScheduleFarmChoices,
  toggleFollowUpCompletion,
} from "../../src/repos/data";
import {
  catchRowHouseNumber,
  formatCatchDateLabel,
  formatCatchHouseLabel,
} from "../../src/lib/catchHouses";
import { getAppTimeZone } from "../../src/lib/appSettings";
import { addDaysKey, todayKey } from "../../src/lib/ids";
import {
  applyIncomingScheduleChecks,
  formatShortScheduleDate,
  rememberScheduleCheckKey,
} from "../../src/lib/schedule";
import { compactCatchTimeLabel } from "../../src/lib/time-slots";
import { VISIT_TYPE_LABELS, VISIT_TYPE_OPTIONS } from "../../src/lib/visits";
import { appScrollProps, colors, styles } from "../../src/theme";

type Board = "today" | "upcoming" | "catches";
type Dashboard = ReturnType<typeof getDashboard>;
type ScheduleItem = Dashboard["todaysSchedule"][number];

const TITLES: Record<Board, string> = {
  today: "Today's Schedule",
  upcoming: "Upcoming Visits",
  catches: "Upcoming Catches",
};

function asBoard(value: string | string[] | undefined): Board {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "upcoming" || raw === "catches" || raw === "today") return raw;
  return "today";
}

export default function ScheduleBoardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ board: string }>();
  const board = asBoard(params.board);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const userCleared = useRef(new Set<string>());
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"visit" | "today" | "upcoming" | null>(null);
  const [farmId, setFarmId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [visitType, setVisitType] = useState("ROUTINE_SERVICE");
  const [otherReason, setOtherReason] = useState("");
  const [typeOpen, setTypeOpen] = useState(false);
  const [farms, setFarms] = useState<Array<{ id: string; farm_name: string }>>([]);

  const load = useCallback(() => {
    setData(getDashboard(board));
    setFarms(listScheduleFarmChoices());
  }, [board]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visits =
    board === "today"
      ? (data?.todaysSchedule ?? [])
      : (data?.upcomingSchedule ?? []).filter((item) => item.date > todayKey());
  const serverSignature = useMemo(
    () => visits.map((item) => `${rememberScheduleCheckKey(item)}:${item.completed}`).join("|"),
    [visits],
  );

  useEffect(() => {
    setChecked((prev) => applyIncomingScheduleChecks(prev, visits, userCleared.current));
  }, [serverSignature, visits]);

  function toggle(item: ScheduleItem) {
    const key = `${item.farmId}-${item.flockId}-${item.date}-${item.label}`;
    const rememberKey = rememberScheduleCheckKey(item);
    if (pendingKey === key) return;
    const next = !(checked[rememberKey] ?? item.completed);
    if (next) userCleared.current.delete(rememberKey);
    else userCleared.current.add(rememberKey);
    setChecked((prev) => ({ ...prev, [rememberKey]: next }));
    setPendingKey(key);
    try {
      toggleFollowUpCompletion({
        farmId: item.farmId,
        flockId: item.flockId,
        scheduledDate: item.date,
        label: item.label,
        completed: next,
      });
      load();
    } catch {
      if (next) userCleared.current.add(rememberKey);
      else userCleared.current.delete(rememberKey);
      setChecked((prev) => ({ ...prev, [rememberKey]: !next }));
    } finally {
      setPendingKey(null);
    }
  }

  function openSheet(mode: "visit" | "today" | "upcoming") {
    setError(null);
    setFarmId(farms[0]?.id ?? "");
    setDate(mode === "upcoming" ? addDaysKey(todayKey(), 1) : todayKey());
    setVisitType("ROUTINE_SERVICE");
    setOtherReason("");
    setTypeOpen(false);
    setSheet(mode);
  }

  function saveVisit() {
    const nextLabel =
      visitType === "OTHER" ? otherReason.trim() : (VISIT_TYPE_LABELS[visitType] ?? visitType);
    const nextDate = sheet === "today" ? todayKey() : date;
    if (!farmId || !nextDate) {
      setError("Choose a farm and a date.");
      return;
    }
    if (visitType === "OTHER" && !nextLabel) {
      setError("Enter a reason for this visit.");
      return;
    }
    if (sheet === "upcoming" && nextDate <= todayKey()) {
      setError("Pick a date after today.");
      return;
    }
    addScheduleVisit({ farmId, date: nextDate, label: nextLabel });
    setSheet(null);
    setError(null);
    load();
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} {...appScrollProps}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: colors.accentDark, fontSize: 17, fontWeight: "800" }}>‹ Dashboard</Text>
          </Pressable>
          <Text style={[styles.title, { flex: 1, textAlign: "right" }]} numberOfLines={1}>
            {TITLES[board]}
          </Text>
        </View>
        {error && !sheet ? <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text> : null}

        {board === "catches" ? (
          <View style={{ marginTop: 12 }}>
            {(data?.upcomingCatches.length ?? 0) === 0 ? (
              <Text style={styles.muted}>None</Text>
            ) : (
              data?.upcomingCatches.map((c) => {
                const houseNumber = catchRowHouseNumber(c);
                const houseLabel = formatCatchHouseLabel(houseNumber);
                return (
                  <Pressable
                    key={`${c.farmId}-${houseNumber ?? ""}-${c.date}`}
                    onPress={() =>
                      router.navigate({
                        pathname: "/(tabs)/farms/[id]",
                        params: { id: c.farmId },
                      })
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "baseline" }}>
                      <OneDotName text={c.farmName} style={{ fontWeight: "700", color: colors.text }} />
                      {houseLabel ? (
                        <Text style={{ color: colors.muted, marginLeft: 4 }}>{houseLabel}</Text>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>
                      {formatCatchDateLabel(c.date, getAppTimeZone())}
                      {c.catchTime ? ` ${compactCatchTimeLabel(c.catchTime)}` : ""}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pressable onPress={() => openSheet("visit")} style={[styles.button, { minHeight: 40, paddingHorizontal: 14 }]}>
                <Text style={styles.buttonText}>Add visit</Text>
              </Pressable>
              <Pressable
                onPress={() => openSheet(board === "upcoming" ? "upcoming" : "today")}
                style={[styles.button, styles.buttonSecondary, { minHeight: 40, paddingHorizontal: 14 }]}
              >
                <Text style={styles.buttonSecondaryText}>
                  {board === "upcoming" ? "Add to upcoming" : "Add to today's schedule"}
                </Text>
              </Pressable>
            </View>
            {visits.length === 0 ? <Text style={[styles.muted, { marginTop: 12 }]}>None</Text> : null}
            {visits.map((item) => {
              const key = `${item.farmId}-${item.flockId}-${item.date}-${item.label}`;
              const isDone = checked[rememberScheduleCheckKey(item)] ?? item.completed;
              return (
                <View
                  key={key}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, opacity: isDone ? 0.5 : 1 }}
                >
                  <Pressable
                    onPress={() => toggle(item)}
                    disabled={pendingKey === key}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      borderWidth: isDone ? 0 : 1.5,
                      borderColor: "#a8a29e",
                      backgroundColor: isDone ? colors.accentDark : "#fff",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isDone ? <Text style={{ color: "#fff", fontWeight: "900" }}>✓</Text> : null}
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.navigate({ pathname: "/(tabs)/farms/[id]", params: { id: item.farmId } })
                    }
                    style={{ flex: 1, flexDirection: "row", alignItems: "baseline" }}
                  >
                    <OneDotName
                      text={item.farmName}
                      style={{
                        fontWeight: "700",
                        color: colors.text,
                        textDecorationLine: isDone ? "line-through" : "none",
                      }}
                    />
                    {item.flockNumber && item.flockAgeDays != null ? (
                      <Text style={{ color: colors.muted, marginLeft: 4 }}>{item.flockAgeDays}d</Text>
                    ) : null}
                  </Pressable>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
                    {item.label} {formatShortScheduleDate(item.date)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={sheet != null} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable
          onPress={() => setSheet(null)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end", padding: 12 }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{ maxHeight: "70%", backgroundColor: "#fff", borderRadius: 16, padding: 16 }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
              {sheet === "today"
                ? "Add to today's schedule"
                : sheet === "upcoming"
                  ? "Add to upcoming"
                  : "Add visit"}
            </Text>
            <Text style={{ marginTop: 12, fontWeight: "700", color: colors.text }}>Farm</Text>
            <ScrollView style={{ maxHeight: 140, marginTop: 6 }}>
              {farms.map((farm) => (
                <Pressable key={farm.id} onPress={() => setFarmId(farm.id)} style={{ paddingVertical: 8 }}>
                  <Text style={{ fontWeight: farm.id === farmId ? "800" : "500", color: colors.text }}>
                    {farm.farm_name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={{ marginTop: 8, fontWeight: "700", color: colors.text }}>Visit type</Text>
            <Pressable
              onPress={() => setTypeOpen((open) => !open)}
              style={[
                styles.input,
                {
                  marginTop: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                },
              ]}
            >
              <Text style={{ fontWeight: "700", color: colors.text }}>
                {VISIT_TYPE_LABELS[visitType] ?? visitType}
              </Text>
              <Text style={{ color: colors.muted, fontWeight: "800" }}>▾</Text>
            </Pressable>
            {typeOpen ? (
              <ScrollView style={{ maxHeight: 180 }}>
                {VISIT_TYPE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      setVisitType(opt.value);
                      setTypeOpen(false);
                    }}
                    style={{ paddingVertical: 10 }}
                  >
                    <Text
                      style={{
                        fontWeight: visitType === opt.value ? "800" : "600",
                        color: colors.text,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {visitType === "OTHER" ? (
              <>
                <Text style={{ marginTop: 8, fontWeight: "700", color: colors.text }}>Reason</Text>
                <TextInput
                  value={otherReason}
                  onChangeText={setOtherReason}
                  placeholder="Reason for this visit"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { marginTop: 6 }]}
                />
              </>
            ) : null}
            {sheet === "today" ? (
              <Text style={{ marginTop: 8, color: colors.muted }}>Date {formatShortScheduleDate(todayKey())}</Text>
            ) : (
              <DatePickerField label="Date" value={date} onChange={setDate} presentation="inline" />
            )}
            {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}
            <Pressable onPress={saveVisit} style={styles.button}>
              <Text style={styles.buttonText}>Add</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
