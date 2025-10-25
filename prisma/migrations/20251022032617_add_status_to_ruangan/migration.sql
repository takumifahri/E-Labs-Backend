-- CreateEnum
CREATE TYPE "public"."StatusRuangan" AS ENUM ('DIPAKAI', 'KOSONG', 'DIPERBAIKI');

-- AlterTable
ALTER TABLE "public"."Ruangan" ADD COLUMN     "status" "public"."StatusRuangan" NOT NULL DEFAULT 'KOSONG';
