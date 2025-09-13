-- AlterTable
ALTER TABLE "public"."Peminjaman_Item" ADD COLUMN     "peminjaman_handset_id" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Item" ADD CONSTRAINT "Peminjaman_Item_peminjaman_handset_id_fkey" FOREIGN KEY ("peminjaman_handset_id") REFERENCES "public"."Peminjaman_Handset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
