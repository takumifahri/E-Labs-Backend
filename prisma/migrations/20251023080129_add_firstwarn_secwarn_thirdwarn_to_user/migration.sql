-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "firstWarn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "secondWarn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "thirdWarn" BOOLEAN NOT NULL DEFAULT false;
