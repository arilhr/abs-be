import { Router } from "express";
import * as pegawaiController from "../controllers/pegawai.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { excelUpload } from "../middlewares/multer.middleware";

const router = Router();
router.use(authenticate);

router.post("/", pegawaiController.createPegawai);
router.post(
  "/import",
  excelUpload.single("file"),
  pegawaiController.importPegawai,
);
router.get("/", pegawaiController.getPegawai);
router.get("/salary", pegawaiController.getGajiPegawai);
router.post("/qrcode/bulk", pegawaiController.generateBulkPegawaiQRCodeZip);
router.post("/qrcode/:id", pegawaiController.generatePegawaiQRCodeUrl);
router.get("/jadwal-list/:id", pegawaiController.getJadwalList);
router.get("/jadwal/:id", pegawaiController.getJadwalPegawai);
router.get("/:id", pegawaiController.getPegawaiById);
router.put("/:id", pegawaiController.updatePegawai);
router.delete("/:id", pegawaiController.deletePegawai);

export default router;
