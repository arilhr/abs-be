import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
  createRequestIzin,
  deleteRequestIzin,
  getRequestIzinById,
  getRequestIzins,
  updateRequestIzin,
} from "../controllers/request-izin.controller";

const router = Router();
router.use(authenticate);

router.post("/", createRequestIzin);
router.get("/", getRequestIzins);
router.get("/:id", getRequestIzinById);
router.put("/:id", updateRequestIzin);
router.delete("/:id", deleteRequestIzin);

export default router;
