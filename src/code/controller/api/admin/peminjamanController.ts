import expres from "express";
import { Request, Response } from "express";
import {PeminjamanRuangan } from "../../../models/peminjaman";
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

const PeminjamanRuangan = async (req: Request, res: Response) => {
  const { ruangan_id, user_id, tanggal, jam_mulai, jam_selesai, kegiatan, nim, matkul_id } = req.body;

  if (!ruangan_id || !user_id || !tanggal || !jam_mulai || !jam_selesai || !kegiatan || !nim || !matkul_id) {
    throw new AppError("All fields are required", 400);
  }

  const kodeProdi = nim.slice(2,4).toUpperCase();
  const prodi = await prisma.prodi.findFirst({ where: { kode_prodi: kodeProdi } });
  if (!prodi) throw new Error("Prodi tidak ditemukan");

  const matkulValid = await prisma.master_matkul.findFirst({
    where: { id: matkul_id, prod_id: prodi.id }
  });
  if (!matkulValid) throw new Error("Matkul tidak sesuai prodi");

  const peminjaman = await prisma.peminjaman_Ruangan.create({
    data: {
      ruangan_id,
      user_id,
      tanggal: new Date(tanggal),
      jam_mulai: new Date(jam_mulai),
      jam_selesai: new Date(jam_selesai),
      kegiatan,
      nim,
      status: "pending", 
      matkul_id
    }
  });

  res.json(peminjaman);
};

export const updatePeminjamanRuangan = async (req: Request, res: Response)=> {
  const {id} = req.params;
  const { status} = req.body;

  if(!status) throw new AppError("Status is required", 400);

  const allowedStatus = ["pending", "approved", "rejected", "completed"];
  if(!allowedStatus.includes(status)) throw new AppError("Invalid status value", 400);
  
  const update = await prisma.peminjaman_Ruangan.update({
    where: { id: Number(id) },
    data: { status }
  });

  res.json({
    message: "Peminjaman berhasil diupdate"
  })
};

export const getAllPeminjamanRuangan = async (req: Request, res: Response) => {
  res.status(200).send({
    message: "Get all peminjaman ruangan",
    status: "success",
  });
}