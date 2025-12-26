import prisma from "../../src/prisma";

export const seedShifts = async () => {
  await prisma.shift.deleteMany();

  const shifts = [
    {
      id: 1,
      name: "Malam",
      jamMasuk: "22:00",
      jamKeluar: "06:00",
      isActive: true,
    },
    {
      id: 2,
      name: "Pagi",
      jamMasuk: "06:00",
      jamKeluar: "13:00",
      isActive: true,
    },
    {
      id: 3,
      name: "Siang",
      jamMasuk: "13:00",
      jamKeluar: "22:00",
      isActive: true,
    },
  ];

  for (const shift of shifts) {
    await prisma.shift.create({
      data: shift,
    });
  }
};
