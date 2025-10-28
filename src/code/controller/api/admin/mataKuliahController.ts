import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { CreateMatkulRequest, UpdateMatkulRequest, MatkulResponse } from '../../../models/matkul';
import { AppError, asyncHandler } from '../../../middleware/error';

const prisma = new PrismaClient();

// Simple in-memory cache for mata kuliah
const matkulCache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL = 10 * 1000; // 10 detik

function setCache(key: string, data: any, ttl: number = CACHE_TTL) {
    matkulCache.set(key, { data, expiry: Date.now() + ttl });
}

function getCache(key: string) {
    const cached = matkulCache.get(key);
    if (!cached) return undefined;
    if (Date.now() > cached.expiry) {
        matkulCache.delete(key);
        return undefined;
    }
    return cached.data;
}

function clearMatkulCache() {
    matkulCache.clear();
}

// CREATE
const createMatkul = asyncHandler(async (req: Request, res: Response) => {
    const { prodi_id, matkul, semester }: CreateMatkulRequest = req.body;
    if (!prodi_id || !matkul) throw new AppError("prodi_id dan matkul wajib diisi", 400);

    const newMatkul = await prisma.master_Matkul.create({
        data: { prodi_id, matkul, semester: semester ?? 1 }
    });
    clearMatkulCache();
    res.status(201).json({ message: "Mata kuliah berhasil dibuat", data: newMatkul });
});
// READ ALL (with cache)
const getAllMatkul = asyncHandler(async (req: Request, res: Response) => {
    const { semester, prodi_id } = req.query;
    const cacheKey = `matkul_list_${semester ?? 'all'}_${prodi_id ?? 'all'}`;
    let matkulList = getCache(cacheKey);
    if (!matkulList) {
        matkulList = await prisma.master_Matkul.findMany({
            where: {
                deletedAt: null,
                ...(semester ? { semester: Number(semester) } : {}),
                ...(prodi_id ? { prodi_id: Number(prodi_id) } : {})
            },
            include: {
                prodi: {
                    select: {
                        id: true,
                        nama_prodi: true,
                        kode_prodi: true,
                        createdAt: true,
                        updatedAt: true,
                        deletedAt: true
                    }
                }
            }
        });
        setCache(cacheKey, matkulList);
    }
    res.status(200).json({ message: "List mata kuliah", data: matkulList });
});

// READ BY ID (with cache)
const getMatkulById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const cacheKey = `matkul_${id}`;
    let matkul = getCache(cacheKey);
    if (!matkul) {
        matkul = await prisma.master_Matkul.findUnique({
            where: { id: Number(id) },
            include: { prodi: true }
        });
        if (!matkul || matkul.deletedAt) throw new AppError("Mata kuliah tidak ditemukan", 404);
        setCache(cacheKey, matkul);
    }
    res.status(200).json({ message: "Detail mata kuliah", data: matkul });
});

// UPDATE
const updateMatkul = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { prodi_id, matkul, semester }: UpdateMatkulRequest = req.body;
    const existing = await prisma.master_Matkul.findUnique({ where: { id: Number(id) } });
    if (!existing || existing.deletedAt) throw new AppError("Mata kuliah tidak ditemukan", 404);

    const updated = await prisma.master_Matkul.update({
        where: { id: Number(id) },
        data: {
            prodi_id: prodi_id ?? existing.prodi_id,
            matkul: matkul ?? existing.matkul,
            semester: semester ?? existing.semester,
            updatedAt: new Date()
        }
    });
    clearMatkulCache();
    res.status(200).json({ message: "Mata kuliah berhasil diupdate", data: updated });
});

// DELETE (soft delete)
const deleteMatkul = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const existing = await prisma.master_Matkul.findUnique({ where: { id: Number(id) } });
    if (!existing || existing.deletedAt) throw new AppError("Mata kuliah tidak ditemukan", 404);

    await prisma.master_Matkul.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() }
    });
    clearMatkulCache();
    res.status(200).json({ message: "Mata kuliah berhasil dihapus" });
});

const MataKuliahController = {
    createMatkul,
    getAllMatkul,
    getMatkulById,
    updateMatkul,
    deleteMatkul
};

export default MataKuliahController;