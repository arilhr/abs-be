-- AlterTable
ALTER TABLE "RequestLembur" ADD COLUMN     "supervisorId" INTEGER;

-- CreateIndex
CREATE INDEX "RequestLembur_supervisorId_idx" ON "RequestLembur"("supervisorId");

-- AddForeignKey
ALTER TABLE "RequestLembur" ADD CONSTRAINT "RequestLembur_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;
