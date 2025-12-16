import { Router } from "express";
import * as pegawaiController from "../controllers/pegawai.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.post("/", pegawaiController.createPegawai);
router.get("/", pegawaiController.getPegawai);
router.get("/salary", pegawaiController.getGajiPegawai);
router.get("/:id", pegawaiController.getPegawaiById);
router.put("/:id", pegawaiController.updatePegawai);
router.delete("/:id", pegawaiController.deletePegawai);

router.get("/jadwal/:id", pegawaiController.getJadwalPegawai);

export default router;
