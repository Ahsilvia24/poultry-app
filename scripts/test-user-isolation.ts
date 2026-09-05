import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { listScheduleImports } from "../src/lib/schedule-imports";
import { listSettlementExamples } from "../src/lib/settlement-examples";

const prisma = new PrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await bcrypt.hash("password123", 8);

  const techA = await prisma.user.create({
    data: {
      name: "Tech A",
      email: `tech-a-${suffix}@test.local`,
      passwordHash,
      settings: { create: {} },
    },
  });
  const techB = await prisma.user.create({
    data: {
      name: "Tech B",
      email: `tech-b-${suffix}@test.local`,
      passwordHash,
      settings: { create: {} },
    },
  });

  const farmA = await prisma.farm.create({
    data: {
      userId: techA.id,
      farmName: `Oak Ridge ${suffix}`,
      growerName: "Grower A",
    },
  });
  const farmB = await prisma.farm.create({
    data: {
      userId: techB.id,
      farmName: `Cedar Creek ${suffix}`,
      growerName: "Grower B",
    },
  });

  const aFarms = await prisma.farm.findMany({
    where: { userId: techA.id, deletedAt: null },
  });
  const bFarms = await prisma.farm.findMany({
    where: { userId: techB.id, deletedAt: null },
  });

  assert(
    aFarms.some((f) => f.id === farmA.id) && !aFarms.some((f) => f.id === farmB.id),
    "Tech A must see only Tech A farms",
  );
  assert(
    bFarms.some((f) => f.id === farmB.id) && !bFarms.some((f) => f.id === farmA.id),
    "Tech B must see only Tech B farms",
  );

  const stillThere = await prisma.farm.findUnique({ where: { id: farmA.id } });
  assert(stillThere?.farmName === farmA.farmName, "Signing out must not delete farms");

  const uploadsRoot = path.join(process.cwd(), "uploads");
  const scheduleDir = path.join(uploadsRoot, "schedule-imports");
  const settlementDir = path.join(uploadsRoot, "settlement-examples");
  await mkdir(scheduleDir, { recursive: true });
  await mkdir(settlementDir, { recursive: true });

  const scheduleA = `iso-a-${suffix}`;
  const scheduleB = `iso-b-${suffix}`;
  await writeFile(
    path.join(scheduleDir, `${scheduleA}.json`),
    JSON.stringify({
      id: scheduleA,
      importType: "placement",
      originalName: "a.pdf",
      storedName: `${scheduleA}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1,
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: techA.id,
    }),
  );
  await writeFile(
    path.join(scheduleDir, `${scheduleB}.json`),
    JSON.stringify({
      id: scheduleB,
      importType: "placement",
      originalName: "b.pdf",
      storedName: `${scheduleB}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1,
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: techB.id,
    }),
  );

  const aImports = await listScheduleImports({ userId: techA.id });
  const bImports = await listScheduleImports({ userId: techB.id });
  assert(
    aImports.some((item) => item.id === scheduleA) && !aImports.some((item) => item.id === scheduleB),
    "Placement uploads must stay on the uploading tech",
  );
  assert(
    bImports.some((item) => item.id === scheduleB) && !bImports.some((item) => item.id === scheduleA),
    "Tech B must not see Tech A placement uploads",
  );

  const settleA = `set-a-${suffix}`;
  const settleB = `set-b-${suffix}`;
  await writeFile(
    path.join(settlementDir, `${settleA}.json`),
    JSON.stringify({
      id: settleA,
      originalName: "a.xlsx",
      storedName: `${settleA}.xlsx`,
      mimeType: "application/vnd.ms-excel",
      sizeBytes: 1,
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: techA.id,
    }),
  );
  await writeFile(
    path.join(settlementDir, `${settleB}.json`),
    JSON.stringify({
      id: settleB,
      originalName: "b.xlsx",
      storedName: `${settleB}.xlsx`,
      mimeType: "application/vnd.ms-excel",
      sizeBytes: 1,
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: techB.id,
    }),
  );

  const aExamples = await listSettlementExamples(techA.id);
  const bExamples = await listSettlementExamples(techB.id);
  assert(
    aExamples.some((item) => item.id === settleA) && !aExamples.some((item) => item.id === settleB),
    "Settlement uploads must stay on the uploading tech",
  );
  assert(
    bExamples.some((item) => item.id === settleB) && !bExamples.some((item) => item.id === settleA),
    "Tech B must not see Tech A settlement uploads",
  );

  await prisma.farm.deleteMany({ where: { id: { in: [farmA.id, farmB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [techA.id, techB.id] } } });
  await rm(path.join(scheduleDir, `${scheduleA}.json`), { force: true });
  await rm(path.join(scheduleDir, `${scheduleB}.json`), { force: true });
  await rm(path.join(settlementDir, `${settleA}.json`), { force: true });
  await rm(path.join(settlementDir, `${settleB}.json`), { force: true });

  console.log("user isolation ok");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
