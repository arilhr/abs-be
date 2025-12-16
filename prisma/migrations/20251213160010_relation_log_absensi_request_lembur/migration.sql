-- AlterTable
ALTER TABLE "LogAbsensi" ADD COLUMN     "requestLemburId" INTEGER;

-- CreateIndex
CREATE INDEX "LogAbsensi_requestLemburId_idx" ON "LogAbsensi"("requestLemburId");

-- AddForeignKey
ALTER TABLE "LogAbsensi" ADD CONSTRAINT "LogAbsensi_requestLemburId_fkey" FOREIGN KEY ("requestLemburId") REFERENCES "RequestLembur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
