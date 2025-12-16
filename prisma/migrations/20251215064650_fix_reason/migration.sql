/*
  Warnings:

  - You are about to drop the column `reasong` on the `RequestLembur` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RequestLembur" DROP COLUMN "reasong",
ADD COLUMN     "reason" TEXT;
