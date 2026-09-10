"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { fitOneDotName } from "@/lib/oneDotName";

export function OneDotName({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(text);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const probe = probeRef.current;
    if (!box || !probe) return;

    const apply = () => {
      const width = box.clientWidth;
      if (width <= 0) return;
      const measure = (value: string) => {
        probe.textContent = value;
        return probe.scrollWidth <= width + 0.5;
      };
      setShown(fitOneDotName(text, measure));
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span
      ref={boxRef}
      title={text}
      className={`relative min-w-0 overflow-hidden ${className ?? ""}`}
    >
      <span
        ref={probeRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap"
      />
      <span className="block overflow-hidden whitespace-nowrap">{shown}</span>
    </span>
  );
}
