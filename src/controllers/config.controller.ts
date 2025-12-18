import dayjs from "dayjs";
import { Request, Response } from "express";

export const getServerTime = async (req: Request, res: Response) => {
  try {
    const date = dayjs().toDate();
    res.status(200).json(date);
  } catch (err) {
    res.status(500).json(err);
  }
};
