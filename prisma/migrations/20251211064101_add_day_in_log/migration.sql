/*
  Warnings:

  - Added the required column `day` to the `LogAbsensi` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LogAbsensi" ADD COLUMN     "day" TEXT NOT NULL;
