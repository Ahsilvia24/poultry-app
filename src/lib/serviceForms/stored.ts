import type { ServiceFormKind } from "./types";

export type StoredServiceForm = {
  id: string;
  farmId: string;
  flockId: string | null;
  formKind: ServiceFormKind;
  formDate: string;
  payload: unknown;
  visitId: string | null;
  createdAt: string;
};

export function isServiceFormKind(value: string): value is ServiceFormKind {
  return value === "service_report" || value === "placement" || value === "prebrood";
}
