import { Request, Response, NextFunction } from "express";
import { UserRole } from "../../prisma/generated/enums";
import prisma from "../prisma";

export const checkRoles = (allowed: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    // get user data
    const userData = await prisma.user.findFirst({
      where: {
        id: user.userId,
      },
    });

    if (!userData) {
      return res.status(401).json({ message: "Unauthenticated" });
    }
    if (!allowed.includes(userData.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};
