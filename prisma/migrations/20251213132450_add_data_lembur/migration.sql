-- AlterTable
ALTER TABLE "LogAbsensi" ADD COLUMN     "isLembur" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RequestLembur" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "pegawaiId" INTEGER NOT NULL,
    "jadwalId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestLembur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestLembur_userId_idx" ON "RequestLembur"("userId");

-- CreateIndex
CREATE INDEX "RequestLembur_pegawaiId_idx" ON "RequestLembur"("pegawaiId");

-- CreateIndex
CREATE INDEX "RequestLembur_jadwalId_idx" ON "RequestLembur"("jadwalId");
