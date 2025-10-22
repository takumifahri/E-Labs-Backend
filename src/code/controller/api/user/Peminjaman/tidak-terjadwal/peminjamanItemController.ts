import { Request, Response, NextFunction } from "express";    
import { PrismaClient } from "@prisma/client";
import { asyncHandler, AppError } from "../../../../../middleware/error";
import { PeminjamanHeaderStatus, PeminjamanItemStatus, PeminjamanHeaderItemTidakTerjadwal, AjuanPeminjamanItemRequestTidakTerjawal } from "../../../../../models/peminjaman";

// Fixed Prisma configuration with proper error handling
const prisma = new PrismaClient({
    datasources: {
        db: {
            // Use DATABASE_URL instead of LOCAL_DATABASE_URL for better compatibility
            url: process.env.DATABASE_URL || process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty'
});


// Tidak Terjadwal, Dia tidak harus login & tidak harus dokumen
const AjuanPeminjamanItemTidakTerjadwal = asyncHandler(async (req: Request, res: Response) => {
    if (!req.body) {
        throw new AppError("Request body is required", 400);
    }
    
    const { NIM, tanggal_pinjam, tanggal_kembali, keperluan, estimasi_pinjam, items }: PeminjamanHeaderItemTidakTerjadwal = req.body;

    // Enhanced validation
    if (!NIM?.trim()) {
        throw new AppError("NIM is required and cannot be empty", 400);
    }
    if (!tanggal_pinjam) {
        throw new AppError("tanggal_pinjam is required", 400);
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new AppError("items array is required and cannot be empty", 400);
    }

    try {
        // Cari user berdasarkan NIM dengan better error handling
        const getUserId = await prisma.user.findFirst({
            where: { 
                NIM: NIM.trim(),
                deletedAt: null,
            },
            select: { id: true, nama: true, NIM: true }
        });
        
        if (!getUserId) {
            throw new AppError(`User dengan NIM ${NIM} tidak ditemukan atau tidak aktif`, 404);
        }
        
        const user_id = getUserId.id;

        // Generate kode peminjaman with better format
        const dateStr = new Date(tanggal_pinjam).toISOString().slice(0, 10).replace(/-/g, "");
        const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, "");
        const kode_peminjaman = `PMJ-${dateStr}-${timeStr}`;

        const result = await prisma.$transaction(async (prismaTransaction) => {
            // Validasi barang dengan improved error handling
            const barangValidations = await Promise.all(
                items.map(async (item, index) => {
                    // Type conversion
                    if (typeof item.barang_id === 'string') {
                        item.barang_id = parseInt(item.barang_id, 10);
                    }
                    
                    if (!item.barang_id || isNaN(item.barang_id)) {
                        throw new AppError(`Invalid barang_id: ${item.barang_id} at item index ${index}`, 400);
                    }

                    const barang = await prismaTransaction.barang.findFirst({
                        where: { 
                            id: item.barang_id,
                            deletedAt: null
                        }
                    });
                    
                    if (!barang) {
                        throw new AppError(`Barang dengan ID ${item.barang_id} tidak ditemukan atau telah dihapus`, 404);
                    }

                    const requestedQuantity = item.jumlah && !isNaN(Number(item.jumlah)) ? Number(item.jumlah) : 1;
                    
                    if (requestedQuantity < 1) {
                        throw new AppError(`Jumlah barang harus minimal 1 untuk item ${barang.nama_barang}`, 400);
                    }
                    
                    if (barang.jumlah < requestedQuantity) {
                        throw new AppError(`Stok barang ${barang.nama_barang} tidak cukup. Tersedia: ${barang.jumlah}, Diminta: ${requestedQuantity}`, 400);
                    }

                    // Check if item is available for borrowing
                    if (barang.status !== 'Tersedia') {
                        throw new AppError(`Barang ${barang.nama_barang} sedang tidak tersedia untuk dipinjam`, 400);
                    }
                    
                    return { item: { ...item, jumlah: requestedQuantity }, barang };
                })
            );

            // Create header peminjaman
            const peminjamanHeader = await prismaTransaction.peminjaman_Handset.create({
                data: {
                    kode_peminjaman,
                    user_id,
                    tanggal_pinjam: new Date(tanggal_pinjam),
                    tanggal_kembali: tanggal_kembali ? new Date(tanggal_kembali) : null,
                    kegiatan: keperluan?.trim() || "Kuliah",
                    barang_id: barangValidations[0].item.barang_id,
                    status: PeminjamanHeaderStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            });

            // Create item peminjaman
            const created_items = await Promise.all(
                barangValidations.map(async ({ item }, index) => {
                    return await prismaTransaction.peminjaman_Item.create({
                        data: {
                            user_id,
                            barang_id: item.barang_id,
                            jumlah: item.jumlah,
                            estimasi_pinjam: item.estimasi_pinjam ? new Date(item.estimasi_pinjam) : new Date(estimasi_pinjam || tanggal_pinjam),
                            jam_pinjam: item.jam_pinjam ? new Date(item.jam_pinjam) : new Date(),
                            jam_kembali: item.jam_kembali ? new Date(item.jam_kembali) : null,
                            kode_peminjaman: `${kode_peminjaman}-ITEM-${String(index + 1).padStart(3, '0')}`,
                            tanggal_pinjam: new Date(tanggal_pinjam),
                            tanggal_kembali: tanggal_kembali ? new Date(tanggal_kembali) : null,
                            status: PeminjamanItemStatus.DIAJUKAN,
                            kegiatan: item.kegiatan?.trim() || keperluan?.trim() || "Kuliah",
                            peminjaman_handset_id: peminjamanHeader.id
                        }
                    });
                })
            );

            // Update stok barang
            const barangUpdates = await Promise.all(
                barangValidations.map(async ({ item }) => {
                    const barang = await prismaTransaction.barang.findUnique({
                        where: { id: item.barang_id },
                        select: { id: true, jumlah: true, nama_barang: true }
                    });
                    
                    if (barang) {
                        const newJumlah = Math.max(0, barang.jumlah - item.jumlah);
                        const newStatus = newJumlah <= 0 ? 'Dipinjam' : 'Tersedia';
                        
                        return await prismaTransaction.barang.update({
                            where: { id: item.barang_id },
                            data: {
                                jumlah: newJumlah,
                                status: newStatus,
                                updatedAt: new Date()
                            }
                        });
                    }
                    return null;
                })
            );

            return { header: peminjamanHeader, items: created_items, barangUpdates: barangUpdates.filter(Boolean) };
        });

        // Success response
        res.status(201).json({
            success: true,
            message: "Peminjaman tidak terjadwal berhasil diajukan",
            data: {
                header: {
                    id: result.header.id,
                    kode_peminjaman: result.header.kode_peminjaman,
                    tanggal_pinjam: result.header.tanggal_pinjam,
                    tanggal_kembali: result.header.tanggal_kembali,
                    status: result.header.status,
                    kegiatan: result.header.kegiatan
                },
                items: result.items.map(item => ({
                    id: item.id,
                    barang_id: item.barang_id,
                    jumlah: item.jumlah,
                    kode_peminjaman: item.kode_peminjaman,
                    estimasi_pinjam: item.estimasi_pinjam,
                    jam_pinjam: item.jam_pinjam,
                    status: item.status,
                    kegiatan: item.kegiatan
                })),
                total_items: result.items.length,
                user_info: {
                    nama: getUserId.nama,
                    identifier: getUserId.NIM
                },
                processed_at: new Date().toISOString()
            }
        });

    } catch (error: any) {
        // Enhanced error handling
        if (error instanceof AppError) {
            throw error;
        }
        
        // Prisma specific errors
        if (error.code === 'P2002') {
            throw new AppError("Kode peminjaman sudah ada, silakan coba lagi", 409);
        }
        
        if (error.code === 'P2025') {
            throw new AppError("Data yang diminta tidak ditemukan", 404);
        }
        
        if (error.code === 'P6001') {
            throw new AppError("Koneksi database bermasalah, silakan coba lagi", 500);
        }
        
        console.error('❌ Unexpected error in AjuanPeminjamanItemTidakTerjadwal:', error);
        throw new AppError("Terjadi kesalahan sistem, silakan coba lagi", 500);
    }
});

const PeminjamanItemTidakTerjadwalController = {
    AjuanPeminjamanItemTidakTerjadwal
};

export default PeminjamanItemTidakTerjadwalController;