import { Express } from "express-serve-static-core";
import { UserRole } from "../../../prisma/generated/enums";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
      };
    }
  }
}
