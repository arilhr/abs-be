/*
  Warnings:

  - Made the column `pegawaiId` on table `Pegawai` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Pegawai" ALTER COLUMN "pegawaiId" SET NOT NULL;
