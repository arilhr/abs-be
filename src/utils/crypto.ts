import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.SCAN_CODE || "default-secret-key-32chars!!";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptQRData(data: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptQRData(encryptedData: string): string {
  const key = getKey();
  const parts = encryptedData.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted data format");
  }
  const iv = Buffer.from(parts[0], "hex");
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
