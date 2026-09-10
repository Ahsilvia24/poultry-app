"use client";

import { useState } from "react";
import { DateKeyField } from "@/components/DateKeyField";
import { Label } from "@/components/ui";

export function ReportDateRangeFields({
  fromLabel,
  toLabel,
  from,
  to,
}: {
  fromLabel: string;
  toLabel: string;
  from: string;
  to: string;
}) {
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="min-w-0 overflow-hidden">
        <Label htmlFor="from">{fromLabel}</Label>
        <DateKeyField
          id="from"
          name="from"
          label={fromLabel}
          value={fromValue}
          onChange={setFromValue}
        />
      </div>
      <div className="min-w-0 overflow-hidden">
        <Label htmlFor="to">{toLabel}</Label>
        <DateKeyField
          id="to"
          name="to"
          label={toLabel}
          value={toValue}
          onChange={setToValue}
        />
      </div>
    </div>
  );
}
