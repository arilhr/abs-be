import { Router } from "express";
import { downloadQrCode } from "../controllers/download.controller";

const router = Router();

router.get("/qrcodes/:filename", downloadQrCode);

export default router;
