import { nextCustomLfoName } from "@/lib/lfo/customName";
import { calcTotalDailyLoss } from "@/lib/mortality/calculations";
import { isLocalRecordId } from "@/lib/offline/formPairs";
import type {
  OfflineFormWrite,
  OfflineMortality,
  OfflineSnapshot,
} from "@/lib/offline/types";

function num(value: string | undefined, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function emptyToNull(value: string | undefined) {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

function patchDashboardFollowUp(
  snapshot: OfflineSnapshot,
  extra: { farmId: string; date: string; label: string; completed: boolean },
): OfflineSnapshot {
  if (!snapshot.dashboard) return snapshot;
  const lists = ["todaysSchedule", "upcomingSchedule"] as const;
  const dashboard = { ...snapshot.dashboard };
  for (const key of lists) {
    const list = dashboard[key];
    if (!Array.isArray(list)) continue;
    dashboard[key] = list.map((item) => {
      if (
        item.farmId === extra.farmId &&
        item.date === extra.date &&
        item.label === extra.label
      ) {
        return { ...item, completed: extra.completed };
      }
      return item;
    }) as typeof list;
  }
  return { ...snapshot, dashboard };
}

export function applyFormWrite(snapshot: OfflineSnapshot, write: OfflineFormWrite): OfflineSnapshot {
  const fields = write.fields ?? {};
  const lists = write.listFields ?? {};
  const now = new Date().toISOString();

  switch (write.action) {
    case "updateFarm":
      return {
        ...snapshot,
        farms: snapshot.farms.map((farm) =>
          farm.id === write.farmId
            ? {
                ...farm,
                farmName: fields.farmName ?? farm.farmName,
                farmNumber: emptyToNull(fields.farmNumber),
                growerName: fields.growerName ?? farm.growerName,
                notes: emptyToNull(fields.notes),
              }
            : farm,
        ),
      };
    case "deactivateFarm":
      return {
        ...snapshot,
        farms: snapshot.farms.map((farm) =>
          farm.id === write.farmId ? { ...farm, isActive: false } : farm,
        ),
      };
    case "reactivateFarm":
      return {
        ...snapshot,
        farms: snapshot.farms.map((farm) =>
          farm.id === write.farmId ? { ...farm, isActive: true, deletedAt: null } : farm,
        ),
      };
    case "deleteFarm":
      return {
        ...snapshot,
        farms: snapshot.farms.map((farm) =>
          farm.id === write.farmId
            ? { ...farm, isActive: false, deletedAt: now }
            : farm,
        ),
      };
    case "createHouse": {
      const id = write.id ?? `local-house`;
      return {
        ...snapshot,
        houses: [
          ...snapshot.houses,
          {
            id,
            farmId: write.farmId ?? fields.farmId ?? "",
            houseNumber: num(fields.houseNumber, snapshot.houses.length + 1),
            squareFootage: num(fields.squareFootage, 29700),
            totalFanCFM: emptyToNull(fields.totalFanCFM) ? num(fields.totalFanCFM) : null,
            totalPowerCFM: emptyToNull(fields.totalPowerCFM) ? num(fields.totalPowerCFM) : null,
            numberOfFans: emptyToNull(fields.numberOfFans) ? num(fields.numberOfFans) : null,
            notes: emptyToNull(fields.notes),
            loggedTemp: null,
            loggedTempAt: null,
            deletedAt: null,
          },
        ],
        farms: snapshot.farms.map((farm) =>
          farm.id === write.farmId
            ? { ...farm, numberOfHouses: farm.numberOfHouses + 1 }
            : farm,
        ),
      };
    }
    case "updateHouse":
      return {
        ...snapshot,
        houses: snapshot.houses.map((house) =>
          house.id === write.id
            ? {
                ...house,
                houseNumber: num(fields.houseNumber, house.houseNumber),
                squareFootage: num(fields.squareFootage, house.squareFootage),
                totalFanCFM: emptyToNull(fields.totalFanCFM)
                  ? num(fields.totalFanCFM)
                  : house.totalFanCFM,
                totalPowerCFM: emptyToNull(fields.totalPowerCFM)
                  ? num(fields.totalPowerCFM)
                  : house.totalPowerCFM,
                numberOfFans: emptyToNull(fields.numberOfFans)
                  ? num(fields.numberOfFans)
                  : house.numberOfFans,
                notes: fields.notes !== undefined ? emptyToNull(fields.notes) : house.notes,
              }
            : house,
        ),
      };
    case "deleteHouse":
      return {
        ...snapshot,
        houses: snapshot.houses.map((house) =>
          house.id === write.id ? { ...house, deletedAt: now } : house,
        ),
      };
    case "createVisit": {
      const id = write.id ?? `local-visit`;
      const farmId = write.farmId ?? fields.farmId ?? "";
      return {
        ...snapshot,
        visits: [
          {
            id,
            farmId,
            flockId: emptyToNull(fields.flockId),
            visitDate: fields.visitDate ?? now.slice(0, 10),
            visitType: fields.visitType || "ROUTINE_SERVICE",
            birdAgeInDays: emptyToNull(fields.birdAgeInDays)
              ? num(fields.birdAgeInDays)
              : null,
            generalBirdCondition: emptyToNull(fields.generalBirdCondition) ?? "Healthy",
            followUpRequired: fields.followUpRequired === "on",
            followUpDate: emptyToNull(fields.followUpDate),
            notes: emptyToNull(fields.notes),
            loggedAt: now,
          },
          ...snapshot.visits,
        ],
      };
    }
    case "updateVisit":
      return {
        ...snapshot,
        visits: snapshot.visits.map((visit) =>
          visit.id === write.id
            ? {
                ...visit,
                visitDate: fields.visitDate ?? visit.visitDate,
                visitType: fields.visitType || visit.visitType,
                generalBirdCondition:
                  emptyToNull(fields.generalBirdCondition) ?? visit.generalBirdCondition,
                followUpRequired: fields.followUpRequired === "on",
                followUpDate: emptyToNull(fields.followUpDate),
                notes: emptyToNull(fields.notes),
              }
            : visit,
        ),
      };
    case "deleteVisit":
      return { ...snapshot, visits: snapshot.visits.filter((visit) => visit.id !== write.id) };
    case "createIssue": {
      const id = write.id ?? `local-issue`;
      return {
        ...snapshot,
        issues: [
          {
            id,
            farmId: write.farmId ?? fields.farmId ?? "",
            houseId: emptyToNull(fields.houseId),
            flockId: emptyToNull(fields.flockId),
            dateReported: fields.dateReported ?? now.slice(0, 10),
            category: fields.category || "OTHER",
            priority: fields.priority || "MEDIUM",
            description: fields.description || "",
            correctiveAction: emptyToNull(fields.correctiveAction),
            assignedTo: emptyToNull(fields.assignedTo),
            status: fields.status || "OPEN",
          },
          ...snapshot.issues,
        ],
      };
    }
    case "updateIssue":
      return {
        ...snapshot,
        issues: snapshot.issues.map((issue) =>
          issue.id === write.id
            ? {
                ...issue,
                dateReported: fields.dateReported ?? issue.dateReported,
                houseId: emptyToNull(fields.houseId),
                category: fields.category || issue.category,
                priority: fields.priority || issue.priority,
                description: fields.description ?? issue.description,
                correctiveAction: emptyToNull(fields.correctiveAction),
                assignedTo: emptyToNull(fields.assignedTo),
                status: fields.status || issue.status,
              }
            : issue,
        ),
      };
    case "deleteIssue":
      return { ...snapshot, issues: snapshot.issues.filter((issue) => issue.id !== write.id) };
    case "createLitter": {
      const id = write.id ?? `local-litter`;
      return {
        ...snapshot,
        litterEvents: [
          {
            id,
            farmId: write.farmId ?? fields.farmId ?? "",
            houseId: emptyToNull(fields.houseId),
            eventDate: fields.eventDate ?? now.slice(0, 10),
            eventType: fields.eventType || "OTHER",
            litterDepth: emptyToNull(fields.litterDepth) ? num(fields.litterDepth) : null,
            contractor: emptyToNull(fields.contractor),
            notes: emptyToNull(fields.notes),
          },
          ...snapshot.litterEvents,
        ],
      };
    }
    case "updateLitter":
      return {
        ...snapshot,
        litterEvents: snapshot.litterEvents.map((row) =>
          row.id === write.id
            ? {
                ...row,
                eventDate: fields.eventDate ?? row.eventDate,
                eventType: fields.eventType || row.eventType,
                houseId: emptyToNull(fields.houseId),
                litterDepth: emptyToNull(fields.litterDepth) ? num(fields.litterDepth) : null,
                contractor: emptyToNull(fields.contractor),
                notes: emptyToNull(fields.notes),
              }
            : row,
        ),
      };
    case "deleteLitter":
      return {
        ...snapshot,
        litterEvents: snapshot.litterEvents.filter((row) => row.id !== write.id),
      };
    case "createFeed": {
      const id = write.id ?? `local-feed`;
      return {
        ...snapshot,
        feedDeliveries: [
          {
            id,
            flockId: emptyToNull(fields.flockId),
            houseFlockId: emptyToNull(fields.houseFlockId),
            deliveryDate: fields.deliveryDate ?? now.slice(0, 10),
            feedType: emptyToNull(fields.feedType),
            feedMill: emptyToNull(fields.feedMill),
            ticketNumber: emptyToNull(fields.ticketNumber),
            poundsDelivered: num(fields.poundsDelivered),
            notes: emptyToNull(fields.notes),
          },
          ...snapshot.feedDeliveries,
        ],
      };
    }
    case "updateFeed":
      return {
        ...snapshot,
        feedDeliveries: snapshot.feedDeliveries.map((row) =>
          row.id === write.id
            ? {
                ...row,
                flockId: emptyToNull(fields.flockId),
                houseFlockId: emptyToNull(fields.houseFlockId),
                deliveryDate: fields.deliveryDate ?? row.deliveryDate,
                feedType: emptyToNull(fields.feedType),
                feedMill: emptyToNull(fields.feedMill),
                ticketNumber: emptyToNull(fields.ticketNumber),
                poundsDelivered: num(fields.poundsDelivered, row.poundsDelivered),
                notes: emptyToNull(fields.notes),
              }
            : row,
        ),
      };
    case "deleteFeed":
      return {
        ...snapshot,
        feedDeliveries: snapshot.feedDeliveries.filter((row) => row.id !== write.id),
      };
    case "createGeneratorLog": {
      const id = write.id ?? `local-gen`;
      return {
        ...snapshot,
        generatorLogs: [
          {
            id,
            farmId: write.farmId ?? fields.farmId ?? "",
            logDate: fields.logDate ?? now.slice(0, 10),
            gen1Hours: emptyToNull(fields.gen1Hours) ? num(fields.gen1Hours) : null,
            gen2Hours: emptyToNull(fields.gen2Hours) ? num(fields.gen2Hours) : null,
            gen3Hours: emptyToNull(fields.gen3Hours) ? num(fields.gen3Hours) : null,
            gen4Hours: emptyToNull(fields.gen4Hours) ? num(fields.gen4Hours) : null,
          },
          ...snapshot.generatorLogs,
        ],
      };
    }
    case "updateGeneratorLog":
      return {
        ...snapshot,
        generatorLogs: snapshot.generatorLogs.map((row) =>
          row.id === write.id
            ? {
                ...row,
                logDate: fields.logDate ?? row.logDate,
                gen1Hours: emptyToNull(fields.gen1Hours) ? num(fields.gen1Hours) : row.gen1Hours,
                gen2Hours: emptyToNull(fields.gen2Hours) ? num(fields.gen2Hours) : row.gen2Hours,
                gen3Hours: emptyToNull(fields.gen3Hours) ? num(fields.gen3Hours) : row.gen3Hours,
                gen4Hours: emptyToNull(fields.gen4Hours) ? num(fields.gen4Hours) : row.gen4Hours,
              }
            : row,
        ),
      };
    case "deleteGeneratorLog":
      return {
        ...snapshot,
        generatorLogs: snapshot.generatorLogs.filter((row) => row.id !== write.id),
      };
    case "saveFarmLfo": {
      const id = write.id ?? `local-lfo`;
      const farmId = write.farmId ?? fields.farmId ?? "";
      const flockId =
        snapshot.flocks.find((flock) => flock.farmId === farmId && flock.flockStatus === "ACTIVE")
          ?.id ??
        snapshot.flocks.find((flock) => flock.farmId === farmId)?.id ??
        "";
      const houseIds = lists.houseId ?? (fields.houseId ? [fields.houseId] : []);
      const inventories = houseIds.map((houseId, index) => ({
        id: `${id}-inv-${index}`,
        lastFeedOrderId: id,
        houseId,
        binAPounds: num((lists.binAPounds ?? [])[index] ?? fields.binAPounds),
        binBPounds: num((lists.binBPounds ?? [])[index] ?? fields.binBPounds),
        headCount: null,
        feedUpAt: emptyToNull((lists.feedUpAt ?? [])[index] ?? fields.feedUpAt),
      }));
      return {
        ...snapshot,
        lfos: [
          {
            id,
            farmId,
            flockId,
            orderDate: fields.orderDate ?? now.slice(0, 10),
            orderTime: emptyToNull(fields.orderTime),
            consumptionRate: num(fields.consumptionRate, 0.45),
            calculatedAt: now,
            notes: emptyToNull(fields.notes),
            createdAt: now,
          },
          ...snapshot.lfos,
        ],
        lfoInventories: [...inventories, ...snapshot.lfoInventories],
      };
    }
    case "createManualLfo": {
      const id = write.id ?? `local-lfo`;
      const customName = nextCustomLfoName(snapshot.lfos.map((row) => row.notes));
      return {
        ...snapshot,
        lfos: [
          {
            id,
            farmId: "local-manual",
            flockId: "",
            orderDate: fields.orderDate ?? now.slice(0, 10),
            orderTime: emptyToNull(fields.orderTime),
            consumptionRate: num(fields.consumptionRate, 0.45),
            calculatedAt: now,
            notes: customName,
            createdAt: now,
          },
          ...snapshot.lfos,
        ],
        lfoInventories: [
          {
            id: `${id}-inv-0`,
            lastFeedOrderId: id,
            houseId: "manual",
            binAPounds: num(fields.binAPounds),
            binBPounds: num(fields.binBPounds),
            headCount: emptyToNull(fields.headCount) ? num(fields.headCount) : null,
            feedUpAt: null,
          },
          ...snapshot.lfoInventories,
        ],
      };
    }
    case "deleteLfo":
      return {
        ...snapshot,
        lfos: snapshot.lfos.filter((row) => row.id !== write.id),
        lfoInventories: snapshot.lfoInventories.filter((row) => row.lastFeedOrderId !== write.id),
      };
    case "saveMortalitySeries": {
      const extra = (write.extra ?? {}) as {
        houseFlockId: string;
        entries: Array<{
          mortalityDate: string;
          dailyMortalityCount: number;
          cullCount: number;
        }>;
        clearDates?: string[];
      };
      const clear = new Set(extra.clearDates ?? []);
      const kept = snapshot.mortalities.filter(
        (row) =>
          row.houseFlockId !== extra.houseFlockId || !clear.has(row.mortalityDate.slice(0, 10)),
      );
      const next = [...kept];
      for (const entry of extra.entries ?? []) {
        const idx = next.findIndex(
          (row) =>
            row.houseFlockId === extra.houseFlockId &&
            row.mortalityDate.slice(0, 10) === entry.mortalityDate,
        );
        const loss = calcTotalDailyLoss(entry.dailyMortalityCount, entry.cullCount);
        const row: OfflineMortality = {
          id: idx >= 0 ? next[idx]!.id : `local-mort-${extra.houseFlockId}-${entry.mortalityDate}`,
          houseFlockId: extra.houseFlockId,
          mortalityDate: entry.mortalityDate,
          birdAgeInDays: idx >= 0 ? next[idx]!.birdAgeInDays : 0,
          dailyMortalityCount: entry.dailyMortalityCount,
          cullCount: entry.cullCount,
          totalDailyLoss: loss,
          isDraft: false,
        };
        if (idx >= 0) next[idx] = row;
        else next.push(row);
      }
      return { ...snapshot, mortalities: next };
    }
    case "toggleFollowUp": {
      const extra = write.extra as {
        farmId: string;
        date: string;
        label: string;
        completed: boolean;
      };
      return patchDashboardFollowUp(snapshot, extra);
    }
    default:
      return snapshot;
  }
}

export function coalesceFormWrite(
  items: import("@/lib/offline/types").OfflineOutboxItem[],
  next: import("@/lib/offline/types").OfflineOutboxItem,
): import("@/lib/offline/types").OfflineOutboxItem[] {
  if (next.kind !== "formWrite") return [...items, next];
  const write = next.payload as OfflineFormWrite;
  if (!isLocalRecordId(write.id)) return [...items, next];
  if (write.action.startsWith("delete")) {
    return items.filter((item) => {
      if (item.kind !== "formWrite") return true;
      return (item.payload as OfflineFormWrite).id !== write.id;
    });
  }
  const idx = items.findIndex((item) => {
    if (item.kind !== "formWrite") return false;
    const payload = item.payload as OfflineFormWrite;
    return payload.id === write.id;
  });
  if (idx >= 0) {
    const copy = items.slice();
    const prev = copy[idx]!.payload as OfflineFormWrite;
    copy[idx] = { ...copy[idx]!, payload: { ...prev, ...write, action: prev.action } };
    return copy;
  }
  return [...items, next];
}
