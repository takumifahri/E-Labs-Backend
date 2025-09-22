import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError, asyncHandler } from "../../../middleware/error";
import { Barang, BarangRespone, KondisiBarang, StatusBarang } from "../../../models/barang";

// Remove Accelerate, use local database only
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

// Enhanced In-memory cache system (L1)
const barangCache = new Map<string, any>();
const kategoriCache = new Map<string, any>();
const statsCache = new Map<string, any>();

// Cache configuration
const CACHE_CONFIG = {
    DEFAULT_TTL: 5 * 60 * 1000,        // 5 minutes
    DETAIL_TTL: 10 * 60 * 1000,        // 10 minutes for details
    STATS_TTL: 2 * 60 * 1000,          // 2 minutes for stats
    KATEGORI_TTL: 30 * 60 * 1000,      // 30 minutes for categories
    MAX_CACHE_SIZE: 1000               // Prevent memory overflow
};

// Cache helpers with size limit
const getCacheKey = (prefix: string, params?: any) => 
    params ? `${prefix}:${JSON.stringify(params)}` : prefix;

const setCache = (cache: Map<string, any>, key: string, data: any, ttl: number = CACHE_CONFIG.DEFAULT_TTL) => {
    // Implement LRU-like behavior
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

const clearAllRelatedCaches = () => {
    clearCachePattern(barangCache, 'barang');
    clearCachePattern(statsCache, 'stats');
    // Keep kategori cache as it changes less frequently
};

// Database query optimization helpers
const optimizedBarangQuery = {
    include: { 
        kategori: { 
            select: { 
                id: true, 
                nama_kategori: true 
            } 
        } 
    }
};

const buildWhereClause = (filters: any) => {
    const where: any = { deletedAt: null };
    
    if (filters.kategori_id) where.kategori_id = Number(filters.kategori_id);
    if (filters.status) where.status = filters.status;
    if (filters.kondisi) where.kondisi = filters.kondisi;
    if (filters.search) {
        where.OR = [
            { nama_barang: { contains: filters.search, mode: 'insensitive' } },
            { kode_barang: { contains: filters.search, mode: 'insensitive' } },
            { merek: { contains: filters.search, mode: 'insensitive' } }
        ];
    }
    
    return where;
};

// Background cache prewarming (non-blocking)
const prewarmCaches = async () => {
    try {
        console.log('🔥 Starting cache prewarm...');
        const start = Date.now();

        // Prewarm popular barang queries
        const popularQueries = [
            { page: 1, limit: 10 },
            { page: 1, limit: 10, status: StatusBarang.TERSEDIA },
            { page: 1, limit: 10, status: StatusBarang.DIPINJAM },
            { page: 1, limit: 20 }
        ];

        await Promise.all(popularQueries.map(async (query) => {
            const cacheKey = getCacheKey('barang:list', query);
            if (getCache(barangCache, cacheKey)) return;

            const where = buildWhereClause(query);
            const skip = ((query.page || 1) - 1) * (query.limit || 10);
            const take = query.limit || 10;

            const [items, total] = await Promise.all([
                prisma.barang.findMany({
                    where,
                    ...optimizedBarangQuery,
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' }
                }),
                prisma.barang.count({ where })
            ]);

            const result = {
                message: "Barang retrieved successfully",
                data: items,
                pagination: {
                    current_page: query.page || 1,
                    total_pages: Math.ceil(total / take),
                    total_items: total,
                    items_per_page: take,
                    has_next_page: (query.page || 1) < Math.ceil(total / take),
                    has_prev_page: (query.page || 1) > 1
                },
                cached: false
            };

            setCache(barangCache, cacheKey, result);
        }));

        // Prewarm categories
        const kategoryCacheKey = 'kategori:all';
        if (!getCache(kategoriCache, kategoryCacheKey)) {
            const categories = await prisma.kategori_Barang.findMany({
                where: { deletedAt: null },
                select: { id: true, nama_kategori: true },
                orderBy: { nama_kategori: 'asc' }
            });
            
            setCache(kategoriCache, kategoryCacheKey, categories, CACHE_CONFIG.KATEGORI_TTL);
        }

        // Prewarm statistics
        const statsCacheKey = 'stats:dashboard';
        if (!getCache(statsCache, statsCacheKey)) {
            const [
                totalBarang,
                tersedia,
                dipinjam,
                rusak,
                byKategori
            ] = await Promise.all([
                prisma.barang.count({ where: { deletedAt: null } }),
                prisma.barang.count({ where: { deletedAt: null, status: StatusBarang.TERSEDIA } }),
                prisma.barang.count({ where: { deletedAt: null, status: StatusBarang.DIPINJAM } }),
                prisma.barang.count({ where: { deletedAt: null, kondisi: KondisiBarang.RUSAK_BERAT } }),
                prisma.barang.count({ where: { deletedAt: null, kondisi: KondisiBarang.RUSAK_RINGAN } }),
                prisma.barang.groupBy({
                    by: ['kategori_id'],
                    where: { deletedAt: null },
                    _count: { id: true }
                })
            ]);

            const stats = {
                total: totalBarang,
                tersedia,
                dipinjam,
                rusak,
                tidak_tersedia: totalBarang - tersedia - dipinjam,
                by_kategori: byKategori
            };

            setCache(statsCache, statsCacheKey, stats, CACHE_CONFIG.STATS_TTL);
        }

        // Prewarm recent items details
        const recentItems = await prisma.barang.findMany({
            where: { deletedAt: null },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        await Promise.all(recentItems.map(async (item) => {
            const detailKey = getCacheKey('barang:detail', { id: item.id });
            if (getCache(barangCache, detailKey)) return;

            const detail = await prisma.barang.findFirst({
                where: { id: item.id, deletedAt: null },
                ...optimizedBarangQuery
            });

            if (detail) {
                const result = { 
                    message: "Barang retrieved successfully", 
                    data: detail, 
                    cached: false 
                };
                setCache(barangCache, detailKey, result, CACHE_CONFIG.DETAIL_TTL);
            }
        }));

        const duration = Date.now() - start;
        console.log(`✅ Cache prewarm completed in ${duration}ms`);
        console.log(`📊 Cache stats: Barang=${barangCache.size}, Kategori=${kategoriCache.size}, Stats=${statsCache.size}`);

    } catch (error) {
        console.error('❌ Cache prewarm error:', error);
    }
};

// Controllers
const getAllBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 10, kategori_id, status, kondisi, search } = req.query;
    const filters = { page: Number(page), limit: Number(limit), kategori_id, status, kondisi, search };
    const cacheKey = getCacheKey('barang:list', filters);

    // Try cache first
    const cached = getCache(barangCache, cacheKey);
    if (cached) {
        return res.status(200).json({ 
            ...cached, 
            cached: true, 
            cache_timestamp: new Date().toISOString(),
            cache_stats: {
                hits: barangCache.get(cacheKey)?.hits || 0,
                total_cached_queries: barangCache.size
            }
        });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const where = buildWhereClause({ kategori_id, status, kondisi, search });

    // Parallel queries for better performance
    const [barangs, total] = await Promise.all([
        prisma.barang.findMany({
            where,
            ...optimizedBarangQuery,
            skip,
            take,
            orderBy: { createdAt: 'desc' }
        }),
        prisma.barang.count({ where })
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
        cached: false,
        query_time: new Date().toISOString()
    };

    // Cache the result
    setCache(barangCache, cacheKey, result);
    
    // Background prewarm (non-blocking)
    if (barangCache.size < 50) { // Only prewarm if cache is not too full
        setImmediate(() => prewarmCaches());
    }

    res.status(200).json(result);
});

const getBarangById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) {
        throw new AppError("Invalid barang ID", 400);
    }

    const cacheKey = getCacheKey('barang:detail', { id: Number(id) });
    const cached = getCache(barangCache, cacheKey);
    
    if (cached) {
        return res.status(200).json({ 
            ...cached, 
            cached: true, 
            cache_timestamp: new Date().toISOString(),
            cache_hits: barangCache.get(cacheKey)?.hits || 0
        });
    }

    const barang = await prisma.barang.findFirst({
        where: { id: Number(id), deletedAt: null },
        ...optimizedBarangQuery
    });

    if (!barang) {
        throw new AppError("Barang not found", 404);
    }

    const result = { 
        message: "Barang retrieved successfully", 
        data: barang, 
        cached: false 
    };
    
    // Cache with longer TTL for details
    setCache(barangCache, cacheKey, result, CACHE_CONFIG.DETAIL_TTL);

    res.status(200).json(result);
});

const createBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { kode_barang, nama_barang, merek, kondisi, jumlah, status, kategori_id } = req.body;
    
    if (!kode_barang || !nama_barang || !kondisi || !status || !kategori_id) {
        throw new AppError("Required fields: kode_barang, nama_barang, kondisi, status, kategori_id", 400);
    }

    // Validate uniqueness
    const existing = await prisma.barang.findUnique({ 
        where: { kode_barang },
        select: { id: true } // Optimize query
    });
    
    if (existing) {
        throw new AppError("Kode barang already exists", 409);
    }

    // Validate category from cache first
    const kategoryCacheKey = 'kategori:all';
    let categories = getCache(kategoriCache, kategoryCacheKey);
    
    if (!categories) {
        categories = await prisma.kategori_Barang.findMany({
            where: { deletedAt: null },
            select: { id: true, nama_kategori: true }
        });
        setCache(kategoriCache, kategoryCacheKey, categories, CACHE_CONFIG.KATEGORI_TTL);
    }

    const kategoriExists = categories.find((k: any) => k.id === Number(kategori_id));
    if (!kategoriExists) {
        throw new AppError("Kategori not found", 404);
    }

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
        ...optimizedBarangQuery
    });

    // Clear all related caches
    clearAllRelatedCaches();
    
    // Trigger background cache refresh
    setImmediate(() => prewarmCaches());

    res.status(201).json({ 
        message: "Barang created successfully", 
        data: newBarang,
        cache_cleared: true
    });
});

const updateBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { kode_barang, nama_barang, merek, kondisi, jumlah, status, kategori_id } = req.body;
    
    if (!id || isNaN(Number(id))) {
        throw new AppError("Invalid barang ID", 400);
    }

    const existing = await prisma.barang.findFirst({ 
        where: { id: Number(id), deletedAt: null },
        select: { id: true, kode_barang: true, kategori_id: true, status: true }
    });
    
    if (!existing) {
        throw new AppError("Barang not found", 404);
    }

    // Validate kode_barang uniqueness if changed
    if (kode_barang && kode_barang !== existing.kode_barang) {
        const conflict = await prisma.barang.findUnique({ 
            where: { kode_barang },
            select: { id: true }
        });
        
        if (conflict) {
            throw new AppError("Kode barang already exists", 409);
        }
    }

    // Validate category if changed
    if (kategori_id && Number(kategori_id) !== existing.kategori_id) {
        const kategoryCacheKey = 'kategori:all';
        let categories = getCache(kategoriCache, kategoryCacheKey);
        
        if (!categories) {
            categories = await prisma.kategori_Barang.findMany({
                where: { deletedAt: null },
                select: { id: true, nama_kategori: true }
            });
            setCache(kategoriCache, kategoryCacheKey, categories, CACHE_CONFIG.KATEGORI_TTL);
        }

        const kategoriExists = categories.find((k: any) => k.id === Number(kategori_id));
        if (!kategoriExists) {
            throw new AppError("Kategori not found", 404);
        }
    }

    // Build update data
    const updateData: any = {};
    if (kode_barang !== undefined) updateData.kode_barang = kode_barang;
    if (nama_barang !== undefined) updateData.nama_barang = nama_barang;
    if (merek !== undefined) updateData.merek = merek;
    if (kondisi !== undefined) updateData.kondisi = kondisi;
    if (jumlah !== undefined) updateData.jumlah = Number(jumlah);
    if (status !== undefined) updateData.status = status;
    if (kategori_id !== undefined) updateData.kategori_id = Number(kategori_id);
    
    updateData.updatedAt = new Date();

    const updated = await prisma.barang.update({
        where: { id: Number(id) },
        data: updateData,
        ...optimizedBarangQuery
    });

    // Clear all related caches
    clearAllRelatedCaches();
    
    // Trigger background cache refresh
    setImmediate(() => prewarmCaches());

    res.status(200).json({ 
        message: "Barang updated successfully", 
        data: updated,
        cache_cleared: true
    });
});

const deleteBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    
    if (!id || isNaN(Number(id))) {
        throw new AppError("Invalid barang ID", 400);
    }

    const existing = await prisma.barang.findFirst({ 
        where: { id: Number(id), deletedAt: null },
        select: { id: true, nama_barang: true, kode_barang: true }
    });
    
    if (!existing) {
        throw new AppError("Barang not found", 404);
    }

    // Check if barang is currently borrowed
    const activePeminjaman = await prisma.peminjaman_Item.findFirst({
        where: { 
            barang_id: Number(id), 
            status: { in: [StatusBarang.DIPINJAM, 'Pending'] }, 
            deletedAt: null 
        },
        select: { id: true }
    });
    
    if (activePeminjaman) {
        throw new AppError("Cannot delete barang that is currently borrowed or pending", 400);
    }

    const deleted = await prisma.barang.update({ 
        where: { id: Number(id) }, 
        data: { 
            deletedAt: new Date(), 
            status: StatusBarang.TIDAK_TERSEDIA,
            updatedAt: new Date()
        },
        select: { id: true, kode_barang: true, nama_barang: true, deletedAt: true }
    });

    // Clear all related caches
    clearAllRelatedCaches();

    res.status(200).json({ 
        message: "Barang deleted successfully", 
        data: deleted,
        cache_cleared: true
    });
});

const restoreBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    
    if (!id || isNaN(Number(id))) {
        throw new AppError("Invalid barang ID", 400);
    }

    const deleted = await prisma.barang.findFirst({ 
        where: { id: Number(id), deletedAt: { not: null } },
        select: { id: true }
    });
    
    if (!deleted) {
        throw new AppError("Deleted barang not found", 404);
    }

    const restored = await prisma.barang.update({
        where: { id: Number(id) },
        data: { 
            deletedAt: null, 
            status: StatusBarang.TERSEDIA,
            updatedAt: new Date()
        },
        ...optimizedBarangQuery
    });

    // Clear all related caches
    clearAllRelatedCaches();
    
    // Trigger background cache refresh
    setImmediate(() => prewarmCaches());

    res.status(200).json({ 
        message: "Barang restored successfully", 
        data: restored,
        cache_cleared: true
    });
});

// Get cache statistics
const getCacheStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const barangStats = Array.from(barangCache.entries()).map(([key, value]) => ({
        key,
        hits: value.hits,
        age_ms: Date.now() - value.created,
        expires_in_ms: value.expiry - Date.now()
    }));

    const kategoriStats = Array.from(kategoriCache.entries()).map(([key, value]) => ({
        key,
        hits: value.hits,
        age_ms: Date.now() - value.created,
        expires_in_ms: value.expiry - Date.now()
    }));

    const statsStats = Array.from(statsCache.entries()).map(([key, value]) => ({
        key,
        hits: value.hits,
        age_ms: Date.now() - value.created,
        expires_in_ms: value.expiry - Date.now()
    }));

    res.status(200).json({
        message: "Cache statistics retrieved successfully",
        data: {
            barang_cache: {
                size: barangCache.size,
                max_size: CACHE_CONFIG.MAX_CACHE_SIZE,
                items: barangStats
            },
            kategori_cache: {
                size: kategoriCache.size,
                items: kategoriStats
            },
            stats_cache: {
                size: statsCache.size,
                items: statsStats
            },
            config: CACHE_CONFIG
        }
    });
});

// Manual cache warming endpoint
const warmBarangCache = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    // Clear existing caches first
    barangCache.clear();
    kategoriCache.clear();
    statsCache.clear();
    
    await prewarmCaches();
    
    const duration = Date.now() - start;
    
    res.status(200).json({ 
        message: "Barang cache warmed successfully", 
        data: {
            duration_ms: duration,
            cache_sizes: {
                barang: barangCache.size,
                kategori: kategoriCache.size,
                stats: statsCache.size
            },
            cache_ttl_config: CACHE_CONFIG,
            timestamp: new Date().toISOString()
        }
    });
});

// Get dashboard statistics (cached)
const getDashboardStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const cacheKey = 'stats:dashboard';
    const cached = getCache(statsCache, cacheKey);
    
    if (cached) {
        return res.status(200).json({
            message: "Dashboard statistics retrieved successfully",
            data: cached,
            cached: true,
            cache_timestamp: new Date().toISOString()
        });
    }

    const [
        totalBarang,
        tersedia,
        dipinjam,
        rusak,
        byKategori,
        recentActivity
    ] = await Promise.all([
        prisma.barang.count({ where: { deletedAt: null } }),
        prisma.barang.count({ where: { deletedAt: null, status: StatusBarang.TERSEDIA } }),
        prisma.barang.count({ where: { deletedAt: null, status: StatusBarang.DIPINJAM } }),
        prisma.barang.count({ where: { deletedAt: null, kondisi: KondisiBarang.RUSAK_BERAT } }),
        prisma.barang.count({ where: { deletedAt: null, kondisi: KondisiBarang.RUSAK_RINGAN } }),

        prisma.barang.groupBy({
            by: ['kategori_id'],
            where: { deletedAt: null },
            _count: { id: true },
            _avg: { jumlah: true }
        }),
        prisma.barang.findMany({
            where: { deletedAt: null },
            select: { id: true, nama_barang: true, status: true, createdAt: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: 10
        })
    ]);

    const stats = {
        overview: {
            total: totalBarang,
            tersedia,
            dipinjam,
            rusak,
            tidak_tersedia: totalBarang - tersedia - dipinjam,
            utilization_rate: totalBarang > 0 ? Math.round((dipinjam / totalBarang) * 100) : 0
        },
        by_kategori: byKategori,
        recent_activity: recentActivity
    };

    setCache(statsCache, cacheKey, stats, CACHE_CONFIG.STATS_TTL);

    res.status(200).json({
        message: "Dashboard statistics retrieved successfully",
        data: stats,
        cached: false
    });
});

const BarangController = {
    getAllBarang,
    getBarangById,
    createBarang,
    updateBarang,
    deleteBarang,
    restoreBarang,
    warmBarangCache,
    getCacheStats,
    getDashboardStats
};

export default BarangController;