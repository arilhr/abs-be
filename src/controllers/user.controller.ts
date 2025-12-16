import { Request, Response } from "express";
import prisma from "../prisma";
import { PrismaClientKnownRequestError } from "../../prisma/generated/internal/prismaNamespace";

// Create a user
async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const { username, password, isActive = true, isArchive = false } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "username and password required" });
      return;
    }

    const user = await prisma.user.create({
      data: { username, password, isActive, isArchive },
    });
    res.status(201).json(user);
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2002") {
      res.status(409).json({ error: "username already exists" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  }
}

// Get all users
async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const { username, lastLogin, page: pageQ, limit: limitQ } = req.query;

    const where: any = {};

    if (typeof username === "string" && username.trim() !== "") {
      where.username = { contains: username.trim(), mode: "insensitive" };
    }

    if (typeof lastLogin === "string" && lastLogin.trim() !== "") {
      const d = new Date(lastLogin);
      if (!Number.isNaN(d.getTime())) {
        where.lastLogin = { gte: d };
      }
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
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            username: true,
            lastLogin: true,
          },
        }),
      ]);

      res.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
      return;
    }

    const data = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        lastLogin: true,
      },
    });

    res.json(data);
  } catch {
    res.status(500).json({ error: "internal error" });
  }
}

// Get single user
async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ error: "internal error" });
  }
}

// Update user
async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { username, password, isActive, isArchive } = req.body;
    const data: any = {};
    if (username !== undefined) data.username = username;
    if (password !== undefined) data.password = password;
    if (isActive !== undefined) data.isActive = isActive;
    if (isArchive !== undefined) data.isArchive = isArchive;

    const user = await prisma.user.update({
      where: { id },
      data,
    });
    res.json(user);
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (error.code === "P2002") {
      res.status(409).json({ error: "username already exists" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  }
}

// Delete user
async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    await prisma.user.delete({ where: { id } });
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

export { createUser, getUsers, getUserById, updateUser, deleteUser };
