import { Router } from "express";
import * as jadwalController from "../controllers/jadwal.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.post("/", jadwalController.createJadwal);
router.get("/", jadwalController.getJadwals);
router.get("/:id", jadwalController.getJadwalById);
router.put("/:id", jadwalController.updateJadwal);
router.delete("/:id", jadwalController.deleteJadwal);

export default router;
