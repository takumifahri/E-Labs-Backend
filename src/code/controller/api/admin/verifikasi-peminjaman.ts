import { Request, Response } from "express";
import { PrismaClient, StatusPeminjamanHandset, StatusPeminjamanItem } from "@prisma/client";
import { AppError, asyncHandler } from "../../../middleware/error";
import { VerifikasiRequest, VerifikasiPeminjamanResponse, VerifikasiPeminjamanRequest, VerifikasiPeminjamanItemRequest, GetAllPengajuan } from "../../../models/verifikasi-peminjaman";
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
    const responses: GetAllPengajuan[] = pengajuan.map(p => ({
        id: p.id,
        kode_peminjaman: p.kode_peminjaman,
        pengaju: p.user_id,
        status: p.status as unknown as StatusPeminjamanHandset,
        tgl_pinjam: p.tanggal_pinjam,
        dalam_rangka: p.kegiatan || '',
        dokumen: p.dokumen || '',
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
                jam_kembali: item.estimasi_pinjam,
                estimasi_kembali: estimasiHari,
                status: item.status as unknown as StatusPeminjamanItem
            };
        })
    }));
    
    res.status(200).json({
        message: "Pengajuan retrieved successfully",
        data: responses
    });
});

const verifikasiPeminjamanHandset = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body; // Ambil langsung dari body

    if (!id) {
        throw new AppError("ID peminjaman handset is required", 400);
    }
    if (!status) {
        throw new AppError("Status is required", 400);
    }

    // Validasi status agar sesuai enum
    if (!Object.values(StatusPeminjamanHandset).includes(status)) {
        throw new AppError(`Status tidak valid. Pilihan: ${Object.values(StatusPeminjamanHandset).join(', ')}`, 400);
    }

    // Update status di header
    const peminjamanHeader = await prisma.peminjaman_Handset.update({
        where: { id: Number(id) },
        data: { status }
    });

    // Map StatusPeminjamanHandset to StatusPeminjamanItem if needed
    let itemStatus: StatusPeminjamanItem;
    switch (status) {
        case StatusPeminjamanHandset.DISETUJUI:
            itemStatus = StatusPeminjamanItem.DIPINJAM;
            break;
        case StatusPeminjamanHandset.DITOLAK:
            itemStatus = StatusPeminjamanItem.DIAJUKAN;
            break;
        default:
            itemStatus = StatusPeminjamanItem.DIPINJAM;
    }

    // Update semua item terkait dengan status yang sama
    await prisma.peminjaman_Item.updateMany({
        where: { peminjaman_handset_id: Number(id) },
        data: { status: itemStatus }
    });

    // Ambil data item terbaru
    const updatedItems = await prisma.peminjaman_Item.findMany({
        where: { peminjaman_handset_id: Number(id) }
    });

    const responses: VerifikasiPeminjamanResponse = {
        id: peminjamanHeader.id,
        id_peminjaman: peminjamanHeader.id,
        status: status as StatusPeminjamanItem,
        item: updatedItems.map(item => ({
            id: item.id,
            status: item.status
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