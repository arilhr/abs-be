-- AlterTable
ALTER TABLE `pengajuanizin` ADD COLUMN `supervisorId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `PengajuanIzin_supervisorId_idx` ON `PengajuanIzin`(`supervisorId`);

-- AddForeignKey
ALTER TABLE `PengajuanIzin` ADD CONSTRAINT `PengajuanIzin_supervisorId_fkey` FOREIGN KEY (`supervisorId`) REFERENCES `Pegawai`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
