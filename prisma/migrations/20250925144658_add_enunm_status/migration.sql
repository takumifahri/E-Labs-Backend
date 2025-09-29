/*
  Warnings:

  - Changed the type of `status` on the `Peminjaman_Handset` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `status` on the `Peminjaman_Item` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."StatusPeminjamanItem" AS ENUM ('Diajukan', 'Dipinjam', 'Dikembalikan', 'Terlambat');

-- CreateEnum
CREATE TYPE "public"."StatusPeminjamanHandset" AS ENUM ('Diajukan', 'Disetujui', 'Ditolakm', 'Dibatalkan', 'Selesai', 'Dipinjam');

-- AlterTable
ALTER TABLE "public"."Peminjaman_Handset" DROP COLUMN "status",
ADD COLUMN     "status" "public"."StatusPeminjamanHandset" NOT NULL;

-- AlterTable
ALTER TABLE "public"."Peminjaman_Item" DROP COLUMN "status",
ADD COLUMN     "status" "public"."StatusPeminjamanItem" NOT NULL;
