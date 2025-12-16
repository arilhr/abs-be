import { Request, Response } from "express";
import prisma from "../prisma";
import { PrismaClientKnownRequestError } from "../../prisma/generated/internal/prismaNamespace";

/**
 * Create a Position
 */
async function createPosition(req: Request, res: Response): Promise<void> {
  try {
    const { name, isArchive = false } = req.body;

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const position = await prisma.position.create({
      data: { name, isArchive },
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
async function getPositions(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.query;
    const isArchiveQuery = req.query.isArchive as string | undefined;
    const pageQuery = req.query.page as string | undefined;
    const limitQuery = req.query.limit as string | undefined;

    // default behavior: when isArchive is omitted, use false
    const isArchive =
      isArchiveQuery === undefined ? false : isArchiveQuery === "true";

    const where: any = {
      isArchive,
    };

    if (typeof name === "string" && name.trim() !== "") {
      where.name = { contains: name.trim(), mode: "insensitive" };
    }

    // If both page and limit are provided and valid numbers -> paginate
    const page = pageQuery ? Number(pageQuery) : undefined;
    const limit = limitQuery ? Number(limitQuery) : undefined;
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
        prisma.position.count({ where }),
        prisma.position.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      res.json({
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
      return;
    }

    // No pagination -> return all matching rows
    const data = await prisma.position.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(data);
  } catch {
    res.status(500).json({ error: "internal error" });
  }
}

/**
 * Get single position by id
 */
async function getPositionById(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const position = await prisma.position.findUnique({ where: { id } });

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
    const { name, isArchive } = req.body;
    const data: any = {};

    if (name !== undefined) data.name = name;
    if (isArchive !== undefined) data.isArchive = isArchive;

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

export {
  createPosition,
  getPositions,
  getPositionById,
  updatePosition,
  deletePosition,
};
