import { Request, Response, NextFunction } from "express";
import { $Enums, PrismaClient } from "@prisma/client";
import { AppError, asyncHandler } from "../../../middleware/error";
import { Barang, BarangRequest, BarangRespone, KondisiBarang, StatusBarang } from "../../../models/barang";
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../../utils/FileHandler';

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
const updateBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    
    if (!id || isNaN(Number(id))) {
        throw new AppError("Invalid barang ID", 400);
    }

    // Debug logging untuk troubleshooting
    console.log('🔍 Update Barang Debug:');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    console.log('Content-Type:', req.headers['content-type']);

    // Safe destructuring dengan default values
    const {
        kode_barang = undefined,
        nama_barang = undefined,
        merek = undefined,
        kondisi = undefined,
        jumlah = undefined,
        status = undefined,
        kategori_id = undefined
    } = req.body || {};

    const existing = await prisma.barang.findFirst({ 
        where: { id: Number(id), deletedAt: null },
        select: { id: true, kode_barang: true, kategori_id: true, status: true, foto_barang: true }
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

    // Handle file upload if present (optional)
    let newFotoBarang = existing.foto_barang; // Keep existing if no new file
    let imageUrl = null;
    
    if (req.file) {
        try {
            // Delete old image if exists
            if (existing.foto_barang) {
                const deleteSuccess = await FileHandler.deleteFile(UploadCategory.BARANG, existing.foto_barang);
                if (deleteSuccess) {
                    console.log(`🗑️  Deleted old barang image: ${existing.foto_barang}`);
                }
            }
            
            newFotoBarang = req.file.filename; // Use new filename
            
            // Generate relative image URL for response
            imageUrl = `uploads/barang/${newFotoBarang}`;
            
            console.log(`📸 Barang image updated: ${newFotoBarang}`);
        } catch (error) {
            console.error("File processing error:", error);
            throw new AppError("Failed to process uploaded file", 500);
        }
    } else if (existing.foto_barang) {
        // Generate relative URL for existing image
        imageUrl = `uploads/barang/${existing.foto_barang}`;
    }

    // Build update data dengan checking yang lebih robust
    const updateData: any = { updatedAt: new Date() };
    
    // Only update fields that are actually provided and not empty
    if (kode_barang !== undefined && kode_barang !== '') {
        updateData.kode_barang = kode_barang;
    }
    if (nama_barang !== undefined && nama_barang !== '') {
        updateData.nama_barang = nama_barang;
    }
    if (merek !== undefined) {
        updateData.merek = merek || "";
    }
    if (kondisi !== undefined && kondisi !== '') {
        updateData.kondisi = kondisi;
    }
    if (jumlah !== undefined && jumlah !== '') {
        updateData.jumlah = Number(jumlah);
    }
    if (status !== undefined && status !== '') {
        updateData.status = status;
    }
    if (kategori_id !== undefined && kategori_id !== '') {
        updateData.kategori_id = Number(kategori_id);
    }
    if (req.file) {
        updateData.foto_barang = newFotoBarang; // Only update if new file uploaded
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 1) { // Only updatedAt
        if (!req.file) {
            throw new AppError("No data provided to update", 400);
        }
    }

    console.log('📝 Update data:', updateData);

    const updated = await prisma.barang.update({
        where: { id: Number(id) },
        data: updateData,
        ...optimizedBarangQuery
    });

    // Clear all related caches
    clearAllRelatedCaches();
    
    // Trigger background cache refresh
    setImmediate(() => prewarmCaches());

    // Prepare response with relative image URL
    const responseData = {
        ...updated,
        foto_barang_url: imageUrl
    };

    res.status(200).json({ 
        message: "Barang updated successfully", 
        data: responseData,
        cache_cleared: true,
        file_info: req.file ? {
            original_name: req.file.originalname,
            filename: newFotoBarang,
            size: FileHandler.formatFileSize(req.file.size),
            mime_type: req.file.mimetype,
            old_file_deleted: existing.foto_barang ? true : false
        } : null,
        updated_fields: Object.keys(updateData).filter(key => key !== 'updatedAt')
    });
});

// Juga perbaiki createBarang dengan safe destructuring
const createBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Debug logging untuk troubleshooting
    console.log('🔍 Create Barang Debug:');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    console.log('Content-Type:', req.headers['content-type']);

    // Safe destructuring dengan default values
    const {
        kode_barang,
        nama_barang,
        merek,
        kondisi,
        jumlah,
        status,
        kategori_id
    }: BarangRequest = req.body || {};

    // Validation dengan lebih robust checking
    if (!kode_barang || kode_barang.trim() === '') {
        throw new AppError("kode_barang is required", 400);
    }
    if (!nama_barang || nama_barang.trim() === '') {
        throw new AppError("nama_barang is required", 400);
    }
    if (!kondisi || kondisi.trim() === '') {
        throw new AppError("kondisi is required", 400);
    }
    if (!status || status.trim() === '') {
        throw new AppError("status is required", 400);
    }
    if (!kategori_id || kategori_id === 0) {
        throw new AppError("kategori_id is required", 400);
    }

    // Validate uniqueness
    const existing = await prisma.barang.findUnique({ 
        where: { kode_barang: kode_barang.trim() },
        select: { id: true } // Optimize query
    });
    
    if (existing) {
        throw new AppError("Kode barang already exists", 409);
    }

    // Handle file upload if present (nullable)
    let foto_barang = null;
    let imageUrl = null;
    
    if (req.file) {
        try {
            foto_barang = req.file.filename; // File sudah di-upload oleh middleware
            
            // Generate image URL for response
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            imageUrl = FileHandler.getFileUrl(UploadCategory.BARANG, foto_barang, baseUrl);
            
            console.log(`📸 Barang image uploaded: ${foto_barang}`);
        } catch (error) {
            console.error("File processing error:", error);
            throw new AppError("Failed to process uploaded file", 500);
        }
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

    console.log('📝 Create data:', {
        kode_barang: kode_barang.trim(),
        nama_barang: nama_barang.trim(),
        merek: merek || "",
        kondisi,
        jumlah: Number(jumlah) || 0,
        status,
        kategori_id: Number(kategori_id),
        foto_barang
    });

    // Import Prisma enum for type-safe assignment
    // eslint-disable-next-line @typescript-eslint/no-var-requires

    const newBarang = await prisma.barang.create({
        data: {
            kode_barang: kode_barang.trim(),
            nama_barang: nama_barang.trim(),
            merek: merek || "",
            kondisi: kondisi as $Enums.KondisiBarang | undefined,
            jumlah: Number(jumlah) || 0,
            status,
            kategori_id: Number(kategori_id),
            foto_barang // Save filename to database (nullable)
        },
        ...optimizedBarangQuery
    });

    // Clear all related caches
    clearAllRelatedCaches();
    
    // Trigger background cache refresh
    setImmediate(() => prewarmCaches());

    // Prepare response with image URL
    const responseData = {
        ...newBarang,
        foto_barang_url: imageUrl // Add image URL to response
    };

    res.status(201).json({ 
        message: "Barang created successfully", 
        data: responseData,
        cache_cleared: true,
        file_info: req.file ? {
            original_name: req.file.originalname,
            filename: foto_barang,
            size: FileHandler.formatFileSize(req.file.size),
            mime_type: req.file.mimetype
        } : null
    });
});

const getAllKategori = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { nama_kategori } = req.query;
    const cacheKey = getCacheKey('kategori:all', { nama_kategori });
    // langsung try
    try{
        // ambil dari table kategori_barang
        const cached = getCache(kategoriCache, cacheKey);
        if (cached) {
            return res.status(200).json({
                message: "Kategori retrieved successfully",
                data: cached,
                cached: true,
                cache_timestamp: new Date().toISOString(),
                cache_stats: {
                    hits: kategoriCache.get(cacheKey)?.hits || 0,
                    total_cached_queries: kategoriCache.size
                }
            });
        }
        const where: any = { deletedAt: null };
        if (nama_kategori) {
            where.nama_kategori = { contains: String(nama_kategori), mode: 'insensitive' };
        }
        const categories = await prisma.kategori_Barang.findMany({
            where,
            select: { id: true, nama_kategori: true },
            orderBy: { nama_kategori: 'asc' }
        });
        setCache(kategoriCache, cacheKey, categories, CACHE_CONFIG.KATEGORI_TTL);
        res.status(200).json({
            message: "Kategori retrieved successfully",
            data: categories,
            cached: false,
            query_time: new Date().toISOString()
        });

    }catch(error){
        console.error('❌ Error fetching kategori:', error);
        throw new AppError("Failed to fetch kategori", 500);
    }

});
// Enhanced getAllBarang to include image URLs
// const getAllBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
//     const { page = 1, limit = 10, kategori_id, status, kondisi, search } = req.query;
//     const filters = { page: Number(page), limit: Number(limit), kategori_id, status, kondisi, search };
//     const cacheKey = getCacheKey('barang:list', filters);
//     // Kita exception yang udah di delete
//     const deletedItems = await prisma.barang.findMany({
//         where: { deletedAt: { not: null } },
//         select: { id: true }
//     });
//     // Try cache first
//     const cached = getCache(barangCache, cacheKey);
//     if (cached) {
//         // Add image URLs to cached data
//         const baseUrl = `${req.protocol}://${req.get('host')}`;
//         const dataWithUrls = cached.data.map((item: any) => ({
//             ...item,
//             foto_barang_url: item.foto_barang ? FileHandler.getFileUrl(UploadCategory.BARANG, item.foto_barang, baseUrl) : null
//         }));
        
//         return res.status(200).json({ 
//             ...cached,
//             data: dataWithUrls,
//             cached: true, 
//             cache_timestamp: new Date().toISOString(),
//             cache_stats: {
//                 hits: barangCache.get(cacheKey)?.hits || 0,
//                 total_cached_queries: barangCache.size
//             }
//         });
//     }

//     const skip = (Number(page) - 1) * Number(limit);
//     const take = Number(limit);
//     const where = buildWhereClause({ kategori_id, status, kondisi, search });

//     // Parallel queries for better performance
    
//     const [barangs, total] = await Promise.all([
//         prisma.barang.findMany({
//             where,
//             ...optimizedBarangQuery,
//             skip,
//             take,
//             orderBy: { createdAt: 'desc' }
//         }),
//         prisma.barang.count({ where })
//     ]);

//     // Add image URLs to response
//     const baseUrl = `${req.protocol}://${req.get('host')}`;
//     const barangsWithUrls = barangs.map(barang => ({
//         ...barang,
//         foto_barang_url: barang.foto_barang ? FileHandler.getFileUrl(UploadCategory.BARANG, barang.foto_barang, baseUrl) : null
//     }));

//     const totalPages = Math.ceil(total / take);
//     const result = {
//         message: "Barang retrieved successfully",
//         data: barangsWithUrls,
//         pagination: {
//             current_page: Number(page),
//             total_pages: totalPages,
//             total_items: total,
//             items_per_page: take,
//             has_next_page: Number(page) < totalPages,
//             has_prev_page: Number(page) > 1
//         },
//         cached: false,
//         query_time: new Date().toISOString()
//     };

//     // Cache the result (without URLs to save space)
//     setCache(barangCache, cacheKey, { ...result, data: barangs });
    
//     // Background prewarm (non-blocking)
//     if (barangCache.size < 50) { // Only prewarm if cache is not too full
//         setImmediate(() => prewarmCaches());
//     }

//     res.status(200).json(result);
// });
const getAllBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { kategori_id, status, kondisi, search } = req.query;
    const filters = { kategori_id, status, kondisi, search };
    const cacheKey = getCacheKey('barang:list:all', filters);

    // Try cache first
    const cached = getCache(barangCache, cacheKey);
    if (cached) {
        const dataWithUrls = cached.data.map((item: any) => ({
            ...item,
            foto_barang_url: item.foto_barang ? `uploads/barang/${item.foto_barang}` : null
        }));

        return res.status(200).json({
            message: "Barang retrieved successfully",
            data: dataWithUrls,
            cached: true,
            cache_timestamp: new Date().toISOString(),
            cache_stats: {
                hits: barangCache.get(cacheKey)?.hits || 0,
                total_cached_queries: barangCache.size
            }
        });
    }

    const where = buildWhereClause({ kategori_id, status, kondisi, search });

    // Ambil semua barang tanpa pagination
    const barangs = await prisma.barang.findMany({
        where,
        ...optimizedBarangQuery,
        orderBy: { createdAt: 'asc' }
    });

    const barangsWithUrls = barangs.map(barang => ({
        ...barang,
        foto_barang_url: barang.foto_barang ? `uploads/barang/${barang.foto_barang}` : null
    }));

    const result = {
        message: "Barang retrieved successfully",
        data: barangsWithUrls,
        cached: false,
        query_time: new Date().toISOString()
    };

    setCache(barangCache, cacheKey, { ...result, data: barangs });

    res.status(200).json(result);
});
// Enhanced getBarangById to include image URL
const getBarangById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) {
        throw new AppError("Invalid barang ID", 400);
    }

    const cacheKey = getCacheKey('barang:detail', { id: Number(id) });
    const cached = getCache(barangCache, cacheKey);
    
    if (cached) {
        // Add image URL to cached data
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const dataWithUrl = {
            ...cached.data,
            foto_barang_url: cached.data.foto_barang ? FileHandler.getFileUrl(UploadCategory.BARANG, cached.data.foto_barang, baseUrl) : null
        };
        
        return res.status(200).json({ 
            ...cached,
            data: dataWithUrl,
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

    // Add image URL to response
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const barangWithUrl = {
        ...barang,
        foto_barang_url: barang.foto_barang ? FileHandler.getFileUrl(UploadCategory.BARANG, barang.foto_barang, baseUrl) : null
    };

    const result = { 
        message: "Barang retrieved successfully", 
        data: barangWithUrl, 
        cached: false 
    };
    
    // Cache with longer TTL for details (cache without URL)
    setCache(barangCache, cacheKey, { ...result, data: barang }, CACHE_CONFIG.DETAIL_TTL);

    res.status(200).json(result);
});

// Enhanced deleteBarang to also delete image
const deleteBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    
    if (!id || isNaN(Number(id))) {
        throw new AppError("Invalid barang ID", 400);
    }

    const existing = await prisma.barang.findFirst({ 
        where: { id: Number(id), deletedAt: null },
        select: { id: true, nama_barang: true, kode_barang: true, foto_barang: true }
    });
    
    if (!existing) {
        throw new AppError("Barang not found", 404);
    }

    // Check if barang is currently borrowed
    const activePeminjaman = await prisma.peminjaman_Item.findFirst({
        where: { 
            barang_id: Number(id), 
            status: { in: [StatusBarang.DIPINJAM] }, 
            deletedAt: null 
        },
        select: { id: true }
    });
    
    if (activePeminjaman) {
        throw new AppError("Cannot delete barang that is currently borrowed", 400);
    }

    // Delete associated image file if exists
    // let imageDeleted = false;
    // if (existing.foto_barang) {
    //     try {
    //         imageDeleted = await FileHandler.deleteFile(UploadCategory.BARANG, existing.foto_barang);
    //         if (imageDeleted) {
    //             console.log(`🗑️  Deleted barang image: ${existing.foto_barang}`);
    //         }
    //     } catch (error) {
    //         console.error("Error deleting image file:", error);
    //         // Continue with deletion even if image deletion fails
    //     }
    // }

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

    // kita cache ulang dg data yang baru
    setImmediate(() => prewarmCaches());
    res.status(200).json({ 
        message: "Barang deleted successfully", 
        data: deleted,
        cache_cleared: true,
        // image_deleted: imageDeleted,
        image_filename: existing.foto_barang
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
            orderBy: { updatedAt: 'asc' },
            take: 10
        })
    ]);

    // Calculate 'tidak_tersedia' from status TIDAK_TERSEDIA
    const tidakTersedia = await prisma.barang.count({ where: { deletedAt: null, status: StatusBarang.TIDAK_TERSEDIA } });

    const stats = {
        overview: {
            total: totalBarang,
            tersedia,
            dipinjam,
            rusak,
            tidak_tersedia: tidakTersedia,
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
    getDashboardStats,
    getAllKategori
};

export default BarangController;