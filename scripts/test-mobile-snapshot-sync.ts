import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { applyUserSnapshot, serializeUserSnapshot } from "../src/lib/mobile-snapshot";

config();

const prisma = new PrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await bcrypt.hash("passwordF1", 8);

  const webTech = await prisma.user.create({
    data: {
      name: "Web Tech",
      email: `web-tech-${suffix}@test.local`,
      passwordHash,
      settings: { create: {} },
    },
  });
  const phoneTech = await prisma.user.create({
    data: {
      name: "Phone Tech",
      email: `phone-tech-${suffix}@test.local`,
      passwordHash,
      settings: { create: {} },
    },
  });

  const webFarm = await prisma.farm.create({
    data: {
      userId: webTech.id,
      farmName: `Website Farm ${suffix}`,
      growerName: "Grower Web",
      numberOfHouses: 2,
      houses: {
        create: [
          { houseNumber: 1, squareFootage: 29700 },
          { houseNumber: 2, squareFootage: 29700 },
        ],
      },
    },
  });

  const pulled = await serializeUserSnapshot(webTech.id);
  assert(
    pulled.tables.farms.some((f) => f.id === webFarm.id && f.farm_name === webFarm.farmName),
    "Website farm must appear in the phone snapshot for the same email",
  );
  assert(pulled.tables.houses.length === 2, "Website houses must appear on the phone snapshot");

  const otherPull = await serializeUserSnapshot(phoneTech.id);
  assert(
    !otherPull.tables.farms.some((f) => f.id === webFarm.id),
    "A different email must not receive another tech's farms",
  );

  const phoneFarmId = `farm_phone_${suffix}`;
  const phoneHouseId = `house_phone_${suffix}`;
  await applyUserSnapshot(phoneTech.id, {
    ...otherPull.tables,
    farms: [
      {
        id: phoneFarmId,
        farm_name: `iPhone Farm ${suffix}`,
        grower_name: "Grower Phone",
        number_of_houses: 1,
        is_active: 1,
      },
    ],
    houses: [
      {
        id: phoneHouseId,
        farm_id: phoneFarmId,
        house_number: 1,
        square_footage: 29700,
      },
    ],
  });

  const afterPhone = await prisma.farm.findFirst({
    where: { id: phoneFarmId, userId: phoneTech.id },
  });
  assert(afterPhone?.farmName === `iPhone Farm ${suffix}`, "Phone farm must land on the website account");

  const webStill = await prisma.farm.findMany({ where: { userId: webTech.id, deletedAt: null } });
  assert(
    webStill.some((f) => f.id === webFarm.id) && !webStill.some((f) => f.id === phoneFarmId),
    "Phone farm must not appear on a different website login",
  );

  let blocked = false;
  try {
    await applyUserSnapshot(phoneTech.id, {
      ...pulled.tables,
      farms: pulled.tables.farms,
      houses: pulled.tables.houses,
    });
  } catch (e) {
    blocked = e instanceof Error && e.message.includes("another technician");
  }
  assert(blocked, "Phone must not steal another technician's farm ids");

  const roundTrip = await serializeUserSnapshot(phoneTech.id);
  const pushedBack = roundTrip.tables.farms.find((f) => f.id === phoneFarmId);
  assert(pushedBack?.farm_name === `iPhone Farm ${suffix}`, "Same farm id must round-trip to the phone");

  await prisma.user.deleteMany({ where: { id: { in: [webTech.id, phoneTech.id] } } });
  console.log("mobile snapshot sync OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
