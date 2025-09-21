-- AlterTable
ALTER TABLE "public"."Barang" ADD COLUMN     "jumlah" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Peminjaman_Ruangan" ADD COLUMN     "matkul_id" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Ruangan" ADD CONSTRAINT "Peminjaman_Ruangan_matkul_id_fkey" FOREIGN KEY ("matkul_id") REFERENCES "public"."Master_Matkul"("id") ON DELETE SET NULL ON UPDATE CASCADE;
