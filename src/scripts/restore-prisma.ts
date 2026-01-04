// test-prisma-restore.ts
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import prisma from "../prisma";

dotenv.config();

interface BackupData {
  timestamp: string;
  database: string;
  models: {
    [modelName: string]: any[];
  };
}

async function testPrismaRestore() {
  console.log("🔄 Testing Prisma Database Restore\n");

  // 1. Check environment variables
  console.log("🔐 Checking database configuration...");
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("❌ DATABASE_URL is not set in .env file!");
    return;
  }

  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":****@");
  console.log(`✅ DATABASE_URL: ${maskedUrl}`);
  console.log(`✅ DB_NAME: ${process.env.DB_NAME || "not set"}\n`);

  // 2. Find backup file
  const backupDir = path.join(process.cwd(), "test-backups");

  if (!fs.existsSync(backupDir)) {
    console.error("❌ Backup directory not found: test-backups/");
    console.log("\n💡 Run backup first: npm run test:backup");
    return;
  }

  const backupFiles = fs
    .readdirSync(backupDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse(); // Latest first

  if (backupFiles.length === 0) {
    console.error("❌ No backup files found in test-backups/");
    console.log("\n💡 Run backup first: npm run test:backup");
    return;
  }

  const latestBackup = backupFiles[0];
  const backupFilePath = path.join(backupDir, latestBackup);

  console.log("📁 Backup files available:");
  backupFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });
  console.log(`\n📥 Using latest backup: ${latestBackup}\n`);

  try {
    // 3. Test database connection
    console.log("🔌 Testing database connection...");
    try {
      await prisma.$connect();
      console.log("✅ Database connection successful!\n");
    } catch (connError: any) {
      console.error("❌ Database connection failed!");
      console.error("Error:", connError.message);
      return;
    }

    // 4. Read backup file
    console.log("📖 Reading backup file...");
    const backupContent = fs.readFileSync(backupFilePath, "utf-8");
    const backupData: BackupData = JSON.parse(backupContent);

    console.log("✅ Backup file loaded successfully\n");

    // 5. Display backup info
    console.log("📊 Backup Information:");
    console.log(`   Database: ${backupData.database}`);
    console.log(`   Timestamp: ${backupData.timestamp}`);
    console.log(`   Total Models: ${Object.keys(backupData.models).length}`);

    const totalRecords = Object.values(backupData.models).reduce(
      (sum, records) => sum + records.length,
      0
    );
    console.log(`   Total Records: ${totalRecords}\n`);

    console.log("📋 Records per model:");
    for (const [modelName, records] of Object.entries(backupData.models)) {
      console.log(`   ${modelName}: ${records.length} records`);
    }

    // 6. Check current data before restore
    console.log("\n📊 Current database state:");
    const currentCounts: any = {};

    for (const modelName of Object.keys(backupData.models)) {
      try {
        const count = await (prisma as any)[modelName].count();
        currentCounts[modelName] = count;
        console.log(`   ${modelName}: ${count} records`);
      } catch (error) {
        console.log(`   ${modelName}: N/A (table might not exist)`);
      }
    }

    // 7. Warning and confirmation
    console.log("\n⚠️  WARNING: This will INSERT data into your database!");
    console.log("💡 Tip: This test will skip duplicates automatically\n");

    // 8. Disable foreign key checks temporarily (MySQL)
    console.log("🔓 Disabling foreign key constraints temporarily...");
    try {
      await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0;");
      console.log("✅ Foreign key constraints disabled\n");
    } catch (error: any) {
      console.warn("⚠️  Could not disable constraints:", error.message);
      console.log(
        "   Continuing anyway... (might fail on foreign key violations)\n"
      );
    }

    // For test purposes, we'll restore without clearing
    console.log("🚀 Starting restore process...\n");

    // 9. Restore data
    let totalRestored = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const [modelName, records] of Object.entries(backupData.models)) {
      try {
        if (!records || records.length === 0) {
          console.log(`⏭️  Skipping ${modelName} (no data)`);
          continue;
        }

        console.log(`\n📋 Restoring ${modelName}...`);

        // Insert records in batches
        const batchSize = 100;
        let modelRestored = 0;

        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);

          try {
            const result = await (prisma as any)[modelName].createMany({
              data: batch,
              skipDuplicates: true,
            });

            modelRestored += result.count;
            totalRestored += result.count;

            const skipped = batch.length - result.count;
            totalSkipped += skipped;

            console.log(
              `   ✓ Batch ${Math.floor(i / batchSize) + 1}: ${
                result.count
              } inserted, ${skipped} skipped`
            );
          } catch (batchError: any) {
            console.error(
              `   ✗ Batch ${Math.floor(i / batchSize) + 1} failed: ${
                batchError.message
              }`
            );
            totalErrors++;
          }
        }

        console.log(`   ✅ ${modelName}: ${modelRestored} records restored`);
      } catch (error: any) {
        console.error(`   ❌ Error restoring ${modelName}: ${error.message}`);
        totalErrors++;
      }
    }

    // 10. Re-enable foreign key checks
    console.log("\n🔒 Re-enabling foreign key constraints...");
    try {
      await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");
      console.log("✅ Foreign key constraints re-enabled\n");
    } catch (error: any) {
      console.warn("⚠️  Could not re-enable constraints:", error.message);
    }

    // 11. Check database state after restore
    console.log("\n📊 Database state after restore:");

    for (const modelName of Object.keys(backupData.models)) {
      try {
        const count = await (prisma as any)[modelName].count();
        const before = currentCounts[modelName] || 0;
        const added = count - before;
        console.log(
          `   ${modelName}: ${count} records (${
            added > 0 ? "+" + added : added
          })`
        );
      } catch (error) {
        console.log(`   ${modelName}: Error checking count`);
      }
    }

    // 10. Summary
    console.log("\n✨ Restore Test Summary:");
    console.log(`   ✅ Records inserted: ${totalRestored}`);
    console.log(`   ⏭️  Records skipped (duplicates): ${totalSkipped}`);
    console.log(`   ❌ Errors: ${totalErrors}`);

    if (totalErrors === 0 && totalRestored > 0) {
      console.log("\n🎉 Test completed successfully!");
    } else if (totalErrors > 0) {
      console.log("\n⚠️  Test completed with errors");
      console.log("\n💡 Common issues:");
      console.log("   - Foreign key constraint violations");
      console.log("   - Missing parent records");
      console.log("   - Unique constraint violations");
      console.log("   - Database permissions");
    } else {
      console.log("\n💡 No new records inserted (all duplicates)");
    }

    console.log("\n💡 Next steps:");
    console.log("   1. Verify data in your database");
    console.log("   2. Check the restored records");
    console.log("   3. Test with a clean database for full restore");
  } catch (error: any) {
    console.error("\n❌ Restore test failed!");
    console.error("Error:", error.message);

    if (error.message.includes("JSON")) {
      console.log(
        "\n💡 Backup file might be corrupted. Try creating a new backup."
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPrismaRestore();
