import path from "path";
import fs from "fs";
import { Request, Response } from "express";

export const downloadQrCode = (req: Request, res: Response) => {
  const { filename } = req.params;

  const filePath = path.join(process.cwd(), "tmp", "qrcodes", filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found or expired" });
    return;
  }

  const isZipFile = path.extname(filename).toLowerCase() === ".zip";

  res.download(filePath, filename, (err) => {
    if (!err && isZipFile && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  });
};
