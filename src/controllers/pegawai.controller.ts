import { Request, Response } from "express";
import prisma from "../prisma";
import { PrismaClientKnownRequestError } from "../../prisma/generated/internal/prismaNamespace";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { calculateMinutesDifferent } from "../utils/calculate-time";
import {
  LATE_DEDUCTION_SALARY_CONFIG_KEY,
  OVERTIME_SALARY_CONFIG_KEY,
} from "../constants/config-key";
import QRCode from "qrcode";
import archiver from "archiver";
import fs from "fs";
import path from "path";

async function createPegawai(req: Request, res: Response): Promise<void> {
  try {
    const { name, positionId, status = "active", salary, pegawaiId } = req.body;
    if (!name || positionId === undefined || pegawaiId === undefined) {
      res
        .status(400)
        .json({ error: "Name, Position, and Pegawai ID required" });
      return;
    }
    const pegawai = await prisma.pegawai.create({
      data: { name, pegawaiId, positionId: Number(positionId), status, salary },
    });
    res.status(201).json(pegawai);
  } catch (err) {
    res.status(500).json({ error: "internal error", err });
  }
}

async function getPegawai(req: Request, res: Response): Promise<void> {
  try {
    const {
      id,
      pegawaiId,
      name,
      positionId,
      status,
      page,
      limit,
      salaryMin,
      salaryMax,
      isArchive = false,
    } = req.query;

    const where: any = {};

    // default behavior: when isArchive is omitted, use false
    where.isArchive = isArchive === undefined ? false : isArchive === "true";

    if (typeof name === "string" && name.trim() !== "") {
      where.name = { contains: name.trim(), mode: "insensitive" };
    }

    if (typeof pegawaiId === "string" && pegawaiId.trim() !== "") {
      where.pegawaiId = { contains: pegawaiId.trim(), mode: "insensitive" };
    }

    if (salaryMin !== undefined && salaryMin !== null && salaryMin !== "") {
      where.salary = {
        gte: Number(salaryMin),
      };
    }

    if (salaryMax !== undefined && salaryMax !== null && salaryMax !== "") {
      where.salary = {
        ...where.salary,
        lte: Number(salaryMax),
      };
    }

    if (id !== undefined) {
      const idNumber = Number(id);
      if (!Number.isNaN(idNumber)) where.id = idNumber;
    }
    if (positionId !== undefined) {
      const pid = Number(positionId);
      if (!Number.isNaN(pid)) where.positionId = pid;
    }
    if (typeof status === "string" && status.trim() !== "") {
      where.status = status.trim();
    }

    const withPagination = !isNaN(Number(page)) || !isNaN(Number(limit));

    const [total, data] = await Promise.all([
      prisma.pegawai.count({ where }),
      prisma.pegawai.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...(withPagination && {
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        include: {
          position: {
            select: { id: true, name: true, department: true },
          },
        },
      }),
    ]);

    res.json({
      data,
      total,
      ...(withPagination && {
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      }),
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "internal error", err });
  }
}

async function getPegawaiById(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const pegawai = await prisma.pegawai.findUnique({
      where: { id },
      include: {
        position: true,
      },
    });
    if (!pegawai) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(pegawai);
  } catch {
    res.status(500).json({ error: "internal error" });
  }
}

export const getJadwalPegawai = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await prisma.jadwal.findMany({
      where: {
        pegawaiId: +id,
        isActive: true,
      },
      include: {
        shift: true,
      },
      orderBy: [{ day: "asc" }],
    });

    // Group by day
    const groupedByDay = result.reduce((acc, jadwal) => {
      const day = jadwal.day;

      if (!acc[day]) {
        acc[day] = [];
      }

      acc[day].push(jadwal);

      return acc;
    }, {} as Record<number, typeof result>);

    res.status(200).json({
      data: groupedByDay,
    });
  } catch (err) {
    res.status(500).json(err);
  }
};

async function updatePegawai(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { name, positionId, status, salary, pegawaiId } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (positionId !== undefined) data.positionId = Number(positionId);
    if (status !== undefined) data.status = status;
    if (salary !== undefined) data.salary = Number(salary);
    if (pegawaiId !== undefined) data.pegawaiId = pegawaiId;

    const pegawai = await prisma.pegawai.update({ where: { id }, data });
    res.json(pegawai);
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(500).json({ error: "internal error", err });
  }
}

async function deletePegawai(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    // archive data
    await prisma.pegawai.update({
      where: { id },
      data: { status: "archive" },
    });
    res.status(204).send();
  } catch (err) {
    const error = err as PrismaClientKnownRequestError;
    if (error.code === "P2025") {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  }
}

export const getGajiPegawai = async (req: Request, res: Response) => {
  try {
    const {
      pegawaiId,
      lateRate: lateRateQ,
      overtimeRate: overtimeRateQ,
      start,
      end,
    } = req.query;

    if (!pegawaiId || !start || !end) {
      res.status(400).json({
        message: "Pegawai ID, start, and end required.",
      });
      return;
    }

    const pegawaiData = await prisma.pegawai.findFirst({
      where: {
        id: +pegawaiId,
      },
      include: {
        position: true,
      },
    });

    // get salary config
    let lateRate: number = Number(lateRateQ) || 0;
    let overtimeRate: number = Number(overtimeRateQ) || 0;

    if (lateRateQ === undefined) {
      const lateDeductionConfig = await prisma.appConfig.findUnique({
        where: { key: LATE_DEDUCTION_SALARY_CONFIG_KEY },
      });

      lateRate = lateDeductionConfig ? Number(lateDeductionConfig.value) : 0;
    }

    if (overtimeRateQ === undefined) {
      const overtimeConfig = await prisma.appConfig.findUnique({
        where: { key: OVERTIME_SALARY_CONFIG_KEY },
      });

      overtimeRate = overtimeConfig ? Number(overtimeConfig.value) : 0;
    }

    if (!pegawaiData) {
      res.status(400).json({
        message: "Pegawai not found.",
      });
      return;
    }

    const startDate = dayjs(start.toString()).startOf("day").toDate();
    const endDate = dayjs(end.toString()).endOf("day").toDate();

    const logAbsensiDatas = await prisma.logAbsensi.findMany({
      where: {
        pegawaiId: pegawaiData.id,
        jamMasukDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalLate = logAbsensiDatas.filter((log) => {
      if (!log.checkIn) return false;
      return log.checkIn > log.jamMasukDate;
    });

    const totalLateMinutes = totalLate.reduce((acc, curr) => {
      if (!curr.checkIn) return acc;
      return acc + calculateMinutesDifferent(curr.jamMasukDate, curr.checkIn);
    }, 0);

    const totalLateDeduction = Math.round((lateRate * totalLateMinutes) / 60);

    const totalAbsent = logAbsensiDatas.filter((log) => {
      return log.checkIn === null;
    }).length;

    const totalMinutes = logAbsensiDatas.reduce((acc, curr) => {
      if (!curr.checkIn) return acc;
      const minutesDiff = calculateMinutesDifferent(
        curr.checkIn,
        curr.jamKeluarDate
      );
      return acc + minutesDiff;
    }, 0);

    const totalGaji = Math.round((pegawaiData.salary * totalMinutes) / 24);

    const totalLembur = logAbsensiDatas.filter(
      (log) => log.isLembur && !!log.checkOut
    );

    const totalLemburMinutes = totalLembur.reduce((acc, curr) => {
      if (!curr.checkOut) return acc;
      return acc + calculateMinutesDifferent(curr.jamKeluarDate, curr.checkOut);
    }, 0);

    const totalGajiLembur = Math.round(
      (overtimeRate * totalLemburMinutes) / 60
    );

    res.status(200).json({
      totalLate: totalLate.length,
      totalLateTime: Math.round(totalLateMinutes),
      totalLateDeduction,
      totalLembur: totalLembur.length,
      totalLemburTime: Math.round(totalLemburMinutes),
      totalGajiLembur,
      totalAbsent,
      totalWorkTime: Math.round(totalMinutes),
      totalGaji,
      totalHari: logAbsensiDatas.length,
      totalMasuk: logAbsensiDatas.length - totalAbsent,
      pegawai: pegawaiData,
    });
  } catch (err) {
    res.status(500).json(err);
  }
};

const normalizeRowKeys = (row: Record<string, any>) => {
  const normalized: Record<string, any> = {};

  for (const key in row) {
    const cleanKey = key
      .trim()
      .replace(/\s*\/\s*/g, "/")
      .replace(/\s+/g, " ")
      .toUpperCase();

    normalized[cleanKey] = row[key];
  }

  return normalized;
};

export const importPegawai = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // Read Excel file
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
      defval: null, // cell kosong tetap ada
    });

    if (rawData.length === 0) {
      res.status(400).json({ error: "Excel file is empty" });
      return;
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Process each row
    for (let i = 0; i < rawData.length; i++) {
      const rawRow = rawData[i];
      const row = normalizeRowKeys(rawRow);

      try {
        // Validate required fields
        if (
          !row["NO KARYAWAN"] ||
          !row["NAMA KARYAWAN"] ||
          !row["JABATAN"] ||
          !row["DEPARTEMEN/BAGIAN"]
        ) {
          results.failed++;
          results.errors.push({
            row: i + 2, // +2 karena header + index mulai 0
            data: rawRow,
            error:
              "Missing required fields (NO KARYAWAN, NAMA KARYAWAN, JABATAN, DEPARTEMEN/BAGIAN)",
          });
          continue;
        }

        const pegawaiData = {
          pegawaiId: String(row["NO KARYAWAN"]).trim(),
          name: String(row["NAMA KARYAWAN"]).trim(),
          departmentName: String(row["DEPARTEMEN/BAGIAN"]).trim(),
          positionName: String(row["JABATAN"]).trim(),
          status: "active",
          salary: row["GAJI"] ? Number(row["GAJI"]) : 0,
        };

        // Process each row in transaction
        await prisma.$transaction(async (tx) => {
          // Check if pegawai already exists
          const existingPegawai = await tx.pegawai.findUnique({
            where: { pegawaiId: pegawaiData.pegawaiId },
          });

          if (existingPegawai) {
            throw new Error(
              `Pegawai dengan ID ${pegawaiData.pegawaiId} sudah ada`
            );
          }

          // Find or create department
          let department = await tx.department.findFirst({
            where: {
              name: {
                equals: pegawaiData.departmentName,
                mode: "insensitive",
              },
            },
          });

          if (!department) {
            department = await tx.department.create({
              data: { name: pegawaiData.departmentName },
            });
          }

          // Find or create position
          let position = await tx.position.findFirst({
            where: {
              name: {
                equals: pegawaiData.positionName,
                mode: "insensitive",
              },
              departmentId: department.id,
            },
          });

          if (!position) {
            position = await tx.position.create({
              data: {
                name: pegawaiData.positionName,
                departmentId: department.id,
              },
            });
          }

          // Create pegawai
          await tx.pegawai.create({
            data: {
              pegawaiId: pegawaiData.pegawaiId,
              name: pegawaiData.name,
              positionId: position.id,
              status: pegawaiData.status,
              salary: pegawaiData.salary,
            },
          });
        });

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          data: rawRow,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      message: "Import completed",
      results,
    });
  } catch (err: any) {
    console.error("Error importing pegawai:", err);
    res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
};

export const generatePegawaiQRCodeUrl = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pegawaiId = Number(id);
    if (Number.isNaN(pegawaiId)) {
      res.status(400).json({ error: "Invalid pegawai ID" });
      return;
    }

    const pegawai = await prisma.pegawai.findUnique({
      where: { id: pegawaiId },
    });

    if (!pegawai) {
      res.status(404).json({ error: "Pegawai not found" });
      return;
    }

    const dirPath = path.join(process.cwd(), "tmp", "qrcodes");
    fs.mkdirSync(dirPath, { recursive: true });

    const filename = `qr-${pegawai.pegawaiId}-${pegawai.name}.png`;
    const filePath = path.join(dirPath, filename);

    const BASE_URL = process.env.BASE_URL || "http://localhost:3300";

    if (fs.existsSync(filePath)) {
      res.status(200).json({
        pegawai: {
          id: pegawai.id,
          pegawaiId: pegawai.pegawaiId,
          name: pegawai.name,
        },
        downloadUrl: `${BASE_URL}/api/download/qrcodes/${filename}`,
        cached: true,
      });
      return;
    }

    const qrData = {
      id: pegawai.id,
      pegawaiId: pegawai.pegawaiId,
      name: pegawai.name,
    };

    const buffer = await QRCode.toBuffer(JSON.stringify(qrData), {
      errorCorrectionLevel: "H",
      type: "png",
      width: 300,
      margin: 2,
    });

    fs.writeFileSync(filePath, buffer);

    res.status(200).json({
      pegawai: {
        id: pegawai.id,
        pegawaiId: pegawai.pegawaiId,
        name: pegawai.name,
      },
      downloadUrl: `${BASE_URL}/api/download/qrcodes/${filename}`,
      cached: false,
    });
  } catch (err) {
    console.error("Error generating QR code:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const generateBulkPegawaiQRCodeZip = async (
  req: Request,
  res: Response
) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || !ids.length) {
      res.status(400).json({ error: "ids must be a non-empty array" });
      return;
    }

    const pegawais = await prisma.pegawai.findMany({
      where: { id: { in: ids.map(Number) } },
    });

    if (!pegawais.length) {
      res.status(404).json({ error: "No pegawai found" });
      return;
    }

    const dirPath = path.join(process.cwd(), "tmp", "qrcodes");
    fs.mkdirSync(dirPath, { recursive: true });

    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const filename = `qrcodes-${timestamp}-${random}.zip`;
    const filePath = path.join(dirPath, filename);

    const output = fs.createWriteStream(filePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);

    for (const pegawai of pegawais) {
      const qrData = {
        id: pegawai.id,
        pegawaiId: pegawai.pegawaiId,
        name: pegawai.name,
      };

      const buffer = await QRCode.toBuffer(JSON.stringify(qrData), {
        errorCorrectionLevel: "H",
        type: "png",
        width: 300,
        margin: 2,
      });

      archive.append(buffer, {
        name: `qr-${pegawai.pegawaiId}-${pegawai.name}.png`,
      });
    }

    await archive.finalize();

    const BASE_URL = process.env.BASE_URL;

    output.on("close", () => {
      res.status(200).json({
        downloadUrl: `${BASE_URL}/api/download/qrcodes/${filename}`,
        expiresIn: 300,
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export {
  createPegawai,
  getPegawai,
  getPegawaiById,
  updatePegawai,
  deletePegawai,
};
