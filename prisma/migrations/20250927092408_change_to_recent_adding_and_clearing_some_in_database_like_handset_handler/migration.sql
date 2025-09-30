/*
  Warnings:

  - The values [Diajukan,Disetujui,Ditolakm,Dibatalkan,Selesai,Dipinjam] on the enum `StatusPeminjamanHandset` will be removed. If these variants are still used in the database, this will fail.
  - The values [Diajukan,Dipinjam,Dikembalikan,Terlambat] on the enum `StatusPeminjamanItem` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `prod_id` on the `Master_Matkul` table. All the data in the column will be lost.
  - You are about to drop the column `Dokumen` on the `Peminjaman_Handset` table. All the data in the column will be lost.
  - You are about to drop the column `peminjaman_handset_id` on the `Peminjaman_Handset` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nama_kategori]` on the table `Kategori_Barang` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[kode_prodi]` on the table `MasterProdi` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nama_role]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `prodi_id` to the `Master_Matkul` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Master_Matkul` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `status` on the `Peminjaman_Ruangan` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."StatusPeminjamanRuangan" AS ENUM ('DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN', 'SELESAI', 'BERLANGSUNG');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."StatusPeminjamanHandset_new" AS ENUM ('DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN', 'SELESAI', 'DIPINJAM');
ALTER TABLE "public"."Peminjaman_Handset" ALTER COLUMN "status" TYPE "public"."StatusPeminjamanHandset_new" USING ("status"::text::"public"."StatusPeminjamanHandset_new");
ALTER TYPE "public"."StatusPeminjamanHandset" RENAME TO "StatusPeminjamanHandset_old";
ALTER TYPE "public"."StatusPeminjamanHandset_new" RENAME TO "StatusPeminjamanHandset";
DROP TYPE "public"."StatusPeminjamanHandset_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."StatusPeminjamanItem_new" AS ENUM ('DIAJUKAN', 'DIPINJAM', 'DIKEMBALIKAN', 'TERLAMBAT');
ALTER TABLE "public"."Peminjaman_Item" ALTER COLUMN "status" TYPE "public"."StatusPeminjamanItem_new" USING ("status"::text::"public"."StatusPeminjamanItem_new");
ALTER TYPE "public"."StatusPeminjamanItem" RENAME TO "StatusPeminjamanItem_old";
ALTER TYPE "public"."StatusPeminjamanItem_new" RENAME TO "StatusPeminjamanItem";
DROP TYPE "public"."StatusPeminjamanItem_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Master_Matkul" DROP CONSTRAINT "Master_Matkul_prod_id_fkey";

-- AlterTable
ALTER TABLE "public"."Master_Matkul" DROP COLUMN "prod_id",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "prodi_id" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Peminjaman_Handset" DROP COLUMN "Dokumen",
DROP COLUMN "peminjaman_handset_id",
ADD COLUMN     "accepted_by_id" INTEGER,
ADD COLUMN     "dokumen" TEXT;

-- AlterTable
ALTER TABLE "public"."Peminjaman_Item" ADD COLUMN     "accepted_by_id" INTEGER;

-- AlterTable
ALTER TABLE "public"."Peminjaman_Ruangan" ADD COLUMN     "accepted_by_id" INTEGER,
DROP COLUMN "status",
ADD COLUMN     "status" "public"."StatusPeminjamanRuangan" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Kategori_Barang_nama_kategori_key" ON "public"."Kategori_Barang"("nama_kategori");

-- CreateIndex
CREATE UNIQUE INDEX "MasterProdi_kode_prodi_key" ON "public"."MasterProdi"("kode_prodi");

-- CreateIndex
CREATE UNIQUE INDEX "Role_nama_role_key" ON "public"."Role"("nama_role");

-- AddForeignKey
ALTER TABLE "public"."Master_Matkul" ADD CONSTRAINT "Master_Matkul_prodi_id_fkey" FOREIGN KEY ("prodi_id") REFERENCES "public"."MasterProdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Item" ADD CONSTRAINT "Peminjaman_Item_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Handset" ADD CONSTRAINT "Peminjaman_Handset_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Ruangan" ADD CONSTRAINT "Peminjaman_Ruangan_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
