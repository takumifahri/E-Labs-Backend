import { Response, Request, NextFunction } from "express";
import { PrismaClient, StatusPeminjamanItem, StatusPeminjamanHandset } from "@prisma/client";
import { AppError, asyncHandler } from "../../../../../middleware/error";
import { PeminjamanBarangItemRequest, PeminjamanBarangRequest, ListPeminjamanBarangResponse } from "../../../../../models/barang";
import NodeCache from "node-cache";
import { logActivity } from "../../LogController";

// Initialize cache with TTL of 5 minutes (300 seconds)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

const ListPengajuanBarangResponse = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { status, search } = req.query;

    // Create cache key based on query parameters
    const cacheKey = `peminjaman_barang_list:${status}:${search}`;

    // Check if data exists in cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
        return res.status(200).json({
            status: "success",
            message: "Data retrieved from cache",
            data: cachedData,
            cached: true
        });
    }

    // Build filter conditions
    const whereConditions: any = {
        deletedAt: null
    };

    // Filter by status if provided
    if (status) {
        whereConditions.status = status as StatusPeminjamanHandset;
    }

    // Search by kode_peminjaman or user name
    if (search) {
        whereConditions.OR = [
            { kode_peminjaman: { contains: search as string, mode: 'insensitive' } },
            { user: { nama: { contains: search as string, mode: 'insensitive' } } },
            { user: { NIM: { contains: search as string, mode: 'insensitive' } } },
            { user: { NIP: { contains: search as string, mode: 'insensitive' } } }
        ];
    }

    // Fetch all data
    const peminjaman_handsets = await prisma.peminjaman_Handset.findMany({
        where: whereConditions,
        orderBy: {
            createdAt: 'desc'
        },
        include: {
            user: {
                select: {
                    id: true,
                    nama: true,
                    NIM: true,
                    NIP: true,
                    email: true
                }
            },
            peminjaman_items: {
                where: {
                    deletedAt: null
                },
                include: {
                    barang: {
                        select: {
                            id: true,
                            nama_barang: true,
                            kode_barang: true,
                            merek: true
                        }
                    }
                }
            }
        }
    });

    // Helper untuk hitung estimasi dalam format jam (misal: "24h 0m")
    const calculateEstimation = (
        tanggal_pinjam: Date,
        tanggal_kembali: Date | null,
        jam_pinjam?: Date | null,
        jam_kembali?: Date | null
    ) => {
        let start: Date, end: Date;
        if (jam_pinjam && jam_kembali) {
            start = jam_pinjam;
            end = jam_kembali;
        } else if (tanggal_pinjam && tanggal_kembali) {
            start = tanggal_pinjam;
            end = tanggal_kembali;
        } else {
            return '';
        }
        const diffMs = end.getTime() - start.getTime();
        if (diffMs <= 0) return '0h 0m';
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${minutes}m`;
    };

    // Transform data to match ListPeminjamanBarangResponse interface
    const transformedData: ListPeminjamanBarangResponse[] = peminjaman_handsets.map(handset => {
        const isReturnedLate = handset.jam_realisasi_selesai && handset.tanggal_kembali
            ? handset.jam_realisasi_selesai > handset.tanggal_kembali
            : false;

        return {
            id: handset.id,
            kode_peminjaman: handset.kode_peminjaman,
            ID_Peminjam: handset.user.NIM || handset.user.NIP || '',
            nama_peminjam: handset.user.nama,
            tanggal_pinjam: handset.tanggal_pinjam,
            tanggal_kembali: handset.tanggal_kembali || handset.tanggal_pinjam,
            tujuan_peminjaman: handset.kegiatan,
            dokumen_pendukung: handset.dokumen || undefined,
            status_peminjaman: handset.status,
            isReturned: handset.jam_realisasi_selesai !== null,
            isReturnedLate,
            total_waktu_peminjaman: calculateEstimation(handset.tanggal_pinjam, handset.tanggal_kembali),
            barang_dipinjam: handset.peminjaman_items.map(item => ({
                kode_peminjaman_item: item.kode_peminjaman,
                nama_barang: item.barang.nama_barang,
                jumlah: item.jumlah,
                kegiatan: item.kegiatan,
                status_item: item.status
            })),
            createdAt: handset.createdAt,
            updatedAt: handset.updatedAt
        };
    });

    // Store in cache
    cache.set(cacheKey, transformedData);

    res.status(200).json({
        status: "success",
        message: "Data retrieved successfully",
        data: transformedData,
        total: transformedData.length,
        cached: false
    });
});

const createPeminjamanBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { ID_Peminjam, items, tanggal_pinjam, tanggal_kembali, tujuan_peminjaman, dokumen_pendukung }: PeminjamanBarangRequest = req.body;

    // Validasi input
    if (!ID_Peminjam) {
        return next(new AppError("NIM/NIP is required", 400));
    }

    if (!items || items.length === 0) {
        return next(new AppError("At least one item is required", 400));
    }

    // Search user_id based on NIM/NIP
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { NIM: ID_Peminjam },
                { NIP: ID_Peminjam }
            ]
        }
    });

    if (!user) {
        return next(new AppError("User not found with provided NIM/NIP", 404));
    }

    // Helper function untuk generate kode peminjaman
    const generate_kodepeminjaman = () => {
        const prefix = "PB";
        const date = new Date();
        const dateString = date.toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}-${dateString}-${randomNum}`;
    };

    // Generate kode peminjaman untuk handset
    const kode_peminjaman_handset = generate_kodepeminjaman();

    // ✅ Ekstrak jam dari tanggal_pinjam dan tanggal_kembali
    const jam_pinjam = new Date(tanggal_pinjam);
    const jam_kembali = new Date(tanggal_kembali);

    // Create peminjaman handset dengan status DIAJUKAN
    const peminjaman = await prisma.peminjaman_Handset.create({
        data: {
            user_id: user.id,
            tanggal_pinjam: new Date(tanggal_pinjam),
            tanggal_kembali: new Date(tanggal_kembali),
            kegiatan: tujuan_peminjaman,
            dokumen: dokumen_pendukung,
            barang_id: items[0].barang_id,
            kode_peminjaman: kode_peminjaman_handset,
            status: StatusPeminjamanHandset.DIAJUKAN,
            peminjaman_items: {
                create: items.map((item) => ({
                    jumlah: item.jumlah,
                    kegiatan: item.kegiatan || tujuan_peminjaman,
                    tanggal_pinjam: new Date(tanggal_pinjam),
                    tanggal_kembali: new Date(tanggal_kembali),
                    status: StatusPeminjamanItem.DIAJUKAN,
                    estimasi_pinjam: new Date(tanggal_kembali),
                    jam_pinjam, // ✅ Gunakan jam dari tanggal_pinjam (untuk Peminjaman_Item)
                    jam_kembali, // ✅ Gunakan jam dari tanggal_kembali (untuk Peminjaman_Item)
                    kode_peminjaman: generate_kodepeminjaman(),
                    user: { connect: { id: user.id } },
                    barang: { connect: { id: item.barang_id } }
                }))
            }
        },
        include: {
            peminjaman_items: {
                include: {
                    barang: true
                }
            },
            user: {
                select: {
                    id: true,
                    nama: true,
                    NIM: true,
                    NIP: true,
                    email: true
                }
            }
        }
    });

    // Clear cache setelah create data baru
    cache.flushAll();

    // Wrap logActivity dengan try-catch
    try {
        await logActivity({
            user_id: peminjaman.user_id,
            pesan: `User (${user.NIM ? "Mahasiswa" : "Dosen"} - ${user.NIM ?? user.NIP ?? ""}) mengajukan peminjaman barang dengan kode ${peminjaman.kode_peminjaman}`,
            aksi: 'PENGAJUAN BARANG',
            tabel_terkait: 'Peminjaman_Handset'
        });
    } catch (logError) {
        console.error('Error logging activity:', logError);
    }

    res.status(201).json({
        status: "success",
        message: "Peminjaman barang berhasil diajukan",
        data: {
            peminjaman
        }
    });
});

const SelesaiPeminjamanBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    
});


const peminjamanBarangController = {
    ListPengajuanBarangResponse,
    createPeminjamanBarang
};

export default peminjamanBarangController;