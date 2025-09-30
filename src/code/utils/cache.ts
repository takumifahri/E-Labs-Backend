export interface CacheItem<T = any> {
    data: T;
    expiry: number;
    hits: number;
    created: number;
    lastAccessed: number;
}

export interface CacheConfig {
    DEFAULT_TTL: number;        // Default Time To Live (ms)
    DETAIL_TTL: number;         // TTL for detail queries
    STATS_TTL: number;          // TTL for statistics
    LIST_TTL: number;           // TTL for list queries  
    MAX_CACHE_SIZE: number;     // Maximum cache size
    ENABLE_BACKGROUND_REFRESH: boolean;
    LOG_CACHE_OPERATIONS: boolean;
}

export interface CacheStats {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    items: Array<{
        key: string;
        hits: number;
        age_ms: number;
        expires_in_ms: number;
        size_estimate: number;
    }>;
}

export class SmartCache<T = any> {
    private cache = new Map<string, CacheItem<T>>();
    private hits = 0;
    private misses = 0;
    
    constructor(
        public readonly name: string,
        private config: CacheConfig
    ) {
        // Auto cleanup expired items every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
        
        if (this.config.LOG_CACHE_OPERATIONS) {
            console.log(`🗄️  Cache initialized: ${this.name}`);
        }
    }

    /**
     * Generate cache key from prefix and parameters
     */
    generateKey(prefix: string, params?: any): string {
        if (!params) return prefix;
        
        // Sort keys for consistent cache keys
        const sortedParams = this.sortObject(params);
        return `${prefix}:${JSON.stringify(sortedParams)}`;
    }

    /**
     * Get item from cache
     */
    get(key: string): T | null {
        const item = this.cache.get(key);
        
        if (!item) {
            this.misses++;
            return null;
        }
        
        // Check if expired
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }
        
        // Update access stats
        item.hits++;
        item.lastAccessed = Date.now();
        this.hits++;
        
        if (this.config.LOG_CACHE_OPERATIONS) {
            console.log(`🎯 Cache HIT: ${key} (hits: ${item.hits})`);
        }
        
        return item.data;
    }

    /**
     * Set item in cache
     */
    set(key: string, data: T, ttl?: number): void {
        const ttlToUse = ttl || this.config.DEFAULT_TTL;
        
        // Implement LRU-like behavior if cache is full
        if (this.cache.size >= this.config.MAX_CACHE_SIZE) {
            this.evictLeastUsed();
        }
        
        const item: CacheItem<T> = {
            data,
            expiry: Date.now() + ttlToUse,
            hits: 0,
            created: Date.now(),
            lastAccessed: Date.now()
        };
        
        this.cache.set(key, item);
        
        if (this.config.LOG_CACHE_OPERATIONS) {
            console.log(`💾 Cache SET: ${key} (TTL: ${ttlToUse}ms, Size: ${this.cache.size})`);
        }
    }

    /**
     * Delete specific item
     */
    delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        
        if (deleted && this.config.LOG_CACHE_OPERATIONS) {
            console.log(`🗑️  Cache DELETE: ${key}`);
        }
        
        return deleted;
    }

    /**
     * Clear items matching pattern
     */
    clearPattern(pattern: string): number {
        let cleared = 0;
        
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                cleared++;
            }
        }
        
        if (cleared > 0 && this.config.LOG_CACHE_OPERATIONS) {
            console.log(`🧹 Cache CLEAR_PATTERN: ${pattern} (${cleared} items)`);
        }
        
        return cleared;
    }

    /**
     * Clear all items
     */
    clear(): void {
        const size = this.cache.size;
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        
        if (this.config.LOG_CACHE_OPERATIONS) {
            console.log(`🆑 Cache CLEAR_ALL: ${this.name} (${size} items)`);
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const items = Array.from(this.cache.entries()).map(([key, value]) => ({
            key,
            hits: value.hits,
            age_ms: Date.now() - value.created,
            expires_in_ms: value.expiry - Date.now(),
            size_estimate: JSON.stringify(value.data).length
        }));

        const totalRequests = this.hits + this.misses;
        const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

        return {
            size: this.cache.size,
            maxSize: this.config.MAX_CACHE_SIZE,
            hitRate: Math.round(hitRate * 100) / 100,
            totalHits: this.hits,
            totalMisses: this.misses,
            items
        };
    }

    /**
     * Get or set with callback (cache-aside pattern)
     */
    async getOrSet<K extends T>(
        key: string, 
        fetcher: () => Promise<K>, 
        ttl?: number
    ): Promise<K> {
        const cached = this.get(key);
        
        if (cached) {
            return cached as K;
        }
        
        // Fetch data
        const data = await fetcher();
        
        // Cache the result
        this.set(key, data, ttl);
        
        return data;
    }

    /**
     * Preload cache with multiple items
     */
    async preload(items: Array<{ key: string; fetcher: () => Promise<T>; ttl?: number }>): Promise<void> {
        const start = Date.now();
        
        await Promise.all(
            items.map(async ({ key, fetcher, ttl }) => {
                try {
                    if (!this.get(key)) {
                        const data = await fetcher();
                        this.set(key, data, ttl);
                    }
                } catch (error) {
                    console.error(`❌ Cache preload failed for key: ${key}`, error);
                }
            })
        );
        
        const duration = Date.now() - start;
        
        if (this.config.LOG_CACHE_OPERATIONS) {
            console.log(`🔥 Cache preload completed: ${items.length} items in ${duration}ms`);
        }
    }

    /**
     * Refresh cache item in background
     */
    async refreshInBackground(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<void> {
        setImmediate(async () => {
            try {
                const data = await fetcher();
                this.set(key, data, ttl);
                
                if (this.config.LOG_CACHE_OPERATIONS) {
                    console.log(`🔄 Background refresh completed: ${key}`);
                }
            } catch (error) {
                console.error(`❌ Background refresh failed: ${key}`, error);
            }
        });
    }

    // Private methods
    private evictLeastUsed(): void {
        let leastUsedKey: string | null = null;
        let leastUsedScore = Infinity;
        
        for (const [key, item] of this.cache.entries()) {
            // Score based on hits and recency (lower is worse)
            const recencyScore = Date.now() - item.lastAccessed;
            const hitScore = item.hits > 0 ? 1 / item.hits : 1000;
            const combinedScore = recencyScore * hitScore;
            
            if (combinedScore < leastUsedScore) {
                leastUsedScore = combinedScore;
                leastUsedKey = key;
            }
        }
        
        if (leastUsedKey) {
            this.cache.delete(leastUsedKey);
            
            if (this.config.LOG_CACHE_OPERATIONS) {
                console.log(`♻️  Cache EVICT: ${leastUsedKey} (LRU)`);
            }
        }
    }

    private cleanup(): void {
        const before = this.cache.size;
        let cleaned = 0;
        
        for (const [key, item] of this.cache.entries()) {
            if (Date.now() > item.expiry) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0 && this.config.LOG_CACHE_OPERATIONS) {
            console.log(`🧽 Cache cleanup: ${cleaned} expired items removed`);
        }
    }

    private sortObject(obj: any): any {
        if (obj === null || typeof obj !== 'object') return obj;
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.sortObject(item));
        }
        
        const sorted: any = {};
        for (const key of Object.keys(obj).sort()) {
            sorted[key] = this.sortObject(obj[key]);
        }
        
        return sorted;
    }
}

/**
 * Cache Manager - manages multiple cache instances
 */
export class CacheManager {
    private static instance: CacheManager;
    private caches = new Map<string, SmartCache>();
    
    private constructor() {}
    
    static getInstance(): CacheManager {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }
    
    /**
     * Get or create cache instance
     */
    getCache<T = any>(name: string, config?: Partial<CacheConfig>): SmartCache<T> {
        if (!this.caches.has(name)) {
            const defaultConfig: CacheConfig = {
                DEFAULT_TTL: 5 * 60 * 1000,        // 5 minutes
                DETAIL_TTL: 10 * 60 * 1000,        // 10 minutes
                STATS_TTL: 2 * 60 * 1000,          // 2 minutes
                LIST_TTL: 3 * 60 * 1000,           // 3 minutes
                MAX_CACHE_SIZE: 1000,
                ENABLE_BACKGROUND_REFRESH: true,
                LOG_CACHE_OPERATIONS: process.env.NODE_ENV === 'development'
            };
            
            const mergedConfig = { ...defaultConfig, ...config };
            this.caches.set(name, new SmartCache<T>(name, mergedConfig));
        }
        
        return this.caches.get(name) as SmartCache<T>;
    }
    
    /**
     * Get all cache statistics
     */
    getAllStats(): Record<string, CacheStats> {
        const stats: Record<string, CacheStats> = {};
        
        for (const [name, cache] of this.caches.entries()) {
            stats[name] = cache.getStats();
        }
        
        return stats;
    }
    
    /**
     * Clear all caches
     */
    clearAll(): void {
        for (const cache of this.caches.values()) {
            cache.clear();
        }
        console.log('🆑 All caches cleared');
    }
}

/**
 * Cache decorators for methods
 */
export function Cached(
    cacheKey: string, 
    ttl?: number, 
    cacheName: string = 'default'
) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            const cache = CacheManager.getInstance().getCache(cacheName);
            const key = cache.generateKey(cacheKey, args);
            
            return await cache.getOrSet(key, async () => {
                return await originalMethod.apply(this, args);
            }, ttl);
        };
        
        return descriptor;
    };
}

/**
 * Cache invalidation decorator
 */
export function InvalidateCache(
    patterns: string[],
    cacheName: string = 'default'
) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            const result = await originalMethod.apply(this, args);
            
            const cache = CacheManager.getInstance().getCache(cacheName);
            for (const pattern of patterns) {
                cache.clearPattern(pattern);
            }
            
            return result;
        };
        
        return descriptor;
    };
}

// Export default instance for convenience
export default CacheManager.getInstance();