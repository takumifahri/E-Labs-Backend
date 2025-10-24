import { Request, Response } from "express";
import { PrismaClient, StatusPeminjamanHandset, StatusPeminjamanItem } from "@prisma/client";
import { AppError, asyncHandler } from "../../../../../middleware/error";
import { VerifikasiRequest, VerifikasiPeminjamanResponse, VerifikasiPeminjamanRequest, VerifikasiPeminjamanItemRequest, GetAllPengajuan } from "../../../../../models/verifikasi-peminjaman";
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

const getAllPengajuan = asyncHandler(async (req: Request, res: Response) => {
    const { id, kode_peminjaman, pengaju, status, tgl_pinjam, dalam_rangka, dokumen, item } = req.query;
    const pengajuan = await prisma.peminjaman_Handset.findMany({
        where: {
            ...(id && { id: Number(id) }),
            ...(kode_peminjaman && typeof kode_peminjaman === "string" && { kode_peminjaman: { contains: kode_peminjaman } }),
            ...(pengaju && { pengaju: Number(pengaju) }),
            ...(status && { status: status as StatusPeminjamanHandset }),
        },
        include: {
            peminjaman_items: {
                include: {
                    barang: true
                }
            }
        }
    });

    if (!pengajuan || pengajuan.length < 0) {
        throw new AppError("No pengajuan found", 404);
    }

    const responses: GetAllPengajuan[] = await Promise.all(pengajuan.map(async p => {
        const pengajuData = await prisma.user.findUnique({
            where: { id: p.user_id },
            select: {
                id: true,
                NIM: true,
                nama: true,
                email: true,
                role: {
                    select: {
                        nama_role: true
                    }
                }
            }
        });
        const respondedBy = await prisma.user.findUnique({
            where: { id: p.accepted_by_id || 0 },
            select: {
                nama: true
            }
        });
        if (!pengajuData) {
            throw new AppError(`User with id ${p.user_id} not found`, 404);
        }

        // Hitung status berdasarkan item status
        const approvedItems = p.peminjaman_items.filter(item => item.status === StatusPeminjamanItem.DIPINJAM);
        const rejectedItems = p.peminjaman_items.filter(item => item.status === StatusPeminjamanItem.DITOLAK);
        const pendingItems = p.peminjaman_items.filter(item => item.status === StatusPeminjamanItem.DIAJUKAN);
        
        let finalStatus: StatusPeminjamanHandset;
        if (pendingItems.length > 0) {
            finalStatus = StatusPeminjamanHandset.DIAJUKAN;
        } else if (approvedItems.length > 0 && rejectedItems.length === 0) {
            finalStatus = StatusPeminjamanHandset.DISETUJUI;
        } else if (rejectedItems.length > 0 && approvedItems.length === 0) {
            finalStatus = StatusPeminjamanHandset.DITOLAK;
        } else if (approvedItems.length > 0 && rejectedItems.length > 0) {
            finalStatus = StatusPeminjamanHandset.SEBAGIAN_DISETUJUI; // New status for mixed cases
        } else {
            finalStatus = p.status; // fallback to original status
        }

        return {
            id: p.id,
            kode_peminjaman: p.kode_peminjaman,
            pengaju: pengajuData,
            status: finalStatus,
            tgl_pinjam: p.tanggal_pinjam,
            dalam_rangka: p.kegiatan || '',
            dokumen: p.dokumen || '',
            respon_by: respondedBy?.nama || 'PENDING',
            item: p.peminjaman_items.map(item => {
            // Hitung estimasi hari
            let estimasiHari = '';
            if (item.jam_pinjam && item.estimasi_pinjam) {
                const msPerDay = 1000 * 60 * 60 * 24;
                const diffMs = item.estimasi_pinjam.getTime() - item.jam_pinjam.getTime();
                const days = Math.ceil(diffMs / msPerDay);
                estimasiHari = `${days} hari`;
            }
            return {
                id: item.id,
                barang: item.barang,
                jumlah_yang_dipinjam: item.jumlah,
                jam_dipinjam: item.jam_pinjam,
                estimasi_hari: estimasiHari,
                status: item.status
            };
            }),
            // Fix Detail_Barang to match BarangDetailResponseVerfikasi structure
            Detail_Barang: {
            Yang_Disetujui: p.peminjaman_items
                .filter(item => item.status === StatusPeminjamanItem.DIPINJAM)
                .map(item => ({
                id: item.id,
                barang: item.barang,
                jumlah: item.jumlah,
                kondisi_pinjam: item.barang.kondisi || ''
                }))[0] || null, // Take first item or null if empty
            Yang_Ditolak: p.peminjaman_items
                .filter(item => item.status === StatusPeminjamanItem.DITOLAK)
                .map(item => ({
                id: item.id,
                barang: item.barang,
                jumlah: item.jumlah,
                kondisi_pinjam: item.barang.kondisi || ''
                }))[0] || 'Tidak Ada' // Take first item or null if empty
            }
        };
    }));


    res.status(200).json({
        message: "Pengajuan retrieved successfully",
        data: responses
    });
});

const verifikasiPeminjamanHandset = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, items, catatan } = req.body;

    if (!id) {
        throw new AppError("ID peminjaman handset is required", 400);
    }

    // Validasi: Harus ada status global ATAU items untuk per-item verification
    if (!status && (!items || !Array.isArray(items) || items.length === 0)) {
        throw new AppError("Status global atau items untuk verifikasi per-item is required", 400);
    }

    // Validasi status global jika ada
    if (status && !Object.values(StatusPeminjamanHandset).includes(status)) {
        throw new AppError(`Status tidak valid. Pilihan: ${Object.values(StatusPeminjamanHandset).join(', ')}`, 400);
    }

    // Validasi items jika ada
    if (items) {
        for (const item of items) {
            if (!item.id || !item.status) {
                throw new AppError("Setiap item harus memiliki id dan status", 400);
            }
            if (!Object.values(StatusPeminjamanItem).includes(item.status)) {
                throw new AppError(`Status item tidak valid. Pilihan: ${Object.values(StatusPeminjamanItem).join(', ')}`, 400);
            }
        }
    }

    // Cari user dari JWT token
    const findUser = await prisma.user.findUnique({
        where: { email: req.user?.email }
    });

    if (!findUser) {
        throw new AppError("User not found", 404);
    }

    console.log("Found user in DB:", findUser.id);

    // Cek apakah peminjaman ada
    const existingPeminjaman = await prisma.peminjaman_Handset.findUnique({
        where: { id: Number(id) },
        include: {
            peminjaman_items: true
        }
    });

    if (!existingPeminjaman) {
        throw new AppError("Peminjaman not found", 404);
    }

    let updatedItems: any[] = [];
    let headerStatus: StatusPeminjamanHandset;

    if (items && items.length > 0) {
        // MODE: Per-item verification
        console.log("Processing per-item verification...");

        // Update setiap item sesuai dengan status yang diberikan
        for (const itemUpdate of items) {
            await prisma.peminjaman_Item.update({
                where: { 
                    id: itemUpdate.id,
                    peminjaman_handset_id: Number(id) // Pastikan item belong to peminjaman ini
                },
                data: { 
                    status: itemUpdate.status,
                    accepted_by_id: findUser.id,
                }
            });
        }

        // Ambil semua items terbaru untuk menentukan status header
        const allItems = await prisma.peminjaman_Item.findMany({
            where: { peminjaman_handset_id: Number(id) }
        });

        updatedItems = allItems;

        // Tentukan status header berdasarkan status items
        const approvedItems = allItems.filter(item => item.status === StatusPeminjamanItem.DIPINJAM);
        const rejectedItems = allItems.filter(item => item.status === StatusPeminjamanItem.DITOLAK);
        const pendingItems = allItems.filter(item => item.status === StatusPeminjamanItem.DIAJUKAN);

        if (pendingItems.length > 0) {
            headerStatus = StatusPeminjamanHandset.DIAJUKAN;
        } else if (approvedItems.length > 0 && rejectedItems.length === 0) {
            headerStatus = StatusPeminjamanHandset.DISETUJUI;
        } else if (rejectedItems.length > 0 && approvedItems.length === 0) {
            headerStatus = StatusPeminjamanHandset.DITOLAK;
        } else {
            // Mixed: ada yang approved dan rejected
            headerStatus = StatusPeminjamanHandset.DIAJUKAN; // Tambahkan enum ini jika perlu
        }

    } else {
        // MODE: Bulk verification (semua items dengan status yang sama)
        console.log("Processing bulk verification...");

        headerStatus = status;

        // Map StatusPeminjamanHandset to StatusPeminjamanItem
        let itemStatus: StatusPeminjamanItem;
        switch (status) {
            case StatusPeminjamanHandset.DISETUJUI:
                itemStatus = StatusPeminjamanItem.DIPINJAM;
                break;
            case StatusPeminjamanHandset.DITOLAK:
                itemStatus = StatusPeminjamanItem.DITOLAK;
                break;
            default:
                itemStatus = StatusPeminjamanItem.DITOLAK;
        }

        // Update semua item dengan status yang sama
        await prisma.peminjaman_Item.updateMany({
            where: { peminjaman_handset_id: Number(id) },
            data: { 
                status: itemStatus, 
                accepted_by_id: findUser.id,
            }
        });

        // Ambil data items terbaru
        updatedItems = await prisma.peminjaman_Item.findMany({
            where: { peminjaman_handset_id: Number(id) }
        });
    }

    // Update status header
    const peminjamanHeader = await prisma.peminjaman_Handset.update({
        where: { id: Number(id) },
        data: { 
            status: headerStatus, 
            accepted_by_id: findUser.id,
        }
    });

    // Response
    const responses: VerifikasiPeminjamanResponse = {
        id: peminjamanHeader.id,
        id_peminjaman: peminjamanHeader.id,
        status: headerStatus as unknown as StatusPeminjamanItem,
        item: updatedItems.map(item => ({
            id: item.id,
            status: item.status,
            catatan: item.catatan
        }))
    };

    res.status(200).json({
        message: "Peminjaman handset verified successfully",
        data: responses
    });
});



const VerifikasiController = {
    getAllPengajuan,
    verifikasiPeminjamanHandset
};

export default VerifikasiController;