import { Router } from "express";
import { getServerTime } from "../controllers/config.controller";

const router = Router();

router.get("/time", getServerTime);

export default router;
