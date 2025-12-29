import { Router } from "express";
import * as ctrl from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { checkRoles } from "../middlewares/role-check.middleware";

const router = Router();
router.use(authenticate);
router.get("/profile", ctrl.getUserData);
router.get("/:id", ctrl.getUserById);
router.use(checkRoles(["SUPERADMIN", "ADMIN"]));
router.post("/", ctrl.createUser);
router.get("/", ctrl.getUsers);
router.put("/change-password", ctrl.changePasswordUserByID);
router.put("/change-my-password", ctrl.changePassword);
router.put("/:id", ctrl.updateUser);
router.delete("/:id", ctrl.deleteUser);

export default router;
