import "dotenv/config";
import prisma from "../../src/prisma";
import { seedDepartmentsAndPositions } from "./department.seed";
import { seedUsers } from "./user.seed";
import { seedShifts } from "./shift.seed";

async function main() {
  console.log("Seeding started...");

  await seedDepartmentsAndPositions();
  await seedUsers();
  await seedShifts();

  console.log("Seeding completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
