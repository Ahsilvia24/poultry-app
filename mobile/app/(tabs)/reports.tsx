import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getFieldLog,
  getGeneratorLogReport,
  getMortalityByHouse,
  getMortalityByPercentage,
  getMortalityCumulativeByAge,
  getReports,
  listFarms,
  type MortalityHouseRow,
  type MortalityPctRow,
} from "../../src/repos/data";
import { addDaysKey, todayKey } from "../../src/lib/ids";
import {
  defaultFieldLogRange,
  FIELD_LOG_FARM_NAME_CHARS,
  fieldLogHasVisits,
  fieldLogVisitTypeLabel,
  fieldLogWeeksToTsv,
  formatFieldLogDayHeader,
  truncateFarmName,
  type FieldLogWeek,
} from "../../src/lib/reports/field-log";
import {
  buildGeneratorReportView,
  formatGeneratorReportDate,
  formatGeneratorReportHours,
  generatorReportToTsv,
  type GeneratorReportFarm,
} from "../../src/lib/reports/generator-log";
import { formatMortalityReportDate } from "../../src/lib/reports/mortality-matrix";
import { shareFieldLogPdf } from "../../src/lib/reports/shareFieldLogPdf";
import { shareGeneratorReportPdf } from "../../src/lib/reports/shareGeneratorPdf";
import { shareMortalityReportPdf } from "../../src/lib/reports/shareMortalityPdf";
import { shareTablePdf } from "../../src/lib/reports/shareTablePdf";
import { colors, styles } from "../../src/theme";
import {
  Card,
  Chip,
  formatPct,
  PageHeader,
  PrimaryButton,
} from "../../src/components/ui";
import { DatePickerField } from "../../src/components/DatePickerField";
import { ClipboardIconButton } from "../../src/components/ClipboardIconButton";
import { SharePdfIconButton } from "../../src/components/SharePdfIconButton";
import { getServiceTech } from "../../src/lib/appSettings";
import { userFacingMessage } from "../../src/lib/useKeyboardInset";

const REPORT_TYPES = [
  { key: "field-log", label: "Field Log" },
  { key: "generator", label: "Generator" },
  { key: "mortality", label: "Mortality" },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["key"];

function formatDateHeader(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function matrixToTsv(
  matrix: ReturnType<typeof getReports>,
  rowHeaderLabel: string,
) {
  const header = [rowHeaderLabel, ...matrix.dates.map(formatDateHeader), "Total"];
  const lines = matrix.rows.map((row) => {
    const values = matrix.dates.map((d) => row.byDate[d] ?? 0);
    const total = values.reduce((sum, n) => sum + n, 0);
    return [row.houseLabel, ...values, total].join("\t");
  });
  return [header.join("\t"), ...lines].join("\n");
}

function resolveMobileReportType(raw: string): ReportType {
  if (raw === "generator" || raw === "mortality") return raw;
  return "field-log";
}

function oldestFarmId(farms: Array<{ id: string; placementDate: string | null }>) {
  return (
    farms
      .slice()
      .sort((a, b) => (a.placementDate ?? "9999").localeCompare(b.placementDate ?? "9999"))[0]
      ?.id ?? ""
  );
}

export default function ReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmId?: string | string[];
    type?: string | string[];
  }>();
  const farmIdParam = paramId(params.farmId);
  const typeParam = paramId(params.type);
  const farms = useMemo(() => listFarms().farms, []);
  const weekDefaults = useMemo(() => defaultFieldLogRange(), []);
  const initialFarmId = farmIdParam || farms[0]?.id || "";
  const initialMortFrom =
    farms.find((farm) => farm.id === initialFarmId)?.placementDate ??
    addDaysKey(todayKey(), -14);
  const [reportType, setReportType] = useState<ReportType>(() =>
    resolveMobileReportType(typeParam),
  );
  const [farmId, setFarmId] = useState(initialFarmId);
  const [genFarmId, setGenFarmId] = useState("");
  const [from, setFrom] = useState(initialMortFrom);
  const [to, setTo] = useState(todayKey());
  const [genFrom, setGenFrom] = useState(addDaysKey(todayKey(), -28));
  const [genTo, setGenTo] = useState(todayKey());
  const [fieldFrom, setFieldFrom] = useState(weekDefaults.from);
  const [fieldTo, setFieldTo] = useState(weekDefaults.to);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [matrix, setMatrix] = useState(() =>
    getReports(initialMortFrom, todayKey(), initialFarmId || undefined),
  );
  const [pctRows, setPctRows] = useState<MortalityPctRow[]>(() =>
    getMortalityByPercentage(initialMortFrom, todayKey(), initialFarmId || undefined),
  );
  const [houseRows, setHouseRows] = useState<MortalityHouseRow[]>(() =>
    getMortalityByHouse(initialMortFrom, todayKey(), initialFarmId || undefined),
  );
  const [ageSeries, setAgeSeries] = useState(() =>
    getMortalityCumulativeByAge(initialMortFrom, todayKey(), initialFarmId || undefined),
  );
  const [fieldWeeks, setFieldWeeks] = useState<FieldLogWeek[]>(() =>
    getFieldLog(weekDefaults.from, weekDefaults.to),
  );
  const [genFarms, setGenFarms] = useState<GeneratorReportFarm[]>(() =>
    getGeneratorLogReport(genFrom, genTo),
  );
  const genView = useMemo(() => buildGeneratorReportView(genFarms), [genFarms]);
  const selectedGenFarmName = useMemo(() => {
    if (!genFarmId) return null;
    return farms.find((f) => f.id === genFarmId)?.farmName ?? null;
  }, [genFarmId, farms]);
  const genFilterLabel = useMemo(() => {
    const range = `${formatGeneratorReportDate(genFrom)} to ${formatGeneratorReportDate(genTo)}`;
    return selectedGenFarmName ? `${selectedGenFarmName} · ${range}` : `All farms · ${range}`;
  }, [genFrom, genTo, selectedGenFarmName]);
  const fieldFilterLabel = useMemo(
    () => `${formatFieldLogDayHeader(fieldFrom)} to ${formatFieldLogDayHeader(fieldTo)}`,
    [fieldFrom, fieldTo],
  );
  const mortFilterLabel = useMemo(
    () => `${formatMortalityReportDate(from)} to ${formatMortalityReportDate(to)}`,
    [from, to],
  );

  const selectedFarmName = useMemo(() => {
    if (!farmId) return null;
    return farms.find((f) => f.id === farmId)?.farmName ?? null;
  }, [farmId, farms]);

  const allFarms = !farmId;
  const displayFarmId = allFarms ? oldestFarmId(farms) : farmId;
  const displayFarmName =
    farms.find((farm) => farm.id === displayFarmId)?.farmName ?? selectedFarmName;
  const entityHeader = allFarms ? "Farm" : "House";
  const rowHeaderLabel = "House";
  const displayMatrix = {
    dates: matrix.dates,
    rows: allFarms
      ? matrix.rows
          .filter((row) => row.farmId === displayFarmId)
          .map((row) => ({ ...row, houseLabel: `House ${row.houseNumber}` }))
      : matrix.rows,
  };
  const displayHouseRows = allFarms
    ? houseRows
        .filter((row) => row.farmId === displayFarmId)
        .map((row) => ({ ...row, houseLabel: `House ${row.houseNumber}` }))
    : houseRows;
  const displayAgePoints = allFarms
    ? (ageSeries.find((row) => row.farmId === displayFarmId)?.points ?? [])
    : (ageSeries[0]?.points ?? []);

  useEffect(() => {
    if (typeParam === "history") {
      router.replace({
        pathname: "/farm-history",
        params: farmIdParam ? { farmId: farmIdParam } : {},
      });
      return;
    }
    if (typeParam) setReportType(resolveMobileReportType(typeParam));
  }, [typeParam, farmIdParam, router]);

  useEffect(() => {
    if (farmIdParam) {
      setFarmId(farmIdParam);
      applyMortality(farmIdParam, from, to);
    }
  }, [farmIdParam, from, to]);

  function applyMortality(nextFarmId = farmId, nextFrom = from, nextTo = to) {
    const farmFilter = nextFarmId || undefined;
    setMatrix(getReports(nextFrom, nextTo, farmFilter));
    setPctRows(getMortalityByPercentage(nextFrom, nextTo, farmFilter));
    setHouseRows(getMortalityByHouse(nextFrom, nextTo, farmFilter));
    setAgeSeries(getMortalityCumulativeByAge(nextFrom, nextTo, farmFilter));
  }

  function selectMortalityFarm(nextFarmId: string) {
    setFarmId(nextFarmId);
    if (!nextFarmId) {
      applyMortality("", from, to);
      return;
    }
    const start =
      farms.find((farm) => farm.id === nextFarmId)?.placementDate ?? from;
    const end = todayKey();
    setFrom(start);
    setTo(end);
    applyMortality(nextFarmId, start, end);
  }

  function applyFieldLog() {
    setFieldWeeks(getFieldLog(fieldFrom, fieldTo));
  }

  function applyGenerator() {
    setGenFarms(getGeneratorLogReport(genFrom, genTo, genFarmId || undefined));
  }

  useEffect(() => {
    if (reportType !== "generator") return;
    setGenFarms(getGeneratorLogReport(genFrom, genTo, genFarmId || undefined));
  }, [reportType, genFrom, genTo, genFarmId]);

  const hasFieldFarms = fieldLogHasVisits(fieldWeeks);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader
          title="Reports"
          actions={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Farm History"
              onPress={() => router.push("/farm-history")}
              style={{
                borderRadius: 10,
                paddingVertical: 8,
                paddingHorizontal: 14,
                backgroundColor: colors.accentDark,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                Farm History
              </Text>
            </Pressable>
          }
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", marginBottom: 12 }}>
            {REPORT_TYPES.map((t) => (
              <Chip
                key={t.key}
                label={t.label}
                active={reportType === t.key}
                onPress={() => {
                  setReportType(t.key);
                  setOpenDate(null);
                  if (t.key === "generator") applyGenerator();
                }}
              />
            ))}
          </View>
        </ScrollView>

        {shareNotice ? (
          <Text style={{ color: colors.danger, fontWeight: "700", marginBottom: 10 }}>
            {shareNotice}
          </Text>
        ) : null}

        {reportType === "field-log" ? (
          <>
            <Card>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField
                    label="Start"
                    value={fieldFrom}
                    onChange={setFieldFrom}
                    expanded={openDate === "fieldFrom"}
                    onOpen={() => setOpenDate("fieldFrom")}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField
                    label="Finish"
                    value={fieldTo}
                    onChange={setFieldTo}
                    expanded={openDate === "fieldTo"}
                    onOpen={() => setOpenDate("fieldTo")}
                  />
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <PrimaryButton
                  label="Run report"
                  onPress={applyFieldLog}
                  style={{ alignSelf: "flex-end", minWidth: 148 }}
                />
              </View>
            </Card>

            <Card style={{ paddingVertical: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>
                    Field Log
                  </Text>
                  <Text style={[styles.muted, { marginTop: 2 }]}>{fieldFilterLabel}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ClipboardIconButton
                    accessibilityLabel="Copy field log"
                    color={colors.accentDark}
                    emptyMessage="No visits in this date range."
                    onNotice={setShareNotice}
                    getText={() => {
                      if (!hasFieldFarms) return "";
                      return fieldLogWeeksToTsv(fieldWeeks);
                    }}
                  />
                  <SharePdfIconButton
                    onPress={() => {
                      setShareNotice(null);
                      void shareFieldLogPdf({
                        weeks: fieldWeeks,
                        subtitle: fieldFilterLabel,
                        technicianName: getServiceTech(),
                      }).catch((e) => {
                        setShareNotice(
                          userFacingMessage(e, "Could not share PDF. Try again in a moment."),
                        );
                      });
                    }}
                    accessibilityLabel="Share field log PDF"
                    color={colors.accentDark}
                  />
                </View>
              </View>
              {fieldWeeks.map((week) => (
                <ScrollView key={week.weekStart} horizontal style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row" }}>
                    {week.days.map((day) => {
                      const weekend = day.weekday === "Saturday" || day.weekday === "Sunday";
                      return (
                        <View
                          key={day.dateKey}
                          style={{
                            width: 112,
                            minHeight: 140,
                            paddingRight: 10,
                            paddingLeft: 4,
                            opacity: day.inRange ? 1 : 0.4,
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: "800",
                              fontSize: 13,
                              color: weekend ? colors.muted : colors.text,
                            }}
                          >
                            {day.weekday}
                          </Text>
                          <Text style={[styles.muted, { marginBottom: 8, fontSize: 12 }]}>
                            {formatFieldLogDayHeader(day.dateKey)}
                          </Text>
                          {day.farms.length === 0 ? (
                            <Text style={styles.muted}>—</Text>
                          ) : (
                            day.farms.map((farm, i) => (
                              <View
                                key={`${day.dateKey}-${i}-${farm.farmName}-${farm.visitType}`}
                                style={{ marginBottom: 8 }}
                              >
                                <Text
                                  style={{ fontWeight: "700", fontSize: 13, color: colors.text }}
                                >
                                  {truncateFarmName(farm.farmName, FIELD_LOG_FARM_NAME_CHARS)}
                                </Text>
                                <Text style={{ fontWeight: "600", fontSize: 11, color: colors.muted }}>
                                  {fieldLogVisitTypeLabel(farm.visitType, farm.notes)}
                                </Text>
                              </View>
                            ))
                          )}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              ))}
              {!hasFieldFarms ? (
                <Text style={styles.muted}>No visits logged in this date range.</Text>
              ) : null}
            </Card>
          </>
        ) : reportType === "generator" ? (
          <>
            <Text style={styles.label}>Farm</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", marginBottom: 8 }}>
                <Chip label="All" active={genFarmId === ""} onPress={() => setGenFarmId("")} />
                {farms.map((f) => (
                  <Chip
                    key={f.id}
                    label={f.farmName}
                    active={genFarmId === f.id}
                    onPress={() => setGenFarmId(f.id)}
                  />
                ))}
              </View>
            </ScrollView>

            <Card>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField
                    label="From"
                    value={genFrom}
                    onChange={setGenFrom}
                    expanded={openDate === "genFrom"}
                    onOpen={() => setOpenDate("genFrom")}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField
                    label="To"
                    value={genTo}
                    onChange={setGenTo}
                    expanded={openDate === "genTo"}
                    onOpen={() => setOpenDate("genTo")}
                  />
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <PrimaryButton
                  label="Apply filters"
                  onPress={applyGenerator}
                  style={{ alignSelf: "flex-end", minWidth: 148 }}
                />
              </View>
            </Card>

            {genView.length === 0 ? (
              <Text style={styles.muted}>No generator hours logged in this date range.</Text>
            ) : (
              <Card style={{ paddingVertical: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>
                      Generator hours
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <ClipboardIconButton
                      accessibilityLabel="Copy generator report"
                      color={colors.accentDark}
                      emptyMessage="No generator hours in this date range."
                      onNotice={setShareNotice}
                      getText={() => generatorReportToTsv(genView)}
                    />
                    <SharePdfIconButton
                      onPress={() => {
                        setShareNotice(null);
                        void shareGeneratorReportPdf({
                          farms: genView,
                          subtitle: genFilterLabel,
                        }).catch((e) => {
                          setShareNotice(
                            userFacingMessage(e, "Could not share PDF. Try again in a moment."),
                          );
                        });
                      }}
                      accessibilityLabel="Share generator report PDF"
                      color={colors.accentDark}
                    />
                  </View>
                </View>
                {genView.map((farm) => (
                  <View key={farm.farmId} style={{ marginTop: 10 }}>
                    <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text, marginBottom: 4 }}>
                      {farm.farmName}
                    </Text>
                    {farm.generators.map((gen) => (
                      <View key={gen.key} style={{ marginTop: 8 }}>
                        <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text, marginBottom: 2 }}>
                          {gen.label}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                          <Text style={{ width: 168, fontSize: 14, fontWeight: "600", color: colors.muted }}>
                            Date
                          </Text>
                          <Text style={{ width: 60, fontSize: 14, fontWeight: "600", color: colors.muted }}>
                            Hours
                          </Text>
                          <Text style={{ width: 80, fontSize: 14, fontWeight: "600", color: colors.muted }}>
                            Exercised
                          </Text>
                        </View>
                        {gen.rows.map((row) => (
                          <View
                            key={`${gen.key}-${row.logDate}`}
                            style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 3 }}
                          >
                            <Text style={{ width: 168, fontSize: 16, fontWeight: "600", color: colors.text }}>
                              {formatGeneratorReportDate(row.logDate)}
                            </Text>
                            <Text style={{ width: 60, fontSize: 16, fontWeight: "600", color: colors.text }}>
                              {formatGeneratorReportHours(row.hours)}
                            </Text>
                            <Text style={{ width: 80, fontSize: 16, fontWeight: "600", color: colors.text }}>
                              {formatGeneratorReportHours(row.exercised)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                ))}
              </Card>
            )}
          </>
        ) : (
          <>
            <Text style={styles.label}>Farm</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", marginBottom: 8 }}>
                <Chip label="All" active={farmId === ""} onPress={() => selectMortalityFarm("")} />
                {farms.map((f) => (
                  <Chip
                    key={f.id}
                    label={f.farmName}
                    active={farmId === f.id}
                    onPress={() => selectMortalityFarm(f.id)}
                  />
                ))}
              </View>
            </ScrollView>

            <Card>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField
                    label="From"
                    value={from}
                    onChange={setFrom}
                    expanded={openDate === "mortFrom"}
                    onOpen={() => setOpenDate("mortFrom")}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField
                    label="To"
                    value={to}
                    onChange={setTo}
                    expanded={openDate === "mortTo"}
                    onOpen={() => setOpenDate("mortTo")}
                  />
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <PrimaryButton
                  label="Apply filters"
                  onPress={() => applyMortality()}
                  style={{ alignSelf: "flex-end", minWidth: 148 }}
                />
              </View>
            </Card>

            <Card style={{ paddingVertical: 12, marginBottom: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: "800", fontSize: 15, color: colors.text, flex: 1 }}>
                  Mortality by Percentage
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ClipboardIconButton
                    accessibilityLabel="Copy mortality by percentage"
                    color={colors.accentDark}
                    emptyMessage="No data for current filters."
                    onNotice={setShareNotice}
                    getText={() => {
                      if (pctRows.length === 0) return "";
                      const header = [entityHeader, "Placed", "Total", "%"].join("\t");
                      const lines = pctRows.map((row) =>
                        [row.label, row.placed, row.total, row.pct.toFixed(2)].join("\t"),
                      );
                      return [header, ...lines].join("\n");
                    }}
                  />
                  <SharePdfIconButton
                    onPress={() => {
                      setShareNotice(null);
                      void shareTablePdf({
                        title: "Mortality by Percentage",
                        filename: `mortality-by-percentage-${Date.now()}.pdf`,
                        headers: [entityHeader, "Placed", "Total", "%"],
                        rows: pctRows.map((row) => [
                          row.label,
                          row.placed,
                          row.total,
                          row.pct.toFixed(2),
                        ]),
                      }).catch((e) => {
                        setShareNotice(
                          userFacingMessage(e, "Could not share PDF. Try again in a moment."),
                        );
                      });
                    }}
                    accessibilityLabel="Share mortality by percentage PDF"
                    color={colors.accentDark}
                  />
                </View>
              </View>
              <Text style={[styles.muted, { marginBottom: 4 }]}>{entityHeader}</Text>
              {pctRows.length === 0 ? (
                <Text style={[styles.muted, { marginTop: 8 }]}>No data for current filters.</Text>
              ) : (
                pctRows.map((row, index) => (
                  <View
                    key={`${row.kind}-${row.label}-${index}`}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 8,
                      paddingLeft: row.kind === "house" ? 12 : 0,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontWeight: row.kind === "farm" ? "800" : "600",
                        color: colors.text,
                      }}
                    >
                      {row.label}
                    </Text>
                    <Text style={{ fontWeight: "700", color: colors.text }}>
                      {formatPct(row.pct)}
                    </Text>
                  </View>
                ))
              )}
            </Card>

            <Card style={{ paddingVertical: 12, marginBottom: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: "800", fontSize: 15, color: colors.text, flex: 1 }}>
                  Mortality by Date
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ClipboardIconButton
                    accessibilityLabel="Copy mortality by date"
                    color={colors.accentDark}
                    emptyMessage="Run a report with data first."
                    onNotice={setShareNotice}
                    getText={() => {
                      if (matrix.rows.length === 0) return "";
                      return matrixToTsv(matrix, rowHeaderLabel);
                    }}
                  />
                  <SharePdfIconButton
                    onPress={() => {
                      setShareNotice(null);
                      void shareMortalityReportPdf({
                        matrix,
                        rowHeaderLabel,
                        subtitle: mortFilterLabel,
                      }).catch((e) => {
                        setShareNotice(
                          userFacingMessage(e, "Could not share PDF. Try again in a moment."),
                        );
                      });
                    }}
                    accessibilityLabel="Share mortality by date PDF"
                    color={colors.accentDark}
                  />
                </View>
              </View>
              <ScrollView horizontal>
                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      marginBottom: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      paddingBottom: 8,
                    }}
                  >
                    <Text
                      style={{ width: 110, fontWeight: "800", color: colors.muted }}
                      numberOfLines={1}
                    >
                      {rowHeaderLabel}
                    </Text>
                    {displayMatrix.dates.map((d) => (
                      <Text
                        key={d}
                        style={{
                          width: 52,
                          textAlign: "center",
                          fontWeight: "700",
                          fontSize: 12,
                          color: colors.muted,
                        }}
                      >
                        {formatDateHeader(d)}
                      </Text>
                    ))}
                    <Text
                      style={{
                        width: 48,
                        textAlign: "right",
                        fontWeight: "800",
                        color: colors.muted,
                      }}
                    >
                      Tot
                    </Text>
                  </View>
                  {displayMatrix.rows.length === 0 ? (
                    <Text style={styles.muted}>No data for range</Text>
                  ) : (
                    displayMatrix.rows.map((row) => {
                      const total = displayMatrix.dates.reduce((s, d) => s + (row.byDate[d] ?? 0), 0);
                      return (
                        <View key={row.houseLabel} style={{ flexDirection: "row", marginBottom: 6 }}>
                          <Text style={{ width: 110, fontWeight: "700" }} numberOfLines={1}>
                            {row.houseLabel}
                          </Text>
                          {displayMatrix.dates.map((d) => {
                            const n = row.byDate[d] ?? 0;
                            return (
                              <Text
                                key={d}
                                style={{
                                  width: 52,
                                  textAlign: "center",
                                  color: n > 0 ? colors.text : colors.muted,
                                  fontWeight: n > 0 ? "700" : "400",
                                }}
                              >
                                {n}
                              </Text>
                            );
                          })}
                          <Text style={{ width: 48, textAlign: "right", fontWeight: "800" }}>
                            {total}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </Card>

            <Card style={{ paddingVertical: 12, marginBottom: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: "800", fontSize: 15, color: colors.text, flex: 1 }}>
                  Mortality by House
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ClipboardIconButton
                    accessibilityLabel="Copy mortality by house"
                    color={colors.accentDark}
                    emptyMessage="No data for current filters."
                    onNotice={setShareNotice}
                    getText={() => {
                      if (houseRows.length === 0) return "";
                      const header = ["House", "Mortality", "Culls", "Total"].join("\t");
                      const lines = houseRows.map((row) =>
                        [row.houseLabel, row.mortality, row.culls, row.total].join("\t"),
                      );
                      return [header, ...lines].join("\n");
                    }}
                  />
                  <SharePdfIconButton
                    onPress={() => {
                      setShareNotice(null);
                      void shareTablePdf({
                        title: "Mortality by House",
                        filename: `mortality-by-house-${Date.now()}.pdf`,
                        headers: ["House", "Mortality", "Culls", "Total"],
                        rows: houseRows.map((row) => [
                          row.houseLabel,
                          row.mortality,
                          row.culls,
                          row.total,
                        ]),
                      }).catch((e) => {
                        setShareNotice(
                          userFacingMessage(e, "Could not share PDF. Try again in a moment."),
                        );
                      });
                    }}
                    accessibilityLabel="Share mortality by house PDF"
                    color={colors.accentDark}
                  />
                </View>
              </View>
              {displayHouseRows.length === 0 ? (
                <Text style={styles.muted}>No data for current filters.</Text>
              ) : (
                displayHouseRows.map((row) => (
                  <View
                    key={`${row.farmId}-${row.houseNumber}`}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ flex: 1, fontWeight: "700", color: colors.text }}>
                      {row.houseLabel}
                    </Text>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{row.total}</Text>
                  </View>
                ))
              )}
            </Card>

            <Card style={{ paddingVertical: 12, marginBottom: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontWeight: "800", fontSize: 15, color: colors.text }}>
                    Cumulative Mortality by Bird Age
                  </Text>
                  {displayFarmName ? (
                    <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text, marginTop: 4 }}>
                      {displayFarmName}
                    </Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ClipboardIconButton
                    accessibilityLabel="Copy cumulative mortality"
                    color={colors.accentDark}
                    emptyMessage="No data for current filters."
                    onNotice={setShareNotice}
                    getText={() => {
                      const points = ageSeries.flatMap((series) =>
                        series.points.map((point) => [series.farmName, point.birdAgeInDays, point.cumulative]),
                      );
                      if (points.length === 0) return "";
                      const header = ["Farm", "Bird age (days)", "Cumulative"].join("\t");
                      return [header, ...points.map((row) => row.join("\t"))].join("\n");
                    }}
                  />
                  <SharePdfIconButton
                    onPress={() => {
                      setShareNotice(null);
                      void shareTablePdf({
                        title: "Cumulative Mortality by Bird Age",
                        filename: `mortality-by-age-${Date.now()}.pdf`,
                        headers: ["Farm", "Age (days)", "Cumulative"],
                        rows: ageSeries.flatMap((series) =>
                          series.points.map((point) => [
                            series.farmName,
                            point.birdAgeInDays,
                            point.cumulative,
                          ]),
                        ),
                      }).catch((e) => {
                        setShareNotice(
                          userFacingMessage(e, "Could not share PDF. Try again in a moment."),
                        );
                      });
                    }}
                    accessibilityLabel="Share cumulative mortality PDF"
                    color={colors.accentDark}
                  />
                </View>
              </View>
              {displayAgePoints.length === 0 ? (
                <Text style={styles.muted}>No data for current filters.</Text>
              ) : (
                displayAgePoints.map((point) => (
                  <View
                    key={point.birdAgeInDays}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ fontWeight: "600", color: colors.text }}>
                      Day {point.birdAgeInDays}
                    </Text>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{point.cumulative}</Text>
                  </View>
                ))
              )}
            </Card>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <PrimaryButton
                label="Export CSV"
                onPress={() => {
                  const header = [entityHeader, "Placed", "Total", "%"].join(",");
                  const pct = pctRows.map((row) =>
                    [row.label, row.placed, row.total, row.pct.toFixed(2)].join(","),
                  );
                  const house = [
                    "House,Mortality,Culls,Total",
                    ...houseRows.map((row) =>
                      [row.houseLabel, row.mortality, row.culls, row.total].join(","),
                    ),
                  ];
                  const age = [
                    "Farm,Bird age (days),Cumulative",
                    ...ageSeries.flatMap((series) =>
                      series.points.map((point) =>
                        [series.farmName, point.birdAgeInDays, point.cumulative].join(","),
                      ),
                    ),
                  ];
                  const text = [
                    header,
                    ...pct,
                    "",
                    ...house,
                    "",
                    matrixToTsv(matrix, rowHeaderLabel).replace(/\t/g, ","),
                    "",
                    ...age,
                  ].join("\n");
                  void import("expo-clipboard")
                    .then((Clipboard) => Clipboard.setStringAsync(text))
                    .then(() => setShareNotice(null))
                    .catch(() => setShareNotice("Could not copy CSV on this device."));
                }}
                style={{ minWidth: 148 }}
              />
              <PrimaryButton
                label="Export PDF"
                secondary
                onPress={() => {
                  setShareNotice(null);
                  void shareMortalityReportPdf({
                    matrix,
                    rowHeaderLabel,
                    subtitle: mortFilterLabel,
                  }).catch((e) => {
                    setShareNotice(
                      userFacingMessage(e, "Could not share PDF. Try again in a moment."),
                    );
                  });
                }}
                style={{ minWidth: 148 }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
