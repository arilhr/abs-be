import dayjs from "dayjs";
import { Request, Response } from "express";
import prisma from "../prisma";
import {
  LATE_DEDUCTION_SALARY_CONFIG_KEY,
  OVERTIME_SALARY_CONFIG_KEY,
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
