import { Request, Response } from "express";
import prisma from "../prisma";
import { PrismaClientKnownRequestError } from "../../prisma/generated/internal/prismaNamespace";

async function createJadwal(req: Request, res: Response): Promise<void> {
  try {
    const { pegawaiId, shiftId, day, isActive = true } = req.body;
    if (pegawaiId === undefined || shiftId === undefined || day === undefined) {
      res.status(400).json({ error: "pegawaiId, shiftId and day required" });
      return;
    }

    // check if there is jadwal with same day, shiftId, and pegawaiId
    const existingJadwal = await prisma.jadwal.findFirst({
      where: {
        pegawaiId,
        shiftId,
        day,
      },
    });

    if (existingJadwal) {
      if (existingJadwal.isArchive) {
        const updatedJadwal = await prisma.jadwal.update({
          where: {
            id: existingJadwal.id,
          },
          data: {
            isArchive: false,
          },
        });

        res.status(201).json(updatedJadwal);

        return;
      }

      res.status(409).json({ message: "Data is already existing." });

      return;
    }

    const jadwal = await prisma.jadwal.create({
      data: {
        pegawaiId: Number(pegawaiId),
        shiftId: Number(shiftId),
        day,
        isActive,
      },
    });
    res.status(201).json(jadwal);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "internal error", err });
  }
}

async function getJadwals(req: Request, res: Response): Promise<void> {
  try {
    const {
      pegawaiId,
      pegawaiName,
      shiftId,
      day,
      isActive,
      page,
      limit,
      sortBy = "createdAt",
      sortOrder = "desc",
      isArchive = false,
    } = req.query;

    const where: any = {};

    // default behavior: when isArchive is omitted, use false
    where.isArchive = isArchive === undefined ? false : isArchive === "true";

    if (pegawaiId !== undefined && String(pegawaiId).trim() !== "") {
      const pid = Number(pegawaiId);
      if (!Number.isNaN(pid)) where.pegawaiId = pid;
    }

    if (shiftId !== undefined && String(shiftId).trim() !== "") {
      const sid = Number(shiftId);
      if (!Number.isNaN(sid)) where.shiftId = sid;
    }

    if (day !== undefined) {
      where.day = +day;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    // relation filter for pegawaiName
    const include: any = { pegawai: true, shift: true };
    if (pegawaiName !== undefined && String(pegawaiName).trim() !== "") {
      where.pegawai = {
        name: { contains: String(pegawaiName).trim() },
      };
    }

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
      if (sortBy === "jamMasuk") {
        orderBy = {
          shift: {
            jamMasuk: sortOrder === "asc" ? "asc" : "desc",
          },
        };
      }
      if (sortBy === "jamKeluar") {
        orderBy = {
          shift: {
            jamKeluar: sortOrder === "asc" ? "asc" : "desc",
          },
        };
      }
    }

    const withPagination = !isNaN(Number(page)) || !isNaN(Number(limit));

    const [total, data] = await Promise.all([
      prisma.jadwal.count({ where }),
      prisma.jadwal.findMany({
        where,
        include,
        orderBy,
        ...(withPagination && {
          skip: Number(page) - 1,
          take: Number(limit),
        }),
      }),
    ]);

    res.json({
      data,
      total,
      ...(withPagination && {
        page,
        limit,
        totalPages: Math.ceil(total / Number(limit)),
      }),
    });
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
}

async function getJadwalById(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const jadwal = await prisma.jadwal.findUnique({
      where: { id },
      include: { pegawai: true, shift: true },
    });
    if (!jadwal) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(jadwal);
  } catch {
    res.status(500).json({ error: "internal error" });
  }
}

async function updateJadwal(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { pegawaiId, shiftId, day, isActive } = req.body;
    const data: any = {};
    if (pegawaiId !== undefined) data.pegawaiId = Number(pegawaiId);
    if (shiftId !== undefined) data.shiftId = Number(shiftId);
    if (day !== undefined) data.day = day;
    if (isActive !== undefined) data.isActive = isActive;

    const jadwal = await prisma.jadwal.update({
      where: { id },
      data,
    });
    res.json(jadwal);
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  }
}

async function deleteJadwal(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    // archive data
    await prisma.jadwal.update({
      where: {
        id: id,
      },
      data: {
        isArchive: true,
      },
    });
    res.status(204).end();
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  }
}

export { createJadwal, getJadwals, getJadwalById, updateJadwal, deleteJadwal };
