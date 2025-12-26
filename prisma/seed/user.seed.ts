import prisma from "../../src/prisma";
import { hashPassword } from "../../src/utils/hash";

export const seedUsers = async () => {
  await prisma.user.deleteMany({
    where: { username: "admin" },
  });

  const adminPassword = await hashPassword("admin123");

  await prisma.user.create({
    data: {
      username: "admin",
      password: adminPassword,
      role: "SUPERADMIN",
    },
  });

  console.log(
    "Created admin user (SUPERADMIN) -> username: admin, password: admin123"
  );
};
