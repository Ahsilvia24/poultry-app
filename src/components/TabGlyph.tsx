import {
  TAB_ICON_ELEMENTS,
  type TabIconName,
} from "@/lib/tab-icon-glyphs";

export function TabGlyph({
  name,
  size = 22,
}: {
  name: TabIconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
    >
      {TAB_ICON_ELEMENTS[name].map((el, i) =>
        el.tag === "path" ? (
          <path
            key={i}
            d={el.d}
            fillRule={el.fillRule}
            transform={el.transform}
          />
        ) : (
          <rect
            key={i}
            x={el.x}
            y={el.y}
            width={el.width}
            height={el.height}
            rx={el.rx}
          />
        ),
      )}
    </svg>
  );
}
