/*
  Warnings:

  - You are about to drop the column `peminjaman_handset_id` on the `Peminjaman_Ruangan` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Peminjaman_Ruangan" DROP CONSTRAINT "Peminjaman_Ruangan_peminjaman_handset_id_fkey";

-- AlterTable
ALTER TABLE "public"."Peminjaman_Ruangan" DROP COLUMN "peminjaman_handset_id",
ADD COLUMN     "dokumen" TEXT;
