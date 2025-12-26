import prisma from "../../src/prisma";

export const seedDepartmentsAndPositions = async () => {
  await prisma.position.deleteMany();
  await prisma.department.deleteMany();

  const departments = [
    { id: 1, name: "Finance" },
    { id: 2, name: "HSE/HRD" },
    { id: 3, name: "Marketing" },
    { id: 4, name: "Operasional" },
  ];

  for (const dept of departments) {
    await prisma.department.create({
      data: dept,
    });
  }

  const positions = [
    { id: 1, name: "Finance dan Accounting Head", departmentId: 1 },
    { id: 2, name: "Admin Finance", departmentId: 1 },

    { id: 3, name: "Kepala HSE/HRD", departmentId: 2 },
    { id: 4, name: "Staff HSE", departmentId: 2 },
    { id: 5, name: "Security", departmentId: 2 },

    { id: 6, name: "Marketing Manager", departmentId: 3 },
    { id: 7, name: "Administrasi", departmentId: 3 },
    { id: 8, name: "Staff HSE Marketing", departmentId: 3 },

    { id: 9, name: "Kabag Operasional", departmentId: 4 },
    { id: 10, name: "Kabag Transportasi", departmentId: 4 },
    { id: 11, name: "Kepala Gudang", departmentId: 4 },
    { id: 12, name: "Kepala Maintenance", departmentId: 4 },
    { id: 13, name: "Maintenance", departmentId: 4 },
    { id: 14, name: "Manager Operasional", departmentId: 4 },
    { id: 15, name: "Mekanik", departmentId: 4 },
    { id: 16, name: "Ops Gudang", departmentId: 4 },
    { id: 17, name: "Staff Legal", departmentId: 4 },
    { id: 18, name: "Teknik", departmentId: 4 },
  ];

  for (const pos of positions) {
    await prisma.position.create({
      data: pos,
    });
  }

  return prisma.position.findMany();
};
