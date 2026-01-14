import { Router } from "express";
import * as jadwalOverrideController from "../controllers/jadwal-override.controller";

const router = Router();

// CRUD routes
router.post("/", jadwalOverrideController.createJadwalOverride);
router.get("/", jadwalOverrideController.getJadwalOverrides);
router.get("/effective", jadwalOverrideController.getEffectiveJadwal);
router.get("/:id", jadwalOverrideController.getJadwalOverrideById);
router.put("/:id", jadwalOverrideController.updateJadwalOverride);
router.delete("/:id", jadwalOverrideController.deleteJadwalOverride);

export default router;
