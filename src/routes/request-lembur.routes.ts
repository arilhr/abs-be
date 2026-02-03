import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
  acceptRequestLembur,
  createRequestLembur,
  deleteRequestLembur,
  getRequestLembur,
  updateRequestLembur,
} from "../controllers/request-lembur.controller";

const router = Router();
router.use(authenticate);

router.get("/", getRequestLembur);
router.post("/", createRequestLembur);
router.put("/:id", updateRequestLembur);
router.delete("/:id", deleteRequestLembur);
router.post("/:id", acceptRequestLembur);

export default router;
