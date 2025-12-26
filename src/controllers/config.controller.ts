import dayjs from "dayjs";
import { Request, Response } from "express";
import prisma from "../prisma";
import {
  LATE_DEDUCTION_SALARY_CONFIG_KEY,
  OVERTIME_SALARY_CONFIG_KEY,
  SCAN_SECRET_CODE_CONFIG_KEY,
} from "../constants/config-key";

export const getServerTime = async (req: Request, res: Response) => {
  try {
    const date = dayjs().toDate();
    res.status(200).json(date);
  } catch (err) {
    res.status(500).json(err);
  }
};

export const getSalaryConfig = async (req: Request, res: Response) => {
  try {
    const lateDeductionConfig = await prisma.appConfig.findUnique({
      where: { key: LATE_DEDUCTION_SALARY_CONFIG_KEY },
    });

    const overtimeConfig = await prisma.appConfig.findUnique({
      where: { key: OVERTIME_SALARY_CONFIG_KEY },
    });

    res.status(200).json({
      lateDeductionRate: lateDeductionConfig?.value ?? 0,
      overtimeRate: overtimeConfig?.value ?? 0,
    });
  } catch (err) {
    res.status(500).json(err);
  }
};

export const updateSalaryConfig = async (req: Request, res: Response) => {
  try {
    const { lateDeductionRate, overtimeRate } = req.body;

    if (lateDeductionRate !== undefined) {
      await prisma.appConfig.upsert({
        where: { key: LATE_DEDUCTION_SALARY_CONFIG_KEY },
        update: { value: Number(lateDeductionRate) },
        create: {
          key: LATE_DEDUCTION_SALARY_CONFIG_KEY,
          value: Number(lateDeductionRate),
        },
      });
    }

    if (overtimeRate !== undefined) {
      await prisma.appConfig.upsert({
        where: { key: OVERTIME_SALARY_CONFIG_KEY },
        update: { value: Number(overtimeRate) },
        create: {
          key: OVERTIME_SALARY_CONFIG_KEY,
          value: Number(overtimeRate),
        },
      });
    }

    res
      .status(200)
      .json({ message: "Salary configuration updated successfully." });
  } catch (err) {
    res.status(500).json(err);
  }
};

export const getScanSecretCode = async (req: Request, res: Response) => {
  try {
    const scanSecretCodeConfig = await prisma.appConfig.findUnique({
      where: { key: SCAN_SECRET_CODE_CONFIG_KEY },
    });

    res.status(200).json(scanSecretCodeConfig?.value ?? "");
  } catch (err) {
    res.status(500).json(err);
  }
};

export const updateScanSecretCode = async (req: Request, res: Response) => {
  try {
    const { scanSecretCode, randomize = false } = req.body;

    if (scanSecretCode !== undefined) {
      await prisma.appConfig.upsert({
        where: { key: SCAN_SECRET_CODE_CONFIG_KEY },
        update: { value: String(scanSecretCode) },
        create: {
          key: SCAN_SECRET_CODE_CONFIG_KEY,
          value: String(scanSecretCode),
        },
      });
    }

    if (randomize) {
      // generate code with 16 characters capital letters and numbers
      const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let randomCode = "";
      for (let i = 0; i < 16; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomCode += characters.charAt(randomIndex);
      }

      await prisma.appConfig.upsert({
        where: { key: SCAN_SECRET_CODE_CONFIG_KEY },
        update: { value: randomCode },
        create: {
          key: SCAN_SECRET_CODE_CONFIG_KEY,
          value: randomCode,
        },
      });
    }

    res.status(200).json({ message: "Scan secret code updated successfully." });
  } catch (err) {
    res.status(500).json(err);
  }
};
