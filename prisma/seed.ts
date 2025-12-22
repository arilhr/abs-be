import "dotenv/config";
import prisma from "../src/prisma";
import { hashPassword } from "../src/utils/hash";

async function seed() {
  console.log("Starting seed...");

  // 1. Create positions: HRD, Staff, Operator
  const positionHRD = await prisma.position.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: "HRD" },
  });

  const positionStaff = await prisma.position.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: "Staff" },
  });

  const positionOperator = await prisma.position.upsert({
    where: { id: 3 },
    update: {},
    create: { id: 3, name: "Operator" },
  });

  console.log("Created 3 positions: HRD, Staff, Operator");

  const positions = [positionHRD, positionStaff, positionOperator];

  // 2. Generate 15 pegawai with random positions, all active
  const pegawaiNames = [
    "Ahmad Rizki",
    "Siti Nurhaliza",
    "Budi Santoso",
    "Dewi Lestari",
    "Eko Prasetyo",
    "Fitri Handayani",
    "Gunawan Wibowo",
    "Hendra Kusuma",
    "Indah Permata",
    "Joko Widodo",
    "Kartika Sari",
    "Lukman Hakim",
    "Maya Angelina",
    "Nanda Pratama",
    "Olivia Rahman",
  ];

  const pegawais = [];
  for (let i = 0; i < pegawaiNames.length; i++) {
    // Random position
    const randomPosition =
      positions[Math.floor(Math.random() * positions.length)];

    const pegawai = await prisma.pegawai.upsert({
      where: { pegawaiId: `PEG${String(i + 1).padStart(3, "0")}` },
      update: {},
      create: {
        pegawaiId: `PEG${String(i + 1).padStart(3, "0")}`,
        name: pegawaiNames[i],
        positionId: randomPosition.id,
        status: "active",
        salary: 5000000,
      },
    });
    pegawais.push(pegawai);
  }

  console.log("Created 15 pegawai with random positions (all active)");

  // 3. Create admin user (SUPERADMIN)
  const adminPwd = await hashPassword("admin123");
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: adminPwd,
      role: "SUPERADMIN",
    },
  });

  console.log(
    "Created admin user (SUPERADMIN) -> username: admin, password: admin123"
  );

  // 3. Generate 15 users linked to pegawai
  for (let i = 0; i < pegawais.length; i++) {
    const pegawai = pegawais[i];
    const username = pegawai.name.toLowerCase().replace(/\s+/g, ".");
    const password = await hashPassword("password123");

    await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        password,
        role: "STAFF",
        pegawaiId: pegawai.id,
      },
    });
  }

  console.log("Created 15 users (STAFF) linked to pegawai");

  console.log("\nSeeding completed successfully!");
  console.log("\nSummary:");
  console.log("   - 3 Positions: HRD, Staff, Operator");
  console.log("   - 15 Pegawai (all active, random positions)");
  console.log("   - 16 Users (1 SUPERADMIN + 15 STAFF)");
  console.log("\nLogin credentials:");
  console.log("   Admin (SUPERADMIN): username=admin, password=admin123");
  console.log(
    "   Staff Users: username=<pegawai.name.lowercase>, password=password123"
  );
  console.log("   Example: username=ahmad.rizki, password=password123");
}

seed()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
