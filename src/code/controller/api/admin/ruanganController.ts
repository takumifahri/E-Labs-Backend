import { Request, Response } from "express";
import { CreateRuanganRequest, Ruangan, UpdateRuanganRequest } from "../../../models/Ruangan";
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL // Accelerate connection string
    }
  }
}).$extends(withAccelerate());

const CreateRuangan = async (req: Request, res: Response) => {
    const { gedung, nama_ruangan, kode_ruangan }: CreateRuanganRequest = req.body;
    try {
        // Check if kode_ruangan already exists
        const existingRuangan = await prisma.ruangan.findUnique({
            where: { 
                kode_ruangan: kode_ruangan,
                deletedAt: null // Only check non-deleted records
            }
        });

        if (existingRuangan) {
            return res.status(409).json({
                message: "Kode ruangan already exists",
                error: `Ruangan with code '${kode_ruangan}' already exists`
            });
        }

        const addRuangan = await prisma.ruangan.create({
            data: {
                gedung,
                nama_ruangan,
                kode_ruangan,
                createdAt: new Date(),
            }
        });

        // Invalidate related cache after creation
        await prisma.$accelerate.invalidate({
            tags: ['ruangan', `ruangan_${gedung}`, 'ruangan_list']
        });

        return res.status(201).json({
            message: "Ruangan created successfully",
            data: addRuangan
        });
    } catch (error) {
        console.error("Error creating ruangan:", error);
        
        // Handle Prisma unique constraint error
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return res.status(409).json({
                message: "Duplicate data",
                error: "Kode ruangan already exists"
            });
        }
        
        return res.status(500).json({ error: "Internal server error" });
    }
}

const GetRuanganMaster = async (req: Request, res: Response) => {
    const { gedung, nama_ruangan, kode_ruangan } = req.query;
    
    try {
        // Build where condition
        const whereCondition: any = {
            deletedAt: null
        };
        
        if (gedung) whereCondition.gedung = gedung;
        if (nama_ruangan) whereCondition.nama_ruangan = { contains: nama_ruangan as string };
        if (kode_ruangan) whereCondition.kode_ruangan = kode_ruangan;

        // Use Prisma Accelerate caching with tags
        const getRuangan = await prisma.ruangan.findMany({
            where: whereCondition,
            orderBy: { createdAt: 'desc' },
            cacheStrategy: {
                ttl: 300, // Cache for 5 minutes
                tags: ['ruangan', 'ruangan_list', gedung ? `ruangan_${gedung}` : ''].filter(Boolean)
            }
        });
        
        if (getRuangan.length === 0) {
            return res.status(404).json({ 
                message: "No ruangan found",
                data: []
            });
        }

        return res.status(200).json({
            message: "Ruangan retrieved successfully",
            data: getRuangan,
            count: getRuangan.length
        });
    } catch (error) {
        console.error("Error retrieving ruangan:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const GetRuanganById = async (req: Request, res: Response) => {
    const { id } = req.params;
    
    try {
        const ruangan = await prisma.ruangan.findUnique({
            where: { 
                id: parseInt(id),
                deletedAt: null 
            },
            cacheStrategy: {
                ttl: 600, // Cache for 10 minutes
                tags: ['ruangan', `ruangan_${id}`]
            }
        });

        if (!ruangan) {
            return res.status(404).json({ message: "Ruangan not found" });
        }

        return res.status(200).json({
            message: "Ruangan retrieved successfully",
            data: ruangan
        });
    } catch (error) {
        console.error("Error retrieving ruangan:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const UpdateRuangan = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { gedung, nama_ruangan, kode_ruangan }: UpdateRuanganRequest = req.body;
    
    try {
        const updatedRuangan = await prisma.ruangan.update({
            where: { id: parseInt(id) },
            data: {
                gedung,
                nama_ruangan,
                kode_ruangan,
                updatedAt: new Date()
            }
        });

        // Invalidate specific and related cache
        await prisma.$accelerate.invalidate({
            tags: [
                'ruangan', 
                `ruangan_${id}`, 
                'ruangan_list',
                `ruangan_${gedung}`,
                updatedRuangan.gedung !== gedung ? `ruangan_${updatedRuangan.gedung}` : ''
            ].filter(Boolean)
        });

        return res.status(200).json({
            message: "Ruangan updated successfully",
            data: updatedRuangan
        });
    } catch (error) {
        console.error("Error updating ruangan:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const DeleteRuangan = async (req: Request, res: Response) => {
    const { id } = req.params;
    
    try {
        // Soft delete
        const deletedRuangan = await prisma.ruangan.update({
            where: { id: parseInt(id) },
            data: {
                deletedAt: new Date()
            }
        });

        // Invalidate all related cache
        await prisma.$accelerate.invalidate({
            tags: [
                'ruangan', 
                `ruangan_${id}`, 
                'ruangan_list',
                `ruangan_${deletedRuangan.gedung}`
            ]
        });

        return res.status(200).json({
            message: "Ruangan deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting ruangan:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const WarmRuanganCache = async (req: Request, res: Response) => {
    try {
        // Pre-load commonly accessed data
        await prisma.ruangan.findMany({
            cacheStrategy: {
                ttl: 3600, // Cache for 1 hour
                tags: ['ruangan', 'ruangan_list']
            }
        });

        // Get unique buildings and cache them
        const buildings = await prisma.ruangan.groupBy({
            by: ['gedung'],
            where: { deletedAt: null },
            cacheStrategy: {
                ttl: 1800, // Cache for 30 minutes
                tags: ['ruangan', 'buildings']
            }
        });

        return res.status(200).json({
            message: "Cache warmed successfully",
            cachedBuildings: buildings.length
        });
    } catch (error) {
        console.error("Error warming cache:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const RuanganController = {
    CreateRuangan,
    GetRuanganMaster,
    GetRuanganById,
    UpdateRuangan,
    DeleteRuangan,
    WarmRuanganCache
}

export default RuanganController;