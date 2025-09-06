/*
  Warnings:

  - You are about to drop the column `role_id` on the `User` table. All the data in the column will be lost.
  - Added the required column `isActive` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_role_id_fkey";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "role_id",
ADD COLUMN     "isActive" BOOLEAN NOT NULL,
ADD COLUMN     "roleId" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
