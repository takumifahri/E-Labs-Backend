-- CreateTable
CREATE TABLE "public"."master_matkul" (
    "id" SERIAL NOT NULL,
    "prod_id" INTEGER NOT NULL,
    "matkul" TEXT NOT NULL,

    CONSTRAINT "master_matkul_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."master_matkul" ADD CONSTRAINT "master_matkul_prod_id_fkey" FOREIGN KEY ("prod_id") REFERENCES "public"."Prodi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
