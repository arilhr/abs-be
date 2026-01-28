import { Request, Response } from "express";
import prisma from "../prisma";
import dayjs from "dayjs";
import { calculateJamShiftDate } from "../utils/calculate-jam-shift-date";
import { CHECK_IN_MINUTE_OFFSET } from "../constants/absensi";
import {
  convertDayDatabaseToDayjs,
  convertDayDayjsToDatabase,
  getDayFromDate,
} from "../utils/get-day-from-date";
import { ScanType } from "../../prisma/generated/enums";
import { decryptQRData } from "../utils/crypto";
import { isDateInTimeRange } from "../utils/is-date-in-time-range";

export const getAllAbsensi = async (req: Request, res: Response) => {
  try {
    const {
      pegawaiId,
      pegawaiName,
      shiftId,
      startDate,
      endDate,
      checkInStart,
      checkInEnd,
      checkOutStart,
      checkOutEnd,
      day,
      sortBy = "createdAt",
      sortOrder = "desc",
      isArchive,
      page,
      limit,
    } = req.query;

    const where: any = { isArchive: false };

    if (isArchive !== undefined && String(isArchive).trim() !== "") {
      where.isArchive = isArchive === "true";
    }

    if (pegawaiId !== undefined && String(pegawaiId).trim() !== "") {
      const pid = Number(pegawaiId);
      if (!Number.isNaN(pid)) where.pegawaiId = pid;
    }

    if (shiftId !== undefined && String(shiftId).trim() !== "") {
      const sid = Number(shiftId);
      if (!Number.isNaN(sid)) where.shiftId = sid;
    }

    if (day !== undefined && String(day).trim() !== "") {
      const d = Number(day);
      if (!Number.isNaN(d)) where.day = d;
    }

    if (startDate !== undefined && String(startDate).trim() !== "") {
      const start = dayjs(String(startDate)).startOf("day").toDate();
      where.jamMasukDate = { ...where.jamMasukDate, gte: start };
    }

    if (endDate !== undefined && String(endDate).trim() !== "") {
      const end = dayjs(String(endDate)).endOf("day").toDate();
      where.jamMasukDate = { ...where.jamMasukDate, lte: end };
    }

    if (checkInStart !== undefined && String(checkInStart).trim() !== "") {
      const ciStart = dayjs(String(checkInStart)).startOf("day").toDate();
      where.checkIn = { ...where.checkIn, gte: ciStart };
    }

    if (checkInEnd !== undefined && String(checkInEnd).trim() !== "") {
      const ciEnd = dayjs(String(checkInEnd)).endOf("day").toDate();
      where.checkIn = { ...where.checkIn, lte: ciEnd };
    }

    if (checkOutStart !== undefined && String(checkOutStart).trim() !== "") {
      const coStart = dayjs(String(checkOutStart)).startOf("day").toDate();
      where.checkOut = { ...where.checkOut, gte: coStart };
    }

    if (checkOutEnd !== undefined && String(checkOutEnd).trim() !== "") {
      const coEnd = dayjs(String(checkOutEnd)).endOf("day").toDate();
      where.checkOut = { ...where.checkOut, lte: coEnd };
    }

    // relation filter for pegawaiName
    const include: any = { pegawai: true, shift: true };
    if (pegawaiName !== undefined && String(pegawaiName).trim() !== "") {
      where.pegawai = {
        name: { contains: String(pegawaiName).trim() },
      };
    }

    // order sorting default createdAt desc, sort can be by jamMasukDate, pegawaiName, day
    const orderBy: any = {};
    if (sortBy === "pegawaiName") {
      orderBy.pegawai = {
        name: sortOrder === "asc" ? "asc" : "desc",
      };
    } else if (sortBy === "day") {
      orderBy.day = sortOrder === "asc" ? "asc" : "desc";
    } else if (sortBy === "jamMasukDate") {
      orderBy.jamMasukDate = sortOrder === "asc" ? "asc" : "desc";
    } else {
      orderBy.createdAt = sortOrder === "asc" ? "asc" : "desc";
    }

    const withPagination = !isNaN(Number(page)) || !isNaN(Number(limit));

    const [total, data] = await Promise.all([
      prisma.logAbsensi.count({ where }),
      prisma.logAbsensi.findMany({
        where,
        include,
        orderBy,
        ...(withPagination && {
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
      }),
    ]);

    res.json({
      data,
      total,
      ...(withPagination && {
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      }),
    });
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
};

export const scanAbsensi = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ message: "Scan code is required." });
      return;
    }

    let pegawaiIdFromQR: string;
    try {
      const decryptedData = decryptQRData(code);
      const parsedData = JSON.parse(decryptedData);
      pegawaiIdFromQR = parsedData.pegawaiId;
      if (!pegawaiIdFromQR) {
        res.status(400).json({ message: "Invalid QR code data." });
        return;
      }
    } catch {
      res.status(401).json({ message: "Invalid or corrupted QR code." });
      return;
    }

    const NOW = dayjs();

    // check pegawai data
    const pegawaiData = await prisma.pegawai.findFirst({
      where: {
        pegawaiId: pegawaiIdFromQR,
      },
      include: {
        position: true,
      },
    });

    if (!pegawaiData) {
      res.status(400).json({ message: "Data pegawai tidak ditemukan." });
      return;
    }

    const pegawaiId = pegawaiData.id;

    const result = await prisma.$transaction(async (tx) => {
      const currentDate = NOW.toDate();
      const currentDay = NOW.day() === 0 ? 6 : NOW.day() - 1;

      // latest log absensi
      let latestLogAbsensi = await tx.logAbsensi.findFirst({
        where: {
          pegawaiId,
          checkOut: null,
        },
        orderBy: {
          jamMasukDate: "desc",
        },
      });

      // cek apakah jam keluar date dari latest log absensi sudah lebih dari 24 jam
      if (latestLogAbsensi) {
        const jamKeluarDate = dayjs(latestLogAbsensi.jamKeluarDate);
        const diffInHours = NOW.diff(jamKeluarDate, "hour");
        if (diffInHours > 24) {
          latestLogAbsensi = null;
        }
      }

      const shiftList = await tx.shift.findMany({
        where: {
          isActive: true,
          isArchive: false,
        },
      });

      const jadwalOriginalList = await tx.jadwal.findMany({
        where: {
          pegawaiId,
          OR: [
            {
              day: currentDay,
            },
            {
              day: currentDay === 0 ? 6 : currentDay - 1,
            },
            {
              day: currentDay === 6 ? 0 : currentDay + 1,
            },
          ],
          isActive: true,
          isArchive: false,
        },
        include: {
          shift: true,
        },
      });

      const jadwalOverrideList = await tx.jadwalOverride.findMany({
        where: {
          pegawaiId,
          OR: [
            {
              date: dayjs(currentDate).startOf("day").toDate(),
            },
            {
              date: NOW.subtract(1, "day").startOf("day").toDate(),
            },
            {
              date: NOW.add(1, "day").startOf("day").toDate(),
            },
          ],
          isActive: true,
          isArchive: false,
        },
        include: {
          shift: true,
        },
      });

      let listJadwalMerge = jadwalOriginalList.map((jadwal) => {
        return {
          day: jadwal.day,
          shiftId: jadwal.shiftId,
          shift: {
            jamMasuk: jadwal.shift.jamMasuk,
            jamKeluar: jadwal.shift.jamKeluar,
            name: jadwal.shift.name,
          },
        };
      });

      jadwalOverrideList.forEach((jadwalOverride) => {
        const jadwalOverrideDay = getDayFromDate(jadwalOverride.date);

        // kalau jadwal override shift id ada, maka hapus jadwal dari list jadwal merge
        if (jadwalOverride.originalShiftId !== null) {
          listJadwalMerge = listJadwalMerge.filter(
            (jadwal) =>
              !(
                jadwal.day === jadwalOverrideDay &&
                jadwal.shiftId === jadwalOverride.originalShiftId
              ),
          );
        }

        // kalau ada shift id, maka tambah jadwal override ke list jadwal merge
        if (jadwalOverride.shiftId !== null) {
          const shiftOverride = shiftList.find(
            (shift) => shift.id === jadwalOverride.shiftId,
          );
          if (shiftOverride) {
            listJadwalMerge.push({
              day: jadwalOverrideDay,
              shiftId: jadwalOverride.shiftId,
              shift: {
                jamMasuk: shiftOverride.jamMasuk,
                jamKeluar: shiftOverride.jamKeluar,
                name: shiftOverride.name,
              },
            });
          }
        }
      });

      // sort list jadwal berdasarkan day lalu jam masuk
      listJadwalMerge.sort((a, b) => {
        if (a.day === b.day) {
          return dayjs(a.shift.jamMasuk).isBefore(dayjs(b.shift.jamMasuk))
            ? -1
            : 1;
        }
        return a.day - b.day;
      });

      while (latestLogAbsensi) {
        // cek apakah sudah waktunya pulang
        if (
          NOW.isSame(dayjs(latestLogAbsensi.jamKeluarDate)) ||
          NOW.isAfter(dayjs(latestLogAbsensi.jamKeluarDate))
        ) {
          // cek apakah terdapat jadwal yang jam masuknya sama dengan latest log absensi
          const jadwalTerusan = listJadwalMerge.find(
            (item) =>
              item.day === latestLogAbsensi?.day &&
              item.shift.jamMasuk === latestLogAbsensi?.jamKeluar,
          );

          // jika terusan
          if (jadwalTerusan) {
            // update check out latest log absensi menjadi sesuai dengan jam keluar log absensi tersebut
            await tx.logAbsensi.update({
              where: {
                id: latestLogAbsensi.id,
              },
              data: {
                checkOut: latestLogAbsensi.jamKeluarDate,
              },
            });

            // buat log absensi untuk jadwal terusan ini
            const { jamMasukDate, jamKeluarDate } = calculateJamShiftDate(
              jadwalTerusan.shift.jamMasuk,
              jadwalTerusan.shift.jamKeluar,
              latestLogAbsensi.jamKeluarDate,
            );

            // cek apakah log absensi untuk jadwal terusan sudah ada
            let logAbsensiTerusan = await tx.logAbsensi.findFirst({
              where: {
                pegawaiId,
                shiftId: jadwalTerusan.shiftId,
                day: jadwalTerusan.day,
              },
            });

            if (!logAbsensiTerusan) {
              logAbsensiTerusan = await tx.logAbsensi.create({
                data: {
                  pegawaiId,
                  shiftId: jadwalTerusan.shiftId,
                  jamMasukDate,
                  jamKeluarDate,
                  jamMasuk: jadwalTerusan.shift.jamMasuk,
                  jamKeluar: jadwalTerusan.shift.jamKeluar,
                  day: jadwalTerusan.day,
                  shiftName: jadwalTerusan.shift.name,
                  checkIn: jamMasukDate,
                },
              });
            }

            latestLogAbsensi = logAbsensiTerusan;

            continue;
          }

          // [CHECKOUT] kalau tidak ada terusan, maka checkout
          const checkOutLogAbsensi = await tx.logAbsensi.update({
            where: {
              id: latestLogAbsensi.id,
            },
            data: {
              checkOut: currentDate,
            },
          });

          // buat data log scan
          await tx.logScan.create({
            data: {
              pegawaiId,
              logAbsensiId: checkOutLogAbsensi.id,
              scanTime: currentDate,
              scanType: "OUT",
            },
          });

          return {
            code: 200,
            status: "CHECK_OUT",
            data: checkOutLogAbsensi,
          };
        }

        // buat data log scan
        await tx.logScan.create({
          data: {
            pegawaiId,
            scanTime: currentDate,
            scanType: "UNKNOWN",
          },
        });

        return {
          code: 200,
          status: "CHECK_OUT_NOT_YET",
          data: latestLogAbsensi,
        };
      }

      // cek jadwal mana yang sekarang aktif
      const jadwalNow = listJadwalMerge.find((jadwal) => {
        if (jadwal.day > currentDay) return false;
        return isDateInTimeRange(
          jadwal.shift.jamMasuk,
          jadwal.shift.jamKeluar,
          NOW,
          jadwal.day < currentDay
            ? NOW.subtract(1, "day").toDate()
            : currentDate,
          -60,
        );
      });

      // kalau ada jadwal yang aktif
      if (jadwalNow) {
        // buat log absensi dan check in
        const { jamMasukDate, jamKeluarDate } = calculateJamShiftDate(
          jadwalNow.shift.jamMasuk,
          jadwalNow.shift.jamKeluar,
          jadwalNow.day < currentDay
            ? NOW.subtract(1, "day").toDate()
            : currentDate,
        );

        const checkInLogAbsensi = await tx.logAbsensi.create({
          data: {
            pegawaiId,
            shiftId: jadwalNow.shiftId,
            jamMasukDate,
            jamKeluarDate,
            jamMasuk: jadwalNow.shift.jamMasuk,
            jamKeluar: jadwalNow.shift.jamKeluar,
            day: jadwalNow.day,
            shiftName: jadwalNow.shift.name,
            checkIn: currentDate,
          },
        });

        // buat data log scan
        await tx.logScan.create({
          data: {
            pegawaiId,
            logAbsensiId: checkInLogAbsensi.id,
            scanTime: currentDate,
            scanType: "IN",
          },
        });

        return {
          code: 200,
          status: "CHECK_IN",
          data: checkInLogAbsensi,
          listJadwalMerge,
        };
      }

      // buat data log scan
      await tx.logScan.create({
        data: {
          pegawaiId,
          scanTime: currentDate,
          scanType: "UNKNOWN",
        },
      });

      return {
        code: 200,
        status: "NOT_YET",
        latestLogAbsensi,
        listJadwalMerge,
        jadwalOverrideList,
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

export const scanAbsensiBulk = async (req: Request, res: Response) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      res
        .status(400)
        .json({ message: "Data array is required and must not be empty." });
      return;
    }

    // Sort data by scanDate from earliest to latest
    const sortedData = [...data].sort((a, b) => {
      const dateA = a.scanDate ? dayjs(a.scanDate) : dayjs();
      const dateB = b.scanDate ? dayjs(b.scanDate) : dayjs();
      return dateA.valueOf() - dateB.valueOf();
    });

    const results = {
      success: [] as any[],
      failed: [] as any[],
      total: sortedData.length,
    };

    // Process each scan sequentially (sorted by earliest date first)
    for (const scanData of sortedData) {
      try {
        const { code, scanDate } = scanData;

        if (!code) {
          results.failed.push({
            scanData,
            error: "Scan code is required.",
          });
          continue;
        }

        let pegawaiIdFromQR: string;
        try {
          const decryptedData = decryptQRData(code);
          const parsedData = JSON.parse(decryptedData);
          pegawaiIdFromQR = parsedData.pegawaiId;
          if (!pegawaiIdFromQR) {
            results.failed.push({
              scanData,
              error: "Invalid QR code data.",
            });
            continue;
          }
        } catch {
          results.failed.push({
            scanData,
            error: "Invalid or corrupted QR code.",
          });
          continue;
        }

        // Use scanDate if provided, otherwise use current time
        const NOW = scanDate ? dayjs(scanDate) : dayjs();

        // check pegawai data
        const pegawaiData = await prisma.pegawai.findFirst({
          where: {
            pegawaiId: pegawaiIdFromQR,
          },
          include: {
            position: true,
          },
        });

        if (!pegawaiData) {
          results.failed.push({
            scanData,
            error: "Data pegawai tidak ditemukan.",
          });
          continue;
        }

        const pegawaiId = pegawaiData.id;

        // Use same logic as scanAbsensi
        const result = await prisma.$transaction(async (tx) => {
          const currentDate = NOW.toDate();
          const currentDay = NOW.day() === 0 ? 6 : NOW.day() - 1;

          // latest log absensi
          let latestLogAbsensi = await tx.logAbsensi.findFirst({
            where: {
              pegawaiId,
              checkOut: null,
            },
            orderBy: {
              jamMasukDate: "desc",
            },
          });

          // cek apakah jam keluar date dari latest log absensi sudah lebih dari 24 jam
          if (latestLogAbsensi) {
            const jamKeluarDate = dayjs(latestLogAbsensi.jamKeluarDate);
            const diffInHours = NOW.diff(jamKeluarDate, "hour");
            if (diffInHours > 24) {
              latestLogAbsensi = null;
            }
          }

          const shiftList = await tx.shift.findMany({
            where: {
              isActive: true,
              isArchive: false,
            },
          });

          const jadwalOriginalList = await tx.jadwal.findMany({
            where: {
              pegawaiId,
              OR: [
                {
                  day: currentDay,
                },
                {
                  day: currentDay === 0 ? 6 : currentDay - 1,
                },
                {
                  day: currentDay === 6 ? 0 : currentDay + 1,
                },
              ],
              isActive: true,
              isArchive: false,
            },
            include: {
              shift: true,
            },
          });

          const jadwalOverrideList = await tx.jadwalOverride.findMany({
            where: {
              pegawaiId,
              OR: [
                {
                  date: dayjs(currentDate).startOf("day").toDate(),
                },
                {
                  date: NOW.subtract(1, "day").startOf("day").toDate(),
                },
                {
                  date: NOW.add(1, "day").startOf("day").toDate(),
                },
              ],
              isActive: true,
              isArchive: false,
            },
            include: {
              shift: true,
            },
          });

          let listJadwalMerge = jadwalOriginalList.map((jadwal) => {
            return {
              day: jadwal.day,
              shiftId: jadwal.shiftId,
              shift: {
                jamMasuk: jadwal.shift.jamMasuk,
                jamKeluar: jadwal.shift.jamKeluar,
                name: jadwal.shift.name,
              },
            };
          });

          jadwalOverrideList.forEach((jadwalOverride) => {
            const jadwalOverrideDay = getDayFromDate(jadwalOverride.date);

            // kalau jadwal override shift id ada, maka hapus jadwal dari list jadwal merge
            if (jadwalOverride.originalShiftId !== null) {
              listJadwalMerge = listJadwalMerge.filter(
                (jadwal) =>
                  !(
                    jadwal.day === jadwalOverrideDay &&
                    jadwal.shiftId === jadwalOverride.originalShiftId
                  ),
              );
            }

            // kalau ada shift id, maka tambah jadwal override ke list jadwal merge
            if (jadwalOverride.shiftId !== null) {
              const shiftOverride = shiftList.find(
                (shift) => shift.id === jadwalOverride.shiftId,
              );
              if (shiftOverride) {
                listJadwalMerge.push({
                  day: jadwalOverrideDay,
                  shiftId: jadwalOverride.shiftId,
                  shift: {
                    jamMasuk: shiftOverride.jamMasuk,
                    jamKeluar: shiftOverride.jamKeluar,
                    name: shiftOverride.name,
                  },
                });
              }
            }
          });

          // sort list jadwal berdasarkan day lalu jam masuk
          listJadwalMerge.sort((a, b) => {
            if (a.day === b.day) {
              return dayjs(a.shift.jamMasuk).isBefore(dayjs(b.shift.jamMasuk))
                ? -1
                : 1;
            }
            return a.day - b.day;
          });

          while (latestLogAbsensi) {
            // cek apakah sudah waktunya pulang
            if (
              NOW.isSame(dayjs(latestLogAbsensi.jamKeluarDate)) ||
              NOW.isAfter(dayjs(latestLogAbsensi.jamKeluarDate))
            ) {
              // cek apakah terdapat jadwal yang jam masuknya sama dengan latest log absensi
              const jadwalTerusan = listJadwalMerge.find(
                (item) =>
                  item.day === latestLogAbsensi?.day &&
                  item.shift.jamMasuk === latestLogAbsensi?.jamKeluar,
              );

              // jika terusan
              if (jadwalTerusan) {
                // update check out latest log absensi menjadi sesuai dengan jam keluar log absensi tersebut
                await tx.logAbsensi.update({
                  where: {
                    id: latestLogAbsensi.id,
                  },
                  data: {
                    checkOut: latestLogAbsensi.jamKeluarDate,
                  },
                });

                // buat log absensi untuk jadwal terusan ini
                const { jamMasukDate, jamKeluarDate } = calculateJamShiftDate(
                  jadwalTerusan.shift.jamMasuk,
                  jadwalTerusan.shift.jamKeluar,
                  latestLogAbsensi.jamKeluarDate,
                );

                // cek apakah log absensi untuk jadwal terusan sudah ada
                let logAbsensiTerusan = await tx.logAbsensi.findFirst({
                  where: {
                    pegawaiId,
                    shiftId: jadwalTerusan.shiftId,
                    day: jadwalTerusan.day,
                  },
                });

                if (!logAbsensiTerusan) {
                  logAbsensiTerusan = await tx.logAbsensi.create({
                    data: {
                      pegawaiId,
                      shiftId: jadwalTerusan.shiftId,
                      jamMasukDate,
                      jamKeluarDate,
                      jamMasuk: jadwalTerusan.shift.jamMasuk,
                      jamKeluar: jadwalTerusan.shift.jamKeluar,
                      day: jadwalTerusan.day,
                      shiftName: jadwalTerusan.shift.name,
                      checkIn: jamMasukDate,
                    },
                  });
                }

                latestLogAbsensi = logAbsensiTerusan;

                continue;
              }

              // kalau tidak ada terusan, maka checkout
              const checkOutLogAbsensi = await tx.logAbsensi.update({
                where: {
                  id: latestLogAbsensi.id,
                },
                data: {
                  checkOut: currentDate,
                },
              });

              // buat data log scan
              await tx.logScan.create({
                data: {
                  pegawaiId,
                  logAbsensiId: checkOutLogAbsensi.id,
                  scanTime: currentDate,
                  scanType: "OUT",
                },
              });

              return {
                code: 200,
                status: "CHECK_OUT",
                data: checkOutLogAbsensi,
              };
            }

            // buat data log scan
            await tx.logScan.create({
              data: {
                pegawaiId,
                scanTime: currentDate,
                scanType: "UNKNOWN",
              },
            });

            return {
              code: 200,
              status: "CHECK_OUT_NOT_YET",
              data: latestLogAbsensi,
            };
          }

          // cek jadwal mana yang sekarang aktif
          const jadwalNow = listJadwalMerge.find((jadwal) => {
            if (jadwal.day > currentDay) return false;
            return isDateInTimeRange(
              jadwal.shift.jamMasuk,
              jadwal.shift.jamKeluar,
              NOW,
              jadwal.day < currentDay
                ? NOW.subtract(1, "day").toDate()
                : currentDate,
              -60,
            );
          });

          // kalau ada jadwal yang aktif
          if (jadwalNow) {
            // buat log absensi dan check in
            const { jamMasukDate, jamKeluarDate } = calculateJamShiftDate(
              jadwalNow.shift.jamMasuk,
              jadwalNow.shift.jamKeluar,
              jadwalNow.day < currentDay
                ? NOW.subtract(1, "day").toDate()
                : currentDate,
            );

            const checkInLogAbsensi = await tx.logAbsensi.create({
              data: {
                pegawaiId,
                shiftId: jadwalNow.shiftId,
                jamMasukDate,
                jamKeluarDate,
                jamMasuk: jadwalNow.shift.jamMasuk,
                jamKeluar: jadwalNow.shift.jamKeluar,
                day: jadwalNow.day,
                shiftName: jadwalNow.shift.name,
                checkIn: currentDate,
              },
            });

            // buat data log scan
            await tx.logScan.create({
              data: {
                pegawaiId,
                logAbsensiId: checkInLogAbsensi.id,
                scanTime: currentDate,
                scanType: "IN",
              },
            });

            return {
              code: 200,
              status: "CHECK_IN",
              data: checkInLogAbsensi,
            };
          }

          // buat data log scan
          await tx.logScan.create({
            data: {
              pegawaiId,
              scanTime: currentDate,
              scanType: "UNKNOWN",
            },
          });

          return {
            code: 200,
            status: "NOT_YET",
            latestLogAbsensi,
            listJadwalMerge,
            jadwalOverrideList,
          };
        });

        results.success.push({
          scanData,
          result: {
            ...result,
            pegawai: pegawaiData,
          },
        });
      } catch (err) {
        results.failed.push({
          scanData,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    res.status(200).json({
      message: `Processed ${results.total} scans: ${results.success.length} successful, ${results.failed.length} failed`,
      results,
    });
  } catch (err) {
    console.log(`ERROR:`, err);
    res.status(500).json({ error: "internal error", err });
  }
};

export const createLogAbsensi = async (req: Request, res: Response) => {
  try {
    const { pegawaiId, shiftId, date, checkIn, checkOut } = req.body;

    if (!pegawaiId || !shiftId || date === undefined) {
      res
        .status(400)
        .json({ message: "Wajib mengisi pegawai, shift, dan tanggal." });
      return;
    }

    // check pegawai data
    const pegawaiData = await prisma.pegawai.findFirst({
      where: {
        id: pegawaiId,
      },
    });

    if (!pegawaiData) {
      res.status(400).json({ message: "Data pegawai tidak ditemukan." });
      return;
    }

    // get shift data
    const shiftData = await prisma.shift.findFirst({
      where: {
        id: shiftId,
      },
    });

    if (!shiftData) {
      res.status(400).json({ message: "Data shift tidak ditemukan." });
      return;
    }

    const shiftDate = calculateJamShiftDate(
      shiftData.jamMasuk,
      shiftData.jamKeluar,
      dayjs(date).toDate(),
    );

    const day = convertDayDayjsToDatabase(dayjs(date).day());

    // check sudah ada log absensi di tanggal tersebut
    const existingLogAbsensi = await prisma.logAbsensi.findFirst({
      where: {
        pegawaiId,
        shiftId,
        jamMasukDate: shiftDate.jamMasukDate,
      },
    });

    if (existingLogAbsensi) {
      res.status(400).json({
        message:
          "Log absensi untuk pegawai dan shift tersebut sudah ada di tanggal tersebut.",
      });
      return;
    }

    const newLogAbsensi = await prisma.logAbsensi.create({
      data: {
        pegawaiId: pegawaiData.id,
        shiftId: shiftData.id,
        shiftName: shiftData.name,
        jamMasukDate: shiftDate.jamMasukDate,
        jamMasuk: shiftData.jamMasuk,
        jamKeluarDate: shiftDate.jamKeluarDate,
        jamKeluar: shiftData.jamKeluar,
        checkIn: checkIn ? dayjs(checkIn).toDate() : null,
        checkOut: checkOut ? dayjs(checkOut).toDate() : null,
        day,
      },
    });

    res.status(201).json(newLogAbsensi);
  } catch (err) {
    res.status(500).json(err);
  }
};

export const updateAbsensi = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      checkIn,
      checkOut,
      shiftId,
      date,
      jamMasukDate,
      jamKeluarDate,
      isLembur,
      isArchive,
    } = req.body;

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

      if (shiftId) {
        // get and check shift data
        const shiftData = await tx.shift.findFirst({
          where: {
            id: shiftId,
          },
        });

        if (!shiftData) {
          return {
            code: 400,
            message: "Data shift tidak ditemukan.",
          };
        }

        const shiftDate = calculateJamShiftDate(
          shiftData.jamMasuk,
          shiftData.jamKeluar,
          date ? dayjs(date).toDate() : logAbsensiData.jamMasukDate,
        );

        data.shiftId = shiftData.id;
        data.shiftName = shiftData.name;
        data.jamMasuk = shiftData.jamMasuk;
        data.jamKeluar = shiftData.jamKeluar;
        data.jamMasukDate = shiftDate.jamMasukDate;
        data.jamKeluarDate = shiftDate.jamKeluarDate;

        if (checkIn !== undefined) {
          data.checkIn = checkIn ? dayjs(checkIn).toDate() : null;
        }

        if (checkOut !== undefined) {
          data.checkOut = checkOut ? dayjs(checkOut).toDate() : null;
        }

        if (isLembur !== undefined) data.isLembur = isLembur;

        if (isArchive !== undefined) data.isArchive = isArchive;

        data.day = convertDayDayjsToDatabase(
          dayjs(date ? date : logAbsensiData.jamMasukDate).day(),
        );

        const existingLogAbsensi = await tx.logAbsensi.findFirst({
          where: {
            id: { not: logAbsensiData.id },
            shiftId: shiftData.id,
            pegawaiId: logAbsensiData.pegawaiId,
            jamMasukDate: shiftDate.jamMasukDate,
          },
        });

        if (existingLogAbsensi) {
          return {
            code: 400,
            message:
              "Log absensi untuk pegawai dan shift tersebut sudah ada di tanggal tersebut.",
          };
        }

        const result = await tx.logAbsensi.update({
          where: {
            id: logAbsensiData.id,
          },
          data: data,
        });

        return {
          code: 200,
          data: result,
        };
      }

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

      if (isArchive !== undefined) data.isArchive = isArchive;

      data.shiftId = null;
      data.shiftName = "Custom";

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
  res: Response,
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
