import { Router } from "express";
import {
  generateLogAbsensi,
  getAllAbsensi,
  scanAbsensi,
  updateAbsensi,
} from "../controllers/absensi.controller";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middlewares/auth.middleware";

export const scanAbsensiRateLimiter = rateLimit({
  windowMs: 3 * 1000,
  max: 1,
  handler: (_, res) => {
    res.status(429).json({
      message: "Terlalu cepat! Mohon tunggu 3 detik sebelum scan lagi.",
      status: "RATE_LIMITED",
      retryAfter: 3,
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();
router.get("/generate", generateLogAbsensi);
router.post("/scan", scanAbsensiRateLimiter, scanAbsensi);

router.use(authenticate);
router.get("/", getAllAbsensi);
router.put("/:id", updateAbsensi);

export default router;
