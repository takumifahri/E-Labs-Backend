import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MasterProdi, CreateProdiRequest, UpdateProdiRequest } from '../../../models/prodi';
import { AppError, asyncHandler } from '../../../middleware/error';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});
// Simple in-memory cache for prodi
const prodiCache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL = Math.floor(Math.random() * 6 + 10) * 1000; // 10-15 detik

function setCache(key: string, data: any, ttl: number = CACHE_TTL) {
    prodiCache.set(key, { data, expiry: Date.now() + ttl });
}

function getCache(key: string) {
    const cached = prodiCache.get(key);
    if (!cached) return undefined;
    if (Date.now() > cached.expiry) {
        prodiCache.delete(key);
        return undefined;
    }
    return cached.data;
}

function clearProdiCache() {
    prodiCache.clear();
}

// CREATE
const createProdi = asyncHandler(async (req: Request, res: Response) => {
    const { nama_prodi, kode_prodi }: CreateProdiRequest = req.body;
    if (!nama_prodi || !kode_prodi) throw new AppError("nama_prodi dan kode_prodi wajib diisi", 400);

    const newProdi = await prisma.masterProdi.create({
        data: { nama_prodi, kode_prodi }
    });
    clearProdiCache();
    res.status(201).json({ message: "Prodi berhasil dibuat", data: newProdi });
});

// READ ALL (with cache)
const getAllProdi = asyncHandler(async (req: Request, res: Response) => {
    const cacheKey = `prodi_list`;
    let prodiList = getCache(cacheKey);
    if (!prodiList) {
        prodiList = await prisma.masterProdi.findMany({
            where: { deletedAt: null },
            include: {
                matkul: {
                    where: { deletedAt: null }
                }
            }
        });
        setCache(cacheKey, prodiList);
    }
    res.status(200).json({ message: "List prodi", data: prodiList });
});

// READ BY ID (with cache)
const getProdiById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const cacheKey = `prodi_${id}`;
    let prodi = getCache(cacheKey);
    if (!prodi) {
        prodi = await prisma.masterProdi.findUnique({
            where: { id: Number(id) },
            include: {
                matkul: {
                    where: { deletedAt: null }
                }
            }
        });
        if (!prodi || prodi.deletedAt) throw new AppError("Prodi tidak ditemukan", 404);
        setCache(cacheKey, prodi);
    }
    res.status(200).json({ message: "Detail prodi", data: prodi });
});

// UPDATE
const updateProdi = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nama_prodi, kode_prodi }: UpdateProdiRequest = req.body;
    const existing = await prisma.masterProdi.findUnique({ where: { id: Number(id) } });
    if (!existing || existing.deletedAt) throw new AppError("Prodi tidak ditemukan", 404);

    const updated = await prisma.masterProdi.update({
        where: { id: Number(id) },
        data: {
            nama_prodi: nama_prodi ?? existing.nama_prodi,
            kode_prodi: kode_prodi ?? existing.kode_prodi,
            updatedAt: new Date()
        }
    });
    clearProdiCache();
    res.status(200).json({ message: "Prodi berhasil diupdate", data: updated });
});

// DELETE (soft delete)
const deleteProdi = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const existing = await prisma.masterProdi.findUnique({ where: { id: Number(id) } });
    if (!existing || existing.deletedAt) throw new AppError("Prodi tidak ditemukan", 404);

    await prisma.masterProdi.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() }
    });
    clearProdiCache();
    res.status(200).json({ message: "Prodi berhasil dihapus" });
});

const ProdiController = {
    createProdi,
    getAllProdi,
    getProdiById,
    updateProdi,
    deleteProdi
};

export default ProdiController;
