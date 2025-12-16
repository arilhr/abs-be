import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
  acceptRequestLembur,
  createRequestLembur,
  getRequestLembur,
} from "../controllers/request-lembur.controller";

const router = Router();
router.use(authenticate);

router.get("/", getRequestLembur);
router.post("/", createRequestLembur);
router.post("/:id", acceptRequestLembur);

export default router;
