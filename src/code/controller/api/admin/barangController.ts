import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { AppError, asyncHandler } from "../../../middleware/error";
import { Barang, BarangRespone, KondisiBarang, StatusBarang } from "../../../models/barang";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    }
}).$extends(withAccelerate());

// In-memory cache untuk barang (L1)
const barangCache = new Map<string, any>();
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

// Helpers
const getCacheKey = (prefix: string, params?: any) => params ? `${prefix}:${JSON.stringify(params)}` : prefix;
const setCache = (key: string, data: any, ttl: number = CACHE_TTL) => {
    barangCache.set(key, { data, expiry: Date.now() + ttl });
};
const getCache = (key: string) => {
    const c = barangCache.get(key);
    if (!c) return null;
    if (Date.now() > c.expiry) { barangCache.delete(key); return null; }
    return c.data;
};
const clearCachePattern = (pattern: string) => {
    for (const k of barangCache.keys()) if (k.includes(pattern)) barangCache.delete(k);
};

// Prewarm helper (non-blocking)
const prewarmRelatedCaches = async () => {
    try {
        const popularQueries = [
            { page: 1, limit: 10 },
            { page: 1, limit: 10, status: StatusBarang.TERSEDIA },
            { page: 1, limit: 10, status: StatusBarang.DIPINJAM }
        ];

        await Promise.all(popularQueries.map(async (q) => {
            const key = getCacheKey('barang:all', q);
            if (getCache(key)) return;

            const where: any = { deletedAt: null };
            if (q.status) where.status = q.status;

            const [rows, total] = await Promise.all([
                prisma.barang.findMany({
                    where,
                    include: { kategori: { select: { id: true, nama_kategori: true } } },
                    skip: 0,
                    take: Number(q.limit || 10),
                    orderBy: { createdAt: 'desc' }
                }),
                prisma.barang.count({ where })
            ]);

            const result = {
                message: "Barang retrieved successfully",
                data: rows,
                pagination: {
                    current_page: 1,
                    total_pages: Math.ceil(total / Number(q.limit || 10)),
                    total_items: total,
                    items_per_page: Number(q.limit || 10),
                    has_next_page: total > Number(q.limit || 10),
                    has_prev_page: false
                },
                cached: false
            };

            setCache(key, result);
        }));

        const recent = await prisma.barang.findMany({
            where: { deletedAt: null },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        await Promise.all(recent.map(async (b) => {
            const key = getCacheKey('barang:detail', { id: b.id });
            if (getCache(key)) return;
            const detail = await prisma.barang.findFirst({
                where: { id: b.id, deletedAt: null },
                include: { kategori: { select: { id: true, nama_kategori: true } } }
            });
            if (detail) setCache(key, { message: "Barang retrieved successfully", data: detail, cached: false }, 10 * 60 * 1000);
        }));
    } catch (err) {
        // swallow prewarm errors
        console.error('prewarmRelatedCaches error', err);
    }
};

// Controllers

const getAllBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 10, kategori_id, status, kondisi, search } = req.query;
    const cacheKey = getCacheKey('barang:all', { page, limit, kategori_id, status, kondisi, search });

    const cached = getCache(cacheKey);
    if (cached) {
        return res.status(200).json({ ...cached, cached: true, cache_timestamp: new Date().toISOString() });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { deletedAt: null };
    if (kategori_id) where.kategori_id = Number(kategori_id);
    if (status) where.status = status as string;
    if (kondisi) where.kondisi = kondisi as string;
    if (search) where.OR = [
        { nama_barang: { contains: search as string, mode: 'insensitive' } },
        { kode_barang: { contains: search as string, mode: 'insensitive' } },
        { merek: { contains: search as string, mode: 'insensitive' } }
    ];

    const [barangs, total] = await Promise.all([
        prisma.barang.findMany({
            where,
            include: { kategori: { select: { id: true, nama_kategori: true } } },
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            cacheStrategy: { ttl: 300 } // accelerate layer
        }),
        prisma.barang.count({ where, cacheStrategy: { ttl: 300 } })
    ]);

    const totalPages = Math.ceil(total / take);
    const result = {
        message: "Barang retrieved successfully",
        data: barangs,
        pagination: {
            current_page: Number(page),
            total_pages: totalPages,
            total_items: total,
            items_per_page: take,
            has_next_page: Number(page) < totalPages,
            has_prev_page: Number(page) > 1
        },
        cached: false
    };

    setCache(cacheKey, result);
    // non-blocking prewarm related caches
    setImmediate(() => prewarmRelatedCaches());

    res.status(200).json(result);
});

const getBarangById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) throw new AppError("Invalid barang ID", 400);

    const cacheKey = getCacheKey('barang:detail', { id });
    const cached = getCache(cacheKey);
    if (cached) return res.status(200).json({ ...cached, cached: true, cache_timestamp: new Date().toISOString() });

    const barang = await prisma.barang.findFirst({
        where: { id: Number(id), deletedAt: null },
        include: { kategori: { select: { id: true, nama_kategori: true } } },
        cacheStrategy: { ttl: 600 }
    });

    if (!barang) throw new AppError("Barang not found", 404);

    const result = { message: "Barang retrieved successfully", data: barang, cached: false };
    setCache(cacheKey, result, 10 * 60 * 1000);
    // background prewarm
    setImmediate(() => prewarmRelatedCaches());

    res.status(200).json(result);
});

const createBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { kode_barang, nama_barang, merek, kondisi, jumlah, status, kategori_id } = req.body;
    if (!kode_barang || !nama_barang || !kondisi || !status || !kategori_id) throw new AppError("Required fields: kode_barang, nama_barang, kondisi, status, kategori_id", 400);

    const existing = await prisma.barang.findUnique({ where: { kode_barang } });
    if (existing) throw new AppError("Kode barang already exists", 409);

    const kategori = await prisma.kategori_Barang.findFirst({ where: { id: Number(kategori_id), deletedAt: null } });
    if (!kategori) throw new AppError("Kategori not found", 404);

    const newBarang = await prisma.barang.create({
        data: {
            kode_barang,
            nama_barang,
            merek: merek || "",
            kondisi,
            jumlah: Number(jumlah) || 0,
            status,
            kategori_id: Number(kategori_id)
        },
        include: { kategori: { select: { id: true, nama_kategori: true } } }
    });

    // invalidate in-memory list caches and optionally accelerate tags
    clearCachePattern('barang:all');
    clearCachePattern('barang:detail');

    try { await prisma.$accelerate.invalidate({ tags: ['barang', 'barang_list', `kategori_${kategori_id}`, `status_${status}`].filter(Boolean) }); } catch (e) { /* ignore accelerate failures */ }

    res.status(201).json({ message: "Barang created successfully", data: newBarang });
});

const updateBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { kode_barang, nama_barang, merek, kondisi, jumlah, status, kategori_id } = req.body;
    if (!id || isNaN(Number(id))) throw new AppError("Invalid barang ID", 400);

    const existing = await prisma.barang.findFirst({ where: { id: Number(id), deletedAt: null } });
    if (!existing) throw new AppError("Barang not found", 404);

    if (kode_barang && kode_barang !== existing.kode_barang) {
        const conflict = await prisma.barang.findUnique({ where: { kode_barang } });
        if (conflict) throw new AppError("Kode barang already exists", 409);
    }

    if (kategori_id && Number(kategori_id) !== existing.kategori_id) {
        const kategori = await prisma.kategori_Barang.findFirst({ where: { id: Number(kategori_id), deletedAt: null } });
        if (!kategori) throw new AppError("Kategori not found", 404);
    }

    const updateData: any = {};
    if (kode_barang !== undefined) updateData.kode_barang = kode_barang;
    if (nama_barang !== undefined) updateData.nama_barang = nama_barang;
    if (merek !== undefined) updateData.merek = merek;
    if (kondisi !== undefined) updateData.kondisi = kondisi;
    if (jumlah !== undefined) updateData.jumlah = Number(jumlah);
    if (status !== undefined) updateData.status = status;
    if (kategori_id !== undefined) updateData.kategori_id = Number(kategori_id);

    const updated = await prisma.barang.update({
        where: { id: Number(id) },
        data: updateData,
        include: { kategori: { select: { id: true, nama_kategori: true } } }
    });

    clearCachePattern('barang:all');
    clearCachePattern('barang:detail');
    try {
        await prisma.$accelerate.invalidate({ tags: ['barang', 'barang_list', `barang_${id}`, `kategori_${existing.kategori_id}`, `kategori_${updateData.kategori_id || existing.kategori_id}`, `status_${existing.status}`, `status_${updateData.status || existing.status}`].filter(Boolean) });
    } catch (e) { /* ignore */ }

    res.status(200).json({ message: "Barang updated successfully", data: updated });
});

const deleteBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) throw new AppError("Invalid barang ID", 400);

    const existing = await prisma.barang.findFirst({ where: { id: Number(id), deletedAt: null } });
    if (!existing) throw new AppError("Barang not found", 404);

    const active = await prisma.peminjaman_Item.findFirst({
        where: { barang_id: Number(id), status: { in: [StatusBarang.DIPINJAM, 'Pending'] as any }, deletedAt: null }
    });
    if (active) throw new AppError("Cannot delete barang that is currently borrowed or pending", 400);

    const deleted = await prisma.barang.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), status: StatusBarang.TIDAK_TERSEDIA } });

    clearCachePattern('barang:all');
    clearCachePattern('barang:detail');
    try { await prisma.$accelerate.invalidate({ tags: ['barang', 'barang_list', `barang_${id}`, `kategori_${deleted.kategori_id}`, `status_Dipinjam`, 'status_Tersedia'] }); } catch (e) { /* ignore */ }

    res.status(200).json({ message: "Barang deleted successfully", data: { id: deleted.id, kode_barang: deleted.kode_barang, nama_barang: deleted.nama_barang, deletedAt: deleted.deletedAt } });
});

const restoreBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) throw new AppError("Invalid barang ID", 400);

    const deleted = await prisma.barang.findFirst({ where: { id: Number(id), deletedAt: { not: null } } });
    if (!deleted) throw new AppError("Deleted barang not found", 404);

    const restored = await prisma.barang.update({
        where: { id: Number(id) },
        data: { deletedAt: null, status: StatusBarang.TERSEDIA },
        include: { kategori: { select: { id: true, nama_kategori: true } } }
    });

    clearCachePattern('barang:all');
    clearCachePattern('barang:detail');
    try { await prisma.$accelerate.invalidate({ tags: ['barang', 'barang_list', `barang_${id}`, `kategori_${restored.kategori_id}`, `status_Tersedia`] }); } catch (e) { /* ignore */ }

    res.status(200).json({ message: "Barang restored successfully", data: restored });
});

// Warm Cache endpoint (manual trigger)
const warmBarangCache = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    await prewarmRelatedCaches();
    const duration = Date.now() - start;
    res.status(200).json({ message: "Barang cache warmed successfully", duration_ms: duration, cache_ttl_minutes: CACHE_TTL / (60 * 1000), timestamp: new Date().toISOString() });
});

const BarangController = {
    getAllBarang,
    getBarangById,
    createBarang,
    updateBarang,
    deleteBarang,
    restoreBarang,
    warmBarangCache
};

export default BarangController;