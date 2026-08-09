"use server";

import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { extractCatchRows } from "@/lib/catch-import/extract";
import {
  catchFarmGroupKey,
  groupCatchFarms,
} from "@/lib/catch-import/parse";
import type { CatchFarmPreview, CatchRow } from "@/lib/catch-import/types";
import { matchPlacementFarm } from "@/lib/placement-import/match";
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
};

export type CatchApplyResult =
  | {
      ok: true;
      updatedHouses: number;
      updatedFlocks: number;
      skippedFarms: number;
      warnings: string[];
    }
  | { ok: false; error: string };

function parsedPath(importId: string) {
  return path.join(SCHEDULE_IMPORTS_DIR, `${importId}.catch.json`);
}

function parseDateKey(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
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

async function syncFlockCatchFromHouses(flockId: string) {
  const hfs = await prisma.houseFlock.findMany({
    where: { flockId },
    select: { placementDate: true, catchDate: true },
  });
  const places = hfs
    .map((h) => h.placementDate)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const catches = hfs
    .map((h) => h.catchDate)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const place = places[0];
  const catchDate = catches[0] ?? (place ? addDays(place, 52) : null);
  if (!catchDate) return;
  await prisma.flock.update({
    where: { id: flockId },
    data: { projectedCatchDate: catchDate },
  });
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
          "Could not read any catch rows. Need a date left of the farm name and a house number in the House column (usually two cells right of the name).",
      };
    }
    await writeFile(parsedPath(importId), JSON.stringify(rows), "utf8");
  }

  const existing = await prisma.farm.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, farmName: true, farmNumber: true },
  });

  const farms: CatchFarmPreview[] = groupCatchFarms(rows).map((group) => {
    const match = matchPlacementFarm(
      group.farmName,
      group.farmCode ?? "",
      existing,
    );
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
    return { ok: false, error: "Select at least one farm to update." };
  }

  const existing = await prisma.farm.findMany({
    where: { userId: user.id, deletedAt: null },
    include: {
      houses: { where: { deletedAt: null }, select: { id: true, houseNumber: true } },
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        select: { id: true },
      },
    },
  });

  let updatedHouses = 0;
  let updatedFlocks = 0;
  let skippedFarms = 0;
  const warnings: string[] = [];
  const touchedFlocks = new Set<string>();

  const selectedRows = rows.filter((r) =>
    selectedKeys.has(catchFarmGroupKey(r.farmName, r.farmCode)),
  );

  const byFarm = new Map<string, CatchRow[]>();
  for (const row of selectedRows) {
    const key = catchFarmGroupKey(row.farmName, row.farmCode);
    const list = byFarm.get(key) ?? [];
    list.push(row);
    byFarm.set(key, list);
  }

  for (const [, farmRows] of byFarm) {
    const sample = farmRows[0]!;
    const match = matchPlacementFarm(
      sample.farmName,
      sample.farmCode ?? "",
      existing.map((f) => ({
        id: f.id,
        farmName: f.farmName,
        farmNumber: f.farmNumber,
      })),
    );

    if (!match.farm) {
      skippedFarms += 1;
      warnings.push(`${sample.farmName} — no matching farm; skipped.`);
      continue;
    }

    const farm = existing.find((f) => f.id === match.farm!.id);
    if (!farm) {
      skippedFarms += 1;
      continue;
    }

    const activeFlock = farm.flocks[0];
    if (!activeFlock) {
      skippedFarms += 1;
      warnings.push(`${farm.farmName} — no active flock; skipped.`);
      continue;
    }

    const houseByNumber = new Map(farm.houses.map((h) => [h.houseNumber, h.id]));
    let farmUpdated = false;

    for (const row of farmRows) {
      const houseId = houseByNumber.get(row.houseNo);
      if (!houseId) {
        warnings.push(`${farm.farmName} house ${row.houseNo} not found — skipped.`);
        continue;
      }

      const catchDate = parseDateKey(row.catchDate);
      if (!catchDate) continue;

      const hf = await prisma.houseFlock.findFirst({
        where: { flockId: activeFlock.id, houseId },
      });
      if (!hf) {
        warnings.push(
          `${farm.farmName} house ${row.houseNo} has no birds on the active flock — skipped.`,
        );
        continue;
      }

      await prisma.houseFlock.update({
        where: { id: hf.id },
        data: { catchDate },
      });
      updatedHouses += 1;
      farmUpdated = true;
      touchedFlocks.add(activeFlock.id);
    }

    if (!farmUpdated) skippedFarms += 1;
  }

  for (const flockId of touchedFlocks) {
    await syncFlockCatchFromHouses(flockId);
    updatedFlocks += 1;
  }

  revalidatePath("/");
  revalidatePath("/farms");
  return {
    ok: true,
    updatedHouses,
    updatedFlocks,
    skippedFarms,
    warnings,
  };
}
