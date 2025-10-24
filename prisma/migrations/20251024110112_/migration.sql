/*
  Warnings:

  - The `kondisi` column on the `Barang` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Barang` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."StatusBarang" AS ENUM ('TERSEDIA', 'DIPINJAM', 'RUSAK', 'PERBAIKAN', 'TIDAK_TERSEDIA');

-- CreateEnum
CREATE TYPE "public"."KondisiBarang" AS ENUM ('BAIK', 'RUSAK_BERAT', 'RUSAK_RINGAN');

-- AlterTable
ALTER TABLE "public"."Barang" DROP COLUMN "kondisi",
ADD COLUMN     "kondisi" "public"."KondisiBarang" NOT NULL DEFAULT 'BAIK',
DROP COLUMN "status",
ADD COLUMN     "status" "public"."StatusBarang" NOT NULL DEFAULT 'TERSEDIA';
