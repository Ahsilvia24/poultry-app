"use client";

import { useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { Input, Label } from "@/components/ui";

const DEFAULT_MARKET_AGE = 52;

function toISODate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function catchFromPlacement(placement: string, marketAge: number) {
  if (!placement || !Number.isFinite(marketAge) || marketAge < 0) return "";
  return toISODate(addDays(parseISO(placement), marketAge));
}

function ageFromDates(placement: string, catchDate: string) {
  if (!placement || !catchDate) return DEFAULT_MARKET_AGE;
  return Math.max(0, differenceInCalendarDays(parseISO(catchDate), parseISO(placement)));
}

export function FlockScheduleFields({
  initialPlacement,
  initialMarketAge = DEFAULT_MARKET_AGE,
  initialCatchDate,
}: {
  initialPlacement?: string;
  initialMarketAge?: number;
  initialCatchDate?: string;
}) {
  const startPlacement = initialPlacement || toISODate(new Date());
  const startAge = initialMarketAge > 0 ? initialMarketAge : DEFAULT_MARKET_AGE;
  const startCatch = initialCatchDate || catchFromPlacement(startPlacement, startAge);

  const [placementDate, setPlacementDate] = useState(startPlacement);
  const [marketAge, setMarketAge] = useState(String(startAge));
  const [catchDate, setCatchDate] = useState(startCatch);

  function onPlacementChange(value: string) {
    setPlacementDate(value);
    const age = Number(marketAge);
    const days = Number.isFinite(age) && age >= 0 ? age : DEFAULT_MARKET_AGE;
    if (value) setCatchDate(catchFromPlacement(value, days));
  }

  function onMarketAgeChange(value: string) {
    setMarketAge(value);
    const age = Number(value);
    if (placementDate && Number.isFinite(age) && age >= 0) {
      setCatchDate(catchFromPlacement(placementDate, age));
    }
  }

  function onCatchChange(value: string) {
    setCatchDate(value);
    if (placementDate && value) {
      setMarketAge(String(ageFromDates(placementDate, value)));
    }
  }

  return (
    <>
      <div>
        <Label htmlFor="placementDate">Placement date</Label>
        <Input
          id="placementDate"
          name="placementDate"
          type="date"
          required
          value={placementDate}
          onChange={(e) => onPlacementChange(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="targetMarketAge">Market age (days)</Label>
        <Input
          id="targetMarketAge"
          name="targetMarketAge"
          type="number"
          min={0}
          required
          value={marketAge}
          onChange={(e) => onMarketAgeChange(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="projectedCatchDate">Projected catch</Label>
        <Input
          id="projectedCatchDate"
          name="projectedCatchDate"
          type="date"
          required
          value={catchDate}
          onChange={(e) => onCatchChange(e.target.value)}
        />
        <p className="mt-1 text-xs text-stone-500">
          Defaults to {DEFAULT_MARKET_AGE} days after placement. Market age and catch date stay linked.
        </p>
      </div>
    </>
  );
}
