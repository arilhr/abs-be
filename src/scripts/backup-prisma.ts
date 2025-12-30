// test-prisma-backup.ts
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import prisma from "../prisma";

dotenv.config();

export const backupPrisma = async (): Promise<string | null> => {
  console.log("🔍 Testing Prisma Database Backup\n");

  // Check environment variables
  console.log("🔐 Checking database configuration...");
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("❌ DATABASE_URL is not set in .env file!");
    console.log("\n💡 Add this to your .env file:");
    console.log(
      '   DATABASE_URL="postgresql://user:password@localhost:5432/dbname"'
    );
    return null;
  }

  // Mask password in URL for security
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":****@");
  console.log(`✅ DATABASE_URL: ${maskedUrl}`);
  console.log(`✅ DB_NAME: ${process.env.DB_NAME || "not set"}\n`);

  const backupDir = path.join(process.cwd(), "backups");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `backup-${timestamp}.json`;
  const backupFilePath = path.join(backupDir, backupFileName);

  try {
    // 1. Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log("✅ Created backup directory");
    }

    // 2. Get all model names from Prisma
    console.log("📋 Detecting Prisma models...");
    const modelNames = Object.keys(prisma).filter(
      (key) =>
        !key.startsWith("_") &&
        !key.startsWith("$") &&
        typeof (prisma as any)[key] === "object"
    );

    if (modelNames.length === 0) {
      console.log("⚠️  No Prisma models found.");
      return null;
    }

    console.log(
      `✅ Found ${modelNames.length} models: ${modelNames.join(", ")}\n`
    );

    // 3. Create backup data structure
    const backupData: any = {
      timestamp: new Date().toISOString(),
      database: process.env.DB_NAME || "unknown",
      models: {},
    };

    // 4. Export data from each model
    console.log("📦 Backing up data...\n");
    let totalRecords = 0;

    for (const modelName of modelNames) {
      try {
        console.log(`📊 Processing ${modelName}...`);

        const data = await (prisma as any)[modelName].findMany();
        backupData.models[modelName] = data;
        totalRecords += data.length;

        console.log(`   ✅ Backed up ${data.length} records`);
      } catch (err: any) {
        console.warn(`   ⚠️  Failed ${modelName}: ${err.message}`);
        backupData.models[modelName] = [];
      }
    }

    // 5. Write backup file
    console.log("\n💾 Writing backup to file...");
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));

    const fileSize = (fs.statSync(backupFilePath).size / 1024).toFixed(2);
    console.log(`✅ Backup file created: ${backupFilePath}`);
    console.log(`📏 File size: ${fileSize} KB`);

    console.log("\n✨ Backup completed successfully!\n");

    // ✅ RETURN NAMA FILE
    return backupFileName;
  } catch (error: any) {
    console.error("\n❌ Backup failed!");
    console.error("Error:", error.message);
    return null;
  } finally {
    await prisma.$disconnect();
  }
};
