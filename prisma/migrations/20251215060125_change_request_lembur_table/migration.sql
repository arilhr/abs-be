/*
  Warnings:

  - You are about to drop the column `jadwalId` on the `RequestLembur` table. All the data in the column will be lost.
  - Added the required column `shiftId` to the `RequestLembur` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "RequestLembur" DROP CONSTRAINT "RequestLembur_jadwalId_fkey";

-- DropIndex
DROP INDEX "RequestLembur_jadwalId_idx";

-- AlterTable
ALTER TABLE "RequestLembur" DROP COLUMN "jadwalId",
ADD COLUMN     "shiftId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "RequestLembur_shiftId_idx" ON "RequestLembur"("shiftId");

-- AddForeignKey
ALTER TABLE "RequestLembur" ADD CONSTRAINT "RequestLembur_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
