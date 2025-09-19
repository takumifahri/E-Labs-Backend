-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_prodiId_fkey";

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "prodiId" DROP NOT NULL,
ALTER COLUMN "prodiId" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "public"."Prodi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
