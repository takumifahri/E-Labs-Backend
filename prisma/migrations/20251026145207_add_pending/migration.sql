/*
  Warnings:

  - The `semester` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
ALTER TYPE "public"."StatusPeminjamanRuangan" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "public"."Peminjaman_Ruangan" ALTER COLUMN "tanggal" DROP NOT NULL,
ALTER COLUMN "jam_mulai" DROP NOT NULL,
ALTER COLUMN "jam_selesai" DROP NOT NULL,
ALTER COLUMN "kegiatan" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "semester",
ADD COLUMN     "semester" INTEGER;
