-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "prodiId" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "public"."Prodi" (
    "id" SERIAL NOT NULL,
    "nama_prodi" TEXT NOT NULL,
    "kode_prodi" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Prodi_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "public"."Prodi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
