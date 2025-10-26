import { asyncHandler, AppError } from "../../../../../middleware/error";
import { Request, Response, NextFunction } from "express";
import { Prisma, PrismaClient, StatusRuangan } from "@prisma/client";
import { ListPengajuanPeminjamanRuanganResponse } from "../../../../../models/Ruangan";
import { PeminjamanRuanganStatus } from "../../../../../models/Ruangan";
import { VerifikasiPeminjamanRequest } from "../../../../../models/verifikasi-peminjaman";
import { logActivity } from "../../../user/LogController";
import { get } from "http";
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

const getAllPeminjamanRuangan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Kita cek apakah user authorized
    const getUser = req.user;
    if (!getUser) {
        throw new AppError('User not authorized', 401);
    }

    const { id, ruangan_id, user_id, jam_mulai, jam_selesai, status, kegiatan, tanggal, dokumen, createdAt, updatedAt, responded_by, responden } = req.query;
    try {
        const peminjamanRuanganListWithRole = await prisma.peminjaman_Ruangan.findMany({
            orderBy: { id: 'asc' },
            include: {
                accepted_by: {
                    include: {
                        role: true // ambil relasi role dari user
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
                    role: pr.accepted_by.role?.nama_role, // ambil nama_role sebagai string
                }
                : null,
            user: pr.user
                ? {
                    id: pr.user.id,
                    nama: pr.user.nama,
                    email: pr.user.email,
                    NIM: pr.user.NIM,
                    NIP: pr.user.NIP,
                    role: pr.user.role?.nama_role // ambil nama_role sebagai string
                }
                : null
        }));
        // query params filtering
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

        res.status(200).json({
            status: 'success',
            message: 'List of peminjaman ruangan retrieved successfully',
            data: filteredResult
        });
    } catch (error) {
        throw new AppError(`Failed to retrieve peminjaman ruangan, error: ${error}`, 500);
    } finally {
        await prisma.$disconnect();
    }
});

const getDetailPeminjamanRuangan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const peminjamanRuanganId = parseInt(req.params.id);
    const getUser = req.user;
    if (!getUser) {
        throw new AppError('User not authorized', 401);
    }
    try {
        const pr = await prisma.peminjaman_Ruangan.findUnique({
            where: {
                id: peminjamanRuanganId
            },
            include: {
                accepted_by: {
                    include: {
                        role: true
                    }
                },
                user: {
                    include: {
                        role: true // <-- Add this line
                    }
                }
            }
        });
        if (!pr) {
            throw new AppError(`Peminjaman ruangan with id ${peminjamanRuanganId} not found`, 404);
        }
        const result: ListPengajuanPeminjamanRuanganResponse = {
            id: pr.id,
            ruangan_id: pr.ruangan_id,
            user_id: pr.user_id,
            jam_mulai: pr.jam_mulai ?? new Date(0),
            jam_selesai: pr.jam_selesai ?? new Date(0),
            status: pr.status as unknown as PeminjamanRuanganStatus,
            kegiatan: pr.kegiatan ?? 'Kuliah',
            tanggal: pr.tanggal ?? new Date(0),
            dokumen: pr.dokumen,
            createdAt: pr.createdAt,
            updatedAt: pr.updatedAt,
            responded_by: pr.accepted_by_id,
            responden: pr.accepted_by
                ? {
                    id: pr.accepted_by.id,
                    email: pr.accepted_by.email,
                    nama: pr.accepted_by.nama,
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
        };
        res.status(200).json({
            status: 'success',
            message: 'Detail peminjaman ruangan retrieved successfully',
            data: result
        });
    } catch (error) {
        throw new AppError(`Failed to retrieve peminjaman ruangan detail, error: ${error}`, 500);
    } finally {
        await prisma.$disconnect();
    }
});

const verifikasiAjuanPeminjamanRuangan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Authorization
    const getUser = req.user;
    if (!getUser) {
        throw new AppError('User not authorized', 401);
    }
    console.log("User details:", getUser);
    // Params
    const peminjamanRuanganId = parseInt(req.params.id);
    if (isNaN(peminjamanRuanganId)) {
        throw new AppError('Invalid peminjaman ruangan ID', 400);
    }

    // Verifikasi Logic
    try {
        const { status }: { status: PeminjamanRuanganStatus } = req.body;

        // Ambil data peminjaman ruangan dari database
        const peminjamanRuangan = await prisma.peminjaman_Ruangan.findUnique({
            where: { id: peminjamanRuanganId }
        });

        if (!peminjamanRuangan) {
            throw new AppError('Peminjaman ruangan not found', 404);
        }

        // Jika pengajuannya sudah di setujui atau ditolak maka tidak bisa di verifikasi ulang
        if (
            peminjamanRuangan.status === PeminjamanRuanganStatus.DISETUJUI ||
            peminjamanRuangan.status === PeminjamanRuanganStatus.DITOLAK
        ) {
            throw new AppError('Peminjaman ruangan sudah di verifikasi', 400);
        }

        // Update status peminjaman ruangan
        const updatedPeminjamanRuangan = await prisma.peminjaman_Ruangan.update({
            where: { id: peminjamanRuanganId },
            data: {
                status: status,
                accepted_by_id: getUser.id,
                updatedAt: new Date()
            }
        });

        await prisma.ruangan.update({
            where: {
                id: peminjamanRuangan.ruangan_id
            },
            data: {
                status: StatusRuangan.DIPAKAI
            }
        });
        // Ambil data ruangan dan user pengaju untuk log
        const ruangan = await prisma.ruangan.findUnique({
            where: { id: peminjamanRuangan.ruangan_id }
        });
        const pengaju = await prisma.user.findUnique({
            where: { id: peminjamanRuangan.user_id }
        });

        const kodeRuangan = ruangan?.kode_ruangan ?? '';
        const pengajuNIM = pengaju?.NIM ?? '';
        const pengajuNama = pengaju?.nama ?? '';
        const verifikatorNama = getUser.nama ?? '';

        await logActivity({
            user_id: getUser.id,
            pesan: `Pengajuan ruangan ${kodeRuangan} yang diajukan ${pengajuNIM} - ${pengajuNama} disetujui oleh ${verifikatorNama}`,
            aksi: 'PENGAJUAN RUANGAN',
            tabel_terkait: 'Peminjaman_Ruangan'
        });
        res.status(200).json({
            status: 'success',
            message: 'Peminjaman ruangan verified successfully',
            data: updatedPeminjamanRuangan
        });

    } catch (error) {
        throw new AppError(`Failed to verify peminjaman ruangan, error: ${error}`, 500);
    } finally {
        await prisma.$disconnect();
    }
});
const verifikasiPeminjamanRuanganController = {
    getAllPeminjamanRuangan,
    getDetailPeminjamanRuangan,
    verifikasiAjuanPeminjamanRuangan
}

export default verifikasiPeminjamanRuanganController;