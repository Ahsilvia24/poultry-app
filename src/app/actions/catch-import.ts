"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  matchPlacementFarmGroups,
} from "@/lib/placement-import/match";
import { extractCatchRows } from "@/lib/catch-import/extract";
import { farmGroupKey, groupCatchFarms } from "@/lib/catch-import/parse";
import type { CatchFarmPreview, CatchRow } from "@/lib/catch-import/types";
import { getScheduleImport, SCHEDULE_IMPORTS_DIR } from "@/lib/schedule-imports";
import { readFile, writeFile } from "fs/promises";
import path from "path";

export type CatchPreviewResult =
  | {
      ok: true;
      importId: string;
      farms: CatchFarmPreview[];
      totalRows: number;
    }
  | { ok: false; error: string };

export type CatchSelection = {
  key: string;
  selected: boolean;
  renameToImportedName?: boolean;
};

export type CatchApplyResult =
  | {
      ok: true;
      updatedHouses: number;
      updatedFlocks: number;
      updatedNames: number;
      warnings: string[];
    }
  | { ok: false; error: string };

function parsedPath(importId: string) {
  return path.join(SCHEDULE_IMPORTS_DIR, `${importId}.catch.json`);
}

async function loadParsedRows(importId: string): Promise<CatchRow[] | null> {
  try {
    const raw = await readFile(parsedPath(importId), "utf8");
    const parsed = JSON.parse(raw) as CatchRow[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function previewCatchImportAction(
  importId: string,
): Promise<CatchPreviewResult> {
  const user = await requireUser();
  if (!user.id) return { ok: false, error: "Unauthorized" };

  const found = await getScheduleImport(importId);
  if (!found || found.meta.importType !== "catch") {
    return { ok: false, error: "Catch Schedule upload not found." };
  }

  let rows = await loadParsedRows(importId);
  if (!rows) {
    const bytes = await readFile(found.absolutePath);
    rows = await extractCatchRows({
      bytes,
      fileName: found.meta.originalName,
      mimeType: found.meta.mimeType,
    });
    if (rows.length === 0) {
      return {
        ok: false,
        error:
          "Could not read catch rows yet. Use a Kill/Catch Schedule PDF or spreadsheet with Catch Date / Ending Kill Date, Farm Name, and House.",
      };
    }
    await writeFile(parsedPath(importId), JSON.stringify(rows), "utf8");
  }

  const existing = await prisma.farm.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, farmName: true, farmNumber: true },
  });

  const grouped = groupCatchFarms(rows);
  const matches = matchPlacementFarmGroups(grouped, existing);
  const farms: CatchFarmPreview[] = grouped.map((group, i) => {
    const match = matches[i]!;
    return {
      ...group,
      match,
      isMyFarm: match.kind !== "none",
    };
  });

  return { ok: true, importId, farms, totalRows: rows.length };
}

export async function applyCatchImportAction(input: {
  importId: string;
  selections: CatchSelection[];
}): Promise<CatchApplyResult> {
  const user = await requireUser();
  if (!user.id) return { ok: false, error: "Unauthorized" };

  const rows = await loadParsedRows(input.importId);
  if (!rows?.length) {
    return { ok: false, error: "Parsed catch data missing. Upload and preview again." };
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

  let updatedHouses = 0;
  let updatedFlocks = 0;
  let updatedNames = 0;
  const warnings: string[] = [];
  const touchedFlockIds = new Set<string>();

  const selectedRows = rows.filter((r) =>
    selectedKeys.has(farmGroupKey(r.farmCode, r.farmName)),
  );

  const byFarm = new Map<string, CatchRow[]>();
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

    if (!match.farm) {
      warnings.push(
        `${sample.farmName}: no matching farm — skipped (import Placement first or rename to match).`,
      );
      continue;
    }

    const farm = existing.find((f) => f.id === match.farm!.id);
    if (!farm) continue;

    if (
      renameKeys.has(key) &&
      match.farm.farmName.trim() !== sample.farmName.trim()
    ) {
      await prisma.farm.update({
        where: { id: farm.id },
        data: { farmName: sample.farmName },
      });
      match.farm.farmName = sample.farmName;
      updatedNames += 1;
    }

    if (!match.farm.farmNumber && sample.farmCode) {
      const taken = await prisma.farm.findFirst({
        where: {
          userId: user.id,
          deletedAt: null,
          id: { not: farm.id },
          farmNumber: sample.farmCode,
        },
        select: { id: true },
      });
      if (!taken) {
        await prisma.farm.update({
          where: { id: farm.id },
          data: { farmNumber: sample.farmCode },
        });
      }
    }

    const houseByNumber = new Map(farm.houses.map((h) => [h.houseNumber, h.id]));

    // Collapse duplicate house rows — keep latest catch date in file order.
    const byHouse = new Map<number, CatchRow>();
    for (const row of farmRows) byHouse.set(row.houseNo, row);

    for (const row of byHouse.values()) {
      const houseId = houseByNumber.get(row.houseNo);
      if (!houseId) {
        warnings.push(`${sample.farmName} house ${row.houseNo} not found — skipped.`);
        continue;
      }

      const activeHf = await prisma.houseFlock.findFirst({
        where: {
          houseId,
          flock: { farmId: farm.id, flockStatus: "ACTIVE", deletedAt: null },
        },
        include: { flock: { select: { id: true, flockNumber: true } } },
      });

      if (!activeHf) {
        warnings.push(
          `${sample.farmName} house ${row.houseNo}: no active flock — skipped.`,
        );
        continue;
      }

      if (
        row.flockId &&
        activeHf.flock.flockNumber.trim().toUpperCase() !== row.flockId &&
        !activeHf.flock.flockNumber.toUpperCase().includes(row.flockId)
      ) {
        warnings.push(
          `${sample.farmName} house ${row.houseNo}: active flock is ${activeHf.flock.flockNumber}, file says ${row.flockId} — updated catch date anyway.`,
        );
      }

      await prisma.houseFlock.update({
        where: { id: activeHf.id },
        data: { catchDate: new Date(`${row.catchDate}T12:00:00.000Z`) },
      });
      updatedHouses += 1;
      touchedFlockIds.add(activeHf.flock.id);
    }
  }

  // Roll flock projected catch up to the latest house catch on that flock.
  for (const flockId of touchedFlockIds) {
    const houseCatches = await prisma.houseFlock.findMany({
      where: { flockId, catchDate: { not: null } },
      select: { catchDate: true },
    });
    const times = houseCatches
      .map((h) => h.catchDate?.getTime())
      .filter((t): t is number => t != null);
    if (times.length === 0) continue;
    const latest = new Date(Math.max(...times));
    await prisma.flock.update({
      where: { id: flockId },
      data: { projectedCatchDate: latest },
    });
    updatedFlocks += 1;
  }

  revalidatePath("/");
  revalidatePath("/farms");
  return {
    ok: true,
    updatedHouses,
    updatedFlocks,
    updatedNames,
    warnings,
  };
}
