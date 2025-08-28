/*
  Warnings:

  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `photoProfile` on the `User` table. All the data in the column will be lost.
  - Added the required column `nama` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "name",
DROP COLUMN "phone",
DROP COLUMN "photoProfile",
ADD COLUMN     "nama" TEXT NOT NULL,
ADD COLUMN     "nim" TEXT,
ADD COLUMN     "semester" TEXT;
