import dayjs from "dayjs";
import { Request, Response } from "express";
import prisma from "../prisma";

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
        SELECT COUNT(*)::int AS total 
        FROM "LogAbsensi" 
        WHERE "checkIn" > "jamMasukDate"
        AND "jamMasukDate" >= ${startOfToday}
        AND "jamMasukDate" <= ${endOfToday}
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
