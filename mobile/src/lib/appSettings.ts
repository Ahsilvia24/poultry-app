import { getMeta, setMeta } from "../db/database";
import { resolveAppTimeZone } from "./appTimeZones";
import { parseFarmOrder, type FarmOrder } from "./farmOrder";

const SERVICE_TECH_KEY = "service_tech";
const FARM_ORDER_KEY = "farm_order";
const TIME_ZONE_KEY = "app_time_zone";

export function getServiceTech(): string {
  return getMeta(SERVICE_TECH_KEY)?.trim() ?? "";
}

export function setServiceTech(name: string) {
  setMeta(SERVICE_TECH_KEY, name.trim());
}

export function getFarmOrder(): FarmOrder {
  return parseFarmOrder(getMeta(FARM_ORDER_KEY));
}

export function setFarmOrder(order: FarmOrder) {
  setMeta(FARM_ORDER_KEY, order);
}

export function getAppTimeZone(): string {
  return resolveAppTimeZone(getMeta(TIME_ZONE_KEY));
}

export function setAppTimeZone(timeZone: string) {
  setMeta(TIME_ZONE_KEY, resolveAppTimeZone(timeZone));
}

/** Use the saved Settings name when a checklist field is still empty. */
export function withSavedServiceTech<T extends { serviceTech: string }>(form: T): T {
  if (form.serviceTech.trim()) return form;
  const saved = getServiceTech();
  return saved ? { ...form, serviceTech: saved } : form;
}
