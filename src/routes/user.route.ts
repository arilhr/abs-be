import { Router } from "express";
import * as ctrl from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);
router.post("/", ctrl.createUser);
router.get("/profile", ctrl.getUserData);
router.get("/", ctrl.getUsers);
router.get("/:id", ctrl.getUserById);
router.put("/change-password", ctrl.changePasswordUserByID);
router.put("/:id", ctrl.updateUser);
router.delete("/:id", ctrl.deleteUser);

export default router;
