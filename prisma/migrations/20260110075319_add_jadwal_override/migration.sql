-- CreateTable
CREATE TABLE `JadwalOverride` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pegawaiId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `shiftId` INTEGER NULL,
    `originalDay` INTEGER NULL,
    `reason` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isArchive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `JadwalOverride_pegawaiId_idx`(`pegawaiId`),
    INDEX `JadwalOverride_date_idx`(`date`),
    INDEX `JadwalOverride_shiftId_idx`(`shiftId`),
    UNIQUE INDEX `JadwalOverride_pegawaiId_date_key`(`pegawaiId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `JadwalOverride` ADD CONSTRAINT `JadwalOverride_pegawaiId_fkey` FOREIGN KEY (`pegawaiId`) REFERENCES `Pegawai`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JadwalOverride` ADD CONSTRAINT `JadwalOverride_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
