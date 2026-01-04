import dayjs from "dayjs";
import { Request, Response } from "express";
import prisma from "../prisma";
import {
  checkIfStartTimeIsYesterday,
  isDateInTimeRange,
} from "../utils/is-date-in-time-range";
import { convertDayDayjsToDatabase } from "../utils/get-day-from-date";

type CountResult = { total: number };

export const getSummary = async (req: Request, res: Response) => {
  try {
    const currentDate = dayjs.tz();
    const currentDay = currentDate.day() === 0 ? 6 : currentDate.day() - 1;

    // Get start and end of today
    const startOfToday = currentDate.startOf("day").toDate();
    const endOfToday = currentDate.endOf("day").toDate();

    const [masuk, terlambat, tidakDatang] = await Promise.all([
      prisma.logAbsensi.count({
        where: {
          day: currentDay,
          checkIn: { not: null },
          jamMasukDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),
      prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*) AS total 
        FROM LogAbsensi 
        WHERE checkIn > jamMasukDate
        AND jamMasukDate >= ${startOfToday}
        AND jamMasukDate <= ${endOfToday}
      `,
      prisma.logAbsensi.count({
        where: {
          day: currentDay,
          checkIn: null,
          jamMasukDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),
    ]);

    res.status(200).json({
      masuk,
      terlambat: terlambat[0].total,
      tidakDatang,
    });
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
};

export const getCurrentJadwalActive = async (req: Request, res: Response) => {
  try {
    const { pegawaiName } = req.query;

    const current = dayjs();

    // cek shift aktif yang berlaku saat ini
    const activeShifts = await prisma.shift.findMany({
      where: {
        isActive: true,
        isArchive: false,
      },
    });

    const shiftOnGoing = activeShifts.find((shift) =>
      isDateInTimeRange(shift.jamMasuk, shift.jamKeluar, current)
    );

    if (!shiftOnGoing) {
      return res
        .status(200)
        .json({ data: [], message: "no active shift currently" });
    }

    // cek apakah jam masuk nya kemarin
    const isStartTimeYesterday = checkIfStartTimeIsYesterday(
      shiftOnGoing.jamMasuk,
      shiftOnGoing.jamKeluar,
      current
    );

    // get index hari
    let dayIndex = isStartTimeYesterday
      ? current.subtract(1, "day").day()
      : current.day();

    // get jadwal aktif saat ini
    const jadwalActive = await prisma.jadwal.findMany({
      where: {
        shiftId: shiftOnGoing.id,
        day: convertDayDayjsToDatabase(dayIndex),
        pegawai: {
          name: {
            contains: pegawaiName as string | undefined,
          },
        },
      },
      include: {
        pegawai: true,
        shift: true,
      },
    });

    res.status(200).json({ data: jadwalActive });
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
};
