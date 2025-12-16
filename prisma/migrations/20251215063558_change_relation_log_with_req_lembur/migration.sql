/*
  Warnings:

  - You are about to drop the column `requestLemburId` on the `LogAbsensi` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[logAbsensiId]` on the table `RequestLembur` will be added. If there are existing duplicate values, this will fail.
  - Made the column `isAccepted` on table `RequestLembur` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "LogAbsensi" DROP CONSTRAINT "LogAbsensi_requestLemburId_fkey";

-- DropIndex
DROP INDEX "LogAbsensi_requestLemburId_idx";

-- AlterTable
ALTER TABLE "LogAbsensi" DROP COLUMN "requestLemburId";

-- AlterTable
ALTER TABLE "RequestLembur" ADD COLUMN     "logAbsensiId" INTEGER,
ALTER COLUMN "isAccepted" SET NOT NULL,
ALTER COLUMN "isAccepted" SET DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "RequestLembur_logAbsensiId_key" ON "RequestLembur"("logAbsensiId");

-- AddForeignKey
ALTER TABLE "RequestLembur" ADD CONSTRAINT "RequestLembur_logAbsensiId_fkey" FOREIGN KEY ("logAbsensiId") REFERENCES "LogAbsensi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
