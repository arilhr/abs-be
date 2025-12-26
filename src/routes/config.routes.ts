import { Router } from "express";
import {
  getSalaryConfig,
  getScanSecretCode,
  getServerTime,
  updateSalaryConfig,
  updateScanSecretCode,
} from "../controllers/config.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { checkRoles } from "../middlewares/role-check.middleware";

const router = Router();

router.get("/time", getServerTime);

router.use(authenticate);
router.use(checkRoles(["SUPERADMIN", "ADMIN"]));
router.get("/salary", getSalaryConfig);
router.put("/salary", updateSalaryConfig);
router.get("/scan-code", getScanSecretCode);
router.put("/scan-code", updateScanSecretCode);

export default router;
