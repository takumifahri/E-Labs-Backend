import { Request, Response } from "express";
import { CreateRuanganRequest, UpdateRuanganRequest } from "../../../models/Ruangan";
import { PrismaClient } from '@prisma/client';
import { AppError, asyncHandler } from '../../../middleware/error';
import QRCode from "qrcode";
import { FileHandler, UploadCategory } from '../../../utils/FileHandler'; // sesuaikan path
import fs from 'fs';
import path from 'path';
// Remove Accelerate, use local database only
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

// Enhanced In-memory cache system for Ruangan
const ruanganCache = new Map<string, any>();
const gedungCache = new Map<string, any>();
const ruanganStatsCache = new Map<string, any>();

// Cache configuration
const CACHE_CONFIG = {
    DEFAULT_TTL: 10 * 60 * 1000,       // 10 minutes (ruangan data changes less frequently)
    DETAIL_TTL: 15 * 60 * 1000,        // 15 minutes for details
    GEDUNG_TTL: 30 * 60 * 1000,        // 30 minutes for building list
    STATS_TTL: 5 * 60 * 1000,          // 5 minutes for stats
    MAX_CACHE_SIZE: 500                // Smaller cache for ruangan
};

// Cache helpers
const getCacheKey = (prefix: string, params?: any) =>
    params ? `${prefix}:${JSON.stringify(params)}` : prefix;

const setCache = (cache: Map<string, any>, key: string, data: any, ttl: number = CACHE_CONFIG.DEFAULT_TTL) => {
    // LRU-like behavior
    if (cache.size >= CACHE_CONFIG.MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
            cache.delete(firstKey);
        }
    }

    cache.set(key, {
        data,
        expiry: Date.now() + ttl,
        hits: 0,
        created: Date.now()
    });
};

const getCache = (cache: Map<string, any>, key: string) => {
    const cached = cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
        cache.delete(key);
        return null;
    }

    // Track cache hits
    cached.hits += 1;
    return cached.data;
};

const clearCachePattern = (cache: Map<string, any>, pattern: string) => {
    for (const key of cache.keys()) {
        if (key.includes(pattern)) {
            cache.delete(key);
        }
    }
};

const clearAllRuanganCaches = () => {
    clearCachePattern(ruanganCache, 'ruangan');
    clearCachePattern(ruanganStatsCache, 'stats');
    // Keep gedung cache as it changes very rarely
};

// Database query optimization
const optimizedRuanganQuery = {
    select: {
        id: true,
        gedung: true,
        nama_ruangan: true,
        kode_ruangan: true,
        status: true,
        QR_Image: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true
    }
};

const buildWhereClause = (filters: any) => {
    const where: any = { deletedAt: null };

    if (filters.gedung) where.gedung = filters.gedung;
    if (filters.nama_ruangan) where.nama_ruangan = {
        contains: filters.nama_ruangan,
        mode: 'insensitive'
    };
    if (filters.kode_ruangan) where.kode_ruangan = filters.kode_ruangan;

    return where;
};

// Background cache prewarming for ruangan
const prewarmRuanganCaches = async () => {
    try {
        console.log('🏢 Starting ruangan cache prewarm...');
        const start = Date.now();

        // Prewarm popular ruangan queries
        const popularQueries = [
            {}, // All ruangan
            { gedung: 'A' },
            { gedung: 'B' },
            { gedung: 'C' }
        ];

        await Promise.all(popularQueries.map(async (query) => {
            const cacheKey = getCacheKey('ruangan:list', query);
            if (getCache(ruanganCache, cacheKey)) return;

            const where = buildWhereClause(query);
            const ruangans = await prisma.ruangan.findMany({
                where,
                ...optimizedRuanganQuery,
                orderBy: { createdAt: 'desc' }
            });

            const result = {
                message: "Ruangan retrieved successfully",
                data: ruangans,
                count: ruangans.length,
                cached: false
            };

            setCache(ruanganCache, cacheKey, result);
        }));

        // Prewarm gedung list
        const gedungCacheKey = 'gedung:list';
        if (!getCache(gedungCache, gedungCacheKey)) {
            const buildings = await prisma.ruangan.groupBy({
                by: ['gedung'],
                where: { deletedAt: null },
                _count: { id: true },
                orderBy: { gedung: 'asc' }
            });

            setCache(gedungCache, gedungCacheKey, buildings, CACHE_CONFIG.GEDUNG_TTL);
        }

        // Prewarm ruangan statistics
        const statsCacheKey = 'stats:ruangan';
        if (!getCache(ruanganStatsCache, statsCacheKey)) {
            const [
                totalRuangan,
                byGedung,
                recentlyAdded
            ] = await Promise.all([
                prisma.ruangan.count({ where: { deletedAt: null } }),
                prisma.ruangan.groupBy({
                    by: ['gedung'],
                    where: { deletedAt: null },
                    _count: { id: true }
                }),
                prisma.ruangan.findMany({
                    where: { deletedAt: null },
                    ...optimizedRuanganQuery,
                    orderBy: { createdAt: 'desc' },
                    take: 5
                })
            ]);

            const stats = {
                total: totalRuangan,
                by_gedung: byGedung,
                recently_added: recentlyAdded
            };

            setCache(ruanganStatsCache, statsCacheKey, stats, CACHE_CONFIG.STATS_TTL);
        }

        // Prewarm recent ruangan details
        const recentRuangan = await prisma.ruangan.findMany({
            where: { deletedAt: null },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        await Promise.all(recentRuangan.map(async (ruangan) => {
            const detailKey = getCacheKey('ruangan:detail', { id: ruangan.id });
            if (getCache(ruanganCache, detailKey)) return;

            const detail = await prisma.ruangan.findUnique({
                where: { id: ruangan.id },
                ...optimizedRuanganQuery
            });

            if (detail && !detail.deletedAt) {
                const result = {
                    message: "Ruangan retrieved successfully",
                    data: detail,
                    cached: false
                };
                setCache(ruanganCache, detailKey, result, CACHE_CONFIG.DETAIL_TTL);
            }
        }));

        const duration = Date.now() - start;
        console.log(`✅ Ruangan cache prewarm completed in ${duration}ms`);
        console.log(`🏢 Cache stats: Ruangan=${ruanganCache.size}, Gedung=${gedungCache.size}, Stats=${ruanganStatsCache.size}`);

    } catch (error) {
        console.error('❌ Ruangan cache prewarm error:', error);
    }
};

// Controllers
const CreateRuangan = asyncHandler(async (req: Request, res: Response) => {
    const { gedung, nama_ruangan, kode_ruangan }: CreateRuanganRequest = req.body;

    if (!gedung || !nama_ruangan || !kode_ruangan) {
        throw new AppError("Gedung, nama ruangan, and kode ruangan are required", 400);
    }

    // Check if kode_ruangan already exists (use cache for recent checks)
    const checkCacheKey = getCacheKey('ruangan:check', { kode_ruangan });
    let existingRuangan = getCache(ruanganCache, checkCacheKey);

    if (!existingRuangan) {
        existingRuangan = await prisma.ruangan.findFirst({
            where: {
                kode_ruangan: kode_ruangan,
                deletedAt: null
            },
            select: { id: true, kode_ruangan: true }
        });

        // Cache the check result for a short time
        setCache(ruanganCache, checkCacheKey, existingRuangan, 60 * 1000); // 1 minute
    }

    if (existingRuangan) {
        throw new AppError(`Ruangan with code '${kode_ruangan}' already exists`, 409);
    }

    const addRuangan = await prisma.ruangan.create({
        data: {
            gedung,
            nama_ruangan,
            kode_ruangan,
            createdAt: new Date(),
        },
        ...optimizedRuanganQuery
    });

    // Clear all related caches
    clearAllRuanganCaches();

    // Trigger background cache refresh
    setImmediate(() => prewarmRuanganCaches());

    return res.status(201).json({
        message: "Ruangan created successfully",
        data: addRuangan,
        cache_cleared: true
    });
});
const GetRuanganMaster = asyncHandler(async (req: Request, res: Response) => {
    const { gedung, nama_ruangan, kode_ruangan, status } = req.query;
    const filters: any = { gedung, nama_ruangan, kode_ruangan, status };
    if (status !== undefined) filters.status = status;

    const cacheKey = getCacheKey('ruangan:list', filters);

    // Try cache first
    const cached = getCache(ruanganCache, cacheKey);
    if (cached) {
        // Add QR_Image URL for each ruangan (just /ruangan/filename)
        const dataWithUrls = cached.data.map((item: any) => ({
            ...item,
            QR_Image_url: item.QR_Image ? `ruangan/${item.QR_Image}` : null
        }));

        return res.status(200).json({
            status: "success",
            ...cached,
            data: dataWithUrls,
            cached: true,
            cache_timestamp: new Date().toISOString(),
            cache_hits: ruanganCache.get(cacheKey)?.hits || 0
        });
    }

    // Build where clause with status filter
    const where = buildWhereClause(filters);

    if (filters.status !== undefined) {
        where.status = filters.status;
    }

    // Ambil semua ruangan tanpa pagination
    const ruangans = await prisma.ruangan.findMany({
        where,
        ...optimizedRuanganQuery,
        orderBy: { createdAt: 'asc' }
    });

    // Tambahkan QR_Image_url pada setiap ruangan (just /ruangan/filename)
    const ruangansWithUrls = ruangans.map(r => ({
        ...r,
        QR_Image_url: r.QR_Image ? `ruangan/${r.QR_Image}` : null
    }));

    const result = {
        status: "success",
        message: "Ruangan retrieved successfully",
        data: ruangansWithUrls,
        count: ruangansWithUrls.length,
        cached: false
    };

    // Cache the result (cache original data, not with URLs)
    setCache(ruanganCache, cacheKey, {
        ...result,
        data: ruangans
    });

    // Background prewarm if cache is not full
    if (ruanganCache.size < CACHE_CONFIG.MAX_CACHE_SIZE) {
        setImmediate(() => prewarmRuanganCaches());
    }

    return res.status(200).json(result);
});

const GetRuanganById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
        throw new AppError("Valid ruangan ID is required", 400);
    }

    const cacheKey = getCacheKey('ruangan:detail', { id: parseInt(id) });
    const cached = getCache(ruanganCache, cacheKey);

    if (cached) {
        return res.status(200).json({
            ...cached,
            cached: true,
            cache_timestamp: new Date().toISOString(),
            cache_hits: ruanganCache.get(cacheKey)?.hits || 0
        });
    }

    const ruangan = await prisma.ruangan.findUnique({
        where: {
            id: parseInt(id)
        },
        ...optimizedRuanganQuery
    });

    if (!ruangan || ruangan.deletedAt) {
        throw new AppError("Ruangan not found", 404);
    }

    const result = {
        message: "Ruangan retrieved successfully",
        data: ruangan,
        cached: false
    };

    // Cache with longer TTL for details
    setCache(ruanganCache, cacheKey, result, CACHE_CONFIG.DETAIL_TTL);

    return res.status(200).json(result);
});

const UpdateRuangan = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { gedung, nama_ruangan, kode_ruangan }: UpdateRuanganRequest = req.body;

    if (!id || isNaN(parseInt(id))) {
        throw new AppError("Valid ruangan ID is required", 400);
    }

    // Get existing ruangan for cache invalidation
    const existing = await prisma.ruangan.findFirst({
        where: { id: parseInt(id), deletedAt: null },
        select: { id: true, gedung: true, kode_ruangan: true }
    });

    if (!existing) {
        throw new AppError("Ruangan not found", 404);
    }

    // Check kode_ruangan uniqueness if changed
    if (kode_ruangan && kode_ruangan !== existing.kode_ruangan) {
        const conflict = await prisma.ruangan.findFirst({
            where: {
                kode_ruangan: kode_ruangan,
                deletedAt: null,
                id: { not: parseInt(id) }
            },
            select: { id: true }
        });

        if (conflict) {
            throw new AppError(`Ruangan with code '${kode_ruangan}' already exists`, 409);
        }
    }

    const updateData: any = {};
    if (gedung !== undefined) updateData.gedung = gedung;
    if (nama_ruangan !== undefined) updateData.nama_ruangan = nama_ruangan;
    if (kode_ruangan !== undefined) updateData.kode_ruangan = kode_ruangan;
    updateData.updatedAt = new Date();

    const updatedRuangan = await prisma.ruangan.update({
        where: { id: parseInt(id) },
        data: updateData,
        ...optimizedRuanganQuery
    });

    // Clear all related caches
    clearAllRuanganCaches();

    // Also clear gedung cache if building changed
    if (gedung && gedung !== existing.gedung) {
        clearCachePattern(gedungCache, 'gedung');
    }

    // Trigger background cache refresh
    setImmediate(() => prewarmRuanganCaches());

    return res.status(200).json({
        message: "Ruangan updated successfully",
        data: updatedRuangan,
        cache_cleared: true
    });
});

const DeleteRuangan = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
        throw new AppError("Valid ruangan ID is required", 400);
    }

    const existing = await prisma.ruangan.findFirst({
        where: { id: parseInt(id), deletedAt: null },
        select: { id: true, nama_ruangan: true, kode_ruangan: true, gedung: true }
    });

    if (!existing) {
        throw new AppError("Ruangan not found", 404);
    }

    // Check if ruangan is being used (if you have peminjaman_ruangan table)
    // const activePeminjaman = await prisma.peminjaman_Ruangan.findFirst({
    //     where: { 
    //         ruangan_id: parseInt(id), 
    //         status: 'Active',
    //         deletedAt: null 
    //     }
    // });

    // if (activePeminjaman) {
    //     throw new AppError("Cannot delete ruangan that is currently being used", 400);
    // }

    const deletedRuangan = await prisma.ruangan.update({
        where: { id: parseInt(id) },
        data: {
            deletedAt: new Date()
        },
        select: { id: true, nama_ruangan: true, kode_ruangan: true, deletedAt: true }
    });

    // Clear all related caches
    clearAllRuanganCaches();

    return res.status(200).json({
        message: "Ruangan deleted successfully",
        data: deletedRuangan,
        cache_cleared: true
    });
});

const RestoreRuangan = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
        throw new AppError("Valid ruangan ID is required", 400);
    }

    const deleted = await prisma.ruangan.findFirst({
        where: { id: parseInt(id), deletedAt: { not: null } },
        select: { id: true }
    });

    if (!deleted) {
        throw new AppError("Deleted ruangan not found", 404);
    }

    const restored = await prisma.ruangan.update({
        where: { id: parseInt(id) },
        data: {
            deletedAt: null,
            updatedAt: new Date()
        },
        ...optimizedRuanganQuery
    });

    // Clear all related caches
    clearAllRuanganCaches();

    // Trigger background cache refresh
    setImmediate(() => prewarmRuanganCaches());

    return res.status(200).json({
        message: "Ruangan restored successfully",
        data: restored,
        cache_cleared: true
    });
});

const GetGedungList = asyncHandler(async (req: Request, res: Response) => {
    const cacheKey = 'gedung:list';
    const cached = getCache(gedungCache, cacheKey);

    if (cached) {
        return res.status(200).json({
            message: "Gedung list retrieved successfully",
            data: cached,
            cached: true,
            cache_timestamp: new Date().toISOString()
        });
    }

    const buildings = await prisma.ruangan.groupBy({
        by: ['gedung'],
        where: { deletedAt: null },
        _count: { id: true },
        orderBy: { gedung: 'asc' }
    });

    const result = buildings.map(b => ({
        gedung: b.gedung,
        jumlah_ruangan: b._count.id
    }));

    setCache(gedungCache, cacheKey, result, CACHE_CONFIG.GEDUNG_TTL);

    return res.status(200).json({
        message: "Gedung list retrieved successfully",
        data: result,
        cached: false
    });
});
const QRGenerator = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { urlName } = req.body;

    if (!id || isNaN(parseInt(id))) {
        throw new AppError("Valid ruangan ID is required", 400);
    }

    const ruangan = await prisma.ruangan.findUnique({
        where: { id: parseInt(id) },
        select: { id: true, nama_ruangan: true, kode_ruangan: true }
    });

    if (!ruangan) {
        throw new AppError("Ruangan not found", 404);
    }

    if (!urlName) {
        return res.status(400).json({
            message: "Please provide 'urlName' in the request body. Example: '/ruangan/aktivasi/{id}' for frontend activation."
        });
    }

    // Generate QR code as base64 PNG
    const qrUrl = `${urlName.replace('{id}', ruangan.id.toString())}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl);

    // Convert base64 to buffer
    const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate filename
    const filename = FileHandler.generateFilename(`qr_ruangan_${ruangan.id}.png`, 'qr');

    // Get storage path
    const uploadDir = FileHandler.getUploadDir(UploadCategory.RUANGAN);
    const filePath = path.join(uploadDir, filename);

    // Save file
    fs.writeFileSync(filePath, buffer);

    // Simpan path/filename ke database
    await prisma.ruangan.update({
        where: { id: ruangan.id },
        data: { QR_Image: filename }
    });

    // Dapatkan URL file untuk frontend
    const fileUrl = FileHandler.getFileUrl(UploadCategory.RUANGAN, filename);

    // Clear all related caches and prewarm again
    clearAllRuanganCaches();
    setImmediate(() => prewarmRuanganCaches());

    return res.status(200).json({
        message: "QR code generated and saved successfully",
        data: {
            ruangan,
            qr_url: qrUrl,
            qr_image_filename: filename,
            qr_image_url: fileUrl
        }
    });
});

const GetRuanganStats = asyncHandler(async (req: Request, res: Response) => {
    const cacheKey = 'stats:ruangan';
    const cached = getCache(ruanganStatsCache, cacheKey);

    if (cached) {
        return res.status(200).json({
            message: "Ruangan statistics retrieved successfully",
            data: cached,
            cached: true,
            cache_timestamp: new Date().toISOString()
        });
    }

    const [
        totalRuangan,
        byGedung,
        recentlyAdded,
        recentlyUpdated
    ] = await Promise.all([
        prisma.ruangan.count({ where: { deletedAt: null } }),
        prisma.ruangan.groupBy({
            by: ['gedung'],
            where: { deletedAt: null },
            _count: { id: true }
        }),
        prisma.ruangan.findMany({
            where: { deletedAt: null },
            ...optimizedRuanganQuery,
            orderBy: { createdAt: 'desc' },
            take: 5
        }),
        prisma.ruangan.findMany({
            where: {
                deletedAt: null,
                updatedAt: { not: undefined }
            },
            ...optimizedRuanganQuery,
            orderBy: { updatedAt: 'desc' },
            take: 5
        })
    ]);

    const stats = {
        overview: {
            total: totalRuangan,
            by_gedung: byGedung.map(g => ({
                gedung: g.gedung,
                count: g._count.id
            }))
        },
        recently_added: recentlyAdded,
        recently_updated: recentlyUpdated
    };

    setCache(ruanganStatsCache, cacheKey, stats, CACHE_CONFIG.STATS_TTL);

    return res.status(200).json({
        message: "Ruangan statistics retrieved successfully",
        data: stats,
        cached: false
    });
});

const GetRuanganCacheStats = asyncHandler(async (req: Request, res: Response) => {
    const ruanganStats = Array.from(ruanganCache.entries()).map(([key, value]) => ({
        key,
        hits: value.hits,
        age_ms: Date.now() - value.created,
        expires_in_ms: value.expiry - Date.now()
    }));

    const gedungStats = Array.from(gedungCache.entries()).map(([key, value]) => ({
        key,
        hits: value.hits,
        age_ms: Date.now() - value.created,
        expires_in_ms: value.expiry - Date.now()
    }));

    const statsStats = Array.from(ruanganStatsCache.entries()).map(([key, value]) => ({
        key,
        hits: value.hits,
        age_ms: Date.now() - value.created,
        expires_in_ms: value.expiry - Date.now()
    }));

    res.status(200).json({
        message: "Ruangan cache statistics retrieved successfully",
        data: {
            ruangan_cache: {
                size: ruanganCache.size,
                max_size: CACHE_CONFIG.MAX_CACHE_SIZE,
                items: ruanganStats
            },
            gedung_cache: {
                size: gedungCache.size,
                items: gedungStats
            },
            stats_cache: {
                size: ruanganStatsCache.size,
                items: statsStats
            },
            config: CACHE_CONFIG
        }
    });
});

const WarmRuanganCache = asyncHandler(async (req: Request, res: Response) => {
    const start = Date.now();

    // Clear existing caches first
    ruanganCache.clear();
    gedungCache.clear();
    ruanganStatsCache.clear();

    await prewarmRuanganCaches();

    const duration = Date.now() - start;

    return res.status(200).json({
        message: "Ruangan cache warmed successfully",
        data: {
            duration_ms: duration,
            cache_sizes: {
                ruangan: ruanganCache.size,
                gedung: gedungCache.size,
                stats: ruanganStatsCache.size
            },
            cache_ttl_config: CACHE_CONFIG,
            timestamp: new Date().toISOString()
        }
    });
});

const RuanganController = {
    CreateRuangan,
    GetRuanganMaster,
    GetRuanganById,
    UpdateRuangan,
    DeleteRuangan,
    RestoreRuangan,
    GetGedungList,
    GetRuanganStats,
    GetRuanganCacheStats,
    WarmRuanganCache,
    QRGenerator
}

export default RuanganController;