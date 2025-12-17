import { Request, Response } from "express";
import prisma from "../prisma";
import { PrismaClientKnownRequestError } from "../../prisma/generated/internal/prismaNamespace";
import { hashPassword } from "../utils/hash";

// Create a user
export const createUser = async (req: Request, res: Response) => {
  try {
    const {
      username,
      password,
      isActive = true,
      isArchive = false,
      pegawaiId,
    } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "username and password required" });
      return;
    }

    const passwordHashed = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        password: passwordHashed,
        isActive,
        isArchive,
        pegawaiId,
      },
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
};

// Get all users
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { username, lastLogin, page, limit } = req.query;

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

    const withPagination = !isNaN(Number(page)) || !isNaN(Number(limit));

    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...(withPagination && {
          skip: Number(page) - 1,
          take: Number(limit),
        }),
        select: {
          id: true,
          username: true,
          lastLogin: true,
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

// Get single user
export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        lastLogin: true,
        pegawai: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ error: "internal error" });
  }
};

// Update user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { username, isActive, isArchive, pegawaiId } = req.body;
    const data: any = {};
    if (username !== undefined) data.username = username;
    if (isActive !== undefined) data.isActive = isActive;
    if (isArchive !== undefined) data.isArchive = isArchive;
    if (pegawaiId !== undefined) data.pegawaiId = pegawaiId;

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
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
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
};

export const getUserData = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ message: "Not Authorized" });
      return;
    }

    const userData = await prisma.user.findFirst({
      where: {
        id: req.user.userId,
      },
    });

    if (!userData) {
      res.status(400).json({ message: "User not found." });
      return;
    }

    res.status(200).json(userData);
  } catch (err) {
    res.status(500).json(err);
  }
};

export const changePasswordUserByID = async (req: Request, res: Response) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      res
        .status(400)
        .json({ message: "User ID and new password are required." });
      return;
    }

    const hashedPassword = await hashPassword(password as string);

    const updatedUser = await prisma.user.update({
      where: { id: Number(userId) },
      data: { password: hashedPassword },
    });

    res
      .status(200)
      .json({ message: "Password updated successfully.", user: updatedUser });
  } catch (err) {
    res.status(500).json(err);
  }
};
