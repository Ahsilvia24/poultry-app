import { ScrollView, Text, View } from "react-native";
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

function TableShell({ children, minWidth }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View
        style={{
          minWidth: minWidth ?? 280,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: "#fff",
        }}
      >
        {children}
      </View>
    </ScrollView>
  );
}

function HeaderCell({
  children,
  flex,
  width,
  align = "left",
  style,
}: {
  children: React.ReactNode;
  flex?: number;
  width?: number;
  align?: "left" | "center" | "right";
  style?: object;
}) {
  return (
    <Text
      style={[
        {
          flex,
          width,
          paddingHorizontal: 10,
          paddingVertical: 8,
          fontSize: 12,
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
  flex,
  width,
  bold,
  align = "left",
  style,
}: {
  children: React.ReactNode;
  flex?: number;
  width?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  style?: object;
}) {
  return (
    <Text
      style={[
        {
          flex,
          width,
          paddingHorizontal: 10,
          paddingVertical: 7,
          fontSize: 14,
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
    <TableShell minWidth={260}>
      <View style={{ flexDirection: "row" }}>
        <HeaderCell flex={1}>Day</HeaderCell>
        <HeaderCell flex={1} style={{ backgroundColor: "#fef3c7", color: "#78350f" }}>
          Summer
        </HeaderCell>
        <HeaderCell flex={1}>Winter</HeaderCell>
      </View>
      {TEMP_CURVE.map((row) => (
        <Row key={row.day}>
          <Cell flex={1} bold>
            {row.day}
          </Cell>
          <Cell flex={1} style={{ backgroundColor: "#fffbeb", color: "#451a03" }}>
            {row.summerF}°F
          </Cell>
          <Cell flex={1}>{row.winterF}°F</Cell>
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
    <TableShell minWidth={360}>
      <View style={{ flexDirection: "row" }}>
        <HeaderCell width={52}>Day</HeaderCell>
        <HeaderCell width={72}>{diffLabel}</HeaderCell>
        <HeaderCell width={52}>On</HeaderCell>
        <HeaderCell width={52}>Off</HeaderCell>
        <HeaderCell width={72}>On temp</HeaderCell>
      </View>
      {rows.map((row, i) => {
        const prev = rows[i - 1];
        const showDay = !prev || prev.day !== row.day;
        return (
          <Row key={`${row.day}-${row.diff}-${row.onSec}`} thickTop={showDay && i > 0}>
            <Cell width={52} bold>
              {showDay ? String(row.day) : ""}
            </Cell>
            <Cell width={72}>
              {row.diff.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </Cell>
            <Cell width={52}>{String(row.onSec)}</Cell>
            <Cell width={52}>{String(row.offSec)}</Cell>
            <Cell width={72} bold>
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
        <Text style={{ fontSize: 12, color: colors.muted }}>
          Big Bird cool cell settings by bird age
        </Text>
        <CoolCellSettingsTable rows={BIG_BIRD_COOL_CELLS} diffLabel="Temp diff" />
        <Text style={{ fontSize: 12, color: colors.muted }}>{SCHEDULE_NOTE}</Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
          Tunnel Diff Cool Cells
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>
          Big Bird cool cell settings by bird age
        </Text>
        <CoolCellSettingsTable rows={MIST_AND_COOL_CELLS} diffLabel="Tunnel diff" />
        <Text style={{ fontSize: 12, color: colors.muted }}>{SCHEDULE_NOTE}</Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Chore Time</Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>Cool pad settings</Text>
        <View
          style={{
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
  const cellW = 36;
  const rhW = 34;
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: "#fff",
          }}
        >
          <View style={{ flexDirection: "row", backgroundColor: "#f5f5f4" }}>
            <Text
              style={{
                width: rhW,
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
                width: cellW * MAX_COOLING_OUTSIDE_TEMPS_F.length,
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
          <View style={{ flexDirection: "row", backgroundColor: "#fafaf9" }}>
            <View
              style={{
                width: rhW,
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
                  width: cellW,
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
            <View key={row.humidityPct} style={{ flexDirection: "row" }}>
              <Text
                style={{
                  width: rhW,
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
                      width: cellW,
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
        </View>
      </ScrollView>
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
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>Big Bird lighting program</Text>
      <TableShell minWidth={420}>
        <View style={{ flexDirection: "row" }}>
          <HeaderCell width={88}>Age (days)</HeaderCell>
          <HeaderCell width={72}>Hours light</HeaderCell>
          <HeaderCell width={72}>Hours dark</HeaderCell>
          <HeaderCell width={80}>Center lights</HeaderCell>
          <HeaderCell width={72}>Intensity</HeaderCell>
        </View>
        {BIG_BIRD_LIGHTING_PROGRAM.map((row) => (
          <Row key={row.ageLabel}>
            <Cell width={88} bold>
              {row.ageLabel}
            </Cell>
            <Cell width={72}>{String(row.hoursLight)}</Cell>
            <Cell width={72}>{String(row.hoursDark)}</Cell>
            <Cell width={80}>{row.centerLights}</Cell>
            <Cell width={72} bold>
              {row.intensity}
            </Cell>
          </Row>
        ))}
      </TableShell>
      <Text style={{ fontSize: 12, color: colors.muted }}>* Brood lights ON days 1–7 only.</Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>
        * 24 hours prior to sell, the lights should be left on.
      </Text>
    </View>
  );
}
