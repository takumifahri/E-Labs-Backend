-- AlterTable
ALTER TABLE "public"."Peminjaman_Handset" ADD COLUMN     "Dokumen" TEXT;

-- AlterTable
ALTER TABLE "public"."Peminjaman_Item" ADD COLUMN     "jumlah" INTEGER NOT NULL DEFAULT 0;
