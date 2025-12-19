/*
  Warnings:

  - Added the required column `pegawaiId` to the `PengajuanIzin` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PengajuanIzin" ADD COLUMN     "pegawaiId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "PengajuanIzin" ADD CONSTRAINT "PengajuanIzin_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
