import { Router } from "express";
import * as positionController from "../controllers/position.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.post("/", positionController.createPosition);
router.get("/", positionController.getPositions);
router.get("/:id", positionController.getPositionById);
router.put("/:id", positionController.updatePosition);
router.delete("/:id", positionController.deletePosition);

export default router;
