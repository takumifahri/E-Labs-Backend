import { Request, Response } from "express";
import { CreateRuanganRequest, UpdateRuanganRequest } from "../../../models/Ruangan";
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { AppError, asyncHandler } from '../../../middleware/error';

const prisma = new PrismaClient({
  datasources: {
    db: {
        
      url: process.env.DATABASE_URL
    }
  }
}).$extends(withAccelerate());

const CreateRuangan = asyncHandler(async (req: Request, res: Response) => {
    const { gedung, nama_ruangan, kode_ruangan }: CreateRuanganRequest = req.body;

    if (!gedung || !nama_ruangan || !kode_ruangan) {
        throw new AppError("Gedung, nama ruangan, and kode ruangan are required", 400);
    }

    // Check if kode_ruangan already exists
    const existingRuangan = await prisma.ruangan.findUnique({
        where: { 
            kode_ruangan: kode_ruangan,
            deletedAt: null
        }
    });

    if (existingRuangan) {
        throw new AppError(`Ruangan with code '${kode_ruangan}' already exists`, 409);
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
});

const GetRuanganMaster = asyncHandler(async (req: Request, res: Response) => {
    const { gedung, nama_ruangan, kode_ruangan } = req.query;
    
    const whereCondition: any = {
        deletedAt: null
    };
    
    if (gedung) whereCondition.gedung = gedung;
    if (nama_ruangan) whereCondition.nama_ruangan = { contains: nama_ruangan as string };
    if (kode_ruangan) whereCondition.kode_ruangan = kode_ruangan;

    const getRuangan = await prisma.ruangan.findMany({
        where: whereCondition,
        orderBy: { createdAt: 'desc' },
        cacheStrategy: {
            ttl: 300,
            tags: ['ruangan', 'ruangan_list', gedung ? `ruangan_${gedung}` : ''].filter(Boolean)
        }
    });

    return res.status(200).json({
        message: "Ruangan retrieved successfully",
        data: getRuangan,
        count: getRuangan.length
    });
});

const GetRuanganById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
        throw new AppError("Valid ruangan ID is required", 400);
    }

    const ruangan = await prisma.ruangan.findUnique({
        where: { 
            id: parseInt(id),
            deletedAt: null 
        },
        cacheStrategy: {
            ttl: 600,
            tags: ['ruangan', `ruangan_${id}`]
        }
    });

    if (!ruangan) {
        throw new AppError("Ruangan not found", 404);
    }

    return res.status(200).json({
        message: "Ruangan retrieved successfully",
        data: ruangan
    });
});

const UpdateRuangan = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { gedung, nama_ruangan, kode_ruangan }: UpdateRuanganRequest = req.body;
    
    if (!id || isNaN(parseInt(id))) {
        throw new AppError("Valid ruangan ID is required", 400);
    }

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
});

const DeleteRuangan = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
        throw new AppError("Valid ruangan ID is required", 400);
    }

    const deletedRuangan = await prisma.ruangan.update({
        where: { id: parseInt(id) },
        data: {
            deletedAt: new Date()
        }
    });

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
});

const WarmRuanganCache = asyncHandler(async (req: Request, res: Response) => {
    await prisma.ruangan.findMany({
        cacheStrategy: {
            ttl: 3600,
            tags: ['ruangan', 'ruangan_list']
        }
    });

    const buildings = await prisma.ruangan.groupBy({
        by: ['gedung'],
        where: { deletedAt: null },
        cacheStrategy: {
            ttl: 1800,
            tags: ['ruangan', 'buildings']
        }
    });

    return res.status(200).json({
        message: "Cache warmed successfully",
        cachedBuildings: buildings.length
    });
});

const RuanganController = {
    CreateRuangan,
    GetRuanganMaster,
    GetRuanganById,
    UpdateRuangan,
    DeleteRuangan,
    WarmRuanganCache
}

export default RuanganController;