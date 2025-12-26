import { Request, Response } from "express";
import prisma from "../prisma";

export const getLogScan = async (req: Request, res: Response) => {
  try {
    const { pegawaiName, scanTimeStart, scanTimeEnd, scanType, page, limit } =
      req.query;

    const where: any = {};

    if (pegawaiName) {
      where.pegawai = {
        name: {
          contains: String(pegawaiName),
          mode: "insensitive",
        },
      };
    }

    if (scanTimeStart || scanTimeEnd) {
      where.scanTime = {};
      if (scanTimeStart) {
        where.scanTime.gte = new Date(String(scanTimeStart));
      }
      if (scanTimeEnd) {
        where.scanTime.lte = new Date(String(scanTimeEnd));
      }
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
