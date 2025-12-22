import { Request, Response } from "express";
import prisma from "../prisma";
import { PrismaClientKnownRequestError } from "../../prisma/generated/internal/prismaNamespace";

/**
 * Create a Position
 */
async function createPosition(req: Request, res: Response): Promise<void> {
  try {
    const { name, departmentId, isArchive = false } = req.body;

    if (!name || !departmentId) {
      res.status(400).json({ error: "Nama dan ID Departemen diperlukan." });
      return;
    }

    const position = await prisma.position.create({
      data: { name, departmentId, isArchive },
    });

    res.status(201).json(position);
  } catch (err) {
    // Generic error response — customize if you want more detail
    res.status(500).json({ error: "internal error" });
  }
}

/**
 Get Positions
 */
export const getPositions = async (req: Request, res: Response) => {
  try {
    const { name, departmentName, page, limit, isArchive } = req.query;

    const where: any = {};

    where.isArchive = isArchive === undefined ? false : isArchive === "true";

    if (typeof name === "string" && name.trim() !== "") {
      where.name = { contains: name.trim(), mode: "insensitive" };
    }

    if (typeof departmentName === "string" && departmentName.trim() !== "") {
      where.department = {
        name: {
          contains: departmentName.trim(),
          mode: "insensitive",
        },
      };
    }
    const withPagination = !isNaN(Number(page)) || !isNaN(Number(limit));

    let resultsData = [];
    const [total, data] = await Promise.all([
      prisma.position.count({ where }),
      prisma.position.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...(withPagination && {
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        include: {
          department: true,
          _count: {
            select: {
              pegawais: true,
            },
          },
        },
      }),
    ]);

    resultsData = data;

    // Transform data to include totalPegawai
    const dataWithTotal = data.map((position) => ({
      ...position,
      totalPegawai: position._count.pegawais,
      _count: undefined, // Remove _count from response
    }));

    resultsData = dataWithTotal;

    res.json({
      data: resultsData,
      total,
      ...(withPagination && {
        page,
        limit,
        totalPages: Math.ceil(total / Number(limit)),
      }),
    });
  } catch (err) {
    res.status(500).json(err);
  }
};

/**
 * Get single position by id
 */
async function getPositionById(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const position = await prisma.position.findUnique({
      where: { id },
      include: { department: true },
    });

    if (!position) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json(position);
  } catch {
    res.status(500).json({ error: "internal error" });
  }
}

/**
 * Update a position
 */
async function updatePosition(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { name, departmentId, isArchive } = req.body;
    const data: any = {};

    if (name !== undefined) data.name = name;
    if (isArchive !== undefined) data.isArchive = isArchive;
    if (departmentId !== undefined) data.departmentId = departmentId;

    const position = await prisma.position.update({
      where: { id },
      data,
    });

    res.json(position);
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  }
}

/**
 * Delete a position
 */
async function deletePosition(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    // archive data
    await prisma.position.update({
      where: { id },
      data: { isArchive: true },
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

export { createPosition, getPositionById, updatePosition, deletePosition };
