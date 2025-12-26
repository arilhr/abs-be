-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('IN', 'OUT', 'UNKNOWN');

-- CreateTable
CREATE TABLE "LogScan" (
    "id" SERIAL NOT NULL,
    "pegawaiId" INTEGER NOT NULL,
    "scanTime" TIMESTAMP(3) NOT NULL,
    "scanType" "ScanType" NOT NULL,
    "logAbsensiId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogScan_pegawaiId_idx" ON "LogScan"("pegawaiId");

-- CreateIndex
CREATE INDEX "LogScan_logAbsensiId_idx" ON "LogScan"("logAbsensiId");

-- AddForeignKey
ALTER TABLE "LogScan" ADD CONSTRAINT "LogScan_logAbsensiId_fkey" FOREIGN KEY ("logAbsensiId") REFERENCES "LogAbsensi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogScan" ADD CONSTRAINT "LogScan_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
