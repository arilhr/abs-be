import { Request, Response } from "express";
import prisma from "../prisma";
import { PrismaClientKnownRequestError } from "../../prisma/generated/internal/prismaNamespace";

// Create a request izin (PengajuanIzin)
export const createDepartment = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: "Nama departemen diperlukan." });
      return;
    }

    const newReq = await prisma.department.create({
      data: {
        name,
      },
    });

    res.status(201).json(newReq);
  } catch (err) {
    res.status(500).json({ error: "Internal Error", err });
  }
};

export const getDepartments = async (req: Request, res: Response) => {
  try {
    const {
      name,
      isArchive,
      page,
      limit,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const where: any = {
      isArchive: isArchive === undefined ? false : isArchive === "true",
    };

    let orderBy: any = {};
    if (sortBy && sortOrder) {
      orderBy[sortBy as string] = sortOrder === "asc" ? "asc" : "desc";
    }

    if (typeof name === "string" && name.trim() !== "") {
      where.name = {
        contains: name.trim(),
        mode: "insensitive",
      };
    }

    const withPagination = !isNaN(Number(page)) || !isNaN(Number(limit));

    const [total, data] = await Promise.all([
      prisma.department.count({ where }),
      prisma.department.findMany({
        where,
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
    res.status(500).json({ error: "Internal Error", err });
  }
};

export const getDepartmentByID = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const department = await prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      res.status(404).json({ error: "Departement tidak ditemukan." });
      return;
    }

    res.json(department);
  } catch (err) {
    res.status(500).json({ error: "Internal Error", err });
  }
};

export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name } = req.body;
    const data: any = {};

    if (name !== undefined) data.name = name;

    const department = await prisma.department.update({
      where: { id },
      data,
    });

    res.json(department);
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "Departemen tidak ditemukan." });
      return;
    }
    res.status(500).json({ error: "Internal Error", err });
  }
};

export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    // archive data
    await prisma.department.update({
      where: { id },
      data: { isArchive: true },
    });

    res.status(204).send();
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "Departemen tidak ditemukan." });
      return;
    }
    res.status(500).json({ error: "Internal Error", err });
  }
};
