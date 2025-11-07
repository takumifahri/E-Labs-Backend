import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../../../middleware/error";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});


const peminjamanCache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL = Math.floor(Math.random() * 6 + 10) * 1000; // 10-15 detik

function setCache(key: string, data: any, ttl: number = CACHE_TTL) {
    peminjamanCache.set(key, { data, expiry: Date.now() + ttl });
}

function getCache(key: string) {
    const cached = peminjamanCache.get(key);
    if (!cached) return undefined;
    if (Date.now() > cached.expiry) {
        peminjamanCache.delete(key);
        return undefined;
    }
    return cached.data;
}

function clearPeminjamanCache() {
    peminjamanCache.clear();
}
export async function logActivity({
    user_id,
    pesan,
    aksi,
    tabel_terkait
}: {
    user_id: number,
    pesan: string,
    aksi: string,
    tabel_terkait?: string
}) {
    try {
        await prisma.log.create({
            data: { user_id, pesan, aksi, tabel_terkait }
        });
    } catch (err) {
        // Optional: log error ke logger biasa, jangan throw supaya tidak ganggu flow utama
        console.error("Failed to log activity:", err);
    }
}


// Create log (catat kegiatan)
export const createLog = asyncHandler(async (req: Request, res: Response) => {
    const { user_id, pesan, aksi, tabel_terkait } = req.body;

    if (!user_id || !pesan || !aksi) {
        return res.status(400).json({
            success: false,
            message: "user_id, pesan, dan aksi wajib diisi"
        });
    }

    const log = await prisma.log.create({
        data: {
            user_id,
            pesan,
            aksi,
            tabel_terkait
        }
    });

    res.status(201).json({
        success: true,
        message: "Log berhasil dibuat",
        data: log
    });
});

// Get all logs (bisa filter by user_id, aksi, tabel_terkait)
export const getLogs = asyncHandler(async (req: Request, res: Response) => {
    const { user_id, aksi, tabel_terkait } = req.query;
    // Buat cache key unik berdasarkan query
    const cacheKey = "peminjaman_list:" + JSON.stringify(req.query);
    const cached = getCache(cacheKey);
    if (cached) {
        return res.status(200).json(cached);
    }
    const where: any = {};
    if (user_id) where.user_id = Number(user_id);
    if (aksi) where.aksi = aksi;
    if (tabel_terkait) where.tabel_terkait = tabel_terkait;

    const logs = await prisma.log.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
            user: { select: { id: true, nama: true, email: true } }
        }
    });
    const response = {
        status: 'success',
        message: 'List of peminjaman ruangan retrieved successfully',
        data: logs
    };
    setCache(cacheKey, response);
    res.status(200).json(response);
});