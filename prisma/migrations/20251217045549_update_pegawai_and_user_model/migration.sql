/*
  Warnings:

  - A unique constraint covering the columns `[pegawaiId]` on the table `Pegawai` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Pegawai" ADD COLUMN     "pegawaiId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pegawaiId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Pegawai_pegawaiId_key" ON "Pegawai"("pegawaiId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;
