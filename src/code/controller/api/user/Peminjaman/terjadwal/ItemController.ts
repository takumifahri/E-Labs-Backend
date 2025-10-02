import { Response, Request, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
// Remove withAccelerate import
import { AppError, asyncHandler } from "../../../../../middleware/error";
import { AjuanPeminjamanRequest, PeminjamanHeader, PeminjamanHeaderStatus, PeminjamanItemStatus } from "../../../../../models/peminjaman";
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../../../../utils/FileHandler';

// Remove Accelerate, use local database only
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

// Enhanced In-memory cache system for Peminjaman
const peminjamanCache = new Map<string, any>();
const userCache = new Map<string, any>();
const barangCache = new Map<string, any>();

// Cache configuration
const CACHE_CONFIG = {
    DEFAULT_TTL: 3 * 60 * 1000,        // 3 minutes (peminjaman data changes frequently)
    USER_TTL: 10 * 60 * 1000,          // 10 minutes for user data
    BARANG_TTL: 5 * 60 * 1000,         // 5 minutes for barang data
    PEMINJAMAN_TTL: 2 * 60 * 1000,     // 2 minutes for peminjaman data
    MAX_CACHE_SIZE: 300                // Smaller cache for peminjaman
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

const clearAllPeminjamanCaches = () => {
    clearCachePattern(peminjamanCache, 'peminjaman');
    clearCachePattern(barangCache, 'barang'); // Clear barang cache when items are borrowed
};

// Database query optimization helpers
const optimizedUserQuery = {
    select: {
        id: true,
        uniqueId: true,
        nama: true,
        email: true,
        NIM: true,
        NIP: true,
        roleId: true,
        isActive: true
    }
};

const optimizedBarangQuery = {
    select: {
        id: true,
        nama_barang: true,
        kode_barang: true,
        merek: true,
        kondisi: true,
        jumlah: true,
        status: true,
        kategori_id: true,
        kategori: {
            select: {
                id: true,
                nama_kategori: true
            }
        }
    }
};

// Background cache prewarming for active users and items
const prewarmPeminjamanCaches = async () => {
    try {
        console.log('📋 Starting peminjaman cache prewarm...');
        const start = Date.now();

        // Prewarm active users
        const activeUsers = await prisma.user.findMany({
            where: { 
                isActive: true, 
                deletedAt: null 
            },
            ...optimizedUserQuery,
            take: 50 // Limit to recent active users
        });

        activeUsers.forEach(user => {
            const userCacheKey = getCacheKey('user', { uniqueId: user.uniqueId });
            setCache(userCache, userCacheKey, user, CACHE_CONFIG.USER_TTL);
        });

        // Prewarm available barang
        const availableBarang = await prisma.barang.findMany({
            where: { 
                deletedAt: null,
                jumlah: { gt: 0 },
                status: { in: ['Tersedia', 'Available'] }
            },
            ...optimizedBarangQuery,
            take: 100 // Limit to available items
        });

        availableBarang.forEach(barang => {
            const barangCacheKey = getCacheKey('barang', { id: barang.id });
            setCache(barangCache, barangCacheKey, barang, CACHE_CONFIG.BARANG_TTL);
        });

        const duration = Date.now() - start;
        console.log(`✅ Peminjaman cache prewarm completed in ${duration}ms`);
        console.log(`📊 Cache stats: User=${userCache.size}, Barang=${barangCache.size}, Peminjaman=${peminjamanCache.size}`);

    } catch (error) {
        console.error('❌ Peminjaman cache prewarm error:', error);
    }
};

// Optimized user lookup with cache
const getCachedUser = async (uniqueId: string) => {
    const userCacheKey = getCacheKey('user', { uniqueId });
    let user = getCache(userCache, userCacheKey);
    
    if (!user) {
        user = await prisma.user.findUnique({ 
            where: { uniqueId },
            ...optimizedUserQuery
        });
        
        if (user) {
            setCache(userCache, userCacheKey, user, CACHE_CONFIG.USER_TTL);
        }
    }
    
    return user;
};

// Optimized barang lookup with cache
const getCachedBarang = async (id: number) => {
    const barangCacheKey = getCacheKey('barang', { id });
    let barang = getCache(barangCache, barangCacheKey);
    
    if (!barang) {
        barang = await prisma.barang.findUnique({
            where: { id },
            ...optimizedBarangQuery
        });
        
        if (barang) {
            setCache(barangCache, barangCacheKey, barang, CACHE_CONFIG.BARANG_TTL);
        }
    }
    
    return barang;
};
// Ajuan Peminjaman Items dengan optimisasi cache
const AjuanPeminjamanItems = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
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
    
    if (!tokenUniqueId) {
        throw new AppError("Unauthorized: User uniqueId is missing", 401);
    }

    // Use cached user lookup
    const dbUser = await getCachedUser(String(tokenUniqueId));
    console.log('🔍 Authenticated user:', dbUser?.uniqueId, dbUser?.nama);
    if (!dbUser || !dbUser.isActive) {
        throw new AppError("User not found or inactive", 401);
    }

    let Dokumen = null;
    let DokumenUrl = null;
    if (req.file) {
        try{
            Dokumen = req.file.filename;

            const baseUrl = `${req.protocol}://${req.get('host')}`;
            DokumenUrl = FileHandler.getFileUrl(UploadCategory.PEMINJAMAN_ITEM, Dokumen, baseUrl);

            console.log(`📸 Barang image uploaded: ${Dokumen}`);
        }catch( error ) {
             console.error("File processing error:", error);
            throw new AppError("Failed to process uploaded file", 500);
        }
    }
    console.log('📝 Create data:', {
        tanggal_pinjam: tanggal_pinjam,
        tanggal_kembali: tanggal_kembali,
        keperluan: keperluan,
        estimasi_pinjam: estimasi_pinjam,
        items: items,
        Dokumen: Dokumen
    });

    const userId = dbUser.id;
    const uniqueCode = `PMJ-${Date.now()}`;

    const result = await prisma.$transaction(async (prisma) => {
        // Validate all barang exist and are available using cache
        const barangValidations = await Promise.all(
            items.map(async (item) => {
                console.log("Barang nya", item);
                // Convert barang_id to number if it's a string
                if (typeof item.barang_id === 'string') {
                    item.barang_id = parseInt(item.barang_id, 10);
                }
                
                if (!item.barang_id || isNaN(item.barang_id)) {
                    throw new AppError(`Invalid barang_id: ${item.barang_id}`, 400);
                }
                
                const barang = await getCachedBarang(item.barang_id);
                
                if (!barang) {
                    throw new AppError(`Barang with ID ${item.barang_id} not found`, 404);
                }

                // Ensure jumlah is a number and at least 1
                const requestedQuantity = item.jumlah && !isNaN(Number(item.jumlah)) ? Number(item.jumlah) : 1;
                
                if (requestedQuantity < 1) {
                    throw new AppError(`Requested quantity must be at least 1`, 400);
                }
                console.log(barang.jumlah, 'jumlah barang')
                if (barang.jumlah < 1) {
                    throw new AppError(`Barang ${barang.nama_barang} is out of stock`, 400);
                }
                
                if (barang.jumlah < requestedQuantity) {
                    throw new AppError(`Not enough stock for ${barang.nama_barang}. Available: ${barang.jumlah}, Requested: ${requestedQuantity}`, 400);
                }
                
                return { 
                    item: {
                        ...item,
                        jumlah: requestedQuantity
                    }, 
                    barang 
                };
            })
        );
        
        // Check if user already borrowed any of these items
        const alreadyBorrowed = await Promise.all(
            barangValidations.map(async ({ item, barang }) => {
                const existing = await prisma.peminjaman_Item.findFirst({
                    where: {
                        user_id: userId,
                        barang_id: item.barang_id,
                        status: { in: [PeminjamanItemStatus.DIPINJAM, PeminjamanItemStatus.DIAJUKAN] },
                        deletedAt: null
                    }
                });
                if (existing) {
                    throw new AppError(`You have already borrowed or requested ${barang.nama_barang}. Please return it before borrowing again.`, 400);
                }
                return null;
            })
        );
        
        if (alreadyBorrowed.some(x => x !== null)) {
            throw new AppError("One or more items have already been borrowed or requested", 400);
        }
        
        // Create Peminjaman_Handset as header
        const peminjaman_header = await prisma.peminjaman_Handset.create({
            data: {
                kode_peminjaman: uniqueCode,
                tanggal_pinjam: new Date(tanggal_pinjam),
                tanggal_kembali: tanggal_kembali ? new Date(tanggal_kembali) : null,
                kegiatan: keperluan || "Acara Kuliah",
                status: PeminjamanHeaderStatus.PENDING,
                user_id: userId,
                barang_id: barangValidations[0].item.barang_id,
                dokumen: DokumenUrl
            }
        });

        // Create multiple Peminjaman_Item records with proper jumlah values
        const created_items = await Promise.all(
            barangValidations.map(async ({ item }, index) => {
                return await prisma.peminjaman_Item.create({
                    data: {
                        user_id: userId,
                        barang_id: item.barang_id,
                        jumlah: item.jumlah,  // Set the requested quantity
                        estimasi_pinjam: item.estimasi_pinjam ? new Date(item.estimasi_pinjam) : new Date(estimasi_pinjam || tanggal_pinjam),
                        jam_pinjam: item.jam_pinjam ? new Date(item.jam_pinjam) : new Date(),
                        jam_kembali: item.jam_kembali ? new Date(item.jam_kembali) : null,
                        kode_peminjaman: `${uniqueCode}-ITEM-${index + 1}`,
                        tanggal_pinjam: new Date(tanggal_pinjam),
                        tanggal_kembali: tanggal_kembali ? new Date(tanggal_kembali) : null,
                        status: PeminjamanItemStatus.DIAJUKAN,
                        kegiatan: item.kegiatan || keperluan || "",
                        peminjaman_handset_id: peminjaman_header.id
                    }
                });
            })
        );

        // Update barang quantities and status based on borrowed quantities
        const barangUpdates = barangValidations.map(async ({ item }) => {
            const barang = await prisma.barang.findUnique({
                where: { id: item.barang_id },
                select: { id: true, jumlah: true }
            });
            
            if (barang) {
                const newJumlah = Math.max(0, barang.jumlah - item.jumlah);
                console.log(`Updating barang ID ${barang.id}: ${barang.jumlah} -> ${newJumlah} (subtracting ${item.jumlah})`);
                
                return prisma.barang.update({
                    where: { id: item.barang_id },
                    data: { 
                        jumlah: newJumlah,
                        status: newJumlah <= 0 ? 'Dipinjam' : 'Tersedia'
                    }
                });
            }
        });

        await Promise.all(barangUpdates.filter(Boolean));

        // Invalidate barang cache for updated items
        barangValidations.forEach(({ item }) => {
            const barangCacheKey = getCacheKey('barang', { id: item.barang_id });
            barangCache.delete(barangCacheKey);
        });

        return { header: peminjaman_header, items: created_items };
    });

    // Clear related caches
    clearAllPeminjamanCaches();
    
    // Background cache refresh
    setImmediate(() => prewarmPeminjamanCaches());

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
                Dokumen: result.header.dokumen
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
                nama: dbUser.nama,
                identifier: dbUser.NIM || dbUser.NIP || dbUser.email
            }
        }
    });
});

// Get User Peminjaman History dengan cache
const GetUserPeminjamanHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 10, status } = req.query;
    const u = (req.user as any) || {};
    const tokenUniqueId = u.uniqueId || u.id;

    if (!tokenUniqueId) {
        throw new AppError("Unauthorized: User uniqueId is missing", 401);
    }

    const dbUser = await getCachedUser(String(tokenUniqueId));
    if (!dbUser) {
        throw new AppError("User not found", 401);
    }

    const filters = { userId: dbUser.id, page: Number(page), limit: Number(limit), status };
    const cacheKey = getCacheKey('peminjaman:user_history', filters);

    // Try cache first
    const cached = getCache(peminjamanCache, cacheKey);
    if (cached) {
        return res.status(200).json({ 
            ...cached, 
            cached: true, 
            cache_timestamp: new Date().toISOString()
        });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { user_id: dbUser.id, deletedAt: null };
    if (status) where.status = status;

    const [peminjaman, total] = await Promise.all([
        prisma.peminjaman_Item.findMany({
            where,
            include: {
                barang: {
                    select: {
                        id: true,
                        nama_barang: true,
                        kode_barang: true,
                        merek: true
                    }
                },
                peminjaman_handset: {
                    select: {
                        id: true,
                        kode_peminjaman: true,
                        kegiatan: true
                    }
                }
            },
            skip,
            take,
            orderBy: { createdAt: 'desc' }
        }),
        prisma.peminjaman_Item.count({ where })
    ]);

    const totalPages = Math.ceil(total / take);
    const result = {
        message: "User peminjaman history retrieved successfully",
        data: peminjaman,
        pagination: {
            current_page: Number(page),
            total_pages: totalPages,
            total_items: total,
            items_per_page: take,
            has_next_page: Number(page) < totalPages,
            has_prev_page: Number(page) > 1
        },
        user_info: {
            nama: dbUser.nama,
            identifier: dbUser.NIM || dbUser.NIP || dbUser.email
        },
        cached: false
    };

    setCache(peminjamanCache, cacheKey, result, CACHE_CONFIG.PEMINJAMAN_TTL);
    
    res.status(200).json(result);
});

// Get Cache Statistics
const GetPeminjamanCacheStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userStats = Array.from(userCache.entries()).map(([key, value]) => ({
        key,
        hits: value.hits,
        age_ms: Date.now() - value.created,
        expires_in_ms: value.expiry - Date.now()
    }));

    const barangStats = Array.from(barangCache.entries()).map(([key, value]) => ({
        key,
        hits: value.hits,
        age_ms: Date.now() - value.created,
        expires_in_ms: value.expiry - Date.now()
    }));

    const peminjamanStats = Array.from(peminjamanCache.entries()).map(([key, value]) => ({
        key,
        hits: value.hits,
        age_ms: Date.now() - value.created,
        expires_in_ms: value.expiry - Date.now()
    }));

    res.status(200).json({
        message: "Peminjaman cache statistics retrieved successfully",
        data: {
            user_cache: {
                size: userCache.size,
                items: userStats
            },
            barang_cache: {
                size: barangCache.size,
                items: barangStats
            },
            peminjaman_cache: {
                size: peminjamanCache.size,
                items: peminjamanStats
            },
            config: CACHE_CONFIG
        }
    });
});

// Manual Cache Warming
const WarmPeminjamanCache = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    // Clear existing caches first
    userCache.clear();
    barangCache.clear();
    peminjamanCache.clear();
    
    await prewarmPeminjamanCaches();
    
    const duration = Date.now() - start;
    
    res.status(200).json({ 
        message: "Peminjaman cache warmed successfully", 
        data: {
            duration_ms: duration,
            cache_sizes: {
                user: userCache.size,
                barang: barangCache.size,
                peminjaman: peminjamanCache.size
            },
            cache_ttl_config: CACHE_CONFIG,
            timestamp: new Date().toISOString()
        }
    });
});

const PeminjamanItemController = {
    AjuanPeminjamanItems,
    GetUserPeminjamanHistory,
    GetPeminjamanCacheStats,
    WarmPeminjamanCache
}

export default PeminjamanItemController;