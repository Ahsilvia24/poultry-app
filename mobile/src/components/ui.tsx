import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../theme";

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

/** Same row as farm / LFO: chevron + destination on the left, page title on the right. */
export function BackHeader({
  backLabel,
  title,
  onBack,
  accessibilityLabel,
}: {
  backLabel: string;
  title: string;
  onBack: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <View
      style={{
        marginBottom: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `Back to ${backLabel}`}
        hitSlop={8}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          flexShrink: 0,
          minHeight: 44,
        }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.accentDark} />
        <Text
          style={{
            color: colors.accentDark,
            fontWeight: "700",
            fontSize: 17,
            fontFamily: styles.title.fontFamily,
          }}
        >
          {backLabel}
        </Text>
      </Pressable>
      <Text
        style={[styles.title, { flex: 1, minWidth: 0, textAlign: "right", fontSize: 24 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {title}
      </Text>
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

export function Metric({
  label,
  value,
  hint,
  columns = 2,
}: {
  label: string;
  value: string;
  hint?: string;
  columns?: 2 | 3;
}) {
  const multiline = value.includes("\n");
  // Use full 1/N width with inner padding — parent rows must not add `gap`, or
  // the third column wraps (2 across × 3 down instead of 3 × 2).
  const width = columns === 3 ? "33.333%" : "50%";
  return (
    <View
      style={{
        width,
        paddingRight: columns === 3 ? 8 : 10,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
      <Text
        style={{
          fontSize: multiline ? 13 : 15,
          fontWeight: "700",
          color: colors.text,
          marginTop: 2,
          lineHeight: multiline ? 18 : undefined,
        }}
      >
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
  tone = "accent",
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  /** accent = green when active (default); neutral = dark stone when active */
  tone?: "accent" | "neutral";
}) {
  const activeBg = tone === "neutral" ? "#292524" : colors.accentDark;
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          marginRight: 8,
          marginBottom: 8,
          flexShrink: 0,
          backgroundColor: active ? activeBg : "#e7e5e4",
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

/** Weeks 1–4 / 5–8 / 9–12 as fixed 4-column rows (empty slots keep columns aligned). */
function groupByFourWeekRows(weeks: WeekTotal[]): Array<Array<WeekTotal | null>> {
  if (weeks.length === 0) return [];
  const byWeek = new Map(
    weeks
      .filter((w) => w.week >= 1 && w.week <= 16)
      .map((w) => [w.week, w]),
  );
  if (byWeek.size === 0) return [];
  const maxWeek = Math.max(...Array.from(byWeek.keys()));
  const rows: Array<Array<WeekTotal | null>> = [];
  for (let start = 1; start <= maxWeek; start += 4) {
    const row: Array<WeekTotal | null> = [];
    for (let i = 0; i < 4; i++) {
      const weekNum = start + i;
      if (weekNum > maxWeek) {
        row.push(null);
      } else {
        const existing = byWeek.get(weekNum);
        row.push(existing ?? { week: weekNum, total: 0 });
      }
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Weeks 1–4 / 5–8 / 9–12 per row.
 * Label + total stack vertically so 4–5 digit counts stay readable (no auto-shrink).
 */
export function WeeklyMortalityList({ weeks }: { weeks: WeekTotal[] }) {
  if (weeks.length === 0) return null;
  const rows = groupByFourWeekRows(weeks);

  return (
    <View style={{ marginTop: 2, gap: 8 }}>
      {rows.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={{ flexDirection: "row", flexWrap: "nowrap", gap: 6 }}
        >
          {row.map((w, colIndex) =>
            w ? (
              <View key={w.week} style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 11,
                    lineHeight: 14,
                    fontWeight: "700",
                    color: colors.muted,
                  }}
                >
                  Wk{w.week}
                </Text>
                <Text
                  style={{
                    marginTop: 1,
                    fontSize: 17,
                    lineHeight: 22,
                    fontWeight: "800",
                    color: colors.text,
                    fontVariant: ["tabular-nums"],
                  }}
                  numberOfLines={1}
                >
                  {w.total.toLocaleString()}
                </Text>
              </View>
            ) : (
              <View key={`pad-${rowIndex}-${colIndex}`} style={{ flex: 1, minWidth: 0 }} />
            ),
          )}
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
