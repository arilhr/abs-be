/*
  Warnings:

  - Added the required column `jamKeluarDate` to the `LogAbsensi` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jamMasukDate` to the `LogAbsensi` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LogAbsensi" ADD COLUMN     "jamKeluarDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "jamMasukDate" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "jamMasuk" SET DATA TYPE TEXT,
ALTER COLUMN "jamKeluar" SET DATA TYPE TEXT;
