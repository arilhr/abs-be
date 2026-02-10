import { Request, Response } from "express";
import prisma from "../prisma";
import { calculateJamShiftDate } from "../utils/calculate-jam-shift-date";

export const createRequestLembur = async (req: Request, res: Response) => {
  try {
    const {
      supervisorId: supervisorIdQ,
      pegawaiId,
      shiftId,
      date,
      reason,
    } = req.body;

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

    let supervisorId = supervisorIdQ ? Number(supervisorIdQ) : req.user.userId;

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
        supervisorId,
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

export const updateRequestLembur = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { supervisorId, pegawaiId, shiftId, date, reason, isAccepted } =
      req.body;

    const existing = await prisma.requestLembur.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ message: "Request not found." });
      return;
    }

    // Only allow editing basic fields if not yet accepted/rejected
    // But allow status changes even if already processed
    if (existing.isAccepted !== null && isAccepted === undefined) {
      res.status(400).json({ message: "Cannot edit processed request." });
      return;
    }

    const data: any = {};
    if (supervisorId !== undefined) data.supervisorId = supervisorId;
    if (pegawaiId !== undefined) data.pegawaiId = pegawaiId;
    if (shiftId !== undefined) data.shiftId = shiftId;
    if (date !== undefined) data.date = date;
    if (reason !== undefined) data.reason = reason;
    if (isAccepted !== undefined) data.isAccepted = isAccepted;

    const updated = await prisma.requestLembur.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
};

export const deleteRequestLembur = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.requestLembur.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ message: "Request not found." });
      return;
    }

    await prisma.requestLembur.delete({
      where: { id },
    });

    res.json({ message: "Request deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
};

export const getRequestLembur = async (req: Request, res: Response) => {
  try {
    const {
      pegawaiId,
      supervisorId,
      page,
      limit,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const where: any = {};

    if (pegawaiId !== undefined && String(pegawaiId).trim() !== "") {
      const pid = Number(pegawaiId);
      if (!Number.isNaN(pid)) where.pegawaiId = pid;
    }

    if (supervisorId !== undefined && String(supervisorId).trim() !== "") {
      const sid = Number(supervisorId);
      if (!Number.isNaN(sid)) where.supervisorId = sid;
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
      if (sortBy === "supervisorName") {
        orderBy = {
          supervisor: {
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
      prisma.requestLembur.count({ where }),
      prisma.requestLembur.findMany({
        where,
        include: {
          pegawai: {
            select: { id: true, name: true },
          },
          supervisor: {
            select: { id: true, name: true },
          },
          shift: true,
          user: {
            select: {
              username: true,
            },
          },
        },
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
      existing.date,
    );

    // create transaction to accept request and update isLembur in logAbsensi
    const result = await prisma.$transaction(async (prisma) => {
      const logAbsensi = await prisma.logAbsensi.findFirst({
        where: {
          pegawaiId: existing.pegawaiId,
          jamMasukDate: shiftDate.jamMasukDate,
        },
      });

      if (!isAccepted) {
        const rejectedRequest = await prisma.requestLembur.update({
          where: { id: Number(id) },
          data: { isAccepted: isAccepted },
        });

        return { status: 200, data: rejectedRequest };
      }

      if (isAccepted) {
        if (!logAbsensi) {
          return {
            status: 400,
            message:
              "Pengajuan lembur tidak bisa diterima karena log absensi tidak ditemukan.",
          };
        }

        const acceptedRequest = await prisma.requestLembur.update({
          where: { id: Number(id) },
          data: { isAccepted: isAccepted, logAbsensiId: logAbsensi.id },
        });

        await prisma.logAbsensi.updateMany({
          where: { id: logAbsensi.id },
          data: { isLembur: isAccepted },
        });

        return { status: 200, data: acceptedRequest };
      }

      return { status: 400, message: "Invalid request." };
    });

    res.status(result.status).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
};
