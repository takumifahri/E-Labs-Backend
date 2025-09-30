import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Request } from 'express';

// Base storage directory
const baseStorageDir = path.join(process.cwd(), 'src', 'code', 'storage');

// File upload categories with their respective directories
export enum UploadCategory {
    PROFILE = 'profile',
    PEMINJAMAN_ITEM = 'peminjaman/item',
    PEMINJAMAN_RUANGAN = 'peminjaman/ruangan',
    BARANG = 'barang',
    RUANGAN = 'ruangan',
    DOCUMENTS = 'documents',
    TEMP = 'temp'
}

// File type configurations
const FILE_TYPE_CONFIG = {
    image: {
        allowedTypes: /jpeg|jpg|png|gif|webp/,
        mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        maxSize: 5 * 1024 * 1024, // 5MB
        extensions: ['.jpg', '.jpeg', '.png', '.webp']
    },
    document: {
        allowedTypes: /pdf|doc|docx|txt|xls|xlsx/,
        mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        maxSize: 10 * 1024 * 1024, // 10MB
        extensions: ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx']
    },
    any: {
        allowedTypes: /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|xls|xlsx/,
        mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        maxSize: 10 * 1024 * 1024, // 10MB
        extensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx']
    }
};

// Enhanced FileHandler class
export class FileHandler {
    // Create directory if it doesn't exist
    static ensureDirectoryExists(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`📁 Created directory: ${dirPath}`);
        }
    }

    // Get upload directory path for specific category
    static getUploadDir(category: UploadCategory): string {
        const uploadDir = path.join(baseStorageDir, 'uploads', category);
        this.ensureDirectoryExists(uploadDir);
        return uploadDir;
    }

    // Generate unique filename
    static generateFilename(originalName: string, prefix?: string): string {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const extension = path.extname(originalName).toLowerCase();
        const baseName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9]/g, '_');

        const prefixPart = prefix ? `${prefix}_` : '';
        return `${prefixPart}${baseName}_${timestamp}_${random}${extension}`;
    }

    // Create multer storage configuration for specific category
    static createStorage(category: UploadCategory, prefix?: string) {
        return multer.diskStorage({
            destination: (req: Request, file: Express.Multer.File, cb) => {
                const uploadDir = this.getUploadDir(category);
                cb(null, uploadDir);
            },
            filename: (req: Request, file: Express.Multer.File, cb) => {
                const filename = this.generateFilename(file.originalname, prefix);
                cb(null, filename);
            }
        });
    }

    // Create file filter for specific file types
    static createFileFilter(fileType: keyof typeof FILE_TYPE_CONFIG = 'any') {
        const config = FILE_TYPE_CONFIG[fileType];

        return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
            const extension = path.extname(file.originalname).toLowerCase();
            const isValidExtension = config.extensions.includes(extension);
            const isValidMimeType = config.mimeTypes.includes(file.mimetype);

            if (isValidExtension && isValidMimeType) {
                cb(null, true);
            } else {
                const allowedExts = config.extensions.join(', ');
                cb(new Error(`Invalid file type. Only ${allowedExts} files are allowed.`));
            }
        };
    }

    // Create multer upload middleware for specific category and file type
    static createUploadMiddleware(
        category: UploadCategory,
        fileType: keyof typeof FILE_TYPE_CONFIG = 'any',
        prefix?: string,
        maxFiles: number = 1,
        fieldName: string = 'file'  // Add custom field name parameter
    ) {
        const config = FILE_TYPE_CONFIG[fileType];
        const storage = this.createStorage(category, prefix);
        const fileFilter = this.createFileFilter(fileType);

        const uploadOptions: multer.Options = {
            storage,
            limits: {
                fileSize: config.maxSize,
                files: maxFiles
            },
            fileFilter
        };

        return maxFiles === 1
            ? multer(uploadOptions).single(fieldName)  // Use custom field name
            : multer(uploadOptions).array(fieldName, maxFiles);
    }

    // Delete file
    static async deleteFile(category: UploadCategory, filename: string): Promise<boolean> {
        try {
            const filePath = path.join(this.getUploadDir(category), filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️  Deleted file: ${filePath}`);
                return true;
            }
            console.warn(`⚠️  File not found: ${filePath}`);
            return false;
        } catch (error) {
            console.error('❌ Error deleting file:', error);
            return false;
        }
    }

    // Get full file path
    static getFilePath(category: UploadCategory, filename: string): string {
        return path.join(this.getUploadDir(category), filename);
    }

    // Check if file exists
    static fileExists(category: UploadCategory, filename: string): boolean {
        const filePath = this.getFilePath(category, filename);
        return fs.existsSync(filePath);
    }

    // Get file URL for serving
    static getFileUrl(category: UploadCategory, filename: string, baseUrl: string): string {
        return `${baseUrl}/storage/uploads/${category}/${filename}`;
    }

    // Get file info
    static getFileInfo(category: UploadCategory, filename: string) {
        const filePath = this.getFilePath(category, filename);

        if (!fs.existsSync(filePath)) {
            return null;
        }

        const stats = fs.statSync(filePath);
        const extension = path.extname(filename).toLowerCase();

        return {
            filename,
            path: filePath,
            size: stats.size,
            sizeFormatted: this.formatFileSize(stats.size),
            extension,
            mimeType: this.getMimeType(extension),
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            category
        };
    }

    // Format file size
    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Get MIME type from extension
    static getMimeType(extension: string): string {
        const mimeTypes: { [key: string]: string } = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.txt': 'text/plain',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };

        return mimeTypes[extension] || 'application/octet-stream';
    }

    // Move file from one category to another
    static async moveFile(
        fromCategory: UploadCategory,
        toCategory: UploadCategory,
        filename: string
    ): Promise<boolean> {
        try {
            const sourcePath = this.getFilePath(fromCategory, filename);
            const destPath = this.getFilePath(toCategory, filename);

            if (!fs.existsSync(sourcePath)) {
                console.warn(`⚠️  Source file not found: ${sourcePath}`);
                return false;
            }

            // Ensure destination directory exists
            this.ensureDirectoryExists(this.getUploadDir(toCategory));

            // Move file
            fs.renameSync(sourcePath, destPath);
            console.log(`📁 Moved file from ${fromCategory} to ${toCategory}: ${filename}`);
            return true;
        } catch (error) {
            console.error('❌ Error moving file:', error);
            return false;
        }
    }

    // Clean up old files (older than specified days)
    // static async cleanupOldFiles(category: UploadCategory, daysOld: number = 30): Promise<number> {
    //     try {
    //         const uploadDir = this.getUploadDir(category);
    //         const files = fs.readdirSync(uploadDir);
    //         const cutoffDate = new Date();
    //         cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    //         let deletedCount = 0;

    //         for (const file of files) {
    //             const filePath = path.join(uploadDir, file);
    //             const stats = fs.statSync(filePath);

    //             if (stats.birthtime < cutoffDate) {
    //                 fs.unlinkSync(filePath);
    //                 deletedCount++;
    //                 console.log(`🗑️  Cleaned up old file: ${file}`);
    //             }
    //         }

    //         console.log(`✅ Cleanup completed: ${deletedCount} files deleted from ${category}`);
    //         return deletedCount;
    //     } catch (error) {
    //         console.error('❌ Error during cleanup:', error);
    //         return 0;
    //     }
    // }

    // Get directory statistics
    static getDirectoryStats(category: UploadCategory) {
        try {
            const uploadDir = this.getUploadDir(category);
            const files = fs.readdirSync(uploadDir);

            let totalSize = 0;
            const filesByType: { [key: string]: number } = {};

            files.forEach(file => {
                const filePath = path.join(uploadDir, file);
                const stats = fs.statSync(filePath);
                const extension = path.extname(file).toLowerCase();

                totalSize += stats.size;
                filesByType[extension] = (filesByType[extension] || 0) + 1;
            });

            return {
                category,
                totalFiles: files.length,
                totalSize,
                totalSizeFormatted: this.formatFileSize(totalSize),
                filesByType,
                directory: uploadDir
            };
        } catch (error) {
            console.error('❌ Error getting directory stats:', error);
            return null;
        }
    }
}

// Update pre-configured middlewares
export const uploadMiddlewares = {
    // Profile uploads
    profileImage: FileHandler.createUploadMiddleware(UploadCategory.PROFILE, 'image', 'profile', 1, 'file'),
    
    // Barang uploads - support both 'file' and 'foto_barang'
    barangImage: FileHandler.createUploadMiddleware(UploadCategory.BARANG, 'image', 'barang', 1, 'file'),
    barangImageWithCustomField: FileHandler.createUploadMiddleware(UploadCategory.BARANG, 'image', 'barang', 1, 'foto_barang'),
    
    // Peminjaman uploads
    peminjamanItemDocument: FileHandler.createUploadMiddleware(UploadCategory.PEMINJAMAN_ITEM, 'document', 'doc', 1, 'file'),
    peminjamanRuanganDocument: FileHandler.createUploadMiddleware(UploadCategory.PEMINJAMAN_RUANGAN, 'document', 'doc', 1, 'file'),
    
    // Ruangan uploads
    ruanganImage: FileHandler.createUploadMiddleware(UploadCategory.RUANGAN, 'image', 'ruangan', 1, 'file'),
    
    // General uploads
    document: FileHandler.createUploadMiddleware(UploadCategory.DOCUMENTS, 'document', undefined, 1, 'file'),
    image: FileHandler.createUploadMiddleware(UploadCategory.DOCUMENTS, 'image', undefined, 1, 'file'),
    any: FileHandler.createUploadMiddleware(UploadCategory.DOCUMENTS, 'any', undefined, 1, 'file'),
    
    // Multiple files
    multipleImages: FileHandler.createUploadMiddleware(UploadCategory.DOCUMENTS, 'image', undefined, 5, 'files'),
    multipleDocuments: FileHandler.createUploadMiddleware(UploadCategory.DOCUMENTS, 'document', undefined, 5, 'files')
};

// Legacy support - keeping the original upload export
export const upload = FileHandler.createUploadMiddleware(UploadCategory.DOCUMENTS, 'any');

export default FileHandler;