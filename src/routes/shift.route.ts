import { Router } from "express";
import * as shiftController from "../controllers/shift.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.post("/", shiftController.createShift);
router.get("/", shiftController.getShifts);
router.get("/:id", shiftController.getShiftById);
router.put("/:id", shiftController.updateShift);
router.delete("/:id", shiftController.deleteShift);

export default router;
