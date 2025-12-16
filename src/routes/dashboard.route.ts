import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { getSummary } from "../controllers/dashboard.controller";

const router = Router();
router.use(authenticate);

router.get("/summary", getSummary);

export default router;
