import { Text, View } from "react-native";
import {
  BIG_BIRD_COOL_CELLS,
  BIG_BIRD_LIGHTING_PROGRAM,
  CHORE_TIME_COOL_PAD_SETTINGS,
  MAX_COOLING_APPARENT_TEMPS,
  MAX_COOLING_OUTSIDE_TEMPS_F,
  MIST_AND_COOL_CELLS,
  TEMP_CURVE,
  maxCoolingZone,
  type CoolCellStage,
  type MaxCoolingZone,
} from "../lib/tools";
import { colors } from "../theme";

const SCHEDULE_NOTE =
  "All stages run 9:00 AM–10:00 PM and only operate cool cells up to 80% RH.";

const ZONE_STYLE: Record<
  MaxCoolingZone,
  { backgroundColor: string; color: string }
> = {
  normal: { backgroundColor: "#fff", color: "#292524" },
  caution: { backgroundColor: "#fde68a", color: "#78350f" },
  danger: { backgroundColor: "#dc2626", color: "#fff" },
};

/** Full-width bordered table shell — matches Chore Time (no horizontal scroll). */
function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        alignSelf: "stretch",
        width: "100%",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#fff",
      }}
    >
      {children}
    </View>
  );
}

function HeaderCell({
  children,
  flex = 1,
  align = "left",
  style,
  numberOfLines = 1,
  padH = 4,
}: {
  children: React.ReactNode;
  flex?: number;
  align?: "left" | "center" | "right";
  style?: object;
  numberOfLines?: number;
  padH?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          flex,
          minWidth: 0,
          paddingHorizontal: padH,
          paddingVertical: 8,
          fontSize: 11,
          fontWeight: "800",
          color: "#44403c",
          backgroundColor: "#f5f5f4",
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function Cell({
  children,
  flex = 1,
  bold,
  align = "left",
  style,
  padH = 4,
}: {
  children: React.ReactNode;
  flex?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  style?: object;
  padH?: number;
}) {
  return (
    <Text
      numberOfLines={1}
      style={[
        {
          flex,
          minWidth: 0,
          paddingHorizontal: padH,
          paddingVertical: 7,
          fontSize: 13,
          fontWeight: bold ? "700" : "500",
          color: colors.text,
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function Row({
  children,
  thickTop,
  style,
}: {
  children: React.ReactNode;
  thickTop?: boolean;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "stretch",
          width: "100%",
          borderTopWidth: thickTop ? 2 : 1,
          borderTopColor: thickTop ? "#d6d3d1" : "#f5f5f4",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function TempCurveChart() {
  return (
    <TableShell>
      <View style={{ flexDirection: "row", width: "100%" }}>
        <HeaderCell flex={1} padH={8}>
          Day
        </HeaderCell>
        <HeaderCell flex={1} padH={8} style={{ backgroundColor: "#fef3c7", color: "#78350f" }}>
          Summer
        </HeaderCell>
        <HeaderCell flex={1} padH={8}>
          Winter
        </HeaderCell>
      </View>
      {TEMP_CURVE.map((row) => (
        <Row key={row.day}>
          <Cell flex={1} bold padH={8}>
            {row.day}
          </Cell>
          <Cell flex={1} padH={8} style={{ backgroundColor: "#fffbeb", color: "#451a03" }}>
            {row.summerF}°F
          </Cell>
          <Cell flex={1} padH={8}>
            {row.winterF}°F
          </Cell>
        </Row>
      ))}
    </TableShell>
  );
}

function CoolCellSettingsTable({
  rows,
  diffLabel,
}: {
  rows: CoolCellStage[];
  diffLabel: string;
}) {
  return (
    <TableShell>
      <View style={{ flexDirection: "row", width: "100%" }}>
        <HeaderCell flex={0.7}>Day</HeaderCell>
        <HeaderCell flex={1.15}>{diffLabel}</HeaderCell>
        <HeaderCell flex={0.7} align="center">
          On
        </HeaderCell>
        <HeaderCell flex={0.7} align="center">
          Off
        </HeaderCell>
        <HeaderCell flex={0.95}>On temp</HeaderCell>
      </View>
      {rows.map((row, i) => {
        const prev = rows[i - 1];
        const showDay = !prev || prev.day !== row.day;
        return (
          <Row key={`${row.day}-${row.diff}-${row.onSec}`} thickTop={showDay && i > 0}>
            <Cell flex={0.7} bold>
              {showDay ? String(row.day) : ""}
            </Cell>
            <Cell flex={1.15}>
              {row.diff.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </Cell>
            <Cell flex={0.7} align="center">
              {String(row.onSec)}
            </Cell>
            <Cell flex={0.7} align="center">
              {String(row.offSec)}
            </Cell>
            <Cell flex={0.95} bold>
              {row.onTemp != null ? String(row.onTemp) : ""}
            </Cell>
          </Row>
        );
      })}
    </TableShell>
  );
}

export function CoolCellsChart() {
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <CoolCellSettingsTable rows={BIG_BIRD_COOL_CELLS} diffLabel="Temp diff" />
        <Text style={{ fontSize: 12, color: colors.muted }}>{SCHEDULE_NOTE}</Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
          Tunnel Diff Cool Cells
        </Text>
        <CoolCellSettingsTable rows={MIST_AND_COOL_CELLS} diffLabel="Tunnel diff" />
        <Text style={{ fontSize: 12, color: colors.muted }}>{SCHEDULE_NOTE}</Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Chore Time</Text>
        <View
          style={{
            alignSelf: "stretch",
            width: "100%",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: "#fff",
          }}
        >
          {CHORE_TIME_COOL_PAD_SETTINGS.map((row, i) => (
            <View
              key={row.label}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "#f5f5f4",
              }}
            >
              <Text style={{ flex: 1, fontSize: 14, color: "#44403c" }}>{row.label}</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function MaxCoolingChart() {
  const tempCount = MAX_COOLING_OUTSIDE_TEMPS_F.length;
  return (
    <View style={{ gap: 10, alignSelf: "stretch", width: "100%" }}>
      <TableShell>
        <View style={{ flexDirection: "row", width: "100%", backgroundColor: "#f5f5f4" }}>
          <Text
            style={{
              flex: 0.9,
              minWidth: 0,
              paddingVertical: 6,
              textAlign: "center",
              fontSize: 10,
              fontWeight: "800",
              color: "#57534e",
              borderRightWidth: 1,
              borderRightColor: "#e7e5e4",
            }}
          >
            RH%
          </Text>
          <Text
            style={{
              flex: tempCount,
              minWidth: 0,
              paddingVertical: 6,
              textAlign: "center",
              fontSize: 10,
              fontWeight: "800",
              color: "#57534e",
            }}
          >
            Outside temperature
          </Text>
        </View>
        <View style={{ flexDirection: "row", width: "100%", backgroundColor: "#fafaf9" }}>
          <View
            style={{
              flex: 0.9,
              minWidth: 0,
              borderRightWidth: 1,
              borderRightColor: "#e7e5e4",
              borderBottomWidth: 1,
              borderBottomColor: "#e7e5e4",
            }}
          />
          {MAX_COOLING_OUTSIDE_TEMPS_F.map((t) => (
            <Text
              key={t}
              style={{
                flex: 1,
                minWidth: 0,
                paddingVertical: 5,
                textAlign: "center",
                fontSize: 11,
                fontWeight: "800",
                color: "#44403c",
                borderBottomWidth: 1,
                borderBottomColor: "#e7e5e4",
              }}
            >
              {t}°
            </Text>
          ))}
        </View>
        {MAX_COOLING_APPARENT_TEMPS.map((row) => (
          <View key={row.humidityPct} style={{ flexDirection: "row", width: "100%" }}>
            <Text
              style={{
                flex: 0.9,
                minWidth: 0,
                paddingVertical: 5,
                textAlign: "center",
                fontSize: 11,
                fontWeight: "800",
                color: colors.text,
                backgroundColor: "#fafaf9",
                borderRightWidth: 1,
                borderRightColor: "#f5f5f4",
              }}
            >
              {row.humidityPct}
            </Text>
            {row.tempsF.map((temp, i) => {
              const zone = maxCoolingZone(temp);
              return (
                <Text
                  key={`${row.humidityPct}-${MAX_COOLING_OUTSIDE_TEMPS_F[i]}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    paddingVertical: 5,
                    textAlign: "center",
                    fontSize: 11,
                    fontWeight: "700",
                    borderWidth: 0.5,
                    borderColor: "#f5f5f4",
                    ...ZONE_STYLE[zone],
                  }}
                >
                  {temp}
                </Text>
              );
            })}
          </View>
        ))}
      </TableShell>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <LegendSwatch color="#fff" border label="Normal" />
        <LegendSwatch color="#fde68a" label="Caution (86–89°F)" />
        <LegendSwatch color="#dc2626" label="Danger (90°F+)" />
      </View>
    </View>
  );
}

function LegendSwatch({
  color,
  label,
  border,
}: {
  color: string;
  label: string;
  border?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          backgroundColor: color,
          borderWidth: border ? 1 : 0,
          borderColor: "#d6d3d1",
        }}
      />
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

export function LightsChart() {
  return (
    <View style={{ gap: 8, alignSelf: "stretch", width: "100%" }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>Big Bird lighting program</Text>
      <TableShell>
        <View style={{ flexDirection: "row", width: "100%" }}>
          <HeaderCell flex={1.05} padH={3}>
            Age (days)
          </HeaderCell>
          <HeaderCell flex={0.95} padH={3} align="center">
            Hrs light
          </HeaderCell>
          <HeaderCell flex={0.95} padH={3} align="center">
            Hrs dark
          </HeaderCell>
          <HeaderCell flex={1.05} padH={3} align="center">
            Center
          </HeaderCell>
          <HeaderCell flex={0.95} padH={3} align="center">
            Intensity
          </HeaderCell>
        </View>
        {BIG_BIRD_LIGHTING_PROGRAM.map((row) => (
          <Row key={row.ageLabel}>
            <Cell flex={1.05} bold padH={3}>
              {row.ageLabel}
            </Cell>
            <Cell flex={0.95} padH={3} align="center">
              {String(row.hoursLight)}
            </Cell>
            <Cell flex={0.95} padH={3} align="center">
              {String(row.hoursDark)}
            </Cell>
            <Cell flex={1.05} padH={3} align="center">
              {row.centerLights}
            </Cell>
            <Cell flex={0.95} bold padH={3} align="center">
              {row.intensity}
            </Cell>
          </Row>
        ))}
      </TableShell>
      <Text style={{ fontSize: 12, color: colors.muted }}>* Brood lights ON days 1–7 only.</Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>
        * 24 hours prior to catch, the lights should be left on.
      </Text>
    </View>
  );
}
