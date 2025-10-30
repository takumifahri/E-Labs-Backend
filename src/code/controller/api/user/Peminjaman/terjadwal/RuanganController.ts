import { Request, Response, NextFunction } from "express";
import { PrismaClient, $Enums, StatusPeminjamanRuangan } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { asyncHandler, AppError } from "../../../../../middleware/error";
import { CreateRuanganRequest, pembatalanPeminjamanRuanganTerjadwalRequest, PeminjamanRuanganStatus, PengajuanPeminjamanRuanganBaseRequest, PengajuanRuanganaTerjadwalRequest, LengkapiDataPengajuanRuanganRequest, Ruangan, StatusRuangan, ListPengajuanPeminjamanRuanganResponse, isAvailableRuangan } from "../../../../../models/Ruangan";
import { error } from "console";
import { logActivity } from "../../LogController";
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.LOCAL_DATABASE_URL
    }
  }
})

const pengajuanCache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL = Math.floor(Math.random() * 6 + 10) * 1000; // 10-15 detik

function setPengajuanCache(key: string, data: any, ttl: number = CACHE_TTL) {
  pengajuanCache.set(key, { data, expiry: Date.now() + ttl });
}

function getPengajuanCache(key: string) {
  const cached = pengajuanCache.get(key);
  if (!cached) return undefined;
  if (Date.now() > cached.expiry) {
    pengajuanCache.delete(key);
    return undefined;
  }
  return cached.data;
}

function clearPengajuanCache() {
  pengajuanCache.clear();
}

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

const PengajuanPeminjamanRuanganTerjadwal = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { nim, ruangan_id }: PengajuanPeminjamanRuanganBaseRequest = req.body;
  // pertama kita ambil dulu si ruangan_id nya
  try {
    const getRuangan = await prisma.ruangan.findUnique({
      where: {
        id: ruangan_id
      }
    });
    if (!getRuangan) {
      return res.status(404).json({
        success: false,
        message: "Ruangan tidak ditemukan"
      });
    }

    // Kita get User_id bberdasarkan NIM
    let user_id;
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

    // Kita cek apakah user ada
    if (typeof user_id !== "number") {
      return res.status(400).json({
        success: false,
        message: "User tidak ditemukan"
      });
    }

    // kita cek apakah user sudah terblokir
    const checkUser = await prisma.user.findUnique({
      where: {
        id: user_id
      }
    });
    if (checkUser?.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Akun Anda diblokir, silakan hubungi admin untuk informasi lebih lanjut"
      });
    }

    // Buat pengajuan ruangan terjadwal
    const pengajuan = await prisma.peminjaman_Ruangan.create({
      data: {
        ruangan_id: getRuangan.id,
        user_id: user_id,
        status: StatusPeminjamanRuangan.PENDING,
      }
    });

    // Kita ubah si status ruangan jadi diajukan
    await prisma.ruangan.update({
      where: {
        id: ruangan_id
      },
      data: {
        status: StatusRuangan.DIAJUKAN
      }
    });

    res.status(201).json({
      success: true,
      message: "Pengajuan ruangan terjadwal berhasil dibuat, silahkan isi data yang diperlukan untuk melengkapi pengajuan.",
      data: pengajuan
    });
  } catch (error) {
    next(error);
  }
});

// Clear, udh sesuai. ga bisa pengajuan jika dia udah ada di jam yang sama
const lengkapiPengajuanPeminjamanRuanganTerjadwal = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { matkul_id, waktu_mulai, waktu_selesai, dokumen, kegiatan }: LengkapiDataPengajuanRuanganRequest = req.body;

  try {
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

    if (peminjamanRuangan.status !== StatusPeminjamanRuangan.PENDING) {
      return res.status(400).json({
        success: false,
        message: "Hanya peminjaman ruangan dengan status PENDING yang dapat dilengkapi datanya"
      });
    }
    if (!matkul_id) {
      return res.status(400).json({
        success: false,
        message: "matkul_id harus disertakan untuk melengkapi pengajuan peminjaman ruangan terjadwal"
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: peminjamanRuangan.user_id
      }
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan"
      });
    }
    if (user.prodiId === null) {
      return res.status(400).json({
        success: false,
        message: "User tidak memiliki prodi_id yang valid"
      });
    }
    const matkul = await prisma.master_Matkul.findUnique({
      where: {
        id: matkul_id,
        semester: user.semester,
        prodi_id: user.prodiId
      }
    });
    if (!matkul) {
      return res.status(404).json({
        success: false,
        message: "Mata kuliah tidak ditemukan"
      });
    }

    // Prevent overlapping bookings at the same time
    const tanggal = peminjamanRuangan.tanggal ? peminjamanRuangan.tanggal.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const waktuMulaiBaru = new Date(waktu_mulai);
    const waktuSelesaiBaru = new Date(waktu_selesai);

    // Prevent jika dia ngajuin di atas jam 17 dan di bawah jam 6
    const startHour = new Date(waktu_mulai).getHours();
    const endHour = new Date(waktu_selesai).getHours();
    if (startHour < 6 || endHour > 17) {
      return res.status(400).json({
        success: false,
        message: "Peminjaman ruangan hanya dapat dilakukan antara jam 6 pagi hingga jam 5 sore"
      });
    }

    const jadwalTerpakai = await prisma.peminjaman_Ruangan.findMany({
      where: {
        ruangan_id: peminjamanRuangan.ruangan_id,
        status: { in: ['DISETUJUI', 'BERLANGSUNG', 'DIAJUKAN', 'PENDING'] },
        OR: [
          {
            jam_mulai: {
              gte: new Date(tanggal + "T00:00:00.000Z"),
              lte: new Date(tanggal + "T23:59:59.999Z")
            }
          },
          {
            jam_selesai: {
              gte: new Date(tanggal + "T00:00:00.000Z"),
              lte: new Date(tanggal + "T23:59:59.999Z")
            }
          }
        ]
      },
      select: {
        id: true,
        jam_mulai: true,
        jam_selesai: true
      }
    });

    for (const jadwal of jadwalTerpakai) {
      if (jadwal.id === parseInt(id)) continue; // Skip current booking
      if (jadwal.jam_mulai && jadwal.jam_selesai) {
        const jadwalMulai = new Date(jadwal.jam_mulai);
        const jadwalSelesai = new Date(jadwal.jam_selesai);

        // Prevent exact same start/end time
        if (
          waktuMulaiBaru.getTime() === jadwalMulai.getTime() ||
          waktuSelesaiBaru.getTime() === jadwalSelesai.getTime()
        ) {
          return res.status(400).json({
            success: false,
            message: "Waktu peminjaman ruangan tidak boleh sama persis dengan jadwal lain, silakan pilih waktu lain."
          });
        }

        // Prevent overlapping
        if (
          (waktuMulaiBaru < jadwalSelesai && waktuMulaiBaru >= jadwalMulai) ||
          (waktuSelesaiBaru > jadwalMulai && waktuSelesaiBaru <= jadwalSelesai) ||
          (waktuMulaiBaru <= jadwalMulai && waktuSelesaiBaru >= jadwalSelesai)
        ) {
          return res.status(400).json({
            success: false,
            message: "Waktu peminjaman ruangan bertabrakan dengan jadwal yang sudah ada, silakan pilih waktu lain."
          });
        }
      }
    }

    const updatePeminjaman = await prisma.peminjaman_Ruangan.update({
      where: {
        id: parseInt(id)
      },
      data: {
        matkul_id: matkul.id || null,
        tanggal: new Date(tanggal),
        status: StatusPeminjamanRuangan.DIAJUKAN,
        jam_mulai: waktu_mulai,
        jam_selesai: waktu_selesai,
        dokumen: dokumen || null,
        kegiatan: kegiatan || 'Kuliah'
      }
    });
    return res.status(200).json({
      success: true,
      message: "Data peminjaman ruangan terjadwal berhasil dilengkapi, mohon tunggu proses persetujuan dari admin.",
      data: updatePeminjaman
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
      if (!peminjamanRuangan.jam_mulai) {
        return res.status(400).json({
          success: false,
          message: "Waktu mulai peminjaman ruangan tidak tersedia"
        });
      }
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

const getListPengajuanRuanganTerjadwal = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
   const cacheKey = "pengajuan_list:" + JSON.stringify(req.query);
  const cached = getPengajuanCache(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }
  const { id, ruangan_id, user_id, jam_mulai, jam_selesai, status, kegiatan, tanggal, dokumen, createdAt, updatedAt, responded_by, responden } = req.query;
  try {
    const peminjamanRuanganListWithRole = await prisma.peminjaman_Ruangan.findMany({
      orderBy: { id: 'asc' },
      include: {
        accepted_by: {
          include: {
            role: true
          }
        },
        user: {
          include: {
            role: true
          }
        }
      }
    });

    const result: ListPengajuanPeminjamanRuanganResponse[] = peminjamanRuanganListWithRole.map(pr => ({
      id: pr.id,
      ruangan_id: pr.ruangan_id,
      user_id: pr.user_id,
      jam_mulai: pr.jam_mulai ?? new Date(0),
      jam_selesai: pr.jam_selesai ?? new Date(0),
      status: pr.status as unknown as PeminjamanRuanganStatus,
      kegiatan: pr.kegiatan ?? "",
      tanggal: pr.tanggal ?? new Date(0),
      dokumen: pr.dokumen ?? "",
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
      responded_by: pr.accepted_by_id,
      responden: pr.accepted_by
        ? {
          id: pr.accepted_by.id,
          nama: pr.accepted_by.nama,
          email: pr.accepted_by.email,
          role: pr.accepted_by.role?.nama_role,
        }
        : null,
      user: pr.user
        ? {
          id: pr.user.id,
          nama: pr.user.nama,
          email: pr.user.email,
          NIM: pr.user.NIM,
          NIP: pr.user.NIP,
          role: pr.user.role?.nama_role
        }
        : null
    }));

    let filteredResult = result;
    const hasFilter =
      id || ruangan_id || user_id || jam_mulai || jam_selesai ||
      status || kegiatan || tanggal || dokumen || createdAt;

    if (hasFilter) {
      filteredResult = result.filter(pr => {
        if (id && pr.id !== Number(id)) return false;
        if (ruangan_id && pr.ruangan_id !== Number(ruangan_id)) return false;
        if (user_id && pr.user_id !== Number(user_id)) return false;
        if (jam_mulai && new Date(pr.jam_mulai).toISOString() !== new Date(jam_mulai as string).toISOString()) return false;
        if (jam_selesai && new Date(pr.jam_selesai).toISOString() !== new Date(jam_selesai as string).toISOString()) return false;
        if (status && pr.status !== status) return false;
        if (kegiatan && pr.kegiatan !== kegiatan) return false;
        if (tanggal && new Date(pr.tanggal).toISOString() !== new Date(tanggal as string).toISOString()) return false;
        if (dokumen && pr.dokumen !== dokumen) return false;
        if (createdAt && new Date(pr.createdAt).toISOString() !== new Date(createdAt as string).toISOString()) return false;
        return true;
      });
    }

    const responsePayload = {
      status: 'success',
      message: 'List of pengajuan peminjaman ruangan terjadwal retrieved successfully',
      data: filteredResult
    };
    res.status(200).json(responsePayload);
    setPengajuanCache(cacheKey, responsePayload);
  } catch (error) {
    throw new AppError(`Failed to get list of scheduled room booking requests, error: ${error}`, 500);
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

const isRuanganAvailable = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { ruangan_id, tanggal, jam_mulai, jam_selesai } = req.body;

  if (!tanggal || !jam_mulai || !jam_selesai) {
    return res.status(400).json({
      success: false,
      message: "Semua field harus diisi"
    });
  }


  // Jika ruangan_id tidak diisi, ambil semua ruangan beserta jadwal terpakai
  if (!ruangan_id) {
    const ruangans = await prisma.ruangan.findMany({
      where: { deletedAt: null }
    });

    // Ambil jadwal terpakai untuk semua ruangan di tanggal yang sama
    const jadwalAll = await prisma.peminjaman_Ruangan.findMany({
      where: {
        status: { in: ['DISETUJUI', 'BERLANGSUNG'] },
        OR: [
          {
            jam_mulai: {
              gte: new Date(tanggal + "T00:00:00.000Z"),
              lte: new Date(tanggal + "T23:59:59.999Z")
            }
          },
          {
            jam_selesai: {
              gte: new Date(tanggal + "T00:00:00.000Z"),
              lte: new Date(tanggal + "T23:59:59.999Z")
            }
          }
        ]
      },
      select: {
        ruangan_id: true,
        jam_mulai: true,
        jam_selesai: true
      }
    });

    // Gabungkan jadwal ke masing-masing ruangan
    const result = ruangans.map((r) => ({
      id: r.id,
      nama_ruangan: r.nama_ruangan,
      kode_ruangan: r.kode_ruangan,
      gedung: r.gedung,
      list_jam_terpakai: jadwalAll
        .filter(j => j.ruangan_id === r.id)
        .map((j, idx) => ({
          id: idx,
          jam_mulai: j.jam_mulai ?? new Date(0),
          jam_selesai: j.jam_selesai ?? new Date(0)
        })),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt ?? undefined
    }));

    return res.status(200).json({
      success: true,
      message: "List ruangan dan jadwal terpakai pada tanggal yang dipilih",
      data: result
    });
  }

  try {
    // Kita cek apakah tanggal dia input sebelum jam saat ini (overlap)
    const now = new Date();
    const inputDate = new Date(tanggal);
    const inputStartTime = new Date(jam_mulai);
    const inputEndTime = new Date(jam_selesai);

    // Pakai toISOString untuk membandingkan tanggal dan waktu secara akurat
    if (
      inputDate.toISOString() < now.toISOString() ||
      (inputDate.toDateString() === now.toDateString() && inputStartTime.toISOString() < now.toISOString())
    ) {
      return res.status(400).json({
        success: false,
        message: "Tanggal dan jam mulai harus setelah waktu saat ini"
      });
    }


    // Kita cek jika dia input pada jam 5 pagi dan 6 malam. karena tidak bisa
    const startHour = inputStartTime.getHours();
    const endHour = inputEndTime.getHours();
    // Hanya bisa pinjam antara jam 6 pagi sampai jam 5 sore (tidak termasuk jam 6 pagi dan di atas jam 5 sore)
    if (startHour < 6 || endHour > 17) {
      return res.status(400).json({
        success: false,
        message: "Peminjaman ruangan hanya dapat dilakukan antara jam 6 pagi hingga jam 5 sore"
      });
    }
    // Cek ketersediaan ruangan dengan filter status
    const isAvailable = await prisma.peminjaman_Ruangan.findMany({
      where: {
        ruangan_id: ruangan_id,
        tanggal: new Date(tanggal),
        status: { in: ['DISETUJUI', 'BERLANGSUNG'] }, // Tambahkan filter status
        AND: [
          {
            jam_mulai: {
              lt: new Date(jam_selesai)
            }
          },
          {
            jam_selesai: {
              gt: new Date(jam_mulai)
            }
          }
        ]
      }
    });
    if (isAvailable.length > 0) {
      return res.status(200).json({
        success: false,
        message: "Ruangan tidak tersedia pada waktu yang dipilih, silahkan ditunggu atau pilih waktu lain"
      });
    }
    // Ambil data ruangan
    const ruangan = await prisma.ruangan.findUnique({
      where: { id: ruangan_id }
    });
    if (!ruangan) {
      return res.status(404).json({
        success: false,
        message: "Ruangan tidak ditemukan"
      });
    }

    // Ambil semua jadwal terpakai pada tanggal yang sama
    const jadwalTerpakai = await prisma.peminjaman_Ruangan.findMany({
      where: {
        ruangan_id: ruangan_id,
        status: { in: ['DISETUJUI', 'BERLANGSUNG'] },
        OR: [
          {
            jam_mulai: {
              gte: new Date(tanggal + "T00:00:00.000Z"),
              lte: new Date(tanggal + "T23:59:59.999Z")
            }
          },
          {
            jam_selesai: {
              gte: new Date(tanggal + "T00:00:00.000Z"),
              lte: new Date(tanggal + "T23:59:59.999Z")
            }
          }
        ]
      },
      select: {
        jam_mulai: true,
        jam_selesai: true
      }
    });


    const response: isAvailableRuangan = {
      id: ruangan.id,
      nama_ruangan: ruangan.nama_ruangan,
      kode_ruangan: ruangan.kode_ruangan,
      gedung: ruangan.gedung,
      list_jam_terpakai: jadwalTerpakai.map((j, idx) => ({
        id: idx, // id diisi dengan index agar mudah diakses
        jam_mulai: j.jam_mulai ?? new Date(0),
        jam_selesai: j.jam_selesai ?? new Date(0)
      })),
      createdAt: ruangan.createdAt,
      updatedAt: ruangan.updatedAt,
      deletedAt: ruangan.deletedAt ?? undefined
    };

    return res.status(200).json({
      success: true,
      message: "Ruangan tersedia pada waktu yang dipilih",
      data: response
    });
  } catch (error) {

    throw new AppError(`Error checking room availability: ${error}`, 500);
  }

});

const PeminjamanRuanganController = {
  PengajuanPeminjamanRuanganTerjadwal,
  lengkapiPengajuanPeminjamanRuanganTerjadwal,
  pembatalanPeminjamanRuanganTerjadwal,
  aktivasiPeminjamanRuanganTerjadwal,

  getAllRuangan,
  getDetailRuangan,

  getListPengajuanRuanganTerjadwal,
  isRuanganAvailable
};
export default PeminjamanRuanganController;