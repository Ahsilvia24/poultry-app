import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { getFieldLog, getGeneratorLogReport, getReports, listFarms } from "../../src/repos/data";
import { addDaysKey, todayKey } from "../../src/lib/ids";
import {
  defaultFieldLogRange,
  fieldLogWeeksToTsv,
  formatFieldLogDayHeader,
  type FieldLogWeek,
} from "../../src/lib/reports/field-log";
import {
  buildGeneratorReportView,
  formatGeneratorReportDate,
  formatGeneratorReportHours,
  generatorReportToTsv,
  type GeneratorReportFarm,
} from "../../src/lib/reports/generator-log";
import { shareGeneratorReportPdf } from "../../src/lib/reports/shareGeneratorPdf";
import { colors, styles } from "../../src/theme";
import {
  Card,
  Chip,
  PageHeader,
  PrimaryButton,
} from "../../src/components/ui";
import { DatePickerField } from "../../src/components/DatePickerField";
import { ClipboardIconButton } from "../../src/components/ClipboardIconButton";

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

export default function ReportsScreen() {
  const params = useLocalSearchParams<{ farmId?: string | string[] }>();
  const farmIdParam = paramId(params.farmId);
  const farms = useMemo(() => listFarms().farms, []);
  const weekDefaults = useMemo(() => defaultFieldLogRange(), []);
  const [reportType, setReportType] = useState<ReportType>("mortality");
  const [farmId, setFarmId] = useState(farmIdParam || farms[0]?.id || "");
  const [from, setFrom] = useState(addDaysKey(todayKey(), -14));
  const [to, setTo] = useState(todayKey());
  const [genFrom, setGenFrom] = useState(addDaysKey(todayKey(), -42));
  const [genTo, setGenTo] = useState(todayKey());
  const [fieldFrom, setFieldFrom] = useState(weekDefaults.from);
  const [fieldTo, setFieldTo] = useState(weekDefaults.to);
  const [matrix, setMatrix] = useState(() =>
    getReports(from, to, (farmIdParam || farms[0]?.id) || undefined),
  );
  const [fieldWeeks, setFieldWeeks] = useState<FieldLogWeek[]>(() =>
    getFieldLog(weekDefaults.from, weekDefaults.to),
  );
  const [genFarms, setGenFarms] = useState<GeneratorReportFarm[]>(() =>
    getGeneratorLogReport(genFrom, genTo),
  );
  const genView = useMemo(() => buildGeneratorReportView(genFarms), [genFarms]);
  const genFilterLabel = useMemo(
    () => `${formatGeneratorReportDate(genFrom)} to ${formatGeneratorReportDate(genTo)}`,
    [genFrom, genTo],
  );

  const selectedFarmName = useMemo(() => {
    if (!farmId) return null;
    return farms.find((f) => f.id === farmId)?.farmName ?? null;
  }, [farmId, farms]);

  const rowHeaderLabel = selectedFarmName || "Farm Name";

  useEffect(() => {
    if (farmIdParam) {
      setFarmId(farmIdParam);
      setMatrix(getReports(from, to, farmIdParam));
    }
  }, [farmIdParam, from, to]);

  function applyMortality() {
    setMatrix(getReports(from, to, farmId || undefined));
  }

  function applyFieldLog() {
    setFieldWeeks(getFieldLog(fieldFrom, fieldTo));
  }

  function applyGenerator() {
    setGenFarms(getGeneratorLogReport(genFrom, genTo));
  }

  useEffect(() => {
    if (reportType !== "generator") return;
    setGenFarms(getGeneratorLogReport(genFrom, genTo));
  }, [reportType, genFrom, genTo]);

  const hasFieldFarms = fieldWeeks.some((week) =>
    week.days.some((day) => day.farms.length > 0),
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader title="Reports" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", marginBottom: 12 }}>
            {REPORT_TYPES.map((t) => (
              <Chip
                key={t.key}
                label={t.label}
                active={reportType === t.key}
                onPress={() => {
                  setReportType(t.key);
                  if (t.key === "generator") applyGenerator();
                }}
              />
            ))}
          </View>
        </ScrollView>

        {reportType === "field-log" ? (
          <>
            <Card>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField label="Start" value={fieldFrom} onChange={setFieldFrom} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField label="Finish" value={fieldTo} onChange={setFieldTo} />
                </View>
              </View>
              <PrimaryButton label="Run report" onPress={applyFieldLog} />
            </Card>

            {fieldWeeks.map((week) => (
              <Card key={week.weekStart} style={{ paddingVertical: 12 }}>
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
                    Field Log
                  </Text>
                  <ClipboardIconButton
                    accessibilityLabel="Copy field log"
                    color={colors.accentDark}
                    emptyMessage="No visits in this date range."
                    getText={() => {
                      if (!hasFieldFarms) return "";
                      return fieldLogWeeksToTsv(fieldWeeks);
                    }}
                  />
                </View>
                <ScrollView horizontal>
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
                              <Text
                                key={`${day.dateKey}-${i}-${farm}`}
                                style={{ fontWeight: "700", marginBottom: 6, fontSize: 13 }}
                              >
                                {farm}
                              </Text>
                            ))
                          )}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </Card>
            ))}

            {!hasFieldFarms ? (
              <Text style={styles.muted}>No visits logged in this date range.</Text>
            ) : null}
          </>
        ) : reportType === "generator" ? (
          <>
            <Card>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField label="From" value={genFrom} onChange={setGenFrom} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField label="To" value={genTo} onChange={setGenTo} />
                </View>
              </View>
              <PrimaryButton label="Apply filters" onPress={applyGenerator} />
            </Card>

            {genView.length === 0 ? (
              <Text style={styles.muted}>No generator hours logged in this date range.</Text>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <ClipboardIconButton
                    accessibilityLabel="Copy generator report"
                    color={colors.accentDark}
                    emptyMessage="No generator hours in this date range."
                    getText={() => generatorReportToTsv(genView)}
                  />
                  <PrimaryButton
                    secondary
                    label="Share PDF"
                    onPress={() => {
                      void shareGeneratorReportPdf({
                        farms: genView,
                        subtitle: genFilterLabel,
                      }).catch(() => {
                        Alert.alert("Could not share PDF", "Try again in a moment.");
                      });
                    }}
                    style={{ minWidth: 120 }}
                  />
                </View>
                {genView.map((farm) => (
                  <Card key={farm.farmId} style={{ paddingVertical: 12 }}>
                    <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text, marginBottom: 8 }}>
                      {farm.farmName}
                    </Text>
                    {farm.generators.map((gen) => (
                      <View key={gen.key} style={{ marginTop: 8 }}>
                        <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text, marginBottom: 2 }}>
                          {gen.label}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                          <Text style={{ width: 96, fontSize: 14, fontWeight: "600", color: colors.muted }}>
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
                            <Text style={{ width: 96, fontSize: 16, fontWeight: "600", color: colors.text }}>
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
                  </Card>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            <Text style={styles.label}>Farm</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", marginBottom: 8 }}>
                <Chip label="All" active={farmId === ""} onPress={() => setFarmId("")} />
                {farms.map((f) => (
                  <Chip
                    key={f.id}
                    label={f.farmName}
                    active={farmId === f.id}
                    onPress={() => setFarmId(f.id)}
                  />
                ))}
              </View>
            </ScrollView>

            <Card>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField label="From" value={from} onChange={setFrom} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DatePickerField label="To" value={to} onChange={setTo} />
                </View>
              </View>
              <PrimaryButton label="Apply filters" onPress={applyMortality} />
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
                <Text style={{ fontWeight: "800", fontSize: 15, color: colors.text, flex: 1 }}>
                  Mortality
                </Text>
                <ClipboardIconButton
                  accessibilityLabel="Copy mortality report"
                  color={colors.accentDark}
                  emptyMessage="Run a report with data first."
                  getText={() => {
                    if (matrix.rows.length === 0) return "";
                    return matrixToTsv(matrix, rowHeaderLabel);
                  }}
                />
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
                    {matrix.dates.map((d) => (
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
                  {matrix.rows.length === 0 ? (
                    <Text style={styles.muted}>No data for range</Text>
                  ) : (
                    matrix.rows.map((row) => {
                      const total = matrix.dates.reduce((s, d) => s + (row.byDate[d] ?? 0), 0);
                      return (
                        <View key={row.houseLabel} style={{ flexDirection: "row", marginBottom: 6 }}>
                          <Text style={{ width: 110, fontWeight: "700" }} numberOfLines={1}>
                            {row.houseLabel}
                          </Text>
                          {matrix.dates.map((d) => {
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
