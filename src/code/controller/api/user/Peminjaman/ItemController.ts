import { Response, Request, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { asyncHandler } from "../../../../middleware/error";
import { AjuanPeminjamanRequest } from "../../../../models/peminjaman";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    }
}).$extends(withAccelerate());

// Ajuan Peminjaman ITems
const AjuanPeminjamanItems = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {tanggal_pinjam, tanggal_kembali, keperluan, estimasi_pinjam, peminjam_nama, items}:AjuanPeminjamanRequest = req.body;
    const userId = req.user?.id;

    const peminjamNama = req.user?.nama ? req.user?.nama : (() => { throw new Error("User name not found") })();
    if (!userId) {
        throw new Error("User ID not found");
    }
    if (!items || items.length === 0) {
        throw new Error("Items are required");
    }

    const uniqueCode = `PMJ-${Date.now()}`;
    const ajuanPeminjaman = await prisma.peminjaman.create({
});