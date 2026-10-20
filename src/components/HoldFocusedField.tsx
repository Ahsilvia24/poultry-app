"use client";

import { useEffect } from "react";
import { installHoldFocusedField } from "@/lib/holdFieldInView";

/** Stop iOS from flinging a focused checklist box to the bottom of the page. */
export function HoldFocusedField() {
  useEffect(() => installHoldFocusedField(), []);
  return null;
}
