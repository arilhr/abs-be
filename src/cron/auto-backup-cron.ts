import cron from "node-cron";
import { uploadToDrive } from "../scripts/upload-to-drive";

export const startAutoBackupCron = () => {
  cron.schedule("59 23 * * *", async () => {
    console.log(`[${new Date().toISOString()}] Starting automatic backup...`);
    try {
      // Dynamically import the backup function to avoid circular dependencies
      const { backupPrisma } = await import("../scripts/backup-prisma");
      const backupFileName = await backupPrisma();

      console.log(
        `[${new Date().toISOString()}] Automatic backup completed successfully. Backup file: ${backupFileName}`
      );

      await uploadToDrive(`backups/${backupFileName!}`, "application/json");

      console.log(
        `[${new Date().toISOString()}] Backup file uploaded to Google Drive successfully.`
      );
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Automatic backup failed:`,
        error
      );
    }
  });
};
