/*
  Warnings:

  - You are about to drop the `Prodi` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_prodiId_fkey";

-- DropTable
DROP TABLE "public"."Prodi";

-- CreateTable
CREATE TABLE "public"."MasterProdi" (
    "id" SERIAL NOT NULL,
    "nama_prodi" TEXT NOT NULL,
    "kode_prodi" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MasterProdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Master_Matkul" (
    "id" SERIAL NOT NULL,
    "prod_id" INTEGER NOT NULL,
    "matkul" TEXT NOT NULL,

    CONSTRAINT "Master_Matkul_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "public"."MasterProdi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Master_Matkul" ADD CONSTRAINT "Master_Matkul_prod_id_fkey" FOREIGN KEY ("prod_id") REFERENCES "public"."MasterProdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
