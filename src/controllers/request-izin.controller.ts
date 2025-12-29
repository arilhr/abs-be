import { Request, Response } from "express";
import prisma from "../prisma";
import { PrismaClientKnownRequestError } from "../../prisma/generated/internal/prismaNamespace";

// Create a request izin (PengajuanIzin)
export const createRequestIzin = async (req: Request, res: Response) => {
  try {
    const { pegawaiId, date, reason, isAccepted } = req.body;

    if (!date || !pegawaiId) {
      res.status(400).json({ error: "Pegawai ID and date is required" });
      return;
    }

    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      res.status(400).json({ error: "invalid date" });
      return;
    }

    const newReq = await prisma.pengajuanIzin.create({
      data: {
        pegawaiId: pegawaiId,
        date: d,
        reason,
        isAccepted,
      },
    });

    res.status(201).json(newReq);
  } catch (err) {
    res.status(500).json({ error: "internal error" });
  }
};

// Get all request izin with optional filters & pagination
export const getRequestIzins = async (req: Request, res: Response) => {
  try {
    const {
      pegawaiName,
      date,
      isAccepted,
      page,
      limit,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const where: any = {};

    if (typeof pegawaiName === "string" && pegawaiName.trim() !== "") {
      where.pegawai = {
        name: { contains: pegawaiName.trim(), mode: "insensitive" },
      };
    }

    if (typeof isAccepted === "string" && isAccepted.trim() !== "") {
      where.isAccepted =
        isAccepted === "t" ? true : isAccepted === "f" ? false : null;
    }

    if (typeof date === "string" && date.trim() !== "") {
      const d = new Date(date);
      if (!Number.isNaN(d.getTime())) {
        where.date = { equals: d };
      }
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
    }

    const withPagination = !isNaN(Number(page)) || !isNaN(Number(limit));

    const [total, data] = await Promise.all([
      prisma.pengajuanIzin.count({ where }),
      prisma.pengajuanIzin.findMany({
        where,
        orderBy,
        ...(withPagination && {
          skip: Number(page) - 1,
          take: Number(limit),
        }),
        select: {
          id: true,
          date: true,
          reason: true,
          isAccepted: true,
          createdAt: true,
          updatedAt: true,
          pegawai: true,
        },
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
  } catch {
    res.status(500).json({ error: "internal error" });
  }
};

// Get single request izin by id
export const getRequestIzinById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.pengajuanIzin.findUnique({
      where: { id },
      select: {
        id: true,
        date: true,
        reason: true,
        isAccepted: true,
        pegawai: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!item) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(item);
  } catch {
    res.status(500).json({ error: "internal error" });
  }
};

// Update request izin
export const updateRequestIzin = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { pegawaiId, date, reason, isAccepted } = req.body;
    const data: any = {};

    if (date !== undefined) {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) {
        res.status(400).json({ error: "invalid date" });
        return;
      }
      data.date = d;
    }
    if (reason !== undefined) data.reason = reason;
    if (isAccepted !== undefined) data.isAccepted = isAccepted;
    if (pegawaiId !== undefined) data.pegawaiId = pegawaiId;

    const updated = await prisma.pengajuanIzin.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  }
};

// Delete request izin
export const deleteRequestIzin = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await prisma.pengajuanIzin.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  }
};
