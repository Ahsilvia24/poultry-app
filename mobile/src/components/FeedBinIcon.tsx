import { View } from "react-native";

/** Compact feed-bin silhouette: straight body + cone hopper + two legs. */
export function FeedBinIcon({
  color,
  size = 20,
}: {
  color: string;
  size?: number;
}) {
  const bodyWidth = size * 0.72;
  const bodyHeight = size * 0.34;
  const coneHeight = size * 0.3;
  const lidHeight = Math.max(2, size * 0.1);
  const legWidth = Math.max(2, size * 0.12);
  const legHeight = size * 0.16;
  const legInset = bodyWidth * 0.12;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: bodyWidth,
          height: lidHeight,
          backgroundColor: color,
          borderTopLeftRadius: 1,
          borderTopRightRadius: 1,
        }}
      />
      <View
        style={{
          width: bodyWidth,
          height: bodyHeight,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: bodyWidth / 2,
          borderRightWidth: bodyWidth / 2,
          borderTopWidth: coneHeight,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: color,
        }}
      />
      <View
        style={{
          width: bodyWidth,
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: legInset,
          marginTop: -1,
        }}
      >
        <View style={{ width: legWidth, height: legHeight, backgroundColor: color }} />
        <View style={{ width: legWidth, height: legHeight, backgroundColor: color }} />
      </View>
    </View>
  );
}
