import Svg, { Path, Rect } from "react-native-svg";
import {
  TAB_ICON_ELEMENTS,
  type TabIconName,
} from "../lib/tab-icon-glyphs";

export function TabGlyph({
  name,
  color,
  size = 22,
}: {
  name: TabIconName;
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      {TAB_ICON_ELEMENTS[name].map((el, i) =>
        el.tag === "path" ? (
          <Path
            key={i}
            d={el.d}
            fill={color}
            fillRule={el.fillRule}
            transform={el.transform}
          />
        ) : (
          <Rect
            key={i}
            x={el.x}
            y={el.y}
            width={el.width}
            height={el.height}
            rx={el.rx}
            fill={el.fill === "none" ? "none" : color}
            stroke={el.fill === "none" ? color : undefined}
            strokeWidth={el.strokeWidth}
          />
        ),
      )}
    </Svg>
  );
}
