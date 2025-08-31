-- CreateTable
CREATE TABLE "public"."Ruangan" (
    "id" SERIAL NOT NULL,
    "nama_ruangan" TEXT NOT NULL,
    "nama_gedung" TEXT NOT NULL,
    "tipe_ruangan_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Ruangan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tipe_Ruangan" (
    "id" SERIAL NOT NULL,
    "nama_tipe" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tipe_Ruangan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Ruangan" ADD CONSTRAINT "Ruangan_tipe_ruangan_id_fkey" FOREIGN KEY ("tipe_ruangan_id") REFERENCES "public"."Tipe_Ruangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
