import { Request, Response } from "express";
import prisma from "../prisma";
import { PrismaClientKnownRequestError } from "../../prisma/generated/internal/prismaNamespace";
import dayjs from "dayjs";

/**
 * Create a new JadwalOverride
 */
async function createJadwalOverride(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      pegawaiId,
      date,
      originalShiftId, // Shift asli yang diganti (null = menambah shift baru)
      shiftId, // Shift pengganti (null = libur/hapus shift)
      reason,
      isActive = true,
    } = req.body;

    if (pegawaiId === undefined || date === undefined) {
      res.status(400).json({ error: "pegawaiId and date are required" });
      return;
    }

    // Parse the date to start of day for consistent storage
    const parsedDate = dayjs(date).startOf("day").toDate();
    const dayOfWeek = dayjs(date).day() === 0 ? 6 : dayjs(date).day() - 1; // Convert to 0=Monday format

    // Validation based on override type
    const parsedOriginalShiftId = originalShiftId
      ? Number(originalShiftId)
      : null;
    const parsedShiftId =
      shiftId !== undefined ? (shiftId ? Number(shiftId) : null) : null;

    // Case 1: GANTI (replace) - originalShiftId is set, shiftId is set
    // Validate that pegawai has jadwal with originalShiftId on that day
    if (parsedOriginalShiftId !== null && parsedShiftId !== null) {
      // Validate: shift pengganti tidak boleh sama dengan shift asli
      if (parsedOriginalShiftId === parsedShiftId) {
        res.status(400).json({
          error: "Shift pengganti tidak boleh sama dengan shift asli.",
          code: "SAME_SHIFT_ERROR",
        });
        return;
      }

      const existingJadwal = await prisma.jadwal.findFirst({
        where: {
          pegawaiId: Number(pegawaiId),
          shiftId: parsedOriginalShiftId,
          day: dayOfWeek,
          isActive: true,
          isArchive: false,
        },
      });

      if (!existingJadwal) {
        res.status(400).json({
          error:
            "Pegawai tidak memiliki jadwal dengan shift asli tersebut pada hari itu.",
          code: "ORIGINAL_SHIFT_NOT_FOUND",
        });
        return;
      }
    }

    // Case 2: LIBUR (remove) - originalShiftId is set, shiftId is null
    // Validate that pegawai has jadwal with originalShiftId on that day
    if (parsedOriginalShiftId !== null && parsedShiftId === null) {
      const existingJadwal = await prisma.jadwal.findFirst({
        where: {
          pegawaiId: Number(pegawaiId),
          shiftId: parsedOriginalShiftId,
          day: dayOfWeek,
          isActive: true,
          isArchive: false,
        },
      });

      if (!existingJadwal) {
        res.status(400).json({
          error:
            "Pegawai tidak memiliki jadwal dengan shift tersebut pada hari itu untuk diliburkan.",
          code: "SHIFT_TO_REMOVE_NOT_FOUND",
        });
        return;
      }
    }

    // Case 3: TAMBAH (add) - originalShiftId is null, shiftId is set
    // Validate that pegawai does NOT have jadwal with shiftId on that day
    if (parsedOriginalShiftId === null && parsedShiftId !== null) {
      const existingJadwal = await prisma.jadwal.findFirst({
        where: {
          pegawaiId: Number(pegawaiId),
          shiftId: parsedShiftId,
          day: dayOfWeek,
          isActive: true,
          isArchive: false,
        },
      });

      if (existingJadwal) {
        res.status(400).json({
          error:
            "Pegawai sudah memiliki jadwal dengan shift tersebut pada hari itu. Gunakan 'Ganti Shift' untuk mengubahnya.",
          code: "SHIFT_ALREADY_EXISTS",
        });
        return;
      }
    }

    // Check if override already exists for this pegawai, date, and originalShiftId
    const existingOverride = await prisma.jadwalOverride.findFirst({
      where: {
        pegawaiId: Number(pegawaiId),
        date: parsedDate,
        originalShiftId: parsedOriginalShiftId,
      },
    });

    if (existingOverride) {
      if (existingOverride.isArchive) {
        // Restore archived override
        const restored = await prisma.jadwalOverride.update({
          where: { id: existingOverride.id },
          data: {
            shiftId: parsedShiftId,
            reason,
            isActive,
            isArchive: false,
          },
          include: { pegawai: true, originalShift: true, shift: true },
        });
        res.status(201).json(restored);
        return;
      }
      res.status(409).json({
        message:
          "Override already exists for this pegawai, date, and original shift.",
      });
      return;
    }

    const jadwalOverride = await prisma.jadwalOverride.create({
      data: {
        pegawaiId: Number(pegawaiId),
        date: parsedDate,
        originalShiftId: parsedOriginalShiftId,
        shiftId: parsedShiftId,
        reason,
        isActive,
      },
      include: { pegawai: true, originalShift: true, shift: true },
    });

    res.status(201).json(jadwalOverride);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error", err });
  }
}

/**
 * Get all JadwalOverrides with filtering and pagination
 */
async function getJadwalOverrides(req: Request, res: Response): Promise<void> {
  try {
    const {
      pegawaiId,
      pegawaiName,
      shiftId,
      dateFrom,
      dateTo,
      date,
      isActive,
      page,
      limit,
      sortBy = "date",
      sortOrder = "desc",
      isArchive = false,
    } = req.query;

    const where: any = {};

    // Default behavior: when isArchive is omitted, use false
    where.isArchive = isArchive === undefined ? false : isArchive === "true";

    if (pegawaiId !== undefined && String(pegawaiId).trim() !== "") {
      const pid = Number(pegawaiId);
      if (!Number.isNaN(pid)) where.pegawaiId = pid;
    }

    if (shiftId !== undefined && String(shiftId).trim() !== "") {
      const sid = Number(shiftId);
      if (!Number.isNaN(sid)) where.shiftId = sid;
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = dayjs(String(dateFrom)).startOf("day").toDate();
      }
      if (dateTo) {
        where.date.lte = dayjs(String(dateTo)).endOf("day").toDate();
      }
    }

    // Specific date filter
    if (date) {
      where.date = {
        gte: dayjs(String(date)).startOf("day").toDate(),
        lte: dayjs(String(date)).endOf("day").toDate(),
      };
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    // Relation filter for pegawaiName
    if (pegawaiName !== undefined && String(pegawaiName).trim() !== "") {
      where.pegawai = {
        name: { contains: String(pegawaiName).trim() },
      };
    }

    const include = { pegawai: true, originalShift: true, shift: true };

    let orderBy: any = {};
    if (sortBy && sortOrder) {
      orderBy[sortBy as string] = sortOrder === "asc" ? "asc" : "desc";
      if (sortBy === "pegawaiName") {
        orderBy = {
          pegawai: {
            name: sortOrder === "asc" ? "asc" : "desc",
          },
        };
      }
      if (sortBy === "shiftName") {
        orderBy = {
          shift: {
            name: sortOrder === "asc" ? "asc" : "desc",
          },
        };
      }
    }

    const withPagination = !isNaN(Number(page)) || !isNaN(Number(limit));

    const [total, data] = await Promise.all([
      prisma.jadwalOverride.count({ where }),
      prisma.jadwalOverride.findMany({
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
    console.error(err);
    res.status(500).json({ error: "Internal server error", err });
  }
}

/**
 * Get JadwalOverride by ID
 */
async function getJadwalOverrideById(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const jadwalOverride = await prisma.jadwalOverride.findUnique({
      where: { id },
      include: { pegawai: true, originalShift: true, shift: true },
    });

    if (!jadwalOverride) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(jadwalOverride);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Update JadwalOverride
 */
async function updateJadwalOverride(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { pegawaiId, date, originalShiftId, shiftId, reason, isActive } =
      req.body;

    const data: any = {};

    if (pegawaiId !== undefined) data.pegawaiId = Number(pegawaiId);
    if (date !== undefined) data.date = dayjs(date).startOf("day").toDate();
    if (originalShiftId !== undefined)
      data.originalShiftId = originalShiftId ? Number(originalShiftId) : null;
    if (shiftId !== undefined) data.shiftId = shiftId ? Number(shiftId) : null;
    if (reason !== undefined) data.reason = reason;
    if (isActive !== undefined) data.isActive = isActive;

    const jadwalOverride = await prisma.jadwalOverride.update({
      where: { id },
      data,
      include: { pegawai: true, originalShift: true, shift: true },
    });

    res.json(jadwalOverride);
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Soft delete JadwalOverride (archive)
 */
async function deleteJadwalOverride(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);

    await prisma.jadwalOverride.update({
      where: { id },
      data: { isArchive: true },
    });

    res.status(204).end();
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Get effective schedule for a specific date
 * Returns the override if exists, otherwise returns regular jadwal
 */
async function getEffectiveJadwal(req: Request, res: Response): Promise<void> {
  try {
    const { pegawaiId, date } = req.query;

    if (!pegawaiId || !date) {
      res
        .status(400)
        .json({ error: "pegawaiId and date query params are required" });
      return;
    }

    const targetDate = dayjs(String(date)).startOf("day");
    const dayOfWeek = targetDate.day(); // 0 = Sunday, 6 = Saturday

    // First check if there's an override for this date
    const override = await prisma.jadwalOverride.findFirst({
      where: {
        pegawaiId: Number(pegawaiId),
        date: {
          gte: targetDate.toDate(),
          lte: targetDate.endOf("day").toDate(),
        },
        isActive: true,
        isArchive: false,
      },
      include: { shift: true },
    });

    if (override) {
      res.json({
        type: "override",
        data: override,
        isOff: override.shiftId === null, // null shiftId means day off
      });
      return;
    }

    // No override, get regular jadwal
    const regularJadwal = await prisma.jadwal.findFirst({
      where: {
        pegawaiId: Number(pegawaiId),
        day: dayOfWeek,
        isActive: true,
        isArchive: false,
      },
      include: { shift: true },
    });

    if (regularJadwal) {
      res.json({
        type: "regular",
        data: regularJadwal,
        isOff: false,
      });
      return;
    }

    // No jadwal found
    res.json({
      type: "none",
      data: null,
      isOff: true, // No schedule means day off
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export {
  createJadwalOverride,
  getJadwalOverrides,
  getJadwalOverrideById,
  updateJadwalOverride,
  deleteJadwalOverride,
  getEffectiveJadwal,
};
