import { Request, Response, NextFunction } from "express";
import { PrismaClient, $Enums } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { asyncHandler, AppError } from "../../../../../middleware/error";
import { CreateRuanganRequest, pembatalanPeminjamanRuanganTerjadwalRequest, PeminjamanRuanganStatus, PengajuanRuanganaTerjadwalRequest, Ruangan, StatusRuangan } from "../../../../../models/Ruangan";
import { error } from "console";
import { logActivity } from "../../LogController";
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
  try {
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
  } catch (error) {
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

  // Declare kodeRuanganForLog with a default value
  let kodeRuanganForLog: string | undefined = undefined;

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
    // Save kode_ruangan for logging
    kodeRuanganForLog = ruangan.kode_ruangan;
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
        status: PeminjamanRuanganStatus.DIAJUKAN,
        kegiatan: kegiatan || 'Kuliah',
        user_id: user_id,
        tanggal: new Date(),
        dokumen: null
      }
    });

    // Ganti Status ruangan jadi DIPAKAI
    await prisma.ruangan.update({
      where: {
        id: ruangan_id
      },
      data: {
        status: $Enums.StatusRuangan.DIAJUKAN
      }
    });
    await logActivity({
      user_id: user_id,
      pesan: `Pengajuan ruangan terjadwal (${gedung} - Kode Ruangan: ${kodeRuanganForLog ?? ''}) oleh NIM: ${nim}`,
      aksi: 'PENGAJUAN RUANGAN',
      tabel_terkait: 'Peminjaman_Ruangan'
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

const pembatalanPeminjamanRuanganTerjadwal = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { nim, nip, status }: pembatalanPeminjamanRuanganTerjadwalRequest = req.body;
  if (!id) {
    return res.status(400).json({
      success: false,
      message: "ID peminjaman ruangan terjadwal harus disertakan"
    });
  }
  try {
    // flow nya kita akan mengubah status diajukan menjadi dibatalkan,
    // Kita cek apakah nim nya saam dengan user_id di peminjaman ruangan terjadwal. jadi kita ambil user_id
    const getUserIdByNIM = await prisma.user.findFirst({
      where: {
        NIM: nim
      }
    });
    if (!getUserIdByNIM) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan"
      });
    }
    console.log("getUserIdByNIM:", getUserIdByNIM);
    const getNIPByUser = await prisma.user.findFirst({
      where: {
        NIP: nip
      }
    });
    if (!getNIPByUser) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan"
      });
    }
    console.log("getNIPByUser:", getNIPByUser);

    // ambil data peminjaman ruangan terjadwal berdasarkan id
    const peminjamanRuangan = await prisma.peminjaman_Ruangan.findUnique({
      where: {
        id: parseInt(id)
      }
    });
    if (!peminjamanRuangan) {
      return res.status(404).json({
        success: false,
        message: "Peminjaman ruangan terjadwal tidak ditemukan"
      });
    }

    // Cek jika user_id dari NIM atau NIP tidak sesuai dg user_id di peminjaman
    if (peminjamanRuangan.user_id !== getUserIdByNIM.id || peminjamanRuangan.user_id !== getNIPByUser.id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki izin untuk membatalkan peminjaman ruangan terjadwal ini"
      });
    } else {
      // update status menjadi dibatalkan
      // Kita cek apakah dia dibatalkan sebelum 1 jam dari waktu mulai
      const currentTime = new Date();
      const waktuMulai = new Date(peminjamanRuangan.jam_mulai);
      const diffInMs = waktuMulai.getTime() - currentTime.getTime();
      const diffInHours = diffInMs / (1000 * 60 * 60);
      if (diffInHours < 1) {
        // Ubahlah akun dengan peringaktan
        return res.status(400).json({
          success: false,
          message: "Peminjaman ruangan terjadwal hanya dapat dibatalkan minimal 1 jam sebelum waktu mulai"
        });
      } else if (currentTime > waktuMulai) {
        // Berikan warning pada user, ada 3 variable first warn, second warn, third warn. nah kita kasih firstwarn
        // Ambil data user
        const user = await prisma.user.findUnique({
          where: { id: peminjamanRuangan.user_id }
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User tidak ditemukan"
          });
        }

        // Cek dan update warning level
        if (!user.firstWarn) {
          await prisma.user.update({
            where: { id: user.id },
            data: { firstWarn: true }
          });
        } else if (!user.secondWarn) {
          await prisma.user.update({
            where: { id: user.id },
            data: { secondWarn: true }
          });
        } else if (!user.thirdWarn) {
          await prisma.user.update({
            where: { id: user.id },
            data: { thirdWarn: true }
          });
        } else if (!user.isBlocked) {
          await prisma.user.update({
            where: { id: user.id },
            data: { isBlocked: true }
          });
        }
        // Ubah jadi dibatalkan
        const updatePeminjaman = await prisma.peminjaman_Ruangan.update({
          where: {
            id: parseInt(id)
          },
          data: {
            status: PeminjamanRuanganStatus.DIBATALKAN
          }
        });
        return res.status(200).json({
          success: true,
          message: "Peminjaman ruangan terjadwal berhasil dibatalkan dengan peringatan pertama",
          data: updatePeminjaman
        });
      }
    }
  } catch (error) {
    throw new AppError(`Failed to cancel scheduled room booking, error: ${error}`, 500);
  } finally {
    await prisma.$disconnect();
  }
});
const aktivasiPeminjamanRuanganTerjadwal = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // This function can be implemented later if needed
  // Dia bakal ambil ruangan yg ada di QR Ruangan, bakal di scan dan masuk ke web aktivasi peminjaman ruangan terjadwal
  const { id } = req.params;
  const { nim, nip } = req.body;
  try {
    // Cek ruangannya
    const ruangans = await prisma.ruangan.findUnique({
      where: {
        id: parseInt(id)
      }
    });
    if (!ruangans) {
      return res.status(404).json({
        success: false,
        message: "Ruangan tidak ditemukan"
      });
    }

    // User bisa input nim atau nip, cek user berdasarkan salah satu
    let user: any = null;
    if (nim) {
      user = await prisma.user.findFirst({
        where: { NIM: nim },
        include: { role: true, peminjaman_ruangans: true }
      });
    } else if (nip) {
      user = await prisma.user.findFirst({
        where: { NIP: nip },
        include: { role: true, peminjaman_ruangans: true }
      });
    }
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan"
      });
    }
    const user_id = user.id;

    // ambil data peminjaman ruangan terjadwal berdasarkan ruangan_id yg di scan apakah sama dengan ruangan_id di peminjaman
    const peminjamanRuangan = await prisma.peminjaman_Ruangan.findFirst({
      where: {
        ruangan_id: ruangans.id,
      }
    });
    if (!peminjamanRuangan) {
      return res.status(404).json({
        success: false,
        message: "Peminjaman ruangan terjadwal tidak ditemukan"
      });
    }
    if (peminjamanRuangan.status !== PeminjamanRuanganStatus.DISETUJUI) {
      return res.status(400).json({
        success: false,
        message: "Peminjaman ruangan terjadwal belum disetujui, tidak dapat diaktifkan"
      });
    }
    // Cek jika user_id dari NIM/NIP tidak sesuai dg user_id di peminjaman
    if (peminjamanRuangan.user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki izin untuk mengaktifkan peminjaman ruangan terjadwal ini"
      });
    } else {
      // update status menjadi aktif
      const updatePeminjaman = await prisma.peminjaman_Ruangan.update({
        where: {
          id: peminjamanRuangan.id
        },
        data: {
          status: PeminjamanRuanganStatus.BERLANGSUNG
        }
      }); 
      // Update status ruangan menjadi DIPAKAI
      await prisma.ruangan.update({
        where: {
          id: ruangans.id
        },
        data: {
          status: $Enums.StatusRuangan.DIPAKAI
        }
      });
      
      return res.status(200).json({
        success: true,
        message: "Peminjaman ruangan terjadwal berhasil diaktifkan",
        data: updatePeminjaman
      });
    }
  } catch (error) {
    throw new AppError(`Failed to activate scheduled room booking, error: ${error}`, 500);
  }
});

const PeminjamanRuanganController = {
  PeminjamanRuanganTerjadwal,
  getAllRuangan,
  getDetailRuangan,
  pembatalanPeminjamanRuanganTerjadwal,
  aktivasiPeminjamanRuanganTerjadwal
};
export default PeminjamanRuanganController;