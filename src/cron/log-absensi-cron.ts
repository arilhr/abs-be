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
    const today = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();
    const todayDayOfWeek = getDayFromDate(new Date());

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
        // Step 1: Get all active overrides for today with this shift
        const overrides = await tx.jadwalOverride.findMany({
          where: {
            shiftId: shift.id,
            date: {
              gte: today,
              lte: todayEnd,
            },
            isActive: true,
            isArchive: false,
          },
        });

        // Create a set of pegawai IDs that have overrides today
        const overriddenPegawaiIds = new Set(overrides.map((o) => o.pegawaiId));

        // Step 2: Process overrides - create LogAbsensi for overridden schedules
        for (const override of overrides) {
          // Check if log already exists for this pegawai today
          const existingLog = await tx.logAbsensi.findFirst({
            where: {
              pegawaiId: override.pegawaiId,
              jamMasukDate: {
                gte: today,
                lte: todayEnd,
              },
            },
          });

          if (!existingLog) {
            const jamShiftDate = calculateJamShiftDate(
              shift.jamMasuk,
              shift.jamKeluar
            );
            const jamMasukDate = dayjs(jamShiftDate.jamMasukDate)
              .day(todayDayOfWeek)
              .toDate();

            await tx.logAbsensi.create({
              data: {
                pegawaiId: override.pegawaiId,
                shiftId: shift.id,
                shiftName: shift.name,
                jamMasuk: shift.jamMasuk,
                jamMasukDate: jamMasukDate,
                jamKeluar: shift.jamKeluar,
                jamKeluarDate: jamShiftDate.jamKeluarDate,
                day: todayDayOfWeek,
              },
            });
          }
        }

        // Step 3: Get regular jadwals for today with this shift
        // But exclude pegawai who have overrides (they might have different shift or day off)
        const jadwals = await tx.jadwal.findMany({
          where: {
            shiftId: shift.id,
            day: todayDayOfWeek,
            isActive: true,
            isArchive: false,
          },
        });

        // Step 4: Process regular jadwals (skip those with overrides)
        for (const jadwal of jadwals) {
          // Skip if this pegawai has an override for today
          // (they either already processed above or have day off/different shift)
          if (overriddenPegawaiIds.has(jadwal.pegawaiId)) {
            continue;
          }

          // Also check if pegawai has a "day off" override (shiftId = null)
          const hasDayOffOverride = await tx.jadwalOverride.findFirst({
            where: {
              pegawaiId: jadwal.pegawaiId,
              date: {
                gte: today,
                lte: todayEnd,
              },
              shiftId: null,
              isActive: true,
              isArchive: false,
            },
          });

          if (hasDayOffOverride) {
            console.log(
              `[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] Pegawai ${
                jadwal.pegawaiId
              } has day off override, skipping`
            );
            continue;
          }

          // Create log absensi if not exists
          const existingLog = await tx.logAbsensi.findFirst({
            where: {
              pegawaiId: jadwal.pegawaiId,
              jamMasukDate: {
                gte: today,
                lte: todayEnd,
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
