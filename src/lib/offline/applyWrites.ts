import { nextCustomLfoName } from "@/lib/lfo/customName";
import { birdAgeFromPlacement, calcTotalDailyLoss } from "@/lib/mortality/calculations";
import { normalizeFlockNumber } from "@/lib/houseFlockNumber";
import { asDate } from "@/lib/offline/dates";
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
