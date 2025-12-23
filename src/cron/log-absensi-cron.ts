import cron from "node-cron";
import dayjs from "dayjs";
import prisma from "../prisma";
import {
  convertDayDatabaseToDayjs,
  getDayFromDate,
} from "../utils/get-day-from-date";
import { calculateJamShiftDate } from "../utils/calculate-jam-shift-date";

export const startShiftCron = () => {
  cron.schedule("* * * * *", async () => {
    const now = dayjs().format("HH:mm");

    const shifts = await prisma.shift.findMany({
      where: { isActive: true, isArchive: false },
    });

    for (const shift of shifts) {
      const shiftTime = shift.jamMasuk.slice(0, 5);
      if (shiftTime !== now) continue;

      console.log(
        `[${dayjs().format(
          "YYYY-MM-DD HH:mm:ss"
        )}] Generate log absensi untuk shift ${shift.id}`
      );

      await prisma.$transaction(async (tx) => {
        // find jadwal for today with this shift
        const jadwals = await tx.jadwal.findMany({
          where: {
            shiftId: shift.id,
            day: getDayFromDate(new Date()),
          },
        });

        for (const jadwal of jadwals) {
          // create log absensi if not exists
          const existingLog = await tx.logAbsensi.findFirst({
            where: {
              pegawaiId: jadwal.pegawaiId,
              jamMasukDate: {
                gte: dayjs().startOf("day").toDate(),
                lte: dayjs().endOf("day").toDate(),
              },
            },
          });

          if (!existingLog) {
            const jamShiftDate = calculateJamShiftDate(
              shift.jamMasuk,
              shift.jamKeluar
            );
            const jamMasukDate = dayjs(jamShiftDate.jamMasukDate)
              .day(convertDayDatabaseToDayjs(jadwal.day))
              .toDate();
            await tx.logAbsensi.create({
              data: {
                pegawaiId: jadwal.pegawaiId,
                shiftId: jadwal.shiftId,
                shiftName: shift.name,
                jamMasuk: shift.jamMasuk,
                jamMasukDate: jamMasukDate,
                jamKeluar: shift.jamKeluar,
                jamKeluarDate: jamShiftDate.jamKeluarDate,
                day: jadwal.day,
              },
            });
          }
        }
      });
    }
  });
};
