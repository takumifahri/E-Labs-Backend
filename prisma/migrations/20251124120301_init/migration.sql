-- CreateEnum
CREATE TYPE "public"."StatusRuangan" AS ENUM ('DIAJUKAN', 'DIPAKAI', 'KOSONG', 'DIPERBAIKI');

-- CreateEnum
CREATE TYPE "public"."StatusBarang" AS ENUM ('TERSEDIA', 'DIPINJAM', 'RUSAK', 'PERBAIKAN', 'TIDAK_TERSEDIA');

-- CreateEnum
CREATE TYPE "public"."KondisiBarang" AS ENUM ('BAIK', 'RUSAK_BERAT', 'RUSAK_RINGAN');

-- CreateEnum
CREATE TYPE "public"."StatusPeminjamanItem" AS ENUM ('DITOLAK', 'DIAJUKAN', 'DIPINJAM', 'DIKEMBALIKAN', 'TERLAMBAT');

-- CreateEnum
CREATE TYPE "public"."StatusPeminjamanHandset" AS ENUM ('DIAJUKAN', 'DISETUJUI', 'SEBAGIAN_DISETUJUI', 'DITOLAK', 'DIBATALKAN', 'SELESAI', 'DIPINJAM');

-- CreateEnum
CREATE TYPE "public"."StatusPeminjamanRuangan" AS ENUM ('PENDING', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN', 'SELESAI', 'BERLANGSUNG');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "uniqueId" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL DEFAULT 1,
    "KLP" TEXT,
    "prodiId" INTEGER,
    "semester" INTEGER,
    "profil" TEXT,
    "email" TEXT,
    "nama" TEXT NOT NULL,
    "NIM" TEXT,
    "NIP" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT NOT NULL,
    "firstWarn" BOOLEAN NOT NULL DEFAULT false,
    "secondWarn" BOOLEAN NOT NULL DEFAULT false,
    "thirdWarn" BOOLEAN NOT NULL DEFAULT false,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "public"."Role" (
    "id" SERIAL NOT NULL,
    "deskripsi" TEXT NOT NULL DEFAULT 'Default Description',
    "nama_role" TEXT NOT NULL DEFAULT 'Default Role',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

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
    "kondisi" "public"."KondisiBarang" NOT NULL DEFAULT 'BAIK',
    "jumlah" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."StatusBarang" NOT NULL DEFAULT 'TERSEDIA',
    "foto_barang" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Barang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ruangan" (
    "id" SERIAL NOT NULL,
    "gedung" TEXT NOT NULL,
    "status" "public"."StatusRuangan" NOT NULL DEFAULT 'KOSONG',
    "nama_ruangan" TEXT NOT NULL,
    "kode_ruangan" TEXT NOT NULL,
    "QR_Image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Ruangan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Master_Matkul" (
    "id" SERIAL NOT NULL,
    "prodi_id" INTEGER NOT NULL,
    "matkul" TEXT NOT NULL,
    "semester" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Master_Matkul_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Peminjaman_Item" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "barang_id" INTEGER NOT NULL,
    "estimasi_pinjam" TIMESTAMP(3) NOT NULL,
    "jumlah" INTEGER NOT NULL DEFAULT 0,
    "jam_kembali" TIMESTAMP(3),
    "jam_pinjam" TIMESTAMP(3) NOT NULL,
    "kode_peminjaman" TEXT NOT NULL,
    "tanggal_pinjam" TIMESTAMP(3) NOT NULL,
    "tanggal_kembali" TIMESTAMP(3),
    "status" "public"."StatusPeminjamanItem" NOT NULL,
    "kegiatan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "accepted_by_id" INTEGER,
    "peminjaman_handset_id" INTEGER,

    CONSTRAINT "Peminjaman_Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Peminjaman_Handset" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "barang_id" INTEGER NOT NULL,
    "kode_peminjaman" TEXT NOT NULL,
    "tanggal_pinjam" TIMESTAMP(3) NOT NULL,
    "tanggal_kembali" TIMESTAMP(3),
    "status" "public"."StatusPeminjamanHandset" NOT NULL,
    "kegiatan" TEXT NOT NULL,
    "dokumen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "accepted_by_id" INTEGER,

    CONSTRAINT "Peminjaman_Handset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Peminjaman_Ruangan" (
    "id" SERIAL NOT NULL,
    "ruangan_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "matkul_id" INTEGER,
    "tanggal" TIMESTAMP(3),
    "jam_mulai" TIMESTAMP(3),
    "jam_selesai" TIMESTAMP(3),
    "jam_realisasi_selesai" TIMESTAMP(3),
    "status" "public"."StatusPeminjamanRuangan" NOT NULL,
    "kegiatan" TEXT,
    "dokumen" TEXT,
    "token" TEXT,
    "isLoop" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "accepted_by_id" INTEGER,

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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notifikasi" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "pesan" TEXT NOT NULL,
    "judul" TEXT,
    "send_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_uniqueId_key" ON "public"."User"("uniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MasterProdi_kode_prodi_key" ON "public"."MasterProdi"("kode_prodi");

-- CreateIndex
CREATE UNIQUE INDEX "Role_nama_role_key" ON "public"."Role"("nama_role");

-- CreateIndex
CREATE UNIQUE INDEX "Kategori_Barang_nama_kategori_key" ON "public"."Kategori_Barang"("nama_kategori");

-- CreateIndex
CREATE UNIQUE INDEX "Barang_kode_barang_key" ON "public"."Barang"("kode_barang");

-- CreateIndex
CREATE UNIQUE INDEX "Ruangan_kode_ruangan_key" ON "public"."Ruangan"("kode_ruangan");

-- CreateIndex
CREATE UNIQUE INDEX "Peminjaman_Item_kode_peminjaman_key" ON "public"."Peminjaman_Item"("kode_peminjaman");

-- CreateIndex
CREATE UNIQUE INDEX "Peminjaman_Handset_kode_peminjaman_key" ON "public"."Peminjaman_Handset"("kode_peminjaman");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "public"."MasterProdi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Barang" ADD CONSTRAINT "Barang_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "public"."Kategori_Barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Master_Matkul" ADD CONSTRAINT "Master_Matkul_prodi_id_fkey" FOREIGN KEY ("prodi_id") REFERENCES "public"."MasterProdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Item" ADD CONSTRAINT "Peminjaman_Item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Item" ADD CONSTRAINT "Peminjaman_Item_barang_id_fkey" FOREIGN KEY ("barang_id") REFERENCES "public"."Barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Item" ADD CONSTRAINT "Peminjaman_Item_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Item" ADD CONSTRAINT "Peminjaman_Item_peminjaman_handset_id_fkey" FOREIGN KEY ("peminjaman_handset_id") REFERENCES "public"."Peminjaman_Handset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Handset" ADD CONSTRAINT "Peminjaman_Handset_barang_id_fkey" FOREIGN KEY ("barang_id") REFERENCES "public"."Barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Handset" ADD CONSTRAINT "Peminjaman_Handset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Handset" ADD CONSTRAINT "Peminjaman_Handset_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Ruangan" ADD CONSTRAINT "Peminjaman_Ruangan_ruangan_id_fkey" FOREIGN KEY ("ruangan_id") REFERENCES "public"."Ruangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Ruangan" ADD CONSTRAINT "Peminjaman_Ruangan_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Ruangan" ADD CONSTRAINT "Peminjaman_Ruangan_matkul_id_fkey" FOREIGN KEY ("matkul_id") REFERENCES "public"."Master_Matkul"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Peminjaman_Ruangan" ADD CONSTRAINT "Peminjaman_Ruangan_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Log" ADD CONSTRAINT "Log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notifikasi" ADD CONSTRAINT "Notifikasi_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
