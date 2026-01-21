import { Request, Response } from "express";
import prisma from "../prisma";
import dayjs from "dayjs";

export const getLogScan = async (req: Request, res: Response) => {
  try {
    const {
      pegawaiId,
      pegawaiName,
      scanTimeStart,
      scanTimeEnd,
      scanType,
      page,
      limit,
    } = req.query;

    const where: any = {};

    if (pegawaiId) {
      where.pegawaiId = Number(pegawaiId);
    }

    if (pegawaiName) {
      where.pegawai = {
        name: {
          contains: String(pegawaiName),
        },
      };
    }

    if (scanTimeStart) {
      const startScanTimeDate = dayjs(String(scanTimeStart))
        .startOf("day")
        .toDate();
      where.scanTime = {
        ...where.scanTime,
        gte: startScanTimeDate,
      };
    }

    if (scanTimeEnd) {
      const endScanTimeDate = dayjs(String(scanTimeEnd)).endOf("day").toDate();
      where.scanTime = {
        ...where.scanTime,
        lte: endScanTimeDate,
      };
    }

    if (scanType) {
      where.scanType = String(scanType);
    }

    const withPagination = !isNaN(Number(page)) || !isNaN(Number(limit));

    const [total, data] = await Promise.all([
      prisma.logScan.count({ where }),
      prisma.logScan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...(withPagination && {
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        include: { pegawai: true },
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
};
