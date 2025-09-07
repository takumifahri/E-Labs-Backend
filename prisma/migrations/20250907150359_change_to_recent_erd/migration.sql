/*
  Warnings:

  - A unique constraint covering the columns `[kode_peminjaman]` on the table `Peminjaman_Handset` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `kode_peminjaman` to the `Peminjaman_Handset` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Notifikasi" ADD COLUMN     "judul" TEXT;

-- AlterTable
ALTER TABLE "public"."Peminjaman_Handset" ADD COLUMN     "kode_peminjaman" TEXT NOT NULL,
ALTER COLUMN "peminjaman_handset_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Peminjaman_Ruangan" ALTER COLUMN "peminjaman_handset_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Peminjaman_Handset_kode_peminjaman_key" ON "public"."Peminjaman_Handset"("kode_peminjaman");

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Item" ADD CONSTRAINT "Peminjaman_Item_barang_id_fkey" FOREIGN KEY ("barang_id") REFERENCES "public"."Barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Handset" ADD CONSTRAINT "Peminjaman_Handset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Ruangan" ADD CONSTRAINT "Peminjaman_Ruangan_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Ruangan" ADD CONSTRAINT "Peminjaman_Ruangan_peminjaman_handset_id_fkey" FOREIGN KEY ("peminjaman_handset_id") REFERENCES "public"."Peminjaman_Handset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notifikasi" ADD CONSTRAINT "Notifikasi_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
