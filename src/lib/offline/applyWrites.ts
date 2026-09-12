import { addDays, format } from "date-fns";
import { nextCustomLfoName, parseCustomLfoNumber } from "@/lib/lfo/customName";
import { birdAgeFromPlacement, calcTotalDailyLoss } from "@/lib/mortality/calculations";
import { isHouseInPropagateRange } from "@/lib/housePropagate";
import { normalizeFlockNumber, planFlockNumberChange } from "@/lib/houseFlockNumber";
import { asDate, asDateKey } from "@/lib/offline/dates";
import { isLocalRecordId, localRecordId } from "@/lib/offline/formPairs";
import { isServiceFormKind } from "@/lib/serviceForms/stored";
import type { AnyServiceForm } from "@/lib/serviceForms/types";
import type {
  OfflineFormWrite,
  OfflineMortality,
  OfflineServiceForm,
  OfflineServiceFormDraft,
  OfflineSnapshot,
  OfflineVisit,
} from "@/lib/offline/types";

function num(value: string | undefined, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function emptyToNull(value: string | undefined) {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

function listValues(
  lists: Record<string, string[]>,
  fields: Record<string, string>,
  key: string,
) {
  if (lists[key]?.length) return lists[key];
  if (fields[key] != null) return [fields[key]];
  return [];
}

function lfoInventoriesFromForm(
  snapshot: OfflineSnapshot,
  lfoId: string,
  lists: Record<string, string[]>,
  fields: Record<string, string>,
  keepStoredHeads: boolean,
) {
  const houseIds = listValues(lists, fields, "houseId");
  const stored = new Map(
    snapshot.lfoInventories
      .filter((inv) => inv.lastFeedOrderId === lfoId)
      .map((inv) => [inv.houseId, inv]),
  );
  return houseIds.map((houseId, index) => {
    const prev = stored.get(houseId);
    return {
      id: prev?.id ?? `${lfoId}-inv-${index}`,
      lastFeedOrderId: lfoId,
      houseId,
      binAPounds: num((lists.binAPounds ?? [])[index] ?? fields.binAPounds),
      binBPounds: num((lists.binBPounds ?? [])[index] ?? fields.binBPounds),
      headCount: keepStoredHeads && prev ? prev.headCount : null,
      feedUpAt: emptyToNull((lists.feedUpAt ?? [])[index] ?? fields.feedUpAt),
    };
  });
}

function visitTypeForKind(formKind: string) {
  if (formKind === "placement") return "PLACEMENT";
  if (formKind === "prebrood") return "PREBROOD";
  return "ROUTINE_SERVICE";
}

function activeFarmFlockId(snapshot: OfflineSnapshot, farmId: string) {
  return (
    snapshot.flocks.find(
      (flock) =>
        flock.farmId === farmId &&
        flock.flockStatus !== "COMPLETED" &&
        !flock.deletedAt,
    )?.id ?? null
  );
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

function formFlag(fields: Record<string, string>, name: string) {
  return fields[name] === "on" || fields[name] === "true";
}

function addDaysKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return format(addDays(new Date(y, m - 1, d, 12), days), "yyyy-MM-dd");
}

function activeFlockIdsForFarm(snapshot: OfflineSnapshot, farmId: string) {
  return new Set(
    snapshot.flocks
      .filter(
        (flock) =>
          flock.farmId === farmId && flock.flockStatus !== "COMPLETED" && !flock.deletedAt,
      )
      .map((flock) => flock.id),
  );
}

function activeHouseFlock(snapshot: OfflineSnapshot, farmId: string, houseId: string) {
  const active = activeFlockIdsForFarm(snapshot, farmId);
  return snapshot.houseFlocks.find((hf) => hf.houseId === houseId && active.has(hf.flockId));
}

function syncFlockDatesFromHouses(snapshot: OfflineSnapshot, flockId: string): OfflineSnapshot {
  const hfs = snapshot.houseFlocks.filter((hf) => hf.flockId === flockId);
  const places = hfs
    .map((hf) => hf.placementDate)
    .filter((value): value is string => Boolean(value))
    .slice()
    .sort();
  const catches = hfs
    .map((hf) => hf.catchDate)
    .filter((value): value is string => Boolean(value))
    .slice()
    .sort();
  if (!places[0]) return snapshot;
  return {
    ...snapshot,
    flocks: snapshot.flocks.map((flock) =>
      flock.id === flockId
        ? {
            ...flock,
            placementDate: places[0]!,
            projectedCatchDate: catches[0] ?? addDaysKey(places[0]!, 52),
          }
        : flock,
    ),
  };
}

function assignHouseFlockNumber(
  snapshot: OfflineSnapshot,
  farmId: string,
  houseId: string,
  currentFlockId: string,
  nextNumber: string,
  placementDate: string,
  catchDate: string,
  placedBirdCount: number,
): OfflineSnapshot {
  const current = snapshot.flocks.find((flock) => flock.id === currentFlockId);
  const existing =
    snapshot.flocks.find(
      (flock) =>
        flock.farmId === farmId &&
        flock.id !== currentFlockId &&
        flock.flockStatus !== "COMPLETED" &&
        !flock.deletedAt &&
        normalizeFlockNumber(flock.flockNumber) === normalizeFlockNumber(nextNumber),
    ) ?? null;
  const others = snapshot.houseFlocks.filter(
    (hf) => hf.flockId === currentFlockId && hf.houseId !== houseId,
  ).length;
  const plan = planFlockNumberChange({
    nextNumber,
    currentFlockNumber: current?.flockNumber ?? "",
    currentFlockId,
    otherHousesOnCurrentFlock: others,
    existingFlockIdWithNumber: existing?.id ?? null,
  });
  if (plan.type === "keep") return syncFlockDatesFromHouses(snapshot, currentFlockId);
  if (plan.type === "rename") {
    return syncFlockDatesFromHouses(
      {
        ...snapshot,
        flocks: snapshot.flocks.map((flock) =>
          flock.id === currentFlockId ? { ...flock, flockNumber: nextNumber } : flock,
        ),
      },
      currentFlockId,
    );
  }

  const targetId =
    plan.type === "move"
      ? plan.flockId
      : localRecordId();
  let next = snapshot;
  if (plan.type === "create") {
    next = {
      ...next,
      flocks: [
        ...next.flocks,
        {
          id: targetId,
          farmId,
          flockNumber: nextNumber,
          flockStatus: "ACTIVE",
          placementDate,
          projectedCatchDate: catchDate,
          actualCatchDate: null,
          targetMarketAge: current?.targetMarketAge ?? null,
          growthRateLbsPerDay: current?.growthRateLbsPerDay ?? null,
          deletedAt: null,
        },
      ],
    };
  }
  if (targetId !== currentFlockId) {
    next = {
      ...next,
      houseFlocks: next.houseFlocks.map((hf) =>
        hf.houseId === houseId && hf.flockId === currentFlockId
          ? { ...hf, flockId: targetId, placedBirdCount: placedBirdCount || hf.placedBirdCount }
          : hf,
      ),
    };
    next = syncFlockDatesFromHouses(next, currentFlockId);
    const leftover = next.houseFlocks.filter((hf) => hf.flockId === currentFlockId).length;
    const otherActive = next.flocks.some(
      (flock) =>
        flock.farmId === farmId &&
        flock.id !== currentFlockId &&
        flock.flockStatus !== "COMPLETED" &&
        !flock.deletedAt,
    );
    if (leftover === 0 && otherActive) {
      next = {
        ...next,
        flocks: next.flocks.map((flock) =>
          flock.id === currentFlockId
            ? { ...flock, deletedAt: new Date().toISOString(), flockStatus: "COMPLETED" }
            : flock,
        ),
      };
    }
  }
  return syncFlockDatesFromHouses(next, targetId);
}

function dropFarmFromDashboard(snapshot: OfflineSnapshot, farmId: string): OfflineSnapshot {
  if (!snapshot.dashboard) return snapshot;
  const farmName = snapshot.farms.find((farm) => farm.id === farmId)?.farmName;
  const dashboard = snapshot.dashboard;
  return {
    ...snapshot,
    dashboard: {
      ...dashboard,
      farmCards: dashboard.farmCards.filter((card) => card.id !== farmId),
      todaysSchedule: dashboard.todaysSchedule.filter((row) => row.farmId !== farmId),
      upcomingSchedule: dashboard.upcomingSchedule.filter((row) => row.farmId !== farmId),
      upcomingCatches: dashboard.upcomingCatches.filter((row) =>
        farmName ? row.farmName !== farmName : true,
      ),
    },
  };
}

function applyUpdateHouse(snapshot: OfflineSnapshot, write: OfflineFormWrite): OfflineSnapshot {
  const fields = write.fields ?? {};
  const houseId = write.id ?? "";
  const farmId = write.farmId ?? fields.farmId ?? "";
  const house = snapshot.houses.find((row) => row.id === houseId);
  if (!house) return snapshot;

  let next: OfflineSnapshot = {
    ...snapshot,
    houses: snapshot.houses.map((row) =>
      row.id === houseId
        ? {
            ...row,
            houseNumber: num(fields.houseNumber, row.houseNumber),
            squareFootage: num(fields.squareFootage, row.squareFootage),
            totalFanCFM: emptyToNull(fields.totalFanCFM) ? num(fields.totalFanCFM) : row.totalFanCFM,
            totalPowerCFM: emptyToNull(fields.totalPowerCFM)
              ? num(fields.totalPowerCFM)
              : row.totalPowerCFM,
            numberOfFans: emptyToNull(fields.numberOfFans) ? num(fields.numberOfFans) : row.numberOfFans,
            notes: fields.notes !== undefined ? emptyToNull(fields.notes) : row.notes,
          }
        : row,
    ),
  };

  const remaining = next.houses.filter(
    (row) =>
      row.farmId === farmId &&
      !row.deletedAt &&
      row.id !== houseId &&
      isHouseInPropagateRange(row.houseNumber, house.houseNumber),
  );
  if (remaining.length > 0) {
    const remainingIds = new Set(remaining.map((row) => row.id));
    next = {
      ...next,
      houses: next.houses.map((row) => {
        if (!remainingIds.has(row.id)) return row;
        return {
          ...row,
          squareFootage: formFlag(fields, "applySquareFootageToRemaining")
            ? num(fields.squareFootage, row.squareFootage)
            : row.squareFootage,
          totalFanCFM: formFlag(fields, "applyMinVentCfmToRemaining")
            ? emptyToNull(fields.totalFanCFM)
              ? num(fields.totalFanCFM)
              : row.totalFanCFM
            : row.totalFanCFM,
          totalPowerCFM: formFlag(fields, "applyPowerCfmToRemaining")
            ? emptyToNull(fields.totalPowerCFM)
              ? num(fields.totalPowerCFM)
              : row.totalPowerCFM
            : row.totalPowerCFM,
        };
      }),
    };
  }

  const placedRaw = emptyToNull(fields.placedBirdCount);
  const placementRaw = emptyToNull(fields.placementDate);
  const catchRaw = emptyToNull(fields.catchDate);
  const catchTimeSubmitted = fields.catchTime !== undefined;
  const flockNumberRaw = emptyToNull(fields.flockNumber);
  if (
    placedRaw == null &&
    placementRaw == null &&
    catchRaw == null &&
    !catchTimeSubmitted &&
    flockNumberRaw == null
  ) {
    return next;
  }

  const activeIds = activeFlockIdsForFarm(next, farmId);
  const activeFlock =
    next.flocks.find(
      (flock) =>
        activeIds.has(flock.id) &&
        next.houseFlocks.some((hf) => hf.houseId === houseId && hf.flockId === flock.id),
    ) ?? next.flocks.find((flock) => activeIds.has(flock.id));
  if (!activeFlock) return next;

  function upsertHf(
    current: OfflineSnapshot,
    targetHouseId: string,
    patch: {
      placedBirdCount?: number;
      placementDate?: string | null;
      catchDate?: string | null;
      catchTime?: string | null;
    },
  ) {
    const existing = activeHouseFlock(current, farmId, targetHouseId);
    if (existing) {
      return {
        ...current,
        houseFlocks: current.houseFlocks.map((hf) =>
          hf.id === existing.id
            ? {
                ...hf,
                placedBirdCount: patch.placedBirdCount ?? hf.placedBirdCount,
                placementDate:
                  patch.placementDate !== undefined ? patch.placementDate : hf.placementDate,
                catchDate: patch.catchDate !== undefined ? patch.catchDate : hf.catchDate,
                catchTime: patch.catchTime !== undefined ? patch.catchTime : hf.catchTime,
              }
            : hf,
        ),
      };
    }
    if (patch.placedBirdCount == null && patch.placementDate == null && patch.catchDate == null) {
      return current;
    }
    const place =
      patch.placementDate ?? asDateKey(activeFlock!.placementDate) ?? activeFlock!.placementDate.slice(0, 10);
    return {
      ...current,
      houseFlocks: [
        ...current.houseFlocks,
        {
          id: localRecordId(),
          flockId: activeFlock!.id,
          houseId: targetHouseId,
          placedBirdCount: patch.placedBirdCount ?? 1,
          placementDate: place,
          catchDate: patch.catchDate ?? addDaysKey(place, 52),
          catchTime: patch.catchTime ?? null,
        },
      ],
    };
  }

  const placedBirdCount = placedRaw != null ? num(placedRaw) : undefined;
  const placementDate = placementRaw;
  const catchDate = catchRaw ?? (placementDate ? addDaysKey(placementDate, 52) : undefined);
  next = upsertHf(next, houseId, {
    placedBirdCount,
    placementDate,
    catchDate,
    catchTime: catchTimeSubmitted ? emptyToNull(fields.catchTime) : undefined,
  });

  if (flockNumberRaw) {
    const hf = activeHouseFlock(next, farmId, houseId);
    if (hf) {
      const place = placementDate ?? hf.placementDate ?? asDateKey(activeFlock.placementDate) ?? "";
      const catchResolved = catchDate ?? hf.catchDate ?? addDaysKey(place, 52);
      next = assignHouseFlockNumber(
        next,
        farmId,
        houseId,
        hf.flockId,
        flockNumberRaw,
        place,
        catchResolved,
        hf.placedBirdCount,
      );
    }
  }

  const remainingFlags =
    formFlag(fields, "applyBirdsToRemaining") ||
    formFlag(fields, "applyPlacementToRemaining") ||
    formFlag(fields, "applyCatchDateToRemaining") ||
    formFlag(fields, "applyCatchTimeToRemaining") ||
    formFlag(fields, "applyFlockIdToRemaining");
  if (remainingFlags) {
    for (const row of remaining) {
      next = upsertHf(next, row.id, {
        ...(formFlag(fields, "applyBirdsToRemaining") ? { placedBirdCount } : {}),
        ...(formFlag(fields, "applyPlacementToRemaining") ? { placementDate } : {}),
        ...(formFlag(fields, "applyCatchDateToRemaining") ? { catchDate } : {}),
        ...(formFlag(fields, "applyCatchTimeToRemaining") && catchTimeSubmitted
          ? { catchTime: emptyToNull(fields.catchTime) }
          : {}),
      });
      if (formFlag(fields, "applyFlockIdToRemaining") && flockNumberRaw) {
        const hf = activeHouseFlock(next, farmId, row.id);
        if (hf) {
          const place = placementDate ?? hf.placementDate ?? asDateKey(activeFlock.placementDate) ?? "";
          const catchResolved = catchDate ?? hf.catchDate ?? addDaysKey(place, 52);
          next = assignHouseFlockNumber(
            next,
            farmId,
            row.id,
            hf.flockId,
            flockNumberRaw,
            place,
            catchResolved,
            hf.placedBirdCount,
          );
        }
      }
    }
  }

  return next;
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
      return dropFarmFromDashboard(
        {
          ...snapshot,
          farms: snapshot.farms.map((farm) =>
            farm.id === write.farmId ? { ...farm, isActive: false } : farm,
          ),
        },
        write.farmId ?? "",
      );
    case "reactivateFarm":
      return {
        ...snapshot,
        farms: snapshot.farms.map((farm) =>
          farm.id === write.farmId ? { ...farm, isActive: true, deletedAt: null } : farm,
        ),
      };
    case "deleteFarm":
      return dropFarmFromDashboard(
        {
          ...snapshot,
          farms: snapshot.farms.map((farm) =>
            farm.id === write.farmId
              ? { ...farm, isActive: false, deletedAt: now }
              : farm,
          ),
        },
        write.farmId ?? "",
      );
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
      return applyUpdateHouse(snapshot, write);
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
      const inventories = lfoInventoriesFromForm(snapshot, id, lists, fields, false);
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
    case "updateLfo": {
      const lfoId = write.id ?? "";
      const existing = snapshot.lfos.find((row) => row.id === lfoId);
      if (!existing) return snapshot;
      const inventories = lfoInventoriesFromForm(snapshot, lfoId, lists, fields, true);
      return {
        ...snapshot,
        lfos: snapshot.lfos.map((row) =>
          row.id === lfoId
            ? {
                ...row,
                orderDate: fields.orderDate ?? row.orderDate,
                orderTime:
                  fields.orderTime !== undefined ? emptyToNull(fields.orderTime) : row.orderTime,
                consumptionRate:
                  fields.consumptionRate != null
                    ? num(fields.consumptionRate, row.consumptionRate)
                    : row.consumptionRate,
                notes: fields.notes !== undefined ? emptyToNull(fields.notes) : row.notes,
              }
            : row,
        ),
        lfoInventories: [
          ...snapshot.lfoInventories.filter((inv) => inv.lastFeedOrderId !== lfoId),
          ...inventories,
        ],
      };
    }
    case "saveAsNewLfo": {
      const id = write.id ?? `local-lfo`;
      const fromId = (write.extra as { fromLfoId?: string } | undefined)?.fromLfoId;
      const source = snapshot.lfos.find((row) => row.id === fromId);
      const farmId = write.farmId ?? source?.farmId ?? fields.farmId ?? "";
      const flockId =
        source?.flockId ||
        snapshot.flocks.find((flock) => flock.farmId === farmId && flock.flockStatus === "ACTIVE")
          ?.id ||
        snapshot.flocks.find((flock) => flock.farmId === farmId)?.id ||
        "";
      const notes =
        parseCustomLfoNumber(source?.notes) != null
          ? nextCustomLfoName(snapshot.lfos.map((row) => row.notes))
          : emptyToNull(fields.notes);
      const inventories = lfoInventoriesFromForm(snapshot, id, lists, fields, false);
      return {
        ...snapshot,
        lfos: [
          {
            id,
            farmId,
            flockId,
            orderDate: fields.orderDate ?? now.slice(0, 10),
            orderTime: emptyToNull(fields.orderTime),
            consumptionRate: num(fields.consumptionRate, source?.consumptionRate ?? 0.45),
            calculatedAt: now,
            notes,
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
    case "createFlock": {
      const farmId = write.farmId ?? fields.farmId ?? "";
      const flockNumber = (fields.flockNumber ?? "").trim();
      const placementDate = (fields.placementDate ?? "").trim();
      if (!farmId || !flockNumber || !placementDate) return snapshot;

      const houseIds = listValues(lists, fields, "houseId");
      const placedCounts = listValues(lists, fields, "placedBirdCount");
      const placements = houseIds
        .map((houseId, i) => ({
          houseId,
          placedBirdCount: num(placedCounts[i]),
        }))
        .filter((row) => row.placedBirdCount > 0);

      const activeFlockIds = new Set(
        snapshot.flocks
          .filter(
            (flock) =>
              flock.farmId === farmId &&
              flock.flockStatus !== "COMPLETED" &&
              !flock.deletedAt,
          )
          .map((flock) => flock.id),
      );
      const occupied = new Set(
        snapshot.houseFlocks
          .filter((hf) => activeFlockIds.has(hf.flockId))
          .map((hf) => hf.houseId),
      );
      const openPlacements = placements.filter((row) => !occupied.has(row.houseId));
      const catchDate = emptyToNull(fields.projectedCatchDate)?.slice(0, 10) ?? null;
      const targetMarketAge = emptyToNull(fields.targetMarketAge)
        ? num(fields.targetMarketAge)
        : null;

      const existing = snapshot.flocks.find(
        (flock) =>
          flock.farmId === farmId &&
          flock.flockStatus !== "COMPLETED" &&
          !flock.deletedAt &&
          normalizeFlockNumber(flock.flockNumber) === normalizeFlockNumber(flockNumber),
      );

      const flockId = existing?.id ?? write.id ?? localRecordId();
      const nextFlocks = existing
        ? snapshot.flocks
        : [
            ...snapshot.flocks,
            {
              id: flockId,
              farmId,
              flockNumber,
              flockStatus: fields.flockStatus || "ACTIVE",
              placementDate,
              projectedCatchDate: catchDate,
              actualCatchDate: emptyToNull(fields.actualCatchDate),
              targetMarketAge,
              growthRateLbsPerDay: null,
              deletedAt: null,
            },
          ];

      const alreadyOnFlock = new Set(
        snapshot.houseFlocks.filter((hf) => hf.flockId === flockId).map((hf) => hf.houseId),
      );
      const nextHouseFlocks = [
        ...snapshot.houseFlocks,
        ...openPlacements
          .filter((row) => !alreadyOnFlock.has(row.houseId))
          .map((row) => ({
            id: localRecordId(),
            flockId,
            houseId: row.houseId,
            placedBirdCount: row.placedBirdCount,
            placementDate: placementDate.slice(0, 10),
            catchDate,
            catchTime: null,
          })),
      ];

      return { ...snapshot, flocks: nextFlocks, houseFlocks: nextHouseFlocks };
    }
    case "createFarm": {
      const farmId = write.id ?? write.farmId ?? localRecordId();
      const farmName = (fields.farmName ?? "").trim();
      if (!farmName) return snapshot;
      const houseCount = Math.min(40, Math.max(0, Math.floor(num(fields.numberOfHouses, 0))));
      const houses = Array.from({ length: houseCount }, (_, i) => ({
        id: localRecordId(),
        farmId,
        houseNumber: i + 1,
        squareFootage: 29700,
        totalFanCFM: null,
        totalPowerCFM: null,
        numberOfFans: null,
        notes: null,
        loggedTemp: null,
        loggedTempAt: null,
        deletedAt: null,
      }));
      return {
        ...snapshot,
        farms: [
          ...snapshot.farms,
          {
            id: farmId,
            farmName,
            growerName: (fields.growerName ?? "").trim(),
            farmNumber: null,
            phoneNumber: null,
            isActive: true,
            deletedAt: null,
            notes: emptyToNull(fields.notes),
            numberOfHouses: houseCount,
            numberOfGenerators: emptyToNull(fields.numberOfGenerators)
              ? num(fields.numberOfGenerators)
              : null,
            address: null,
            city: null,
            state: null,
            zipCode: null,
          },
        ],
        houses: [...snapshot.houses, ...houses],
      };
    }
    case "completeFlock": {
      const flockId = write.id ?? "";
      return {
        ...snapshot,
        flocks: snapshot.flocks.map((flock) =>
          flock.id === flockId
            ? {
                ...flock,
                flockStatus: "COMPLETED",
                actualCatchDate: flock.actualCatchDate ?? now.slice(0, 10),
              }
            : flock,
        ),
      };
    }
    case "deleteFlock": {
      const flockId = write.id ?? "";
      const flock = snapshot.flocks.find((row) => row.id === flockId);
      if (!flock || flock.flockStatus === "ACTIVE") return snapshot;
      return {
        ...snapshot,
        flocks: snapshot.flocks.map((row) =>
          row.id === flockId ? { ...row, deletedAt: now } : row,
        ),
      };
    }
    case "reactivateFlock": {
      const flockId = write.id ?? "";
      const flock = snapshot.flocks.find((row) => row.id === flockId);
      if (!flock) return snapshot;
      const houseIds = new Set(
        snapshot.houseFlocks.filter((hf) => hf.flockId === flockId).map((hf) => hf.houseId),
      );
      const overlap = snapshot.houseFlocks.some((hf) => {
        if (!houseIds.has(hf.houseId) || hf.flockId === flockId) return false;
        const other = snapshot.flocks.find((row) => row.id === hf.flockId);
        return Boolean(
          other &&
            other.farmId === flock.farmId &&
            other.flockStatus !== "COMPLETED" &&
            !other.deletedAt,
        );
      });
      if (overlap) return snapshot;
      return {
        ...snapshot,
        flocks: snapshot.flocks.map((row) =>
          row.id === flockId ? { ...row, flockStatus: "ACTIVE", actualCatchDate: null } : row,
        ),
      };
    }
    case "updateFlockNumber": {
      const nextNumber = (fields.flockNumber ?? "").trim();
      if (!nextNumber || !write.id) return snapshot;
      return {
        ...snapshot,
        flocks: snapshot.flocks.map((flock) =>
          flock.id === write.id ? { ...flock, flockNumber: nextNumber } : flock,
        ),
      };
    }
    case "updateWeightProjection": {
      const rate = num(fields.growthRateLbsPerDay, NaN);
      if (!Number.isFinite(rate) || rate < 0 || !write.id) return snapshot;
      const flock = snapshot.flocks.find((row) => row.id === write.id);
      if (!flock) return snapshot;
      return {
        ...snapshot,
        flocks: snapshot.flocks.map((row) =>
          row.farmId === flock.farmId && row.flockStatus !== "COMPLETED" && !row.deletedAt
            ? { ...row, growthRateLbsPerDay: rate }
            : row,
        ),
      };
    }
    case "saveServiceDraft": {
      const farmId = write.farmId ?? "";
      const formKind = fields.formKind ?? "";
      if (!farmId || !formKind) return snapshot;
      const drafts = (snapshot.serviceFormDrafts ?? []).filter(
        (row) => !(row.farmId === farmId && row.formKind === formKind),
      );
      const next: OfflineServiceFormDraft = {
        farmId,
        formKind,
        payload: write.extra,
        updatedAt: now,
      };
      return { ...snapshot, serviceFormDrafts: [...drafts, next] };
    }
    case "completeServiceForm": {
      const farmId = write.farmId ?? "";
      const form = write.extra as AnyServiceForm | undefined;
      if (!farmId || !form || !isServiceFormKind(form.kind)) return snapshot;
      const formDate = form.date?.trim() || now.slice(0, 10);
      const comments = typeof form.comments === "string" ? form.comments.trim() : "";
      const formId = write.id ?? localRecordId();
      const forms = snapshot.serviceForms ?? [];
      const existing = forms.find((row) => row.id === formId);
      const flockId = existing?.flockId ?? activeFarmFlockId(snapshot, farmId);
      const visitId =
        existing?.visitId ??
        emptyToNull(fields.existingVisitId) ??
        localRecordId();
      const flock = snapshot.flocks.find((row) => row.id === flockId);
      const placement = flock ? asDate(flock.placementDate) : null;
      const visitDate = asDate(formDate);
      const birdAgeInDays =
        placement && visitDate ? birdAgeFromPlacement(placement, visitDate) : null;
      const visit: OfflineVisit = {
        id: visitId,
        farmId,
        flockId,
        visitDate: formDate,
        visitType: visitTypeForKind(form.kind),
        birdAgeInDays,
        generalBirdCondition: "Healthy",
        followUpRequired: false,
        followUpDate: null,
        notes: comments || null,
        loggedAt: now,
      };
      const visits = snapshot.visits.some((row) => row.id === visitId)
        ? snapshot.visits.map((row) => (row.id === visitId ? { ...row, ...visit } : row))
        : [visit, ...snapshot.visits];
      const stored: OfflineServiceForm = {
        id: formId,
        farmId,
        flockId,
        formKind: form.kind,
        formDate,
        payload: form,
        visitId,
        createdAt: existing?.createdAt ?? now,
      };
      const nextForms = existing
        ? forms.map((row) => (row.id === formId ? stored : row))
        : [stored, ...forms];
      return {
        ...snapshot,
        visits,
        serviceForms: nextForms,
        serviceFormDrafts: (snapshot.serviceFormDrafts ?? []).filter(
          (row) => !(row.farmId === farmId && row.formKind === form.kind),
        ),
      };
    }
    case "deleteServiceDraft": {
      const farmId = write.farmId ?? "";
      const formKind = fields.formKind ?? "";
      return {
        ...snapshot,
        serviceFormDrafts: (snapshot.serviceFormDrafts ?? []).filter(
          (row) => !(row.farmId === farmId && row.formKind === formKind),
        ),
      };
    }
    case "deleteServiceForm": {
      const existing = (snapshot.serviceForms ?? []).find((row) => row.id === write.id);
      return {
        ...snapshot,
        serviceForms: (snapshot.serviceForms ?? []).filter((row) => row.id !== write.id),
        visits: existing?.visitId
          ? snapshot.visits.filter((row) => row.id !== existing.visitId)
          : snapshot.visits,
      };
    }
    default:
      return snapshot;
  }
}

function asFormWrite(item: import("@/lib/offline/types").OfflineOutboxItem) {
  if (item.kind !== "formWrite") return null;
  return item.payload as OfflineFormWrite;
}

function sameServiceDraft(a: OfflineFormWrite, b: OfflineFormWrite) {
  return (
    a.farmId === b.farmId &&
    (a.fields?.formKind ?? "") === (b.fields?.formKind ?? "")
  );
}

export function coalesceFormWrite(
  items: import("@/lib/offline/types").OfflineOutboxItem[],
  next: import("@/lib/offline/types").OfflineOutboxItem,
): import("@/lib/offline/types").OfflineOutboxItem[] {
  if (next.kind !== "formWrite") return [...items, next];
  const write = next.payload as OfflineFormWrite;

  if (write.action === "saveServiceDraft") {
    const idx = items.findIndex((item) => {
      const payload = asFormWrite(item);
      return payload?.action === "saveServiceDraft" && sameServiceDraft(payload, write);
    });
    if (idx >= 0) {
      const copy = items.slice();
      copy[idx] = next;
      return copy;
    }
    return [...items, next];
  }

  if (write.action === "deleteServiceDraft" || write.action === "completeServiceForm") {
    const kept = items.filter((item) => {
      const payload = asFormWrite(item);
      if (!payload) return true;
      if (payload.action !== "saveServiceDraft") return true;
      const kind =
        write.action === "completeServiceForm"
          ? (write.extra as { kind?: string } | undefined)?.kind
          : write.fields?.formKind;
      return !(payload.farmId === write.farmId && payload.fields?.formKind === kind);
    });
    if (write.action === "deleteServiceDraft") return [...kept, next];
    items = kept;
  }

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
