import "dotenv/config";
import prisma from "../src/prisma";
import { hashPassword } from "../src/utils/hash";

async function seed() {
  console.log("Starting seed...");

  // 1. Create Departments and Positions

  // Dept. Finance
  const deptFinance = await prisma.department.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: "Finance" },
  });

  const posFinanceHead = await prisma.position.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Finance dan Accounting Head",
      departmentId: deptFinance.id,
    },
  });

  const posAdminFinance = await prisma.position.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: "Admin Finance", departmentId: deptFinance.id },
  });

  console.log("Created Finance department with 2 positions");

  // Dept. HSE/HRD
  const deptHSEHRD = await prisma.department.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: "HSE/HRD" },
  });

  const posKepalaHSEHRD = await prisma.position.upsert({
    where: { id: 3 },
    update: {},
    create: { id: 3, name: "Kepala HSE/HRD", departmentId: deptHSEHRD.id },
  });

  const posStaffHSE = await prisma.position.upsert({
    where: { id: 4 },
    update: {},
    create: { id: 4, name: "Staff HSE", departmentId: deptHSEHRD.id },
  });

  const posSecurity = await prisma.position.upsert({
    where: { id: 5 },
    update: {},
    create: { id: 5, name: "Security", departmentId: deptHSEHRD.id },
  });

  console.log("Created HSE/HRD department with 3 positions");

  // Dept. Marketing
  const deptMarketing = await prisma.department.upsert({
    where: { id: 3 },
    update: {},
    create: { id: 3, name: "Marketing" },
  });

  const posMarketingManager = await prisma.position.upsert({
    where: { id: 6 },
    update: {},
    create: {
      id: 6,
      name: "Marketing Manager",
      departmentId: deptMarketing.id,
    },
  });

  const posAdministrasi = await prisma.position.upsert({
    where: { id: 7 },
    update: {},
    create: { id: 7, name: "Administrasi", departmentId: deptMarketing.id },
  });

  const posStaffHSEMarketing = await prisma.position.upsert({
    where: { id: 8 },
    update: {},
    create: {
      id: 8,
      name: "Staff HSE Marketing",
      departmentId: deptMarketing.id,
    },
  });

  console.log("Created Marketing department with 3 positions");

  // Dept. Operasional
  const deptOperasional = await prisma.department.upsert({
    where: { id: 4 },
    update: {},
    create: { id: 4, name: "Operasional" },
  });

  const posKabagOperasional = await prisma.position.upsert({
    where: { id: 9 },
    update: {},
    create: {
      id: 9,
      name: "Kabag Operasional",
      departmentId: deptOperasional.id,
    },
  });

  const posKabagTransportasi = await prisma.position.upsert({
    where: { id: 10 },
    update: {},
    create: {
      id: 10,
      name: "Kabag Transportasi",
      departmentId: deptOperasional.id,
    },
  });

  const posKepalaGudang = await prisma.position.upsert({
    where: { id: 11 },
    update: {},
    create: { id: 11, name: "Kepala Gudang", departmentId: deptOperasional.id },
  });

  const posKepalaMaintenance = await prisma.position.upsert({
    where: { id: 12 },
    update: {},
    create: {
      id: 12,
      name: "Kepala Maintenance",
      departmentId: deptOperasional.id,
    },
  });

  const posMaintenance = await prisma.position.upsert({
    where: { id: 13 },
    update: {},
    create: { id: 13, name: "Maintenance", departmentId: deptOperasional.id },
  });

  const posManagerOperasional = await prisma.position.upsert({
    where: { id: 14 },
    update: {},
    create: {
      id: 14,
      name: "Manager Operasional",
      departmentId: deptOperasional.id,
    },
  });

  const posMekanik = await prisma.position.upsert({
    where: { id: 15 },
    update: {},
    create: { id: 15, name: "Mekanik", departmentId: deptOperasional.id },
  });

  const posOpsGudang = await prisma.position.upsert({
    where: { id: 16 },
    update: {},
    create: { id: 16, name: "Ops Gudang", departmentId: deptOperasional.id },
  });

  const posStaffLegal = await prisma.position.upsert({
    where: { id: 17 },
    update: {},
    create: { id: 17, name: "Staff Legal", departmentId: deptOperasional.id },
  });

  const posTeknik = await prisma.position.upsert({
    where: { id: 18 },
    update: {},
    create: { id: 18, name: "Teknik", departmentId: deptOperasional.id },
  });

  console.log("Created Operasional department with 10 positions");

  // Collect all positions
  const positions = [
    posFinanceHead,
    posAdminFinance,
    posKepalaHSEHRD,
    posStaffHSE,
    posSecurity,
    posMarketingManager,
    posAdministrasi,
    posStaffHSEMarketing,
    posKabagOperasional,
    posKabagTransportasi,
    posKepalaGudang,
    posKepalaMaintenance,
    posMaintenance,
    posManagerOperasional,
    posMekanik,
    posOpsGudang,
    posStaffLegal,
    posTeknik,
  ];

  console.log("Total: 4 departments, 18 positions created");

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

  // 4. Generate 15 users linked to pegawai
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

  // 5. Generate shift data
  const shiftMalam = await prisma.shift.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Malam",
      jamMasuk: "22:00",
      jamKeluar: "06:00",
      isActive: true,
    },
  });

  const shiftPagi = await prisma.shift.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: "Pagi",
      jamMasuk: "06:00",
      jamKeluar: "13:00",
      isActive: true,
    },
  });

  const shiftSiang = await prisma.shift.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      name: "Siang",
      jamMasuk: "13:00",
      jamKeluar: "22:00",
      isActive: true,
    },
  });

  console.log(
    "Created 3 shifts: Malam (22:00-06:00), Pagi (06:00-13:00), Siang (13:00-22:00)"
  );

  console.log("\nSeeding completed successfully!");
  console.log("\nSummary:");
  console.log("   - 4 Departments: Finance, HSE/HRD, Marketing, Operasional");
  console.log("   - 18 Positions across all departments");
  console.log("   - 15 Pegawai (all active, random positions)");
  console.log("   - 16 Users (1 SUPERADMIN + 15 STAFF)");
  console.log("   - 3 Shifts: Malam, Pagi, Siang");
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
