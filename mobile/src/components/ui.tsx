import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, styles } from "../theme";

export function BrandBar({
  right,
}: {
  right?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 12,
        marginBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={styles.brand}>PoultryTech</Text>
      {right}
    </View>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actions ? <View style={{ marginTop: 12 }}>{actions}</View> : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatusBadge({ status }: { status: string }) {
  const sc =
    status === "Critical"
      ? { bg: "#fee2e2", fg: "#991b1b" }
      : status === "High"
        ? { bg: "#ffedd5", fg: "#9a3412" }
        : status === "Watch"
          ? { bg: "#fef3c7", fg: "#92400e" }
          : { bg: "#d1fae5", fg: "#065f46" };
  return (
    <Text style={[styles.badge, { backgroundColor: sc.bg, color: sc.fg }]}>{status}</Text>
  );
}

export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={{ width: "47%", flexGrow: 1, marginBottom: 8, padding: 12 }}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text, marginTop: 2 }}>
        {value}
      </Text>
    </Card>
  );
}

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={{ width: "47%", marginBottom: 10 }}>
      <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 2 }}>
        {value}
      </Text>
      {hint ? (
        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          marginRight: 8,
          flexShrink: 0,
          backgroundColor: active ? colors.accentDark : "#e7e5e4",
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: active ? "#fff" : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  secondary,
  style,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        secondary ? styles.buttonSecondary : null,
        style,
      ]}
    >
      <Text style={secondary ? styles.buttonSecondaryText : styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle]}>{children}</Text>;
}

type WeekTotal = { week: number; total: number };

function groupByFourWeekRows(weeks: WeekTotal[]): WeekTotal[][] {
  const rows = new Map<number, WeekTotal[]>();
  for (const w of weeks) {
    const rowIndex = Math.floor((Math.max(1, w.week) - 1) / 4);
    const list = rows.get(rowIndex) ?? [];
    list.push(w);
    rows.set(rowIndex, list);
  }
  return Array.from(rows.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) => list.sort((a, b) => a.week - b.week));
}

/** Weeks 1–4 / 5–8 / 9–12 per row; totals bold and slightly larger than body metrics. */
export function WeeklyMortalityList({ weeks }: { weeks: WeekTotal[] }) {
  if (weeks.length === 0) return null;
  const rows = groupByFourWeekRows(weeks);

  return (
    <View style={{ marginTop: 2, gap: 8 }}>
      {rows.map((row) => (
        <View
          key={row[0]!.week}
          style={{ flexDirection: "row", flexWrap: "nowrap", gap: 6 }}
        >
          {row.map((w) => (
            <View key={w.week} style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, lineHeight: 22, color: colors.muted }}>
                Week {w.week}{" "}
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                  {w.total}
                </Text>
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function formatNumber(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}
