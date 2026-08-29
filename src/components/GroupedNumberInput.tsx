"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { formatGroupedInput, ungroupNumber } from "@/lib/grouped-number";

export function GroupedNumberInput({
  id,
  name,
  defaultValue,
  decimal = false,
  min,
  step,
  required,
  compact,
}: {
  id: string;
  name: string;
  defaultValue?: string | number;
  decimal?: boolean;
  min?: number;
  step?: string | number;
  required?: boolean;
  compact?: boolean;
}) {
  const [value, setValue] = useState(() => {
    if (defaultValue === "" || defaultValue == null) return "";
    return formatGroupedInput(String(defaultValue), decimal);
  });

  return (
    <>
      <input type="hidden" name={name} value={ungroupNumber(value)} />
      <Input
        id={id}
        inputMode={decimal ? "decimal" : "numeric"}
        compact={compact}
        required={required}
        min={min}
        step={step}
        value={value}
        onChange={(e) => setValue(formatGroupedInput(e.target.value, decimal))}
      />
    </>
  );
}
