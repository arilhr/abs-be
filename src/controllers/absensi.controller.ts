import { Request, Response } from "express";
import prisma from "../prisma";
import dayjs from "dayjs";
import { calculateJamShiftDate } from "../utils/calculate-jam-shift-date";
import { CHECK_IN_MINUTE_OFFSET } from "../constants/absensi";
import { convertDayDatabaseToDayjs } from "../utils/get-day-from-date";
import { ScanType } from "../../prisma/generated/enums";
import { SCAN_SECRET_CODE_CONFIG_KEY } from "../constants/config-key";

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

export const scanAbsensi = async (req: Request, res: Response) => {
  try {
    const { pegawaiId, code } = req.body;

    if (!code) {
      res.status(400).json({ message: "Scan secret code is required." });
      return;
    }

    // check scan secret code
    const scanSecretCodeConfig = await prisma.appConfig.findUnique({
      where: { key: SCAN_SECRET_CODE_CONFIG_KEY },
    });

    if (scanSecretCodeConfig) {
      const scanSecretCode = scanSecretCodeConfig.value;
      if (code !== scanSecretCode) {
        res.status(401).json({ message: "Invalid scan secret code." });
        return;
      }
    }

    const NOW = dayjs();

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
      res.status(400).json({ message: "Data pegawai tidak ditemukan." });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentDate = NOW.toDate();
      const currentDay = NOW.day() === 0 ? 6 : NOW.day() - 1;

      // get all jadwal pegawai
      const jadwalPegawaiList = await tx.jadwal.findMany({
        where: {
          pegawaiId: pegawaiId,
          OR: [
            { day: currentDay },
            { day: currentDay === 6 ? 0 : currentDay + 1 },
            { day: currentDay === 0 ? 6 : currentDay - 1 },
          ],
        },
        include: {
          shift: {
            select: { jamMasuk: true, jamKeluar: true, name: true },
          },
        },
        orderBy: [{ day: "asc" }, { shift: { jamMasuk: "asc" } }],
      });

      // check apakah masuk current date masuk ke salah satu jadwal
      const jadwalOnCurrentDate = jadwalPegawaiList.find((jadwal) => {
        const shiftDayDate = NOW.clone()
          .day(convertDayDatabaseToDayjs(jadwal.day))
          .toDate();
        const jamShiftJadwalDate = calculateJamShiftDate(
          jadwal.shift.jamMasuk,
          jadwal.shift.jamKeluar,
          shiftDayDate
        );
        const startJamMasukDate = dayjs(jamShiftJadwalDate.jamMasukDate)
          .subtract(CHECK_IN_MINUTE_OFFSET, "minutes")
          .toDate();

        return (
          startJamMasukDate <= currentDate &&
          currentDate < jamShiftJadwalDate.jamKeluarDate
        );
      });

      // kalau berada di dalam jadwal
      if (jadwalOnCurrentDate) {
        // check apakah ada log absensi dengan jadwal tersebut
        const jamShiftDate = calculateJamShiftDate(
          jadwalOnCurrentDate.shift.jamMasuk,
          jadwalOnCurrentDate.shift.jamKeluar
        );
        const jamMasukDate = dayjs(jamShiftDate.jamMasukDate)
          .day(convertDayDatabaseToDayjs(jadwalOnCurrentDate.day))
          .toDate();
        const existingLogAbsensi = await tx.logAbsensi.findFirst({
          where: {
            pegawaiId,
            shiftId: jadwalOnCurrentDate.shiftId,
            jamMasukDate,
          },
        });

        // kalau sudah ada log absensi
        if (existingLogAbsensi) {
          // kalau tidak ada checkin, maka checkin
          if (!existingLogAbsensi.checkIn) {
            const updateCheckIn = await tx.logAbsensi.update({
              where: {
                id: existingLogAbsensi.id,
              },
              data: {
                checkIn: currentDate,
              },
            });

            await tx.logScan.create({
              data: {
                pegawaiId,
                logAbsensiId: existingLogAbsensi.id,
                scanTime: currentDate,
                scanType: ScanType.IN,
              },
            });

            return {
              data: updateCheckIn,
              status: "CHECK_IN",
              code: 201,
            };
          }

          // kalau tidak ada checkout, maka checkout
          if (!existingLogAbsensi.checkOut) {
            // Cek apakah sudah waktu nya pulang
            if (existingLogAbsensi.jamKeluarDate > currentDate) {
              await tx.logScan.create({
                data: {
                  pegawaiId,
                  logAbsensiId: existingLogAbsensi.id,
                  scanTime: currentDate,
                  scanType: ScanType.UNKNOWN,
                },
              });

              return {
                status: "CHECK_OUT_NOT_YET",
                data: existingLogAbsensi,
                code: 201,
              };
            }

            const updateCheckOut = await tx.logAbsensi.update({
              where: {
                id: existingLogAbsensi.id,
              },
              data: {
                checkOut: currentDate,
              },
            });

            await tx.logScan.create({
              data: {
                pegawaiId,
                logAbsensiId: existingLogAbsensi.id,
                scanTime: currentDate,
                scanType: ScanType.OUT,
              },
            });

            return {
              data: updateCheckOut,
              status: "CHECK_OUT",
              code: 201,
            };
          }

          await tx.logScan.create({
            data: {
              pegawaiId,
              logAbsensiId: existingLogAbsensi.id,
              scanTime: currentDate,
              scanType: ScanType.UNKNOWN,
            },
          });

          return {
            data: existingLogAbsensi,
            status: "ALREADY_CHECK_OUT",
            code: 201,
          };
        }

        // kalau tidak ada, create log absensi baru dan check in
        const newLogAbsensi = await tx.logAbsensi.create({
          data: {
            pegawaiId,
            shiftId: jadwalOnCurrentDate.shiftId,
            shiftName: jadwalOnCurrentDate.shift.name,
            jamMasuk: jadwalOnCurrentDate.shift.jamMasuk,
            jamMasukDate: jamMasukDate,
            jamKeluar: jadwalOnCurrentDate.shift.jamKeluar,
            jamKeluarDate: jamShiftDate.jamKeluarDate,
            day: jadwalOnCurrentDate.day,
            checkIn: currentDate,
          },
        });

        await tx.logScan.create({
          data: {
            pegawaiId,
            logAbsensiId: newLogAbsensi.id,
            scanTime: currentDate,
            scanType: ScanType.IN,
          },
        });

        return {
          data: newLogAbsensi,
          code: 201,
          status: "CHECK_IN",
        };
      }

      // kalau tidak, cek apakah ada log absensi dengan jam checkout yang masih berlaku
      const yesterdayDate = NOW.subtract(1, "day").toDate();
      const notExpiredLogCheckOut = await prisma.logAbsensi.findFirst({
        where: {
          pegawaiId,
          checkIn: {
            not: null,
          },
          checkOut: null,
          jamKeluarDate: {
            lte: currentDate,
            gte: yesterdayDate,
          },
        },
      });

      if (notExpiredLogCheckOut) {
        const checkOutLogAbsensi = await prisma.logAbsensi.update({
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
            checkOut: currentDate,
          },
        });

        await tx.logScan.create({
          data: {
            pegawaiId,
            logAbsensiId: notExpiredLogCheckOut.id,
            scanTime: currentDate,
            scanType: ScanType.OUT,
          },
        });

        return {
          status: "CHECK_OUT",
          data: checkOutLogAbsensi,
          code: 201,
        };
      }

      await tx.logScan.create({
        data: {
          pegawaiId,
          scanTime: currentDate,
          scanType: ScanType.UNKNOWN,
        },
      });

      return {
        code: 201,
        status: "NOT_YET",
      };
    });

    res.status(result?.code || 400).json({
      ...result,
      pegawai: pegawaiData,
    });
  } catch (err) {
    console.log(`ERROR:`, err);
    res.status(500).json({ error: "internal error", err });
  }
};

export const updateAbsensi = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, jamMasukDate, jamKeluarDate, isLembur } =
      req.body;

    const result = await prisma.$transaction(async (tx) => {
      const logAbsensiData = await tx.logAbsensi.findFirst({
        where: {
          id: Number(id),
        },
      });

      if (!logAbsensiData)
        return {
          code: 404,
          message: "Log absensi data tidak ditemukan",
        };

      const data: any = {};

      if (jamMasukDate) {
        data.jamMasukDate = dayjs(jamMasukDate).toDate();
        data.jamMasuk = dayjs(jamMasukDate).format("HH:mm:ss");
      }

      if (jamKeluarDate) {
        data.jamKeluarDate = dayjs(jamKeluarDate).toDate();
        data.jamKeluar = dayjs(jamKeluarDate).format("HH:mm:ss");
      }

      if (checkIn !== undefined) {
        data.checkIn = checkIn ? dayjs(checkIn).toDate() : null;
      }

      if (checkOut !== undefined) {
        data.checkOut = checkOut ? dayjs(checkOut).toDate() : null;
      }

      if (isLembur !== undefined) data.isLembur = isLembur;

      const updated = await tx.logAbsensi.update({
        where: {
          id: logAbsensiData.id,
        },
        data: data,
      });

      return {
        code: 200,
        data: updated,
      };
    });

    res.status(result.code).json(result);
  } catch (err) {
    res.status(500).json(err);
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
