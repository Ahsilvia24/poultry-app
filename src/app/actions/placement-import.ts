"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { matchPlacementFarmGroups } from "@/lib/placement-import/match";
import { extractPlacementRows } from "@/lib/placement-import/extract";
import { farmGroupKey, groupPlacementFarms } from "@/lib/placement-import/parse";
import type {
  PlacementFarmPreview,
  PlacementRow,
} from "@/lib/placement-import/types";
import { getScheduleImport } from "@/lib/schedule-imports";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { SCHEDULE_IMPORTS_DIR } from "@/lib/schedule-imports";

const DEFAULT_SQ_FT = 29700;

export type PlacementPreviewResult =
  | {
      ok: true;
      importId: string;
      farms: PlacementFarmPreview[];
      totalRows: number;
    }
  | { ok: false; error: string };

export type PlacementSelection = {
  key: string;
  selected: boolean;
  /** When matched and names differ, update saved farm name to imported name. */
  renameToImportedName?: boolean;
};

export type PlacementApplyResult =
  | {
      ok: true;
      createdFarms: number;
      updatedNames: number;
      createdFlocks: number;
      createdHouses: number;
      warnings: string[];
    }
  | { ok: false; error: string };

function parsedPath(importId: string) {
  return path.join(SCHEDULE_IMPORTS_DIR, `${importId}.placement.json`);
}

async function loadParsedRows(importId: string): Promise<PlacementRow[] | null> {
  try {
    const raw = await readFile(parsedPath(importId), "utf8");
    const parsed = JSON.parse(raw) as PlacementRow[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function previewPlacementImportAction(
  importId: string,
): Promise<PlacementPreviewResult> {
  const user = await requireUser();
  if (!user.id) return { ok: false, error: "Unauthorized" };

  const found = await getScheduleImport(importId);
  if (!found || found.meta.importType !== "placement") {
    return { ok: false, error: "Placement upload not found." };
  }

  let rows = await loadParsedRows(importId);
  if (!rows) {
    const bytes = await readFile(found.absolutePath);
    rows = await extractPlacementRows({
      bytes,
      fileName: found.meta.originalName,
      mimeType: found.meta.mimeType,
    });
    if (rows.length === 0) {
      return {
        ok: false,
        error:
          "Could not read any placement rows. Use a Weekly Chick Placement PDF or a spreadsheet with Date Placed, Farm Code, Farm Name, Flock Code, House No, and Number Sent.",
      };
    }
    await writeFile(parsedPath(importId), JSON.stringify(rows), "utf8");
  }

  const existing = await prisma.farm.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, farmName: true, farmNumber: true },
  });

  const grouped = groupPlacementFarms(rows);
  const matches = matchPlacementFarmGroups(grouped, existing);
  const farms: PlacementFarmPreview[] = grouped.map((group, i) => {
    const match = matches[i]!;
    return {
      ...group,
      match,
      isMyFarm: match.kind !== "none",
    };
  });

  return { ok: true, importId, farms, totalRows: rows.length };
}

export async function applyPlacementImportAction(input: {
  importId: string;
  selections: PlacementSelection[];
}): Promise<PlacementApplyResult> {
  const user = await requireUser();
  if (!user.id) return { ok: false, error: "Unauthorized" };

  const rows = await loadParsedRows(input.importId);
  if (!rows?.length) {
    return { ok: false, error: "Parsed placement data missing. Upload and preview again." };
  }

  const selectedKeys = new Set(
    input.selections.filter((s) => s.selected).map((s) => s.key),
  );
  if (selectedKeys.size === 0) {
    return { ok: false, error: "Select at least one farm to import." };
  }

  const renameKeys = new Set(
    input.selections.filter((s) => s.selected && s.renameToImportedName).map((s) => s.key),
  );

  const existing = await prisma.farm.findMany({
    where: { userId: user.id, deletedAt: null },
    include: {
      houses: { where: { deletedAt: null }, select: { id: true, houseNumber: true } },
    },
  });

  let createdFarms = 0;
  let updatedNames = 0;
  let createdFlocks = 0;
  let createdHouses = 0;
  const warnings: string[] = [];

  const selectedRows = rows.filter((r) =>
    selectedKeys.has(farmGroupKey(r.farmCode, r.farmName)),
  );

  const byFarm = new Map<string, PlacementRow[]>();
  for (const row of selectedRows) {
    const key = farmGroupKey(row.farmCode, row.farmName);
    const list = byFarm.get(key) ?? [];
    list.push(row);
    byFarm.set(key, list);
  }

  const farmEntries = Array.from(byFarm.entries());
  const farmMatches = matchPlacementFarmGroups(
    farmEntries.map(([, farmRows]) => ({
      farmName: farmRows[0]!.farmName,
      farmCode: farmRows[0]!.farmCode,
    })),
    existing.map((f) => ({ id: f.id, farmName: f.farmName, farmNumber: f.farmNumber })),
  );

  for (let farmIndex = 0; farmIndex < farmEntries.length; farmIndex++) {
    const [key, farmRows] = farmEntries[farmIndex]!;
    const sample = farmRows[0]!;
    const match = farmMatches[farmIndex]!;

    let farmId: string;
    let houses = match.farm
      ? existing.find((f) => f.id === match.farm!.id)?.houses ?? []
      : [];

    if (match.farm) {
      farmId = match.farm.id;
      const data: { farmName?: string; farmNumber?: string | null } = {};
      if (
        renameKeys.has(key) &&
        match.farm &&
        match.farm.farmName.trim() !== sample.farmName.trim()
      ) {
        data.farmName = sample.farmName;
        updatedNames += 1;
      }
      if (!match.farm.farmNumber && sample.farmCode) {
        data.farmNumber = sample.farmCode;
      }
      if (Object.keys(data).length > 0) {
        await prisma.farm.update({ where: { id: farmId }, data });
      }
    } else {
      const maxHouse = Math.max(...farmRows.map((r) => r.houseNo), 1);
      const created = await prisma.farm.create({
        data: {
          userId: user.id,
          farmName: sample.farmName,
          growerName: "",
          farmNumber: sample.farmCode,
          numberOfHouses: maxHouse,
          houses: {
            create: Array.from({ length: maxHouse }, (_, i) => ({
              houseNumber: i + 1,
              squareFootage: DEFAULT_SQ_FT,
            })),
          },
        },
        include: { houses: { select: { id: true, houseNumber: true } } },
      });
      farmId = created.id;
      houses = created.houses;
      createdFarms += 1;
      createdHouses += created.houses.length;
      existing.push({
        ...created,
        houses: created.houses,
      } as (typeof existing)[number]);
    }

    // Ensure every referenced house exists (gap-tolerant).
    const needed = Array.from(new Set(farmRows.map((r) => r.houseNo)));
    for (const houseNo of needed) {
      if (houses.some((h) => h.houseNumber === houseNo)) continue;
      const created = await prisma.house.create({
        data: {
          farmId,
          houseNumber: houseNo,
          squareFootage: DEFAULT_SQ_FT,
        },
        select: { id: true, houseNumber: true },
      });
      houses.push(created);
      createdHouses += 1;
      await prisma.farm.update({
        where: { id: farmId },
        data: { numberOfHouses: Math.max(...houses.map((h) => h.houseNumber)) },
      });
    }

    const houseByNumber = new Map(houses.map((h) => [h.houseNumber, h.id]));

    // Group by flock id
    const byFlock = new Map<string, PlacementRow[]>();
    for (const row of farmRows) {
      const list = byFlock.get(row.flockId) ?? [];
      list.push(row);
      byFlock.set(row.flockId, list);
    }

    for (const [flockId, flockRows] of byFlock) {
      // Collapse duplicate house rows (keep last number sent / date)
      const byHouse = new Map<number, PlacementRow>();
      for (const row of flockRows) byHouse.set(row.houseNo, row);
      const uniqueHouseRows = Array.from(byHouse.values());

      const placements: Array<{
        houseId: string;
        placedBirdCount: number;
        placementDate: Date;
      }> = [];

      for (const row of uniqueHouseRows) {
        const houseId = houseByNumber.get(row.houseNo);
        if (!houseId) continue;
        const occupied = await prisma.houseFlock.findFirst({
          where: {
            houseId,
            flock: { farmId, flockStatus: "ACTIVE", deletedAt: null },
          },
          include: { flock: { select: { flockNumber: true } } },
        });
        if (occupied) {
          warnings.push(
            `${sample.farmName} house ${row.houseNo} already on active flock ${occupied.flock.flockNumber} — skipped.`,
          );
          continue;
        }
        placements.push({
          houseId,
          placedBirdCount: row.numberSent,
          placementDate: new Date(`${row.datePlaced}T12:00:00.000Z`),
        });
      }

      if (placements.length === 0) continue;

      // Existing flock with same number?
      const existingFlock = await prisma.flock.findFirst({
        where: {
          farmId,
          flockNumber: flockId,
          deletedAt: null,
          flockStatus: "ACTIVE",
        },
      });
      if (existingFlock) {
        warnings.push(
          `${sample.farmName} already has active flock ${flockId} — skipped creating another.`,
        );
        continue;
      }

      const dates = placements.map((p) => p.placementDate.getTime());
      const minDate = new Date(Math.min(...dates));
      const total = placements.reduce((s, p) => s + p.placedBirdCount, 0);

      await prisma.flock.create({
        data: {
          farmId,
          flockNumber: flockId,
          placementDate: minDate,
          initialBirdCount: total,
          flockStatus: "ACTIVE",
          houseFlocks: {
            create: placements.map((p) => ({
              houseId: p.houseId,
              placedBirdCount: p.placedBirdCount,
              placementDate: p.placementDate,
            })),
          },
        },
      });
      createdFlocks += 1;
    }
  }

  revalidatePath("/");
  revalidatePath("/farms");
  return {
    ok: true,
    createdFarms,
    updatedNames,
    createdFlocks,
    createdHouses,
    warnings,
  };
}
