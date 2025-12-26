import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { getLogScan } from "../controllers/log.controller";

const router = Router();
router.use(authenticate);

router.get("/scan", getLogScan);

export default router;
