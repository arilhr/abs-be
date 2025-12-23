import { Request, Response } from "express";
import prisma from "../prisma";
import { PrismaClientKnownRequestError } from "../../prisma/generated/internal/prismaNamespace";

async function createShift(req: Request, res: Response): Promise<void> {
  try {
    const { name, jamMasuk, jamKeluar, isActive = true } = req.body;
    if (!name || jamMasuk === undefined || jamKeluar === undefined) {
      res.status(400).json({ error: "name, jamMasuk and jamKeluar required" });
      return;
    }
    const shift = await prisma.shift.create({
      data: { name, jamMasuk, jamKeluar, isActive },
    });
    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
}

async function getShifts(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      jamMasuk,
      jamKeluar,
      isActive,
      isArchive = false,
      page,
      limit,
    } = req.query;

    const where: any = {
      isArchive: isArchive === undefined ? false : isArchive === "true",
    };

    if (typeof name === "string" && name.trim() !== "") {
      where.name = { contains: name.trim(), mode: "insensitive" };
    }
    if (typeof jamMasuk === "string" && jamMasuk.trim() !== "") {
      where.jamMasuk = jamMasuk.trim();
    }
    if (typeof jamKeluar === "string" && jamKeluar.trim() !== "") {
      where.jamKeluar = jamKeluar.trim();
    }
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const withPagination = !isNaN(Number(page)) || !isNaN(Number(limit));

    const [total, data] = await Promise.all([
      prisma.shift.count({ where }),
      prisma.shift.findMany({
        where,
        orderBy: { createdAt: "desc" },
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

async function getShiftById(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(shift);
  } catch {
    res.status(500).json({ error: "internal error" });
  }
}

async function updateShift(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { name, jamMasuk, jamKeluar, isActive } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (jamMasuk !== undefined) data.jamMasuk = jamMasuk;
    if (jamKeluar !== undefined) data.jamKeluar = jamKeluar;
    if (isActive !== undefined) data.isActive = isActive;

    const shift = await prisma.shift.update({ where: { id }, data });
    res.json(shift);
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  }
}

async function deleteShift(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    // archive shift instead of deleting
    await prisma.shift.update({
      where: { id },
      data: { isArchive: true },
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

export { createShift, getShifts, getShiftById, updateShift, deleteShift };
