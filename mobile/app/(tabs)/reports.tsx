import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { getReports, listFarms } from "../../src/repos/data";
import { addDaysKey, todayKey } from "../../src/lib/ids";
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
  { key: "placement", label: "Placement" },
  { key: "feed", label: "Feed" },
  { key: "performance", label: "Performance" },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["key"];

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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (farmIdParam) {
      setFarmId(farmIdParam);
      setMatrix(getReports(from, to, farmIdParam));
    }
  }, [farmIdParam, from, to]);

  function apply() {
    setCopied(false);
    setMatrix(getReports(from, to, farmId || undefined));
  }

  async function copyResults() {
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

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => {
            // Prefer the originating farm (passed as `farmId`), since tab-stack
            // navigation can make `router.back()` land on Dashboard.
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
                onPress={() => setReportType(t.key)}
              />
            ))}
          </View>
        </ScrollView>

        {reportType !== "mortality" ? (
          <Card>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>
              {REPORT_TYPES.find((t) => t.key === reportType)?.label} report
            </Text>
            <Text style={[styles.muted, { marginTop: 8 }]}>
              Placeholder — this report type is coming soon. Use Mortality for house × date results
              today.
            </Text>
          </Card>
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
              <DatePickerField label="From" value={from} onChange={setFrom} />
              <View style={{ height: 8 }} />
              <DatePickerField label="To" value={to} onChange={setTo} />
              <Text style={[styles.muted, { marginTop: 8, marginBottom: 4 }]}>
                {formatMdY(from)} – {formatMdY(to)}
              </Text>
              <PrimaryButton label="Apply filters" onPress={apply} />
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
                  onPress={copyResults}
                  hitSlop={8}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: "#f5f5f4",
                  }}
                >
                  <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: 13 }}>
                    {copied ? "Copied" : "Copy"}
                  </Text>
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
