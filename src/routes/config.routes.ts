import { Router } from "express";
import {
  getSalaryConfig,
  getServerTime,
  updateSalaryConfig,
} from "../controllers/config.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { checkRoles } from "../middlewares/role-check.middleware";

const router = Router();

router.get("/time", getServerTime);

router.use(authenticate);
router.use(checkRoles(["SUPERADMIN", "ADMIN"]));
router.get("/salary", getSalaryConfig);
router.put("/salary", updateSalaryConfig);

export default router;
