import { Text, View } from "react-native";
import { ClipboardIconButton } from "./ClipboardIconButton";
import { SharePdfIconButton } from "./SharePdfIconButton";
import { colors, fonts } from "../theme";

export function CopyHouseSummaryButton({
  lines,
  farmName,
}: {
  lines: string[];
  /** Prefixed on its own line when copying (e.g. saved LFO tile). */
  farmName?: string;
}) {
  if (lines.length === 0) return null;

  return (
    <ClipboardIconButton
      accessibilityLabel="Copy house summary"
      getText={() => {
        const name = farmName?.trim();
        return name ? [name, ...lines].join("\n") : lines.join("\n");
      }}
    />
  );
}

/** Stacked H1/H2/… summary with copy-to-clipboard. Shows every line (no truncation). */
export function LfoHouseSummaryBlock({
  lines,
  farmName,
  fontSize = 13,
  onSharePdf,
}: {
  lines: string[];
  farmName?: string;
  fontSize?: number;
  onSharePdf?: () => void;
}) {
  if (lines.length === 0) return null;

  return (
    <View style={{ marginTop: 4, flexShrink: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2, flexShrink: 0 }}>
          {lines.map((line) => (
            <Text
              key={line}
              style={{ fontFamily: fonts.sans, fontWeight: "700", color: colors.text, fontSize }}
            >
              {line}
            </Text>
          ))}
        </View>
        {onSharePdf ? (
          <SharePdfIconButton onPress={onSharePdf} accessibilityLabel="Share full LFO PDF" />
        ) : null}
        <CopyHouseSummaryButton lines={lines} farmName={farmName} />
      </View>
    </View>
  );
}
