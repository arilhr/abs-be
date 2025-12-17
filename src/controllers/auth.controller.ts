import { Request, Response } from "express";
import prisma from "../prisma";
import { comparePassword } from "../utils/hash";
import jwt from "jsonwebtoken";

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "username & password required" });

  const user = await prisma.user.findUnique({
    where: { username },
    include: { pegawai: true },
  });

  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  if (!user.isActive || (user.pegawai && user.pegawai?.status !== "active")) {
    return res
      .status(401)
      .json({ message: "User atau data pegawai anda dinonaktifkan." });
  }

  const ok = await comparePassword(password, user.password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
    expiresIn: "8h",
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
    },
  });
};
