import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { ClipboardIconButton } from "./ClipboardIconButton";
import { SharePdfIconButton } from "./SharePdfIconButton";
import { PrimaryButton } from "./ui";
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

export function FeedMillDataButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied && !failed) return;
    const t = setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 2200);
    return () => clearTimeout(t);
  }, [copied, failed]);

  return (
    <PrimaryButton
      secondary
      label={copied ? "Copied" : failed ? "Copy failed" : "Feed Mill Data"}
      onPress={async () => {
        try {
          const text = getText();
          if (!text.trim()) {
            setFailed(true);
            return;
          }
          const Clipboard = await import("expo-clipboard");
          await Clipboard.setStringAsync(text);
          setFailed(false);
          setCopied(true);
        } catch {
          setCopied(false);
          setFailed(true);
        }
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
