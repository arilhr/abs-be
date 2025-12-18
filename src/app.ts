import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";
import pegawaiRoutes from "./routes/pegawai.route";
import shiftRoutes from "./routes/shift.route";
import jadwalRoutes from "./routes/jadwal.route";
import positionRoutes from "./routes/position.route";
import absensiRoutes from "./routes/absensi.route";
import dashboardRoutes from "./routes/dashboard.route";
import requestLemburRoutes from "./routes/request-lembur.routes";
import configRoutes from "./routes/config.controller";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import duration from "dayjs/plugin/duration";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

dayjs.tz.setDefault("Asia/Jakarta");

const app = express();
const apiRouter = express.Router();

apiRouter.use(cors());
apiRouter.use(express.json());

apiRouter.use("/auth", authRoutes);
apiRouter.use("/user", userRoutes);
apiRouter.use("/pegawai", pegawaiRoutes);
apiRouter.use("/position", positionRoutes);
apiRouter.use("/shift", shiftRoutes);
apiRouter.use("/jadwal", jadwalRoutes);
apiRouter.use("/absensi", absensiRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/request-lembur", requestLemburRoutes);
apiRouter.use("/config", configRoutes);

app.use("/api", apiRouter);

app.get("/", (_, res) => res.json({ ok: true }));

export default app;
