import "dotenv/config";
import prisma from "../src/prisma";
import { hashPassword } from "../src/utils/hash";

async function seed() {
  const pwd = await hashPassword("admin123");
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: pwd,
    },
  });

  console.log("Seeded admin user -> username: admin, password: admin123");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
