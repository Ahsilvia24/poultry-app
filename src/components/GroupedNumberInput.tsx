"use client";

import { useState } from "react";
import { SettingsChipInput } from "@/components/SettingsLayout";
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
  variant = "default",
}: {
  id: string;
  name: string;
  defaultValue?: string | number;
  decimal?: boolean;
  min?: number;
  step?: string | number;
  required?: boolean;
  compact?: boolean;
  variant?: "default" | "settings";
}) {
  const [value, setValue] = useState(() => {
    if (defaultValue === "" || defaultValue == null) return "";
    return formatGroupedInput(String(defaultValue), decimal);
  });

  return (
    <>
      <input type="hidden" name={name} value={ungroupNumber(value)} />
      {variant === "settings" ? (
        <SettingsChipInput
          id={id}
          inputMode={decimal ? "decimal" : "numeric"}
          required={required}
          value={value}
          onChange={(e) => setValue(formatGroupedInput(e.target.value, decimal))}
        />
      ) : (
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
      )}
    </>
  );
}
