/*
  Warnings:

  - Added the required column `reasong` to the `RequestLembur` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RequestLembur" ADD COLUMN     "reasong" TEXT NOT NULL;
