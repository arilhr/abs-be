import { Router } from "express";
import { login, loginWithQR } from "../controllers/auth.controller";

const router = Router();
router.post("/login", login);
router.post("/login-qr", loginWithQR);

export default router;
