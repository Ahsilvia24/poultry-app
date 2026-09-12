import { getMeta, setMeta } from "../db/database";
import { resolveAppTimeZone } from "./appTimeZones";
import { parseFarmOrder, type FarmOrder } from "./farmOrder";
import { resolveLfoFeedTiming, type LfoFeedTiming } from "./lfo/calculate";

const SERVICE_TECH_KEY = "service_tech";
const FARM_ORDER_KEY = "farm_order";
const TIME_ZONE_KEY = "app_time_zone";
const LFO_FEED_UP_HOURS_KEY = "lfo_feed_up_hours";
const LFO_FEED_OFF_HOURS_KEY = "lfo_feed_off_hours";

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

function readHours(key: string, fallback: number): number {
  const raw = Number(getMeta(key));
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.round(raw);
}

export function getLfoFeedUpHoursBeforeCatch(): number {
  return readHours(LFO_FEED_UP_HOURS_KEY, 5);
}

export function getLfoFeedOffHoursBeforeCatch(): number {
  return readHours(LFO_FEED_OFF_HOURS_KEY, 10);
}

export function setLfoFeedUpHoursBeforeCatch(hours: number) {
  const timing = resolveLfoFeedTiming(hours, getLfoFeedOffHoursBeforeCatch());
  setMeta(LFO_FEED_UP_HOURS_KEY, String(timing.feedUpHoursBeforeCatch));
  setMeta(LFO_FEED_OFF_HOURS_KEY, String(timing.feedOffHoursBeforeCatch));
}

export function setLfoFeedOffHoursBeforeCatch(hours: number) {
  const timing = resolveLfoFeedTiming(getLfoFeedUpHoursBeforeCatch(), hours);
  setMeta(LFO_FEED_UP_HOURS_KEY, String(timing.feedUpHoursBeforeCatch));
  setMeta(LFO_FEED_OFF_HOURS_KEY, String(timing.feedOffHoursBeforeCatch));
}

export function getLfoFeedTiming(): LfoFeedTiming {
  return resolveLfoFeedTiming(getLfoFeedUpHoursBeforeCatch(), getLfoFeedOffHoursBeforeCatch());
}

/** Use the saved Settings name when a checklist field is still empty. */
export function withSavedServiceTech<T extends { serviceTech: string }>(form: T): T {
  if (form.serviceTech.trim()) return form;
  const saved = getServiceTech();
  return saved ? { ...form, serviceTech: saved } : form;
}
