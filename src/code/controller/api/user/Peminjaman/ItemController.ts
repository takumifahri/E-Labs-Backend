import { Response, Request, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { AppError, asyncHandler } from "../../../../middleware/error";
import { AjuanPeminjamanRequest, PeminjamanHeader, PeminjamanHeaderStatus, PeminjamanItemStatus } from "../../../../models/peminjaman";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    }
}).$extends(withAccelerate());

// Ajuan Peminjaman Items
const AjuanPeminjamanItems = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Fix: Gunakan AjuanPeminjamanRequest, bukan AjuanPeminjamanItemRequest
    const { tanggal_pinjam, tanggal_kembali, keperluan, estimasi_pinjam, items }: AjuanPeminjamanRequest = req.body;
    
    // Validation
    if (!tanggal_pinjam) {
        throw new AppError("tanggal_pinjam is required", 400);
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new AppError("items array is required and cannot be empty", 400);
    }

    const u = (req.user as any) || {};
    const tokenUniqueId = u.uniqueId || u.id;
    
    const dbUser = tokenUniqueId
        ? await prisma.user.findUnique({ where: { uniqueId: String(tokenUniqueId) } })
        : null;
        
    if (!dbUser) {
        throw new AppError("User not found in database", 401);
    }

    const userId = dbUser.id;
    const uniqueCode = `PMJ-${Date.now()}`;

    const result = await prisma.$transaction(async (prisma) => {
        // Validate all barang exist and are available
        for (const item of items) {
            if (!item.barang_id || typeof item.barang_id !== 'number') {
                throw new AppError(`Invalid barang_id: ${item.barang_id}`, 400);
            }
            
            const barang = await prisma.barang.findUnique({
                where: { id: item.barang_id }
            });
            
            if (!barang) {
                throw new AppError(`Barang with ID ${item.barang_id} not found`, 404);
            }
            if (barang.jumlah < 1) {
                throw new AppError(`Barang ${barang.nama_barang} is out of stock`, 400);
            }
            if (barang.jumlah < (item.jumlah || 1)) {
                throw new AppError(`Not enough stock for ${barang.nama_barang}. Available: ${barang.jumlah}, Requested: ${item.jumlah || 1}`, 400);
            }
            // if (barang.status !== 'Tersedia') {
            //     throw new AppError(`Barang ${barang.nama_barang} is not available (status: ${barang.status})`, 400);
            // }
        }

        // Create Peminjaman_Handset as header
        const peminjaman_header = await prisma.peminjaman_Handset.create({
            data: {
                kode_peminjaman: uniqueCode,
                tanggal_pinjam: new Date(tanggal_pinjam),
                tanggal_kembali: tanggal_kembali ? new Date(tanggal_kembali) : null,
                kegiatan: keperluan || "",
                status: PeminjamanHeaderStatus.PENDING,
                user_id: userId,
                barang_id: items[0].barang_id, // Required by schema
            }
        });

        // Create multiple Peminjaman_Item records
        const created_items = await Promise.all(
            items.map(async (item, index) => {
                return await prisma.peminjaman_Item.create({
                    data: {
                        
                        user_id: userId,
                        barang_id: item.barang_id,
                        estimasi_pinjam: item.estimasi_pinjam ? new Date(item.estimasi_pinjam) : new Date(estimasi_pinjam || tanggal_pinjam),
                        jam_pinjam: item.jam_pinjam ? new Date(item.jam_pinjam) : new Date(),
                        jam_kembali: item.jam_kembali ? new Date(item.jam_kembali) : null,
                        kode_peminjaman: `${uniqueCode}-ITEM-${index + 1}`, // Unique per item
                        tanggal_pinjam: new Date(tanggal_pinjam),
                        tanggal_kembali: tanggal_kembali ? new Date(tanggal_kembali) : null,
                        status: PeminjamanItemStatus.DIPINJAM,
                        kegiatan: item.kegiatan || keperluan || "",
                        peminjaman_handset_id: peminjaman_header.id
                    }
                });
            })
        );

        // Update barang status to 'Dipinjam' 
        for (const item of items) {
            await prisma.barang.update({
                where: { id: item.barang_id },
                data: { status: 'Dipinjam' }
            });
        }

        return { header: peminjaman_header, items: created_items };
    });

    res.status(201).json({
        message: "Peminjaman items submitted successfully",
        data: {
            header: {
                id: result.header.id,
                kode_peminjaman: result.header.kode_peminjaman,
                tanggal_pinjam: result.header.tanggal_pinjam,
                tanggal_kembali: result.header.tanggal_kembali,
                status: result.header.status,
                kegiatan: result.header.kegiatan,
            },
            items: result.items.map(item => ({
                id: item.id,
                barang_id: item.barang_id,
                kode_peminjaman: item.kode_peminjaman,
                estimasi_pinjam: item.estimasi_pinjam,
                jam_pinjam: item.jam_pinjam,
                status: item.status,
                kegiatan: item.kegiatan
            })),
            total_items: result.items.length
        }
    });
});

const PeminjamanItemController = {
    AjuanPeminjamanItems    
}

export default PeminjamanItemController;