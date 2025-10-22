import { Request, Response, NextFunction } from "express";
import { PrismaClient, $Enums } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { asyncHandler, AppError } from "../../../../../middleware/error";
import { CreateRuanganRequest, PengajuanRuanganaTerjadwalRequest, Ruangan, StatusRuangan } from "../../../../../models/Ruangan";
import { error } from "console";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.LOCAL_DATABASE_URL
    }
  }
})
// Get all ruangan (DTO sesuai interface Ruangan) secara ascending berdasarkan id
const getAllRuangan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gedung, nama_ruangan, kode_ruangan, status } = req.query;

    // Query options
    const where: any = {};
    if (gedung) where.gedung = gedung;
    if (nama_ruangan) where.nama_ruangan = nama_ruangan;
    if (kode_ruangan) where.kode_ruangan = kode_ruangan;
    if (status) where.status = status;

    const ruanganList = await prisma.ruangan.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { id: "asc" }
    });

    const result: Ruangan[] = ruanganList.map(r => ({
      id: r.id,
      gedung: r.gedung,
      nama_ruangan: r.nama_ruangan,
      kode_ruangan: r.kode_ruangan,
      status: r.status as StatusRuangan,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt ?? undefined
    }));

    return res.status(200).json({
      success: true,
      message: "Ruangan retrieved successfully",
      data: result
    });
  } catch (error) {
    throw new AppError(`Failed to retrieve ruangan, error: ${error}`, 500);
  } finally {
    await prisma.$disconnect();
  }
});

const getDetailRuangan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const ruanganId = parseInt(req.params.id);
  try{
    const ruangan = await prisma.ruangan.findUnique({
      where: {
        id: ruanganId
      }
    });
    if (!ruangan) {
      throw new AppError(
        `Ruangan not found, Message: ${error} not found`, 404
      );
    }
    return res.status(200).json({
      success: true,
      message: "Ruangan detail retrieved successfully",
      data: ruangan
    });
  }catch(error){
    next(error);
  }
});

// Terjadwal, Dia ga perlu login
const PeminjamanRuanganTerjadwal = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { gedung, nim, ruangan_id, waktu_mulai, waktu_selesai, kegiatan }: PengajuanRuanganaTerjadwalRequest = req.body;

  // cari gedung lalu nanti di sort untuk ruangannya
  const gedungDatas = await prisma.ruangan.findFirst({
    where: {
      gedung: gedung
    }
  });
  if (!gedungDatas) {
    return res.status(404).json({
      success: false,
      message: "Gedung tidak ditemukan"
    });
  }
  // Kita get User_id bberdasarkan NIM
  let user_id: number | undefined = undefined;
  try {
    if (nim) {
      const user = await prisma.user.findFirst({
        where: {
          NIM: nim
        }
      });
      if (user) {
        user_id = user.id;
      }
    }
  } catch (error) {
    next(error);
  }
  if (typeof user_id !== "number") {
    return res.status(400).json({
      success: false,
      message: "User tidak ditemukan"
    });
  }

  // Cek apakah ada ruangan id
  try {
    const ruangan = await prisma.ruangan.findUnique({
      where: {
        id: ruangan_id,
        gedung: gedungDatas.gedung
      }
    });
    if (!ruangan) {
      return res.status(404).json({
        success: false,
        message: "Ruangan tidak ditemukan"
      });
    }
  } catch (error) {
    next(error);
  } finally {
    await prisma.$disconnect();
  }

  // Buat pengajuan ruangan terjadwal
  try {
    const pengajuan = await prisma.peminjaman_Ruangan.create({
      data: {
        // gedung,
        ruangan_id,
        jam_mulai: waktu_mulai,
        jam_selesai: waktu_selesai,
        status: "DIAJUKAN",
        kegiatan: kegiatan || 'Kuliah',
        user_id: user_id,
        tanggal: new Date(),
        // accepted_by: undefined, // You can omit this line entirely if not setting
        dokumen: null
      }
    });

    // Ganti Status ruangan jadi DIPAKAI
    await prisma.ruangan.update({
      where: {
        id: ruangan_id
      },
      data: {
        status: "DIPAKAI"
      }
    });
    return res.status(201).json({
      success: true,
      message: "Pengajuan ruangan terjadwal berhasil dibuat",
      data: pengajuan
    });
  } catch (error) {
    next(error);
  } finally {
    await prisma.$disconnect();
  }
});

const PeminjamanRuanganController = {
  PeminjamanRuanganTerjadwal,
  getAllRuangan,
  getDetailRuangan
};
export default PeminjamanRuanganController;