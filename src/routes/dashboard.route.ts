import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
  getCurrentJadwalActive,
  getSummary,
} from "../controllers/dashboard.controller";

const router = Router();
router.use(authenticate);

router.get("/summary", getSummary);
router.get("/jadwal-active", getCurrentJadwalActive);

export default router;
