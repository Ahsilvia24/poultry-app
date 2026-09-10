import { useMemo, useState } from "react";
import { Text, View, type StyleProp, type TextStyle } from "react-native";
import { truncateWithPeriod } from "../lib/oneDotName";

const AVG_CHAR_WIDTH = 0.58;

export function OneDotName({
  text,
  style,
  fontSize = 15,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  fontSize?: number;
}) {
  const [width, setWidth] = useState(0);
  const shown = useMemo(() => {
    if (width <= 0) return text;
    const maxChars = Math.max(5, Math.floor(width / (fontSize * AVG_CHAR_WIDTH)));
    return truncateWithPeriod(text, maxChars);
  }, [fontSize, text, width]);

  return (
    <View
      style={{ flexGrow: 0, flexShrink: 1, minWidth: 0, maxWidth: "100%" }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Text style={style} numberOfLines={1}>
        {shown}
      </Text>
    </View>
  );
}
