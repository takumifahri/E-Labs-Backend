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

// Ajuan Peminjaman ITems

// Ajuan Peminjaman Items
const AjuanPeminjamanItems = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tanggal_pinjam, tanggal_kembali, keperluan, estimasi_pinjam, items }: AjuanPeminjamanRequest = req.body;
    const u = (req.user as any) || {};
    const tokenUniqueId = u.uniqueId || u.id; // token biasanya beri uniqueId
    // Ambil user nyata dari DB supaya dapat numeric id yang sesuai schema
    const dbUser = tokenUniqueId
        ? await prisma.user.findUnique({ where: { uniqueId: String(tokenUniqueId) } })
        : null;
    if (!dbUser) {
        throw new AppError("User not found in database", 401);
    }
    const userId = dbUser.id; // numeric id sesuai Prisma schema (Int)
    const peminjamNama = dbUser.nama ?? dbUser.email ?? dbUser.uniqueId;

    const uniqueCode = `PMJ-${Date.now()}`;

    // Use transaction for atomic operation
    const result = await prisma.$transaction(async (prisma) => {
        // Validate all barang exist and are available
        for (const item of items) {
            const barang = await prisma.barang.findUnique({
                where: { id: item.barang_id }
            });
            if (!barang) {
                throw new AppError(`Barang with ID ${item.barang_id} not found`, 404);
            }
            if (barang.status !== 'Tersedia') {
                throw new AppError(`Barang ${barang.nama_barang} is not available`, 400);
            }
        }

        // Create Peminjaman_Handset as header (one per transaction)
        const peminjaman_header = await prisma.peminjaman_Handset.create({
            data: {
                kode_peminjaman: uniqueCode,
                tanggal_pinjam: new Date(tanggal_pinjam),
                tanggal_kembali: tanggal_kembali ? new Date(tanggal_kembali) : null,
                kegiatan: keperluan || "",
                status: PeminjamanHeaderStatus.PENDING,
                user_id: userId,
                barang_id: items[0].barang_id, // Required by schema - use first item's barang
            }
        });

        // Create multiple Peminjaman_Item records linked to the header
        const created_items = await Promise.all(
            items.map(async (item) => {
                return await prisma.peminjaman_Item.create({
                    data: {
                        user_id: userId,
                        barang_id: item.barang_id,
                        estimasi_pinjam: item.estimasi_pinjam ? new Date(item.estimasi_pinjam) : new Date(estimasi_pinjam || tanggal_pinjam),
                        jam_pinjam: item.jam_pinjam ? new Date(item.jam_pinjam) : new Date(),
                        jam_kembali: item.jam_kembali ? new Date(item.jam_kembali) : null,
                        kode_peminjaman: `${uniqueCode}-${item.barang_id}`, // Unique per item
                        tanggal_pinjam: new Date(tanggal_pinjam),
                        tanggal_kembali: tanggal_kembali ? new Date(tanggal_kembali) : null,
                        status: PeminjamanItemStatus.DIPINJAM,
                        kegiatan: item.kegiatan || keperluan || "",
                        peminjaman_handset_id: peminjaman_header.id // Link to header
                    }
                });
            })
        );

        // Update barang status to 'Dipinjam'
        await Promise.all(
            items.map(async (item) => {
                return await prisma.barang.update({
                    where: { id: item.barang_id },
                    data: { status: 'Dipinjam' }
                });
            })
        );

        return { header: peminjaman_header, items: created_items };
    });

    // Return success response
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