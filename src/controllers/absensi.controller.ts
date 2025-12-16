import { Request, Response } from "express";
import prisma from "../prisma";
import dayjs from "dayjs";
import { calculateTimeDifferent } from "../utils/calculate-time";

const NOW = dayjs("2025-12-12 05:30:00");

export const getAllAbsensi = async (req: Request, res: Response) => {
  try {
    const {
      pegawaiId,
      pegawaiName,
      shiftId,
      date,
      page: pageQ,
      limit: limitQ,
    } = req.query;

    const where: any = {};

    if (pegawaiId !== undefined && String(pegawaiId).trim() !== "") {
      const pid = Number(pegawaiId);
      if (!Number.isNaN(pid)) where.pegawaiId = pid;
    }

    if (shiftId !== undefined && String(shiftId).trim() !== "") {
      const sid = Number(shiftId);
      if (!Number.isNaN(sid)) where.shiftId = sid;
    }

    if (date !== undefined) {
      const start = dayjs.tz(date.toString()).startOf("day").toDate();
      const end = dayjs.tz(date.toString()).endOf("day").toDate();

      where.jamMasukDate = {
        gte: start,
        lte: end,
      };
    }

    // relation filter for pegawaiName
    const include: any = { pegawai: true, shift: true };
    if (pegawaiName !== undefined && String(pegawaiName).trim() !== "") {
      where.pegawai = {
        name: { contains: String(pegawaiName).trim(), mode: "insensitive" },
      };
    }

    const page = pageQ ? Number(pageQ) : undefined;
    const limit = limitQ ? Number(limitQ) : undefined;
    const shouldPaginate =
      page !== undefined &&
      limit !== undefined &&
      Number.isInteger(page) &&
      page > 0 &&
      Number.isInteger(limit) &&
      limit > 0;

    if (shouldPaginate) {
      const skip = (page - 1) * limit;
      const [total, data] = await Promise.all([
        prisma.logAbsensi.count({ where }),
        prisma.logAbsensi.findMany({
          where,
          include,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);
      res.json({
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
      return;
    }

    const data = await prisma.logAbsensi.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
};

export const scanAbsensi = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { pegawaiId } = req.body;

    // check pegawai data
    const pegawaiData = await prisma.pegawai.findFirst({
      where: {
        id: pegawaiId,
      },
      include: {
        position: true,
      },
    });

    if (!pegawaiData) {
      res.status(400).json({ message: "Pegawai not found." });
      return;
    }

    const currentDate = NOW.toDate();
    const currentDay = NOW.day() === 0 ? 6 : NOW.day() - 1;
    const currentHour = NOW.format("HH:mm:ss");

    // get all jadwal pegawai
    const jadwalPegawaiToday = await prisma.jadwal.findMany({
      where: {
        pegawaiId: pegawaiId,
        OR: [
          { day: currentDay },
          { day: currentDay === 6 ? 0 : currentDay + 1 },
        ],
      },
      include: {
        shift: {
          select: { jamMasuk: true, jamKeluar: true, name: true },
        },
      },
      orderBy: {
        shift: {
          jamMasuk: "asc",
        },
      },
    });

    // apakah ada jadwal pegawai yang jam masuk nya 1 jam lagi
    const jadwalOneHourAwayFromNewCheckIn = jadwalPegawaiToday.filter(
      (jadwal) => {
        const currentToJamMasukDiff = calculateTimeDifferent(
          currentHour,
          jadwal.shift.jamMasuk,
          currentDay !== jadwal.day
        );

        return currentToJamMasukDiff <= 60 && currentToJamMasukDiff >= 0;
      }
    );

    if (jadwalOneHourAwayFromNewCheckIn.length > 0) {
      const newLogJadwal = jadwalOneHourAwayFromNewCheckIn[0];

      const jamShiftDate = getJamShiftDate(
        newLogJadwal.shift.jamMasuk,
        newLogJadwal.shift.jamKeluar,
        currentDay !== newLogJadwal.day
      );

      // cek apakah jadwal tersebut sudah dibuat atau belum
      const existingLogAbsensi = await prisma.logAbsensi.findFirst({
        where: {
          pegawaiId: pegawaiId,
          shiftId: newLogJadwal.shiftId,
          jamMasukDate: jamShiftDate.jamMasukDate,
        },
        include: {
          pegawai: {
            select: {
              name: true,
              position: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (existingLogAbsensi) {
        res.status(201).json({
          message: "Anda sudah absensi masuk.",
          status: "ALREADY_CHECK_IN",
        });
        return;
      }

      // buat log absensi baru untuk jadwal tersebut
      const newLogAbsensi = await prisma.logAbsensi.create({
        data: {
          pegawaiId: pegawaiId,
          shiftId: newLogJadwal.shiftId,
          shiftName: newLogJadwal.shift.name,
          jamMasuk: newLogJadwal.shift.jamMasuk,
          jamKeluar: newLogJadwal.shift.jamKeluar,
          jamMasukDate: jamShiftDate.jamMasukDate,
          jamKeluarDate: jamShiftDate.jamKeluarDate,
          day: newLogJadwal.day,
          checkIn: currentDate,
        },
        include: {
          pegawai: {
            select: {
              name: true,
              position: {
                select: { name: true },
              },
            },
          },
        },
      });

      res.status(201).json({
        message: "Sukses Absen Masuk.",
        status: "CHECK_IN",
        data: newLogAbsensi,
      });

      return;
    }

    // cari apakah ada log absensi dengan check in kosong, dan date sekarang berada diantara jam masuk date sama jam keluar date nya
    const logAbsensiOngoing = await prisma.logAbsensi.findFirst({
      where: {
        pegawaiId,
        jamMasukDate: {
          lt: currentDate,
        },
        jamKeluarDate: {
          gte: currentDate,
        },
        OR: [{ checkIn: null }, { checkOut: null }],
      },
    });

    if (logAbsensiOngoing) {
      // kalau belum ada data check in
      if (!logAbsensiOngoing.checkIn) {
        const result = await prisma.logAbsensi.update({
          where: {
            id: logAbsensiOngoing.id,
          },
          include: {
            pegawai: {
              select: {
                name: true,
                position: {
                  select: { name: true },
                },
              },
            },
          },
          data: {
            checkIn: NOW.toDate(),
          },
        });

        res.status(201).json({
          message: "Absensi masuk berhasil",
          status: "CHECK_IN",
          data: result,
        });
        return;
      }

      // kalau belum ada data check out, maka check out
      const result = await prisma.logAbsensi.update({
        where: {
          id: logAbsensiOngoing.id,
        },
        include: {
          pegawai: {
            select: {
              name: true,
              position: {
                select: { name: true },
              },
            },
          },
        },
        data: {
          checkOut: NOW.toDate(),
        },
      });

      res.status(201).json({
        message: "Absensi pulang berhasil",
        status: "CHECK_OUT",
        data: result,
      });
      return;
    }

    // cek apakah sekarang masuk ke jadwal yang ada
    const jadwalNow = jadwalPegawaiToday.filter((jadwal) => {
      return (
        jadwal.shift.jamMasuk <= currentHour &&
        jadwal.shift.jamKeluar > currentHour
      );
    });

    if (jadwalNow.length > 0) {
      const jadwalNowData = jadwalNow[0];
      const jamMasukSplit = jadwalNowData.shift.jamMasuk.split(":");
      const jamMasukShiftDate = dayjs
        .tz()
        .hour(+jamMasukSplit[0])
        .minute(+jamMasukSplit[1])
        .second(+jamMasukSplit[2]);

      // Jam Keluar
      const jamKeluarSplit = jadwalNowData.shift.jamKeluar.split(":");
      const jamKeluarShiftDate = dayjs
        .tz()
        .hour(+jamKeluarSplit[0])
        .minute(+jamKeluarSplit[1])
        .second(+jamKeluarSplit[2]);
      const result = await prisma.logAbsensi.create({
        data: {
          pegawaiId: pegawaiId,
          shiftId: jadwalNowData.shiftId,
          shiftName: jadwalNowData.shift.name,
          day: jadwalNowData.day,
          jamMasuk: jadwalNowData.shift.jamMasuk,
          jamKeluar: jadwalNowData.shift.jamKeluar,
          jamMasukDate: jamMasukShiftDate.toDate(),
          jamKeluarDate: jamKeluarShiftDate.toDate(),
          checkIn: currentDate,
        },
      });

      res.status(201).json({
        message: "Absensi masuk berhasil",
        status: "CHECK_IN",
        data: { ...result, pegawai: pegawaiData },
      });
      return;
    }

    const yesterdayDate = NOW.subtract(1, "day").toDate();

    // cari apakah ada log yang belum expired (belum 1 hari)
    const notExpiredLogCheckOut = await prisma.logAbsensi.findFirst({
      where: {
        pegawaiId,
        checkIn: {
          not: null,
        },
        checkOut: null,
        jamKeluarDate: {
          lt: currentDate,
          gte: yesterdayDate,
        },
      },
    });

    if (notExpiredLogCheckOut) {
      const result = await prisma.logAbsensi.update({
        where: {
          id: notExpiredLogCheckOut.id,
        },
        include: {
          pegawai: {
            select: {
              name: true,
              position: {
                select: { name: true },
              },
            },
          },
        },
        data: {
          checkOut: NOW.toDate(),
        },
      });

      res.status(201).json({
        message: "Absensi pulang berhasil",
        status: "CHECK_OUT",
        data: result,
      });
      return;
    }

    res
      .status(201)
      .json({ message: "Belum masuk jadwal kerja anda.", status: "NOT_YET" });
  } catch (err) {
    console.log(`ERROR:`, err);
    res.status(500).json({ error: "internal error", err });
  }
};

export const generateLogAbsensi = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { shiftId } = req.query;

    if (!shiftId) {
      res.status(400).json({ message: "Need shift id." });
      return;
    }

    // Get shift data
    const shiftData = await prisma.shift.findFirst({
      where: {
        id: +shiftId,
      },
    });

    if (!shiftData) {
      res.status(500).json({ message: "Shift data not found." });
      return;
    }

    const currDay = dayjs.tz().day();

    // Jam Masuk
    const jamMasukSplit = shiftData.jamMasuk.split(":");
    const jamMasukShiftDate = dayjs
      .tz()
      .hour(+jamMasukSplit[0])
      .minute(+jamMasukSplit[1])
      .second(+jamMasukSplit[2]);

    // Jam Keluar
    const jamKeluarSplit = shiftData.jamKeluar.split(":");
    const jamKeluarShiftDate = dayjs
      .tz()
      .hour(+jamKeluarSplit[0])
      .minute(+jamKeluarSplit[1])
      .second(+jamKeluarSplit[2]);

    const result = await prisma.$transaction(async (tx) => {
      const jadwalToday = await tx.jadwal.findMany({
        where: {
          day: currDay,
          isArchive: false,
          pegawai: {
            status: "active",
          },
          ...(shiftId && { shiftId: +shiftId }),
        },
        include: {
          shift: {
            select: {
              name: true,
              jamMasuk: true,
              jamKeluar: true,
            },
          },
        },
      });

      // get all log absensi with shiftId and jam masuk date

      // generate log absensi
      const newLogAbsensiDatas = jadwalToday.map((jt) => {
        return {
          pegawaiId: jt.pegawaiId,
          shiftId: jt.shiftId,
          shiftName: jt.shift.name,
          jamMasuk: jt.shift.jamMasuk,
          jamKeluar: jt.shift.jamKeluar,
          jamMasukDate: jamMasukShiftDate.toDate(),
          jamKeluarDate: jamKeluarShiftDate.toDate(),
          day: jt.day,
        };
      });

      const result = await tx.logAbsensi.createMany({
        data: newLogAbsensiDatas,
      });

      return result;
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
};

const getJamShiftDate = (
  jamMasuk: string,
  jamKeluar: string,
  isTommorow = false
) => {
  const baseDay = isTommorow ? NOW.clone().add(1, "day") : NOW.clone();
  const baseDayFormatted = baseDay.format("YYYY-MM-DD");
  const jamMasukShiftDate = dayjs(`${baseDayFormatted} ${jamMasuk}`);

  // Jam Keluar
  let jamKeluarShiftDate = dayjs(`${baseDayFormatted} ${jamKeluar}`);

  if (
    jamKeluarShiftDate.isBefore(jamMasukShiftDate) ||
    jamKeluarShiftDate.isSame(jamMasukShiftDate)
  ) {
    jamKeluarShiftDate = jamKeluarShiftDate.add(1, "day");
  }

  return {
    jamMasukDate: jamMasukShiftDate.toDate(),
    jamKeluarDate: jamKeluarShiftDate.toDate(),
  };
};
