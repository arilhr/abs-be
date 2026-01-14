import { Request, Response } from "express";
import prisma from "../prisma";
import dayjs from "dayjs";
import { calculateJamShiftDate } from "../utils/calculate-jam-shift-date";
import { CHECK_IN_MINUTE_OFFSET } from "../constants/absensi";
import {
  convertDayDatabaseToDayjs,
  convertDayDayjsToDatabase,
} from "../utils/get-day-from-date";
import { ScanType } from "../../prisma/generated/enums";

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

/**
 * Helper: Find consecutive shifts (where jamKeluar of one = jamMasuk of next)
 * Returns array of shift groups, each group is an array of consecutive shifts sorted by jamMasuk
 */
function groupConsecutiveShifts(
  shifts: Array<{
    day: number;
    shiftId: number;
    shift: { jamMasuk: string; jamKeluar: string; name: string };
    isOverride?: boolean;
  }>,
  currentDay: number
): Array<typeof shifts> {
  // Filter only today's shifts
  const todayShifts = shifts.filter((s) => s.day === currentDay);

  if (todayShifts.length <= 1) {
    return todayShifts.map((s) => [s]);
  }

  // Sort by jamMasuk
  todayShifts.sort((a, b) => a.shift.jamMasuk.localeCompare(b.shift.jamMasuk));

  const groups: Array<typeof shifts> = [];
  let currentGroup: typeof shifts = [todayShifts[0]];

  for (let i = 1; i < todayShifts.length; i++) {
    const prevShift = currentGroup[currentGroup.length - 1];
    const currShift = todayShifts[i];

    // Check if consecutive (prevShift.jamKeluar === currShift.jamMasuk)
    if (prevShift.shift.jamKeluar === currShift.shift.jamMasuk) {
      currentGroup.push(currShift);
    } else {
      // Start new group
      groups.push(currentGroup);
      currentGroup = [currShift];
    }
  }

  groups.push(currentGroup);
  return groups;
}

export const scanAbsensi = async (req: Request, res: Response) => {
  try {
    const { pegawaiId, code } = req.body;

    if (!code) {
      res.status(400).json({ message: "Scan secret code is required." });
      return;
    }

    // check scan secret code
    const scanSecretCodeConfig = process.env.SCAN_CODE;

    if (scanSecretCodeConfig) {
      const scanSecretCode = scanSecretCodeConfig;
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
      const todayStart = NOW.startOf("day").toDate();
      const todayEnd = NOW.endOf("day").toDate();

      // Step 1: Get ALL JadwalOverrides for today
      const todayOverrides = await tx.jadwalOverride.findMany({
        where: {
          pegawaiId: pegawaiId,
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
          isActive: true,
          isArchive: false,
        },
        include: {
          shift: true,
          originalShift: true,
        },
      });

      // Categorize overrides by type
      const addOverrides = todayOverrides.filter(
        (o) => o.originalShiftId === null && o.shiftId !== null
      ); // TAMBAH
      const replaceOverrides = todayOverrides.filter(
        (o) => o.originalShiftId !== null && o.shiftId !== null
      ); // GANTI
      const removeOverrides = todayOverrides.filter(
        (o) => o.originalShiftId !== null && o.shiftId === null
      ); // LIBUR

      // Get set of original shift IDs that are being replaced or removed
      const replacedOrRemovedShiftIds = new Set([
        ...replaceOverrides.map((o) => o.originalShiftId!),
        ...removeOverrides.map((o) => o.originalShiftId!),
      ]);

      // Step 2: Build jadwal list
      let jadwalPegawaiList: Array<{
        day: number;
        shiftId: number;
        shift: { jamMasuk: string; jamKeluar: string; name: string };
        isOverride?: boolean;
      }> = [];

      // Add shifts from TAMBAH overrides (new shifts)
      for (const override of addOverrides) {
        if (override.shift) {
          jadwalPegawaiList.push({
            day: currentDay,
            shiftId: override.shiftId!,
            shift: {
              jamMasuk: override.shift.jamMasuk,
              jamKeluar: override.shift.jamKeluar,
              name: override.shift.name,
            },
            isOverride: true,
          });
        }
      }

      // Add replacement shifts from GANTI overrides
      for (const override of replaceOverrides) {
        if (override.shift) {
          jadwalPegawaiList.push({
            day: currentDay,
            shiftId: override.shiftId!,
            shift: {
              jamMasuk: override.shift.jamMasuk,
              jamKeluar: override.shift.jamKeluar,
              name: override.shift.name,
            },
            isOverride: true,
          });
        }
      }

      // Get regular jadwal (for current day and nearby days)
      const regularJadwalList = await tx.jadwal.findMany({
        where: {
          pegawaiId: pegawaiId,
          isActive: true,
          isArchive: false,
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

      // Add regular jadwals to list
      for (const jadwal of regularJadwalList) {
        // For today's shifts: skip if this shift is being replaced or removed
        if (
          jadwal.day === currentDay &&
          replacedOrRemovedShiftIds.has(jadwal.shiftId)
        ) {
          continue;
        }
        jadwalPegawaiList.push({
          day: jadwal.day,
          shiftId: jadwal.shiftId,
          shift: jadwal.shift,
        });
      }

      // === CONSECUTIVE SHIFTS HANDLING ===
      // Group today's shifts by consecutive jamMasuk/jamKeluar
      const shiftGroups = groupConsecutiveShifts(jadwalPegawaiList, currentDay);

      // Find which group the current time falls into
      let activeGroup: typeof jadwalPegawaiList | null = null;
      let groupFirstShift: (typeof jadwalPegawaiList)[0] | null = null;
      let groupLastShift: (typeof jadwalPegawaiList)[0] | null = null;

      for (const group of shiftGroups) {
        if (group.length === 0) continue;

        const firstShift = group[0];
        const lastShift = group[group.length - 1];

        // Calculate time window for the entire group
        const firstShiftDate = calculateJamShiftDate(
          firstShift.shift.jamMasuk,
          firstShift.shift.jamKeluar
        );
        const lastShiftDate = calculateJamShiftDate(
          lastShift.shift.jamMasuk,
          lastShift.shift.jamKeluar
        );

        const groupStartTime = dayjs(firstShiftDate.jamMasukDate)
          .subtract(CHECK_IN_MINUTE_OFFSET, "minutes")
          .toDate();
        const groupEndTime = lastShiftDate.jamKeluarDate;

        // Check if current time is within this group's window (for check-in/during shift)
        // OR if current time is AFTER groupEndTime (for late checkout)
        const isWithinWindow =
          groupStartTime <= currentDate && currentDate < groupEndTime;
        const isPastWindow = currentDate >= groupEndTime;

        if (isWithinWindow || isPastWindow) {
          activeGroup = group;
          groupFirstShift = firstShift;
          groupLastShift = lastShift;
          break;
        }
      }

      // If we're in an active group of consecutive shifts
      if (activeGroup && groupFirstShift && groupLastShift) {
        // Calculate dates for first shift (for LogAbsensi lookup)
        const firstShiftDate = calculateJamShiftDate(
          groupFirstShift.shift.jamMasuk,
          groupFirstShift.shift.jamKeluar
        );
        const firstJamMasukDate = dayjs(firstShiftDate.jamMasukDate)
          .day(convertDayDatabaseToDayjs(groupFirstShift.day))
          .toDate();

        // Check if LogAbsensi exists for the FIRST shift in the group
        const existingFirstLogAbsensi = await tx.logAbsensi.findFirst({
          where: {
            pegawaiId,
            shiftId: groupFirstShift.shiftId,
            jamMasukDate: firstJamMasukDate,
          },
        });

        // Case 1: No LogAbsensi yet - this is a CHECK-IN
        // Only create LogAbsensi for the FIRST shift
        // Let cron create subsequent shifts, or create them at checkout
        if (!existingFirstLogAbsensi || !existingFirstLogAbsensi.checkIn) {
          let firstLogAbsensi = existingFirstLogAbsensi;

          if (!firstLogAbsensi) {
            // Create LogAbsensi for first shift only
            firstLogAbsensi = await tx.logAbsensi.create({
              data: {
                pegawaiId,
                shiftId: groupFirstShift.shiftId,
                shiftName: groupFirstShift.shift.name,
                jamMasuk: groupFirstShift.shift.jamMasuk,
                jamMasukDate: firstJamMasukDate,
                jamKeluar: groupFirstShift.shift.jamKeluar,
                jamKeluarDate: firstShiftDate.jamKeluarDate,
                day: groupFirstShift.day,
                checkIn: currentDate,
              },
            });
          } else {
            // Update existing with checkIn
            firstLogAbsensi = await tx.logAbsensi.update({
              where: { id: firstLogAbsensi.id },
              data: { checkIn: currentDate },
            });
          }

          // Create LogScan for the check-in
          await tx.logScan.create({
            data: {
              pegawaiId,
              logAbsensiId: firstLogAbsensi.id,
              scanTime: currentDate,
              scanType: ScanType.IN,
            },
          });

          const shiftNames = activeGroup.map((s) => s.shift.name).join(" + ");

          return {
            status:
              activeGroup.length > 1 ? "CHECK_IN_CONSECUTIVE" : "CHECK_IN",
            message:
              activeGroup.length > 1
                ? `Check-in untuk ${shiftNames} (shift berikutnya akan dibuat otomatis)`
                : undefined,
            data: firstLogAbsensi,
            consecutiveShifts:
              activeGroup.length > 1 ? activeGroup.length : undefined,
            code: 201,
          };
        }

        // Case 2: Already checked in - check if it's time for CHECK-OUT
        // Check if ALL shifts have been checked in
        const allLogsInGroup = [];
        for (const shift of activeGroup) {
          const shiftDate = calculateJamShiftDate(
            shift.shift.jamMasuk,
            shift.shift.jamKeluar
          );
          const shiftJamMasukDate = dayjs(shiftDate.jamMasukDate)
            .day(convertDayDatabaseToDayjs(shift.day))
            .toDate();

          const logAbsensi = await tx.logAbsensi.findFirst({
            where: {
              pegawaiId,
              shiftId: shift.shiftId,
              jamMasukDate: shiftJamMasukDate,
            },
          });

          if (logAbsensi) {
            allLogsInGroup.push({
              log: logAbsensi,
              shift,
              shiftDate,
            });
          }
        }

        // Check if FIRST shift is already checked out (means all are done)
        if (existingFirstLogAbsensi.checkOut) {
          await tx.logScan.create({
            data: {
              pegawaiId,
              logAbsensiId: existingFirstLogAbsensi.id,
              scanTime: currentDate,
              scanType: ScanType.UNKNOWN,
            },
          });

          return {
            status: "ALREADY_CHECK_OUT",
            data: allLogsInGroup.map((l) => l.log),
            code: 201,
          };
        }

        // Check if it's time to check out (only check last shift's jamKeluar)
        const lastShiftDate = calculateJamShiftDate(
          groupLastShift.shift.jamMasuk,
          groupLastShift.shift.jamKeluar
        );
        if (lastShiftDate.jamKeluarDate > currentDate) {
          await tx.logScan.create({
            data: {
              pegawaiId,
              logAbsensiId: existingFirstLogAbsensi.id,
              scanTime: currentDate,
              scanType: ScanType.UNKNOWN,
            },
          });

          return {
            status: "CHECK_OUT_NOT_YET",
            message: `Belum waktunya pulang. Jam pulang: ${groupLastShift.shift.jamKeluar}`,
            data:
              allLogsInGroup.length > 0
                ? allLogsInGroup.map((l) => l.log)
                : [existingFirstLogAbsensi],
            code: 201,
          };
        }

        // It's checkout time - first ensure ALL shifts have LogAbsensi
        // (some may not exist if cron didn't run yet)
        const allLogsForCheckout = [];

        for (let i = 0; i < activeGroup.length; i++) {
          const shift = activeGroup[i];
          const shiftDate = calculateJamShiftDate(
            shift.shift.jamMasuk,
            shift.shift.jamKeluar
          );
          const shiftJamMasukDate = dayjs(shiftDate.jamMasukDate)
            .day(convertDayDatabaseToDayjs(shift.day))
            .toDate();
          const isFirstShift = i === 0;
          const isLastShift = i === activeGroup.length - 1;

          // Find or create LogAbsensi for this shift
          let logAbsensi = await tx.logAbsensi.findFirst({
            where: {
              pegawaiId,
              shiftId: shift.shiftId,
              jamMasukDate: shiftJamMasukDate,
            },
          });

          if (!logAbsensi) {
            // Create LogAbsensi for missing shift
            // checkIn = jamMasukDate of THIS shift (not first shift's checkIn)
            logAbsensi = await tx.logAbsensi.create({
              data: {
                pegawaiId,
                shiftId: shift.shiftId,
                shiftName: shift.shift.name,
                jamMasuk: shift.shift.jamMasuk,
                jamMasukDate: shiftJamMasukDate,
                jamKeluar: shift.shift.jamKeluar,
                jamKeluarDate: shiftDate.jamKeluarDate,
                day: shift.day,
                checkIn: shiftJamMasukDate, // Use THIS shift's jamMasuk as checkIn
                checkOut: isLastShift ? currentDate : shiftDate.jamKeluarDate,
              },
            });
          } else if (!logAbsensi.checkOut) {
            // Update existing with checkOut
            // For first shift: checkOut = jamKeluarDate
            // For last shift: checkOut = actual scan time
            const checkOutTime = isLastShift
              ? currentDate
              : shiftDate.jamKeluarDate;
            logAbsensi = await tx.logAbsensi.update({
              where: { id: logAbsensi.id },
              data: { checkOut: checkOutTime },
            });
          }

          allLogsForCheckout.push(logAbsensi);
        }

        // Create single LogScan for the check-out
        const lastLogForCheckout =
          allLogsForCheckout[allLogsForCheckout.length - 1];
        await tx.logScan.create({
          data: {
            pegawaiId,
            logAbsensiId: lastLogForCheckout.id,
            scanTime: currentDate,
            scanType: ScanType.OUT,
          },
        });

        const shiftNames = activeGroup.map((s) => s.shift.name).join(" + ");

        return {
          status:
            activeGroup.length > 1 ? "CHECK_OUT_CONSECUTIVE" : "CHECK_OUT",
          message:
            activeGroup.length > 1
              ? `Check-out untuk ${shiftNames}`
              : undefined,
          data: allLogsForCheckout,
          code: 201,
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
      dayjs(date).toDate()
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
          date ? dayjs(date).toDate() : logAbsensiData.jamMasukDate
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
          dayjs(date ? date : logAbsensiData.jamMasukDate).day()
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
