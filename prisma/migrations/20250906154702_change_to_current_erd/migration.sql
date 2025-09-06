/*
  Warnings:

  - You are about to drop the column `roleName` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `nama_gedung` on the `Ruangan` table. All the data in the column will be lost.
  - You are about to drop the column `tipe_ruangan_id` on the `Ruangan` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `nim` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `nip` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `roleId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Plan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tipe_Ruangan` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[kode_ruangan]` on the table `Ruangan` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `gedung` to the `Ruangan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kode_ruangan` to the `Ruangan` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Plan" DROP CONSTRAINT "Plan_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Plan" DROP CONSTRAINT "Plan_forWhoUid_fkey";

-- DropForeignKey
ALTER TABLE "public"."Ruangan" DROP CONSTRAINT "Ruangan_tipe_ruangan_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_roleId_fkey";

-- AlterTable
ALTER TABLE "public"."Role" DROP COLUMN "roleName",
ADD COLUMN     "deskripsi" TEXT NOT NULL DEFAULT 'Default Description',
ADD COLUMN     "nama_role" TEXT NOT NULL DEFAULT 'Default Role';

-- AlterTable
ALTER TABLE "public"."Ruangan" DROP COLUMN "nama_gedung",
DROP COLUMN "tipe_ruangan_id",
ADD COLUMN     "gedung" TEXT NOT NULL,
ADD COLUMN     "kode_ruangan" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "address",
DROP COLUMN "isActive",
DROP COLUMN "nim",
DROP COLUMN "nip",
DROP COLUMN "roleId",
ADD COLUMN     "NIM" TEXT,
ADD COLUMN     "NIP" TEXT,
ADD COLUMN     "profil" TEXT,
ADD COLUMN     "role_id" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE "public"."Plan";

-- DropTable
DROP TABLE "public"."Project";

-- DropTable
DROP TABLE "public"."Tipe_Ruangan";

-- DropEnum
DROP TYPE "public"."StatusPlan";

-- CreateTable
CREATE TABLE "public"."Kategori_Barang" (
    "id" SERIAL NOT NULL,
    "nama_kategori" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Kategori_Barang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Barang" (
    "id" SERIAL NOT NULL,
    "kategori_id" INTEGER NOT NULL,
    "kode_barang" TEXT NOT NULL,
    "nama_barang" TEXT NOT NULL,
    "merek" TEXT,
    "kondisi" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Barang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Peminjaman_Item" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "barang_id" INTEGER NOT NULL,
    "estimasi_pinjam" TIMESTAMP(3) NOT NULL,
    "jam_kembali" TIMESTAMP(3),
    "jam_pinjam" TIMESTAMP(3) NOT NULL,
    "kode_peminjaman" TEXT NOT NULL,
    "tanggal_pinjam" TIMESTAMP(3) NOT NULL,
    "tanggal_kembali" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "kegiatan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Peminjaman_Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Peminjaman_Handset" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "barang_id" INTEGER NOT NULL,
    "peminjaman_handset_id" INTEGER NOT NULL,
    "tanggal_pinjam" TIMESTAMP(3) NOT NULL,
    "tanggal_kembali" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "kegiatan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Peminjaman_Handset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Peminjaman_Ruangan" (
    "id" SERIAL NOT NULL,
    "ruangan_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "peminjaman_handset_id" INTEGER NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "jam_mulai" TIMESTAMP(3) NOT NULL,
    "jam_selesai" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "kegiatan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Peminjaman_Ruangan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "pesan" TEXT NOT NULL,
    "aksi" TEXT NOT NULL,
    "tabel_terkait" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notifikasi" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "pesan" TEXT NOT NULL,
    "send_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Barang_kode_barang_key" ON "public"."Barang"("kode_barang");

-- CreateIndex
CREATE UNIQUE INDEX "Peminjaman_Item_kode_peminjaman_key" ON "public"."Peminjaman_Item"("kode_peminjaman");

-- CreateIndex
CREATE UNIQUE INDEX "Ruangan_kode_ruangan_key" ON "public"."Ruangan"("kode_ruangan");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Barang" ADD CONSTRAINT "Barang_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "public"."Kategori_Barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Item" ADD CONSTRAINT "Peminjaman_Item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Handset" ADD CONSTRAINT "Peminjaman_Handset_barang_id_fkey" FOREIGN KEY ("barang_id") REFERENCES "public"."Barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Ruangan" ADD CONSTRAINT "Peminjaman_Ruangan_ruangan_id_fkey" FOREIGN KEY ("ruangan_id") REFERENCES "public"."Ruangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Log" ADD CONSTRAINT "Log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
