/*
  Warnings:

  - You are about to drop the column `position` on the `Pegawai` table. All the data in the column will be lost.
  - Added the required column `positionId` to the `Pegawai` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Pegawai" DROP COLUMN "position",
ADD COLUMN     "positionId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Pegawai_positionId_idx" ON "Pegawai"("positionId");

-- AddForeignKey
ALTER TABLE "Pegawai" ADD CONSTRAINT "Pegawai_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
