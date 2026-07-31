import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { format } from "date-fns";
import { getReports, listFarms, listVisitsReport } from "../../src/repos/data";
import { VISIT_TYPE_LABELS } from "../../src/lib/visits";
import { addDaysKey, parseDateKey, todayKey } from "../../src/lib/ids";
import { colors, styles } from "../../src/theme";
import {
  Card,
  Chip,
  PageHeader,
  PrimaryButton,
} from "../../src/components/ui";
import { DatePickerField } from "../../src/components/DatePickerField";

const REPORT_TYPES = [
  { key: "mortality", label: "Mortality" },
  { key: "visits", label: "Visits" },
  { key: "feed", label: "Feed" },
  { key: "performance", label: "Performance" },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["key"];
type VisitRow = ReturnType<typeof listVisitsReport>[number];

function formatDateHeader(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMdY(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, 12);
  return dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** DD MMM YY — e.g. 31 Jul 26 */
function formatVisitDate(dateKey: string) {
  try {
    return format(parseDateKey(dateKey), "dd MMM yy");
  } catch {
    return dateKey;
  }
}

function visitTypeLabel(type: string) {
  return VISIT_TYPE_LABELS[type] ?? type;
}

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function matrixToTsv(matrix: ReturnType<typeof getReports>) {
  const header = ["House", ...matrix.dates.map(formatDateHeader), "Total"];
  const lines = matrix.rows.map((row) => {
    const values = matrix.dates.map((d) => row.byDate[d] ?? 0);
    const total = values.reduce((sum, n) => sum + n, 0);
    return [row.houseLabel, ...values, total].join("\t");
  });
  return [header.join("\t"), ...lines].join("\n");
}

function visitsToClipboardText(rows: VisitRow[]) {
  return rows
    .map(
      (r) =>
        `${formatVisitDate(r.visitDate)}\t${r.farmName}\t${visitTypeLabel(r.visitType)}`,
    )
    .join("\n");
}

export default function ReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string | string[] }>();
  const farmIdParam = paramId(params.farmId);
  const farms = useMemo(() => listFarms().farms, []);
  const [reportType, setReportType] = useState<ReportType>("mortality");
  const [farmId, setFarmId] = useState(farmIdParam || farms[0]?.id || "");
  const [from, setFrom] = useState(addDaysKey(todayKey(), -14));
  const [to, setTo] = useState(todayKey());
  const [matrix, setMatrix] = useState(() =>
    getReports(from, to, (farmIdParam || farms[0]?.id) || undefined),
  );
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [visitsGenerated, setVisitsGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (farmIdParam) {
      setFarmId(farmIdParam);
      if (reportType === "mortality") {
        setMatrix(getReports(from, to, farmIdParam));
      }
    }
  }, [farmIdParam, from, to, reportType]);

  function applyMortality() {
    setCopied(false);
    setMatrix(getReports(from, to, farmId || undefined));
  }

  function applyVisits() {
    setCopied(false);
    setVisits(listVisitsReport(from, to, farmId || undefined));
    setVisitsGenerated(true);
  }

  async function copyMortality() {
    if (matrix.rows.length === 0) {
      Alert.alert("Nothing to copy", "Run a report with data first.");
      return;
    }
    try {
      await Clipboard.setStringAsync(matrixToTsv(matrix));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert("Copy failed", "Could not copy results to the clipboard.");
    }
  }

  async function copyVisits() {
    if (visits.length === 0) {
      Alert.alert("Nothing to copy", "Generate a visit list first.");
      return;
    }
    try {
      await Clipboard.setStringAsync(visitsToClipboardText(visits));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert("Copy failed", "Could not copy the visit list.");
    }
  }

  function onSelectReportType(key: ReportType) {
    setReportType(key);
    setCopied(false);
    if (key === "visits" && !farmIdParam && farmId === farms[0]?.id) {
      // Prefer All farms when opening Visits from the Reports tab.
      setFarmId("");
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => {
            if (farmIdParam) {
              router.replace({
                pathname: "/(tabs)/farms/[id]",
                params: { id: farmIdParam },
              });
              return;
            }

            if (router.canGoBack()) router.back();
          }}
          style={{ marginBottom: 8 }}
        >
          <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Back</Text>
        </Pressable>
        <PageHeader title="Reports" subtitle="Choose a report type, then run filters" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", marginBottom: 12 }}>
            {REPORT_TYPES.map((t) => (
              <Chip
                key={t.key}
                label={t.label}
                active={reportType === t.key}
                onPress={() => onSelectReportType(t.key)}
              />
            ))}
          </View>
        </ScrollView>

        {reportType === "mortality" ? (
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
              <DatePickerField label="From" value={from} onChange={setFrom} />
              <View style={{ height: 8 }} />
              <DatePickerField label="To" value={to} onChange={setTo} />
              <Text style={[styles.muted, { marginTop: 8, marginBottom: 4 }]}>
                {formatMdY(from)} – {formatMdY(to)}
              </Text>
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
                  House × date
                </Text>
                <Pressable
                  onPress={copyMortality}
                  hitSlop={8}
                  accessibilityLabel={copied ? "Copied" : "Copy to clipboard"}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "#f5f5f4",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={copied ? "checkmark" : "copy-outline"}
                    size={18}
                    color={colors.accentDark}
                  />
                </Pressable>
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
                    <Text style={{ width: 110, fontWeight: "800", color: colors.muted }}>House</Text>
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
        ) : reportType === "visits" ? (
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
              <DatePickerField label="From" value={from} onChange={setFrom} />
              <View style={{ height: 8 }} />
              <DatePickerField label="To" value={to} onChange={setTo} />
              <Text style={[styles.muted, { marginTop: 8, marginBottom: 4 }]}>
                {formatMdY(from)} – {formatMdY(to)}
              </Text>
              <PrimaryButton label="Generate list" onPress={applyVisits} />
            </Card>

            <Card style={{ paddingVertical: 14 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>
                    Visits
                  </Text>
                  {visitsGenerated ? (
                    <Text style={[styles.muted, { marginTop: 2, fontSize: 13 }]}>
                      {visits.length === 0
                        ? "No visits in this range"
                        : `${visits.length} visit${visits.length === 1 ? "" : "s"}`}
                    </Text>
                  ) : (
                    <Text style={[styles.muted, { marginTop: 2, fontSize: 13 }]}>
                      Choose farm and dates, then generate
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={copyVisits}
                  hitSlop={8}
                  disabled={!visitsGenerated || visits.length === 0}
                  accessibilityLabel={copied ? "Copied" : "Copy visit list to clipboard"}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: "#f5f5f4",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: !visitsGenerated || visits.length === 0 ? 0.4 : 1,
                  }}
                >
                  <Ionicons
                    name={copied ? "checkmark" : "copy-outline"}
                    size={20}
                    color={colors.accentDark}
                  />
                </Pressable>
              </View>

              {!visitsGenerated ? null : visits.length === 0 ? (
                <Text style={styles.muted}>Try a wider date range or another farm.</Text>
              ) : (
                <View style={{ gap: 0 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      paddingBottom: 8,
                      marginBottom: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={{ flex: 1.1, fontWeight: "800", fontSize: 12, color: colors.muted }}>
                      Date
                    </Text>
                    <Text style={{ flex: 1.2, fontWeight: "800", fontSize: 12, color: colors.muted }}>
                      Farm
                    </Text>
                    <Text style={{ flex: 1.3, fontWeight: "800", fontSize: 12, color: colors.muted }}>
                      Type
                    </Text>
                  </View>
                  {visits.map((row, index) => (
                    <View
                      key={row.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        paddingVertical: 10,
                        borderBottomWidth: index === visits.length - 1 ? 0 : 1,
                        borderBottomColor: "#f0eeea",
                      }}
                    >
                      <Text
                        style={{
                          flex: 1.1,
                          fontWeight: "700",
                          fontSize: 13,
                          color: colors.text,
                          paddingRight: 6,
                        }}
                      >
                        {formatVisitDate(row.visitDate)}
                      </Text>
                      <Text
                        style={{
                          flex: 1.2,
                          fontWeight: "600",
                          fontSize: 13,
                          color: colors.text,
                          paddingRight: 6,
                        }}
                        numberOfLines={2}
                      >
                        {row.farmName}
                      </Text>
                      <Text
                        style={{
                          flex: 1.3,
                          fontWeight: "500",
                          fontSize: 13,
                          color: colors.muted,
                        }}
                        numberOfLines={2}
                      >
                        {visitTypeLabel(row.visitType)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        ) : (
          <Card>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>
              {REPORT_TYPES.find((t) => t.key === reportType)?.label} report
            </Text>
            <Text style={[styles.muted, { marginTop: 8 }]}>
              Placeholder — this report type is coming soon. Use Mortality or Visits today.
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
