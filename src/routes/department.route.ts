import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
  createDepartment,
  deleteDepartment,
  getDepartmentByID,
  getDepartments,
  updateDepartment,
} from "../controllers/department.controller";

const router = Router();
router.use(authenticate);

router.post("/", createDepartment);
router.get("/", getDepartments);
router.get("/:id", getDepartmentByID);
router.put("/:id", updateDepartment);
router.delete("/:id", deleteDepartment);

export default router;
