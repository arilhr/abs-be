import { Request, Response } from "express";
import prisma from "../prisma";
import { calculateJamShiftDate } from "../utils/calculate-jam-shift-date";

export const createRequestLembur = async (req: Request, res: Response) => {
  try {
    const { pegawaiId, shiftId, date, reason } = req.body;

    if (!req.user?.userId) {
      res.status(400).json({ error: "User ID not found from the token" });
      return;
    }

    if (
      pegawaiId === undefined ||
      shiftId === undefined ||
      date === undefined
    ) {
      res.status(400).json({ error: "pegawaiId, shiftId, date required" });
      return;
    }

    // check if request already made
    const existing = await prisma.requestLembur.findFirst({
      where: {
        pegawaiId,
        shiftId,
        date,
      },
    });

    if (existing) {
      res.status(409).json({ message: "Request already exists." });
      return;
    }

    const result = await prisma.requestLembur.create({
      data: {
        userId: req.user.userId,
        pegawaiId,
        shiftId,
        date,
        reason,
      },
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
};

export const getRequestLembur = async (req: Request, res: Response) => {
  try {
    const { pegawaiId, page: pageQ, limit: limitQ } = req.query;

    const where: any = {};

    if (pegawaiId !== undefined && String(pegawaiId).trim() !== "") {
      const pid = Number(pegawaiId);
      if (!Number.isNaN(pid)) where.pegawaiId = pid;
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
        prisma.requestLembur.count({ where }),
        prisma.requestLembur.findMany({
          where,
          include: {
            pegawai: {
              select: { name: true },
            },
            shift: true,
            user: {
              select: {
                username: true,
              },
            },
          },
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

    const data = await prisma.requestLembur.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(data);
  } catch (err) {
    res.status(500).json(err);
  }
};

export const acceptRequestLembur = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isAccepted } = req.body;

    const existing = await prisma.requestLembur.findUnique({
      where: { id: Number(id), isAccepted: null },
      include: {
        shift: true,
      },
    });

    if (!existing) {
      res
        .status(404)
        .json({ message: "Request not found or already accepted." });
      return;
    }

    // check if there is logAbsensi with pegawaiId, and jadwal jamMasuk and date
    const shiftDate = calculateJamShiftDate(
      existing.shift.jamMasuk,
      existing.shift.jamKeluar,
      existing.date
    );
    const logAbsensi = await prisma.logAbsensi.findFirst({
      where: {
        pegawaiId: existing.pegawaiId,
        jamMasukDate: shiftDate.jamMasukDate,
      },
    });

    if (!logAbsensi) {
      res
        .status(404)
        .json({ message: "Log Absensi not found for the given request." });
      return;
    }

    // create transaction to accept request and update isLembur in logAbsensi
    const result = await prisma.$transaction(async (prisma) => {
      const acceptedRequest = await prisma.requestLembur.update({
        where: { id: Number(id) },
        data: { isAccepted: isAccepted, logAbsensiId: logAbsensi.id },
      });

      await prisma.logAbsensi.updateMany({
        where: { id: logAbsensi.id },
        data: { isLembur: isAccepted },
      });

      return acceptedRequest;
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
};
