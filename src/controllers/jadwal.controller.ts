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

async function getJadwalMulti(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, pegawaiName } = req.query;

    const pegawaiWhere: any = { isArchive: false };
    if (pegawaiName && String(pegawaiName).trim() !== "") {
      pegawaiWhere.name = { contains: String(pegawaiName).trim() };
    }

    const withPagination = !isNaN(Number(page)) && !isNaN(Number(limit));

    const [total, pegawais] = await Promise.all([
      prisma.pegawai.count({ where: pegawaiWhere }),
      prisma.pegawai.findMany({
        where: pegawaiWhere,
        orderBy: { name: "asc" },
        ...(withPagination && {
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
      }),
    ]);

    const pegawaiIds = pegawais.map((p) => p.id);

    const jadwals = await prisma.jadwal.findMany({
      where: {
        pegawaiId: { in: pegawaiIds },
        isArchive: false,
      },
      include: { shift: true },
    });

    const data = pegawais.map((pegawai) => {
      const jadwalMap: Record<
        number,
        { shiftId: number; shiftName: string; jamMasuk: string }[]
      > = {
        0: [],
        1: [],
        2: [],
        3: [],
        4: [],
        5: [],
        6: [],
      };

      jadwals
        .filter((j) => j.pegawaiId === pegawai.id)
        .forEach((j) => {
          jadwalMap[j.day].push({
            shiftId: j.shiftId,
            shiftName: j.shift?.name || "",
            jamMasuk: j.shift?.jamMasuk || "",
          });
        });

      for (const day of Object.keys(jadwalMap)) {
        jadwalMap[Number(day)].sort((a, b) =>
          a.jamMasuk.localeCompare(b.jamMasuk),
        );
      }

      return {
        id: pegawai.id,
        pegawaiId: pegawai.pegawaiId,
        pegawaiName: pegawai.name,
        jadwal: jadwalMap,
      };
    });

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
    console.log(err);
    res.status(500).json({ error: "internal error", err });
  }
}

async function updateJadwalMulti(req: Request, res: Response): Promise<void> {
  try {
    const pegawaiId = Number(req.params.pegawaiId);
    const { jadwal } = req.body;

    if (!jadwal || typeof jadwal !== "object") {
      res.status(400).json({ error: "jadwal object required" });
      return;
    }

    const pegawai = await prisma.pegawai.findUnique({
      where: { id: pegawaiId },
    });
    if (!pegawai) {
      res.status(404).json({ error: "pegawai not found" });
      return;
    }

    const existingJadwals = await prisma.jadwal.findMany({
      where: { pegawaiId },
    });

    const newShiftSet = new Set<string>();
    for (const dayStr of Object.keys(jadwal)) {
      const day = Number(dayStr);
      const shiftIds: number[] = jadwal[dayStr] || [];
      for (const shiftId of shiftIds) {
        newShiftSet.add(`${day}-${shiftId}`);
      }
    }

    const archiveIds: number[] = [];
    const restoreIds: number[] = [];
    const existingKeys = new Set<string>();

    for (const j of existingJadwals) {
      const key = `${j.day}-${j.shiftId}`;
      existingKeys.add(key);

      if (newShiftSet.has(key)) {
        if (j.isArchive) {
          restoreIds.push(j.id);
        }
      } else {
        if (!j.isArchive) {
          archiveIds.push(j.id);
        }
      }
    }

    if (archiveIds.length > 0) {
      await prisma.jadwal.updateMany({
        where: { id: { in: archiveIds } },
        data: { isArchive: true },
      });
    }

    if (restoreIds.length > 0) {
      await prisma.jadwal.updateMany({
        where: { id: { in: restoreIds } },
        data: { isArchive: false },
      });
    }

    const createData: { pegawaiId: number; shiftId: number; day: number }[] =
      [];
    for (const dayStr of Object.keys(jadwal)) {
      const day = Number(dayStr);
      const shiftIds: number[] = jadwal[dayStr] || [];
      for (const shiftId of shiftIds) {
        const key = `${day}-${shiftId}`;
        if (!existingKeys.has(key)) {
          createData.push({ pegawaiId, shiftId, day });
        }
      }
    }

    if (createData.length > 0) {
      await prisma.jadwal.createMany({ data: createData });
    }

    res.json({ message: "Jadwal updated successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "internal error", err });
  }
}

export {
  createJadwal,
  getJadwals,
  getJadwalById,
  updateJadwal,
  deleteJadwal,
  getJadwalMulti,
  updateJadwalMulti,
};
