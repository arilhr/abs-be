import { Router } from "express";
import {
  generateLogAbsensi,
  getAllAbsensi,
  scanAbsensi,
} from "../controllers/absensi.controller";
import rateLimit from "express-rate-limit";

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
router.get("/", getAllAbsensi);
router.get("/generate", generateLogAbsensi);
router.post("/scan", scanAbsensiRateLimiter, scanAbsensi);

export default router;
