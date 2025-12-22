import { Request, Response } from "express";
import prisma from "../prisma";
import { PrismaClientKnownRequestError } from "../../prisma/generated/internal/prismaNamespace";
import dayjs from "dayjs";
import { calculateMinutesDifferent } from "../utils/calculate-time";

async function createPegawai(req: Request, res: Response): Promise<void> {
  try {
    const { name, positionId, status = "active", salary, pegawaiId } = req.body;
    if (!name || positionId === undefined || pegawaiId === undefined) {
      res
        .status(400)
        .json({ error: "Name, Position, and Pegawai ID required" });
      return;
    }
    const pegawai = await prisma.pegawai.create({
      data: { name, pegawaiId, positionId: Number(positionId), status, salary },
    });
    res.status(201).json(pegawai);
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
}

async function getPegawai(req: Request, res: Response): Promise<void> {
  try {
    const {
      id,
      name,
      positionId,
      status,
      page,
      limit,
      isArchive = false,
    } = req.query;

    const where: any = {};

    // default behavior: when isArchive is omitted, use false
    where.isArchive = isArchive === undefined ? false : isArchive === "true";

    if (typeof name === "string" && name.trim() !== "") {
      where.name = { contains: name.trim(), mode: "insensitive" };
    }
    if (id !== undefined) {
      const idNumber = Number(id);
      if (!Number.isNaN(idNumber)) where.id = idNumber;
    }
    if (positionId !== undefined) {
      const pid = Number(positionId);
      if (!Number.isNaN(pid)) where.positionId = pid;
    }
    if (typeof status === "string" && status.trim() !== "") {
      where.status = status.trim();
    }

    const withPagination = !isNaN(Number(page)) || !isNaN(Number(limit));

    const [total, data] = await Promise.all([
      prisma.pegawai.count({ where }),
      prisma.pegawai.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...(withPagination && {
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        include: {
          position: {
            select: { id: true, name: true, department: true },
          },
        },
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
  } catch {
    res.status(500).json({ error: "internal error" });
  }
}

async function getPegawaiById(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const pegawai = await prisma.pegawai.findUnique({
      where: { id },
      include: {
        position: true,
      },
    });
    if (!pegawai) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(pegawai);
  } catch {
    res.status(500).json({ error: "internal error" });
  }
}

export const getJadwalPegawai = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await prisma.jadwal.findMany({
      where: {
        pegawaiId: +id,
        isActive: true,
      },
      include: {
        shift: true,
      },
      orderBy: [{ day: "asc" }],
    });

    // Group by day
    const groupedByDay = result.reduce((acc, jadwal) => {
      const day = jadwal.day;

      if (!acc[day]) {
        acc[day] = [];
      }

      acc[day].push(jadwal);

      return acc;
    }, {} as Record<number, typeof result>);

    res.status(200).json({
      data: groupedByDay,
    });
  } catch (err) {
    res.status(500).json(err);
  }
};

async function updatePegawai(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { name, positionId, status, salary, pegawaiId } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (positionId !== undefined) data.positionId = Number(positionId);
    if (status !== undefined) data.status = status;
    if (salary !== undefined) data.salary = Number(salary);
    if (pegawaiId !== undefined) data.pegawaiId = pegawaiId;

    const pegawai = await prisma.pegawai.update({ where: { id }, data });
    res.json(pegawai);
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(500).json({ error: "internal error", err });
  }
}

async function deletePegawai(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    // archive data
    await prisma.pegawai.update({
      where: { id },
      data: { status: "archive" },
    });
    res.status(204).send();
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  }
}

export const getGajiPegawai = async (req: Request, res: Response) => {
  try {
    const { pegawaiId, start, end } = req.query;

    if (!pegawaiId || !start || !end) {
      res.status(400).json({
        message: "Pegawai ID, start, and end required.",
      });
      return;
    }

    const pegawaiData = await prisma.pegawai.findFirst({
      where: {
        id: +pegawaiId,
      },
      include: {
        position: true,
      },
    });

    if (!pegawaiData) {
      res.status(400).json({
        message: "Pegawai not found.",
      });
      return;
    }

    const startDate = dayjs(start.toString()).startOf("day").toDate();
    const endDate = dayjs(end.toString()).endOf("day").toDate();

    const logAbsensiDatas = await prisma.logAbsensi.findMany({
      where: {
        pegawaiId: pegawaiData.id,
        jamMasukDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalLate = logAbsensiDatas.filter((log) => {
      if (!log.checkIn) return false;
      return log.checkIn > log.jamMasukDate;
    });

    const totalLateMinutes = totalLate.reduce((acc, curr) => {
      if (!curr.checkIn) return acc;
      return acc + calculateMinutesDifferent(curr.jamMasukDate, curr.checkIn);
    }, 0);

    const totalAbsent = logAbsensiDatas.filter((log) => {
      return log.checkIn === null;
    }).length;

    const totalMinutes = logAbsensiDatas.reduce((acc, curr) => {
      if (!curr.checkIn) return acc;
      const minutesDiff = calculateMinutesDifferent(
        curr.checkIn,
        curr.jamKeluarDate
      );
      return acc + minutesDiff;
    }, 0);

    const totalGaji = Math.round((pegawaiData.salary * totalMinutes) / 24);

    const totalLembur = logAbsensiDatas.filter(
      (log) => log.isLembur && !!log.checkOut
    );

    const totalLemburMinutes = totalLembur.reduce((acc, curr) => {
      if (!curr.checkOut) return acc;
      return acc + calculateMinutesDifferent(curr.jamKeluarDate, curr.checkOut);
    }, 0);

    const totalGajiLembur = Math.round(
      (pegawaiData.salary / 24) * totalLemburMinutes
    );

    res.status(200).json({
      totalLate: totalLate.length,
      totalLateTime: Math.round(totalLateMinutes),
      totalLembur: totalLembur.length,
      totalLemburTime: Math.round(totalLemburMinutes),
      totalGajiLembur,
      totalAbsent,
      totalWorkTime: Math.round(totalMinutes),
      totalGaji,
      totalHari: logAbsensiDatas.length,
      totalMasuk: logAbsensiDatas.length - totalAbsent,
      pegawai: pegawaiData,
    });
  } catch (err) {
    res.status(500).json(err);
  }
};

export {
  createPegawai,
  getPegawai,
  getPegawaiById,
  updatePegawai,
  deletePegawai,
};
