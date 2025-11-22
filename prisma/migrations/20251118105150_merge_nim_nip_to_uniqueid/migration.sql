/*
  Warnings:

  - You are about to drop the column `NIM` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `NIP` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "NIM",
DROP COLUMN "NIP";
